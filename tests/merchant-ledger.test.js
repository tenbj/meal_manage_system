const test=require('node:test'),assert=require('node:assert/strict'),D=require('../public/assets/merchant-domain');
let serial=0;const id=p=>`${p}-${++serial}`;
function fixture(){
  const s=D.initial();s.customers=[{id:'c',name:'测试客户',fulfillment:'pickup'}];
  s.dishes=[['rice','主食'],['meat','荤'],['veg','素'],['reserve-meat','荤'],['reserve-veg','素']].map(([id,category])=>({id,name:id,category,ingredients:[id],defaultGrams:100,nutrition:{source:'manual',kcal100:100,basis:'cooked',reference:'测试'}}));
  s.menus['2026-10-12:lunch']=s.dishes.slice(0,3).map(d=>({dishId:d.id,grams:100}));D.planOf(s,'2026-10-12','lunch').backups=s.dishes.slice(3).map(d=>({dishId:d.id,grams:100}));
  s.orders=[{id:'p1',customerId:'c',kind:'plan',serviceType:'包餐',startDate:'2026-10-01',endDate:'2026-11-01',credits:2,portions:1,meals:['lunch','dinner'],weekdays:[0,1,2,3,4,5,6],status:'服务中'},{id:'p2',customerId:'c',kind:'plan',serviceType:'包餐',startDate:'2026-10-10',endDate:'2026-11-10',credits:10,portions:1,meals:['lunch','dinner'],weekdays:[0,1,2,3,4,5,6],status:'服务中'}];return s;
}
test('registration and package renewal never automatically add diners',()=>{const s=fixture();D.sync(s,'2026-10-12','lunch');assert.equal(s.boxes.length,0);D.confirmMenu(s,'2026-10-12','lunch');assert.equal(s.boxes.length,0);});
test('renewals reserve oldest eligible card first without overselling across dates',()=>{
  const s=fixture();const a=D.addDiner(s,'c','2026-10-12','lunch',id),b=D.addDiner(s,'c','2026-10-13','lunch',id),c=D.addDiner(s,'c','2026-10-14','lunch',id);
  assert.equal(a.orderId,'p1');assert.equal(b.orderId,'p1');assert.equal(c.orderId,'p2');assert.equal(D.remaining(s,s.orders[0]),2);assert.equal(D.reserved(s,s.orders[0]),2);
  assert.throws(()=>D.addDiner(s,'c','2026-10-12','lunch',id),/已有记录/);assert.equal(D.orderLabel(s,s.orders[1]),'包餐 · 第 2 期');
});
test('completed cancellation refunds or retains exactly one credit and is audited',()=>{
  const s=fixture(),b=D.addDiner(s,'c','2026-10-12','lunch',id);D.finish(s,[b.id,b.id]);assert.equal(D.remaining(s,s.orders[0]),1);
  D.cancelBox(s,b.id,false,'客户临时取消');assert.equal(D.remaining(s,s.orders[0]),2);assert.equal(b.events[0].type,'complete');assert.equal(b.events[1].from,'completed');
  assert.throws(()=>D.cancelBox(s,b.id,false,'再退'),/已取消/);D.resumeBox(s,b.id);D.cancelBox(s,b.id,true,'迟到取消仍扣');assert.equal(D.remaining(s,s.orders[0]),1);
  D.resumeBox(s,b.id);assert.equal(D.remaining(s,s.orders[0]),2);D.finish(s,[b.id]);assert.equal(D.remaining(s,s.orders[0]),1);
});
test('manual adjustment appends ledger without rewriting purchase and cannot underfund reservations',()=>{
  const s=fixture();D.addDiner(s,'c','2026-10-12','lunch',id);assert.throws(()=>D.adjustBalance(s,'p1',0,'扣次',id('a')),/已安排/);
  D.adjustBalance(s,'p1',5,'赠送三次',id('a'));assert.equal(s.orders[0].credits,2);assert.equal(D.remaining(s,s.orders[0]),5);assert.equal(s.creditAdjustments[0].delta,3);
  D.adjustBalance(s,'p1',4,'补扣一次',id('a'));assert.equal(s.creditAdjustments.length,2);assert.equal(D.remaining(s,s.orders[0]),4);assert.throws(()=>D.adjustBalance(s,'p1',2,'',id('a')),/原因/);
});
test('menus require a meat and vegetable backup, and no repeat with neighboring meals',()=>{
  const s=fixture();D.confirmMenu(s,'2026-10-12','lunch');s.menus['2026-10-12:dinner']=[{dishId:'rice',grams:100}];assert.equal(D.workflow(s,'2026-10-12','lunch').menuReady,false);assert.throws(()=>D.confirmMenu(s,'2026-10-12','lunch'),/重复菜/);
  delete s.menus['2026-10-12:dinner'];s.menus['2026-10-13:dinner']=[{dishId:'veg',grams:100}];assert.equal(D.menuRepeats(s,'2026-10-12','lunch').length,1);
  delete s.menus['2026-10-13:dinner'];D.planOf(s,'2026-10-12','lunch').backups.pop();assert.throws(()=>D.confirmMenu(s,'2026-10-12','lunch'),/一荤一素/);
});
test('catalog cleanup removes old selectable data but keeps completed nutrition and credit history',()=>{
  const s=fixture(),b=D.addDiner(s,'c','2026-10-12','lunch',id);D.finish(s,[b.id]);const kcal=D.nutrition(s,b.items).kcal;
  assert.equal(D.purgeLegacyDishes(s),5);D.hydrate(s);assert.equal(s.dishes.length,0);assert.equal(D.nutrition(s,b.items).kcal,kcal);assert.equal(D.remaining(s,s.orders[0]),1);D.validate(s);
});
test('missing profiles always default to 500 even with stale gender settings',()=>{for(const c of [{},{gender:'男'},{gender:'女',height:160}]){const t=D.mealTarget(c,{fallbackCalorieBasis:'meal'});assert.equal(t.kcal,500);assert.equal(t.minKcal,400);assert.equal(t.maxKcal,600);}});
test('cancelling one diner leaves other confirmed packing boxes ready',()=>{
  const s=fixture();s.customers.push({id:'c2',name:'另一位客户',fulfillment:'pickup'});
  const a=D.addDiner(s,'c','2026-10-12','lunch',id);D.addDiner(s,'c2','2026-10-12','lunch',id);D.confirmMenu(s,a.date,a.meal);D.confirmRoster(s,a.date,a.meal);
  D.cancelBox(s,a.id,false,'临时有事');assert.equal(D.workflow(s,a.date,a.meal).rosterReady,true);assert.equal(D.workflow(s,a.date,a.meal).live.length,1);
});
