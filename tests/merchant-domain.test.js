const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../public/assets/merchant-domain');
function fixture() {
  const s=D.initial();
  s.customers=[{id:'c',name:'测试客户',restrictions:[],allergies:[]}];
  s.dishes=[{id:'rice',name:'熟米饭',ingredients:['大米'],nutrition:{source:'manual',basis:'cooked',kcal100:100,reference:'测试'},defaultGrams:120}];
  s.orders=[{id:'o',customerId:'c',startDate:'2026-10-08',endDate:'2026-10-10',status:'服务中',credits:2,portions:1,meals:['lunch'],weekdays:[0,1,2,3,4,5,6]}];
  s.menus['2026-10-08:lunch']=[{dishId:'rice',grams:120}];
  return s;
}
test('legacy values are unverified, not converted into Boohee data or zero calories',()=>{
  const s=D.initial({dishes:[{id:'x',name:'米饭',kcal100:116,source:'薄荷'}]});
  assert.equal(s.dishes[0].nutrition.source,'legacy');
  assert.equal(D.nutrition(s,[{dishId:'x',grams:100}]).kcal,null);
});
test('deleted legacy dish references are preserved as unverified placeholders',()=>{
  const s=D.initial({recipes:[{date:'2026-10-08',meals:{lunch:{categories:{'主食':'removed'}}}}]});
  assert.equal(s.dishes[0].id,'removed');assert.equal(s.dishes[0].nutrition.kcal100,null);D.validate(s);
});
test('calculation requires all dishes and compatible weight basis',()=>{
  const s=fixture();assert.equal(D.nutrition(s,[{dishId:'rice',grams:150}]).kcal,150);
  assert.equal(D.nutrition(s,[{dishId:'rice',grams:150},{dishId:'unknown',grams:100}]).complete,false);
  s.dishes[0].nutrition.basis='raw';assert.equal(D.nutrition(s,[{dishId:'rice',grams:150}]).kcal,null);
});
test('sync is idempotent and keeps individual changes',()=>{
  const s=fixture();D.sync(s,'2026-10-08','lunch');D.sync(s,'2026-10-08','lunch');assert.equal(s.boxes.length,1);
  s.boxes[0].custom=true;s.boxes[0].items[0].grams=80;
  s.menus['2026-10-08:lunch'][0].grams=200;D.sync(s,'2026-10-08','lunch');assert.equal(s.boxes[0].items[0].grams,80);
});
test('print and pause do not consume credits, completion consumes once',()=>{
  const s=fixture();D.sync(s,'2026-10-08','lunch');const b=s.boxes[0];
  b.exportedVersion=b.version;assert.equal(D.remaining(s,s.orders[0]),2);
  b.status='paused';D.finish(s,[b.id]);assert.equal(D.remaining(s,s.orders[0]),2);
  b.status='pending';D.finish(s,[b.id]);D.finish(s,[b.id]);assert.equal(D.remaining(s,s.orders[0]),1);
});
test('completed nutrition stays unchanged when dish data changes',()=>{
  const s=fixture();D.sync(s,'2026-10-08','lunch');D.finish(s,[s.boxes[0].id]);
  s.dishes[0].nutrition.kcal100=300;assert.equal(D.nutrition(s,s.boxes[0].items).kcal,120);
  s.customers[0].name='新称呼';s.settings.name='新店名';assert.equal(s.boxes[0].customerSnapshot.name,'测试客户');assert.equal(s.boxes[0].settingsSnapshot.name,'我的健康小饭桌');
  s.menus['2026-10-08:lunch'][0].grams=250;D.sync(s,'2026-10-08','lunch');assert.equal(s.boxes[0].items[0].grams,120);
});
test('changed pending box has a different label version',()=>{
  const s=fixture();D.sync(s,'2026-10-08','lunch');const b=s.boxes[0];b.exportedVersion=b.version;
  s.menus['2026-10-08:lunch'][0].grams=180;D.sync(s,'2026-10-08','lunch');assert.notEqual(b.exportedVersion,b.version);
});
test('insufficient credits reject entire completion batch',()=>{
  const s=fixture();D.sync(s,'2026-10-08','lunch');D.sync(s,'2026-10-09','lunch');
  s.boxes[1].items=D.copy(s.boxes[0].items);s.orders[0].credits=1;
  assert.throws(()=>D.finish(s,s.boxes.map(b=>b.id)),/剩余餐次不足/);assert.ok(s.boxes.every(b=>b.status==='pending'));
});
test('dietary conflicts and missing ingredient information require review',()=>{
  const s=fixture();s.customers[0].allergies=['大米'];D.sync(s,'2026-10-08','lunch');assert.throws(()=>D.finish(s,[s.boxes[0].id]),/忌口/);
  s.dishes[0].ingredients=[];assert.equal(D.checks(s,s.boxes[0]).unknown,true);
});
test('single customer multi-box orders get distinct stable IDs',()=>{
  const s=fixture();s.orders[0].portions=2;D.sync(s,'2026-10-08','lunch');assert.equal(s.boxes.length,2);assert.notEqual(s.boxes[0].id,s.boxes[1].id);
});
test('invalid grams and missing manual provenance cannot be persisted',()=>{
  const s=fixture();D.validate(s);s.menus['2026-10-08:lunch'][0].grams=0;assert.throws(()=>D.validate(s),/克重/);
  s.menus['2026-10-08:lunch'][0].grams=120;s.dishes[0].nutrition.reference='';assert.throws(()=>D.validate(s),/依据/);
});
