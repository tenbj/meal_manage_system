const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../public/assets/merchant-domain');
function fixture() {
  const s=D.initial();s.rosterMode='legacy-auto';
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
  s.dishes[0].nutrition.kcal100=300;assert.equal(D.nutrition(s,s.boxes[0].items).kcal,500);
  s.customers[0].name='新称呼';s.settings.name='新店名';assert.equal(s.boxes[0].customerSnapshot.name,'测试客户');assert.equal(s.boxes[0].settingsSnapshot.name,'我的健康小饭桌');
  s.menus['2026-10-08:lunch'][0].grams=250;D.sync(s,'2026-10-08','lunch');assert.equal(s.boxes[0].items[0].grams,500);
});
test('changed pending box has a different label version',()=>{
  const s=fixture();D.sync(s,'2026-10-08','lunch');const b=s.boxes[0];b.exportedVersion=b.version;
  D.setBoxItems(s,b,[{dishId:'rice',grams:450}]);assert.notEqual(b.exportedVersion,b.version);
});
test('insufficient credits reject entire completion batch',()=>{
  const s=fixture();s.menus['2026-10-09:lunch']=D.copy(s.menus['2026-10-08:lunch']);D.sync(s,'2026-10-08','lunch');D.sync(s,'2026-10-09','lunch');
  s.boxes[1].items=D.copy(s.boxes[0].items);s.orders[0].credits=1;
  assert.throws(()=>D.finish(s,s.boxes.map(b=>b.id)),/剩余餐次不足/);assert.ok(s.boxes.every(b=>b.status==='pending'));
});
test('dietary conflicts and missing ingredient information require review',()=>{
  const s=fixture();s.customers[0].allergies=['大米'];D.sync(s,'2026-10-08','lunch');assert.throws(()=>D.finish(s,[s.boxes[0].id]),/忌口/);
  s.dishes[0].ingredients=[];assert.equal(D.checks(s,s.boxes[0]).conflicts.length,1);s.customers[0].allergies=['花生'];assert.equal(D.checks(s,s.boxes[0]).unknown,true);
});
test('single customer multi-box orders get distinct stable IDs',()=>{
  const s=fixture();s.orders[0].portions=2;D.sync(s,'2026-10-08','lunch');assert.equal(s.boxes.length,2);assert.notEqual(s.boxes[0].id,s.boxes[1].id);
});
test('invalid grams and missing manual provenance cannot be persisted',()=>{
  const s=fixture();D.validate(s);s.menus['2026-10-08:lunch'][0].grams=0;assert.throws(()=>D.validate(s),/克重/);
  s.menus['2026-10-08:lunch'][0].grams=120;s.dishes[0].nutrition.reference='';assert.throws(()=>D.validate(s),/依据/);
});

