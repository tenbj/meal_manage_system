const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../public/assets/merchant-domain');
function fixture() {
  const s=D.initial(),date='2026-10-09';
  s.customers=[{id:'c',name:'配餐测试',gender:'女',age:30,height:160,currentWeight:60,fulfillment:'pickup'}];
  s.dishes=[['rice','主食',100,120],['beef','荤',180,150],['veg','素',60,100],['chicken','荤',120,150]].map(([id,category,kcal100,defaultGrams])=>({id,name:id,category,defaultGrams,ingredients:[id],nutrition:{source:'manual',basis:'cooked',kcal100,reference:'隔离测试'}}));
  s.orders=[{id:'o',customerId:'c',status:'服务中',startDate:date,endDate:date,meals:['lunch','dinner'],weekdays:[0,1,2,3,4,5,6],portions:1,credits:4}];
  for(const meal of ['lunch','dinner']) {
    s.menus[`${date}:${meal}`]=s.dishes.slice(0,3).map(d=>({dishId:d.id,grams:d.defaultGrams}));
    D.planOf(s,date,meal).backups=[{dishId:'chicken',grams:150}];D.sync(s,date,meal);
  }
  return s;
}
test('adult profile uses Mifflin estimate times 36%, independently for lunch and dinner',()=>{
  const s=fixture(),female=D.mealTarget(s.customers[0]);assert.equal(female.bmr,1289);assert.equal(female.kcal,464);
  assert.equal(D.mealTarget({gender:'男',age:30,height:175,currentWeight:70}).kcal,594);
  assert.equal(s.boxes[0].allocation.target.kcal,s.boxes[1].allocation.target.kcal);
});
test('fallback units are explicit; missing sex and minors never silently use female defaults',()=>{
  assert.equal(D.mealTarget({gender:'女'}).kcal,1400);assert.equal(D.mealTarget({gender:'男'}).kcal,1600);
  assert.equal(D.mealTarget({gender:'女'},{fallbackCalorieBasis:'daily-base'}).kcal,504);
  assert.equal(D.mealTarget({gender:'男',height:175},{fallbackCalorieBasis:'daily-base'}).kcal,576);
  assert.equal(D.mealTarget({}).kcal,null);assert.equal(D.mealTarget({gender:'女',age:12,height:150,currentWeight:40}).kcal,null);
});
test('one third is staple calories; other dishes preserve baseline mass ratio and round to grams',()=>{
  const s=fixture(),b=s.boxes[0];assert.equal(b.allocation.status,'auto');
  assert.deepEqual(b.items.map(i=>i.grams),[155,141,94]);assert.equal(D.nutrition(s,b.items).kcal,465);
  assert.ok(Math.abs(155/465-1/3)<.005);assert.equal(b.items[1].grams/b.items[2].grams,1.5);
});
test('multiple staples share one staple budget',()=>{
  const s=fixture();s.dishes.push({...D.copy(s.dishes[0]),id:'rice2'});
  const r=D.allocate(s,[...s.menus['2026-10-09:lunch'],{dishId:'rice2',grams:120}],s.customers[0]);
  assert.equal(r.items[0].grams,77);assert.equal(r.items[3].grams,77);
});
test('missing or zero food energy and incomplete menus never masquerade as personal allocations',()=>{
  const s=fixture(),menu=s.menus['2026-10-09:lunch'];s.dishes[0].nutrition.kcal100=null;
  const r=D.allocate(s,menu,s.customers[0]);assert.equal(r.status,'unavailable');assert.deepEqual(r.items,menu);
  s.dishes[0].nutrition.kcal100=0;assert.equal(D.allocate(s,menu,s.customers[0]).status,'unavailable');
  s.dishes[0].nutrition.kcal100=100;assert.equal(D.allocate(s,menu.slice(1),s.customers[0]).status,'unavailable');
  assert.equal(D.allocate(s,menu.slice(0,1),s.customers[0]).status,'unavailable');
});
test('automatic backup replacement recalculates weights while preserving target and other boxes',()=>{
  const s=fixture(),[b,other]=s.boxes,untouched=D.copy(other);D.replaceWithBackup(s,b.id,1,'chicken');
  assert.equal(b.portionMode,'auto');assert.equal(b.items[1].dishId,'chicken');assert.notEqual(b.items[1].grams,150);
  assert.ok(Math.abs(D.nutrition(s,b.items).kcal-464)<=2);assert.deepEqual(other,untouched);
  D.refreshPending(s);assert.equal(b.items[1].dishId,'chicken');
});
test('profile or dish edits invalidate printed portions and confirmed rosters; refresh is idempotent',()=>{
  const s=fixture(),b=s.boxes[0];D.confirmMenu(s,b.date,b.meal);D.confirmRoster(s,b.date,b.meal);b.exportedVersion=b.version;
  const before=D.copy(b.items);s.customers[0].currentWeight=80;D.refreshPending(s);
  assert.notDeepEqual(b.items,before);assert.notEqual(b.version,b.exportedVersion);assert.equal(D.workflow(s,b.date,b.meal).rosterReady,false);
  const version=b.version;D.refreshPending(s);assert.equal(b.version,version);
  s.dishes[0].nutrition.kcal100=200;D.refreshPending(s);assert.ok(b.items[0].grams<before[0].grams);
});
test('manual weights stay fixed; restoring automatic preserves substitute dishes',()=>{
  const s=fixture(),b=s.boxes[0];D.replaceWithBackup(s,b.id,1,'chicken');const manual=D.copy(b.items);manual[0].grams=90;D.setBoxItems(s,b,manual);
  s.customers[0].currentWeight=80;D.setMenu(s,b.date,b.meal,s.menus[`${b.date}:${b.meal}`].map(i=>({...i,grams:i.grams*2})));
  assert.deepEqual(b.items,manual);assert.equal(b.allocation.status,'manual');D.restoreAutomatic(s,b);
  assert.equal(b.portionMode,'auto');assert.equal(b.items[1].dishId,'chicken');assert.notEqual(b.items[0].grams,90);
});
test('completed boxes freeze allocation, food calories and customer snapshot',()=>{
  const s=fixture(),b=s.boxes[0];D.finish(s,[b.id]);const before=D.copy(b);
  s.customers[0].currentWeight=90;s.dishes[0].nutrition.kcal100=200;D.refreshPending(s);
  assert.deepEqual(b,before);assert.equal(D.nutrition(s,b.items).kcal,465);assert.throws(()=>D.restoreAutomatic(s,b),/已完成/);
});
test('invalid body units and fallback settings cannot be persisted',()=>{
  const s=fixture();D.validate(s);s.customers[0].height=1.6;assert.throws(()=>D.validate(s),/身高/);
  s.customers[0].height=160;s.customers[0].currentWeight=-5;assert.throws(()=>D.validate(s),/体重/);
  s.customers[0].currentWeight=60;s.settings.fallbackCalorieBasis='unknown';assert.throws(()=>D.validate(s),/口径/);
});
