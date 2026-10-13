const {identity}=require('../src/identity');
const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createMerchantRouter}=require('../src/merchant');
const D=require('../public/assets/merchant-domain');
const {createBoohee}=require('../src/boohee');

test('merchant API persists revisions, rejects stale writes and unconfigured source claims',async()=>{
  let record={revision:1,payload:JSON.stringify(D.initial())};
  const pool={query:async(sql,args)=>{
    if(sql.startsWith('CREATE'))return [{}];
    if(sql.startsWith('SELECT id'))return [record?[{id:1}]:[]];
    if(sql.startsWith('INSERT')){if(!record)record={revision:1,payload:args[0]};return [{}];}
    if(sql.startsWith('SELECT revision'))return [[structuredClone(record)]];
    if(sql.startsWith('UPDATE')){if(record.revision!==args[1])return [{affectedRows:0}];record={revision:record.revision+1,payload:args[0]};return [{affectedRows:1}];}
    throw new Error(`Unexpected SQL: ${sql}`);
  }};
  const app=express();app.use(express.json());app.use((req,res,next)=>{if(req.get('origin') && req.get('origin')!=='http://'+req.get('host'))return res.sendStatus(403);req.access='write';identity.run({id:1},next);});app.use('/api/merchant',createMerchantRouter({readState:async()=>({})},{getPool:()=>pool,boohee:createBoohee({readKey:async()=>''})}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/merchant`;
  try{
    const first=await fetch(url).then(r=>r.json());assert.equal(first.revision,1);
    first.state.settings.name='保存测试';
    const put=body=>fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await put(first)).status,200);
    const saved=await fetch(url).then(r=>r.json());assert.equal(saved.state.settings.name,'保存测试');assert.equal(saved.revision,2);
    first.state.settings.name='过期内容';assert.equal((await put(first)).status,409);
    assert.equal((await fetch(url).then(r=>r.json())).state.settings.name,'保存测试');
    // An out-of-range draft may be edited, but cannot be printed or completed through the API.
    const draft=D.copy(saved);draft.state.customers=[{id:'c',name:'隔离测试',fulfillment:'pickup'}];
    draft.state.dishes=[{id:'meal',name:'测试菜',category:'素',ingredients:[],nutrition:{source:'manual',basis:'cooked',kcal100:100,reference:'隔离测试'}}];
    draft.state.orders=[{id:'order',customerId:'c',credits:1,portions:1,startDate:'2026-10-12',endDate:'2026-10-12',meals:['lunch'],weekdays:[1]}];
    draft.state.boxes=[{id:'box',customerId:'c',orderId:'order',date:'2026-10-12',meal:'lunch',status:'pending',portionMode:'manual',items:[{dishId:'meal',grams:677}],version:1,exportedVersion:0}];
    assert.equal((await put(draft)).status,200);const unsafe=await fetch(url).then(r=>r.json());
    const print=D.copy(unsafe);print.state.boxes[0].exportedVersion=print.state.boxes[0].version;assert.equal((await put(print)).status,422);
    const complete=D.copy(unsafe);complete.state.boxes[0].status='completed';assert.equal((await put(complete)).status,422);
    assert.equal((await fetch(url).then(r=>r.json())).state.boxes[0].status,'pending');
    // Keep the other validation cases on the latest revision and immutable records.
    Object.assign(saved,await fetch(url).then(r=>r.json()));
    const fabricated=D.copy(saved);fabricated.state.dishes.push({id:'fake',name:'伪造条目',nutrition:{source:'boohee',basis:'cooked',kcal100:100}});
    assert.equal((await put(fabricated)).status,422);
    const invalid=D.copy(saved);invalid.state.settings.labelWidth=-1;assert.equal((await put(invalid)).status,422);
    const incomplete=D.copy(saved);incomplete.state.dishes.push({id:'empty',name:'无热量新菜',nutrition:{source:'legacy',kcal100:null,basis:'cooked'}});incomplete.state.menus['2026-10-12:lunch']=[{dishId:'empty',grams:150}];
    assert.equal((await put(incomplete)).status,422);assert.equal((await fetch(url).then(r=>r.json())).state.dishes.length,1);
    assert.equal((await fetch(`${url}/nutrition/status`).then(r=>r.json())).configured,false);
    assert.equal((await fetch(`${url}/nutrition/search?q=米饭`)).status,503);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('connection endpoints preserve provider diagnostics and block requests from unrelated origins',async()=>{
  let calls=0;const boohee={check:async()=>{calls++;throw Object.assign(new Error('薄荷返回：接口未开通'),{status:502,kind:'provider',httpStatus:200,providerCode:1042});},connect:async()=>{calls++;return {configured:true,verified:true};}};
  const app=express();app.use(express.json());app.use((req,res,next)=>{if(req.get('origin') && req.get('origin')!=='http://'+req.get('host'))return res.sendStatus(403);req.access='write';identity.run({id:1},next);});app.use('/api/merchant',createMerchantRouter({}, {boohee}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    const response=await fetch(origin+'/api/merchant/nutrition/check',{method:'POST',headers:{Origin:origin}});assert.equal(response.status,502);
    const data=await response.json();assert.equal(data.providerCode,1042);assert.equal(data.httpStatus,200);assert.equal(data.kind,'provider');assert.match(data.message,/接口未开通/);
    for(const action of ['connect','check'])assert.equal((await fetch(origin+'/api/merchant/nutrition/'+action,{method:'POST',headers:{Origin:'https://unrelated.example','Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal(calls,1);
  }finally{await new Promise(r=>server.close(r));}
});