function preparationFixture() {
  const s=fixture();s.customers[0].fulfillment='delivery';s.customers[0].address='测试地址 1 号';
  s.dishes.push({id:'beef',name:'牛肉',category:'荤',ingredients:['牛肉'],nutrition:{source:'manual',basis:'cooked',kcal100:180,reference:'测试'},defaultGrams:150});
  s.dishes.push({id:'fish',name:'清蒸鱼',category:'海鲜',ingredients:['鱼'],nutrition:{source:'manual',basis:'cooked',kcal100:120,reference:'测试'},defaultGrams:160});
  s.dishes.push({...D.copy(s.dishes[1]),id:'veg',name:'青菜',category:'素',ingredients:['青菜']});D.planOf(s,'2026-10-08','lunch').backups=[{dishId:'beef',grams:150},{dishId:'veg',grams:160}];
  D.sync(s,'2026-10-08','lunch');return s;
}
test('tomorrow crosses month and year correctly',()=>{
  assert.equal(D.nextDate('2026-12-31'),'2027-01-01');assert.equal(D.nextDate('2026-10-31'),'2026-11-01');
});
test('reserves are not included until explicitly substituted',()=>{
  const s=preparationFixture();assert.equal(s.boxes[0].items.length,1);assert.equal(D.nutrition(s,s.boxes[0].items).kcal,500);
  D.confirmMenu(s,'2026-10-08','lunch');D.confirmRoster(s,'2026-10-08','lunch');assert.equal(D.workflow(s,'2026-10-08','lunch').rosterReady,true);
});
test('reserves are optional but cannot repeat a main dish',()=>{
  const s=fixture();assert.doesNotThrow(()=>D.confirmMenu(s,'2026-10-08','lunch'));
  D.planOf(s,'2026-10-08','lunch').backups=[{dishId:'rice',grams:100}];assert.throws(()=>D.confirmMenu(s,'2026-10-08','lunch'),/备用菜/);
});
test('one click replacement changes only that box and scales reserve grams to target',()=>{
  const s=preparationFixture();s.customers[0].restrictions=['大米'];s.orders[0].portions=2;D.sync(s,'2026-10-08','lunch');
  D.confirmMenu(s,'2026-10-08','lunch');assert.throws(()=>D.confirmRoster(s,'2026-10-08','lunch'),/忌口/);
  const [a,b]=s.boxes;a.exportedVersion=a.version;D.replaceWithBackup(s,a.id,0,'beef');
  assert.deepEqual(a.items,[{dishId:'beef',grams:278}]);assert.equal(D.nutrition(s,a.items).kcal,500);assert.equal(b.items[0].dishId,'rice');assert.notEqual(a.exportedVersion,a.version);
});
test('unsafe or incompletely described reserve cannot replace a conflict',()=>{
  const s=preparationFixture();s.customers[0].allergies=['海鲜'];D.planOf(s,'2026-10-08','lunch').backups[1]={dishId:'fish',grams:160};assert.throws(()=>D.replaceWithBackup(s,s.boxes[0].id,0,'fish'),/仍有忌口/);
  s.dishes.find(d=>d.id==='beef').ingredients=[];assert.throws(()=>D.replaceWithBackup(s,s.boxes[0].id,0,'beef'),/食材/);
});
test('main menu changes rebase unaffected items while retaining the chosen substitute',()=>{
  const s=preparationFixture();D.replaceWithBackup(s,s.boxes[0].id,0,'beef');
  D.setMenu(s,'2026-10-08','lunch',[{dishId:'rice',grams:200},{dishId:'fish',grams:130}]);
  assert.deepEqual(s.boxes[0].items,[{dishId:'beef',grams:176},{dishId:'fish',grams:153}]);
  D.setMenu(s,'2026-10-08','lunch',[{dishId:'fish',grams:180}]);assert.deepEqual(s.boxes[0].items,[{dishId:'fish',grams:417}]);
});
test('pausing and resuming refreshes menu, invalidates confirmed roster, does not debit',()=>{
  const s=preparationFixture();D.confirmMenu(s,'2026-10-08','lunch');D.confirmRoster(s,'2026-10-08','lunch');
  const b=s.boxes[0];b.status='paused';assert.equal(D.workflow(s,'2026-10-08','lunch').rosterReady,false);
  s.dishes[0].nutrition.kcal100=125;D.setMenu(s,'2026-10-08','lunch',[{dishId:'rice',grams:190}]);b.status='pending';assert.equal(b.items[0].grams,400);assert.equal(D.remaining(s,s.orders[0]),2);
});
test('recipient confirmation requires address or explicit pickup, and changes invalidate it',()=>{
  const s=preparationFixture();D.confirmMenu(s,'2026-10-08','lunch');s.customers[0].address='';assert.throws(()=>D.confirmRoster(s,'2026-10-08','lunch'),/配送地址/);
  s.customers[0].fulfillment='pickup';D.confirmRoster(s,'2026-10-08','lunch');assert.equal(D.workflow(s,'2026-10-08','lunch').rosterReady,true);
  s.customers[0].nickname='改昵称';assert.equal(D.workflow(s,'2026-10-08','lunch').rosterReady,false);
});

test('database object key reordering preserves menu, roster and printed portion versions',()=>{
  const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).reverse().map(k=>[k,reorder(value[k])])):value;
  const s=preparationFixture(),date='2026-10-08';D.confirmMenu(s,date,'lunch');D.confirmRoster(s,date,'lunch');s.boxes[0].exportedVersion=s.boxes[0].version;
  // Existing signatures may use the previous noncanonical field ordering.
  for(const field of ['menuConfirmed','rosterConfirmed'])s.plans[date+':lunch'][field]=JSON.stringify(reorder(JSON.parse(s.plans[date+':lunch'][field])));
  s.boxes[0].portionSignature=JSON.stringify(reorder(JSON.parse(s.boxes[0].portionSignature)));
  const restored=D.hydrate(reorder(s)),version=restored.boxes[0].version;D.refreshPending(restored);D.sync(restored,date,'lunch');
  assert.equal(restored.boxes[0].version,version);assert.equal(restored.boxes[0].exportedVersion,version);assert.equal(D.workflow(restored,date,'lunch').rosterReady,true);
  restored.customers[0].address='新的配送地址';D.refreshPending(restored);assert.equal(D.workflow(restored,date,'lunch').rosterReady,false);assert.ok(restored.boxes[0].version>version);
});
