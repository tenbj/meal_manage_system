const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const D=require('../public/assets/merchant-domain'),{createMerchantRouter}=require('../src/merchant');
test('food search is local first; confirmed provider imports persist and deduplicate across restart',async()=>{
  let record={revision:1,payload:JSON.stringify(D.initial())},searches=0,details=0;
  const pool={query:async(sql,args)=>{
    if(sql.startsWith('CREATE'))return [{}];if(sql.startsWith('SELECT id'))return [[{id:1}]];if(sql.startsWith('SELECT revision'))return [[structuredClone(record)]];
    if(sql.startsWith('UPDATE')){if(args[1]!==record.revision)return [{affectedRows:0}];record={revision:record.revision+1,payload:args[0]};return [{affectedRows:1}];}throw new Error(sql);
  }};
  const boohee={status:async()=>({configured:true}),search:async()=>{searches++;return {foods:[{code:'rice',name:'熟米饭',kcal100:116}],hasMore:false};},detail:async()=>{details++;return {code:'rice',name:'熟米饭',kcal100:116,ingredients:['大米']};}};
  const app=express();app.use(express.json());app.use('/api/merchant',createMerchantRouter({}, {getPool:()=>pool,boohee}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api/merchant`;
  const post=(path,body,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    assert.equal((await fetch(base+'/nutrition/search?q=米饭').then(r=>r.json())).source,'boohee');assert.equal(searches,1);
    const body={code:'rice',category:'主食',basis:'cooked',confirmed:true,revision:1};
    assert.equal((await post('/nutrition/import',{...body,confirmed:false})).status,422);
    const saved=await post('/nutrition/import',body).then(r=>r.json());assert.equal(saved.state.dishes[0].nutrition.source,'boohee');assert.equal(saved.revision,2);
    assert.equal((await fetch(base+'/nutrition/search?q=米饭').then(r=>r.json())).source,'local');assert.equal(searches,1);
    assert.equal((await post('/nutrition/import',{...body,revision:2}).then(r=>r.json())).existing,true);assert.equal(details,1);
    const get=await fetch(base).then(r=>r.json());assert.equal(get.state.dishes.length,1);assert.equal(get.state.dishes[0].nutrition.kcal100,116);
    assert.equal((await post('',get,'PUT')).status,200);
    const tampered=await fetch(base).then(r=>r.json());tampered.state.dishes[0].nutrition.kcal100=5;assert.equal((await post('',tampered,'PUT')).status,422);
    assert.equal((await post('/nutrition/import',body)).status,409);
    assert.equal((await fetch(base+'/nutrition/search?q=米饭&remote=1').then(r=>r.json())).source,'boohee');assert.equal(searches,2);
    const ledger=await fetch(base).then(r=>r.json());ledger.state.customers.push({id:'c',name:'账本测试'});
    ledger.state.orders.push({id:'o',kind:'plan',customerId:'c',status:'服务中',startDate:D.today(),endDate:D.today(),credits:2,portions:1,meals:['lunch'],weekdays:[0,1,2,3,4,5,6]});
    D.addDiner(ledger.state,'c',D.today(),'lunch',p=>p+'-test');assert.equal((await post('',ledger,'PUT')).status,200);
    const purchase=await fetch(base).then(r=>r.json());purchase.state.orders[0].credits=5;assert.equal((await post('',purchase,'PUT')).status,422);
    const removed=await fetch(base).then(r=>r.json());removed.state.boxes=[];assert.equal((await post('',removed,'PUT')).status,422);
    const adjustment=await fetch(base).then(r=>r.json());D.adjustBalance(adjustment.state,'o',3,'赠餐','adjust');assert.equal((await post('',adjustment,'PUT')).status,200);
    const rewrite=await fetch(base).then(r=>r.json());rewrite.state.creditAdjustments=[];assert.equal((await post('',rewrite,'PUT')).status,422);
  }finally{await new Promise(r=>server.close(r));}
});
