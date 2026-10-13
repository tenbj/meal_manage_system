const {identity}=require('../src/identity');
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const D=require('../public/assets/merchant-domain'),{createMerchantRouter}=require('../src/merchant');
test('food search is local first; confirmed provider imports persist and deduplicate across restart',async()=>{
  const mysqlOrder=value=>Array.isArray(value)?value.map(mysqlOrder):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort((a,b)=>a.length-b.length||a.localeCompare(b)).map(k=>[k,mysqlOrder(value[k])])):value;
  let record={revision:1,payload:JSON.stringify(D.initial())},searches=0,details=0;
  const pool={query:async(sql,args)=>{
    if(sql.startsWith('CREATE'))return [{}];if(sql.startsWith('SELECT id'))return [[{id:1}]];if(sql.startsWith('SELECT revision'))return [[structuredClone(record)]];
    if(sql.startsWith('UPDATE')){if(args[1]!==record.revision)return [{affectedRows:0}];record={revision:record.revision+1,payload:JSON.stringify(mysqlOrder(JSON.parse(args[0])))};return [{affectedRows:1}];}throw new Error(sql);
  }};
  const boohee={status:async()=>({configured:true}),search:async()=>{searches++;return {foods:[{code:'rice',name:'熟米饭',kcal100:116}],hasMore:false};},detail:async()=>{details++;return {code:'rice',name:'熟米饭',kcal100:116,ingredients:['大米']};}};
  const app=express();app.use(express.json());app.use((req,res,next)=>{if(req.get('origin') && req.get('origin')!=='http://'+req.get('host'))return res.sendStatus(403);req.access='write';identity.run({id:1},next);});app.use('/api/merchant',createMerchantRouter({}, {getPool:()=>pool,boohee}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api/merchant`;
  const post=(path,body,method='POST')=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    assert.equal((await fetch(base+'/nutrition/search?q=米饭').then(r=>r.json())).source,'boohee');assert.equal(searches,1);
    const body={code:'rice',category:'主食',basis:'cooked',confirmed:true,revision:1};
    assert.equal((await post('/nutrition/import',{...body,confirmed:false})).status,422);
    const saved=await post('/nutrition/import',body).then(r=>r.json());assert.equal(saved.state.dishes[0].nutrition.source,'boohee');assert.equal(saved.revision,2);assert.equal(saved.dish.ingredientsSource,'boohee');
    assert.equal((await fetch(base+'/nutrition/search?q=米饭').then(r=>r.json())).source,'local');assert.equal(searches,1);
    assert.equal((await post('/nutrition/import',{...body,revision:2}).then(r=>r.json())).existing,true);assert.equal(details,1);
    saved.state.menus[D.today()+':lunch']=[{dishId:saved.dish.id,grams:180}];
    assert.equal((await post('',saved,'PUT')).status,200,'selecting an immediately imported dish must survive MySQL key reordering');
    const get=await fetch(base).then(r=>r.json());assert.equal(get.state.dishes.length,1);assert.equal(get.state.dishes[0].nutrition.kcal100,116);
    assert.equal((await post('',get,'PUT')).status,200);
    for(const [field,value] of [['kcal100',5],['providerCode','forged'],['basis','ready'],['reference','rewritten']]){const tampered=await fetch(base).then(r=>r.json());tampered.state.dishes[0].nutrition[field]=value;assert.equal((await post('',tampered,'PUT')).status,422);}
    const edited=await fetch(base).then(r=>r.json());edited.state.dishes[0].category='素';edited.state.dishes[0].defaultGrams=120;assert.equal((await post('',edited,'PUT')).status,200);
    const reviewed=await fetch(base).then(r=>r.json());D.setDietaryReview(reviewed.state,'boohee:rice','花生',false);assert.equal((await post('',reviewed,'PUT')).status,200);
    const recalled=await fetch(base).then(r=>r.json());assert.equal(D.activeDietaryReviews(recalled.state.dishes[0])[0].contains,false);assert.equal(recalled.state.dishes[0].nutrition.source,'boohee');assert.equal(recalled.state.dishes[0].nutrition.kcal100,116);
    assert.equal((await post('/nutrition/import',body)).status,409);
    assert.equal((await fetch(base+'/nutrition/search?q=米饭&remote=1').then(r=>r.json())).source,'boohee');assert.equal(searches,2);
    const ledger=await fetch(base).then(r=>r.json());ledger.state.customers.push({id:'c',name:'账本测试'});
    ledger.state.orders.push({id:'o',kind:'plan',customerId:'c',status:'服务中',startDate:D.today(),endDate:D.today(),credits:2,portions:1,meals:['lunch'],weekdays:[0,1,2,3,4,5,6]});
    D.addDiner(ledger.state,'c',D.today(),'lunch',p=>p+'-test');assert.equal((await post('',ledger,'PUT')).status,200);
    const purchase=await fetch(base).then(r=>r.json());purchase.state.orders[0].credits=5;assert.equal((await post('',purchase,'PUT')).status,422);
    const removed=await fetch(base).then(r=>r.json());removed.state.boxes=[];assert.equal((await post('',removed,'PUT')).status,422);
    const adjustment=await fetch(base).then(r=>r.json());D.adjustBalance(adjustment.state,'o',3,'赠餐','adjust');assert.equal((await post('',adjustment,'PUT')).status,200);
    const repeated=await fetch(base).then(r=>r.json());assert.equal((await post('',repeated,'PUT')).status,200,'unchanged credit adjustment objects can reorder');
    D.cancelBox(repeated.state,repeated.state.boxes[0].id,false,'取消测试');repeated.revision++;assert.equal((await post('',repeated,'PUT')).status,200);
    repeated.revision++;assert.equal((await post('',repeated,'PUT')).status,200,'unchanged cancellation event objects can reorder');
    const rewrite=await fetch(base).then(r=>r.json());rewrite.state.creditAdjustments=[];assert.equal((await post('',rewrite,'PUT')).status,422);
  }finally{await new Promise(r=>server.close(r));}
});
