const test=require('node:test'),assert=require('node:assert/strict'),D=require('../../public/assets/merchant-domain');
function fixture(){
  const s=D.initial();s.customers=[{id:'c',name:'测试',fulfillment:'pickup',restrictions:[],allergies:[]}];
  s.dishes=[{id:'rice',name:'米饭',category:'主食',ingredients:[],nutrition:{source:'boohee',kcal100:116,basis:'cooked'}},{id:'egg',name:'番茄炒蛋',category:'荤',ingredients:['鸡蛋','番茄','花生油'],nutrition:{source:'boohee',kcal100:100,basis:'cooked'}}];
  s.menus[D.today()+':lunch']=s.dishes.map(d=>({dishId:d.id,grams:150}));
  let i=0;const b=D.addDiner(s,'c',D.today(),'lunch',p=>p+(++i));return {s,b,c:s.customers[0]};
}
test('blank and explicit none preferences never mark rice or reference recipes as conflicts',()=>{
  const {s,b,c}=fixture();for(const values of [[],['无'],[' 无忌口 ','暂无','none']]){c.restrictions=values;c.allergies=values;assert.equal(D.checks(s,b).blocked,false);assert.equal(D.checks(s,b).hasTerms,false);}
});
test('unrelated ordinary preferences do not require filling every missing recipe',()=>{
  const {s,b,c}=fixture();c.restrictions=['蒜','香菜'];assert.equal(D.checks(s,b).blocked,false);
});
test('Boohee peanut oil is an explained reference review, not an assertion about the shop recipe',()=>{
  const {s,b,c}=fixture();c.restrictions=['花生'];let check=D.checks(s,b);assert.equal(check.conflicts.length,0);assert.equal(check.reviews.length,1);assert.match(check.reviews[0].reason,/薄荷参考配方含 花生油/);
  c.allergies=['花生'];check=D.checks(s,b);assert.equal(check.conflicts.length,0);assert.equal(check.reviews.length,2);assert.equal(check.blocked,true);
  D.confirmMenu(s,b.date,b.meal);assert.throws(()=>D.confirmRoster(s,b.date,b.meal),/本店用料/);assert.throws(()=>D.finish(s,[b.id]),/核对本店用料/);
});
test('one shop confirmation is reused across diners and reloads; actual recipe change resets it',()=>{
  const {s,b,c}=fixture();c.allergies=['花生'];for(const d of s.dishes)D.setDietaryReview(s,d.id,'花生',false);
  assert.equal(D.checks(s,b).blocked,false);s.customers.push({id:'c2',name:'另一位',allergies:['花生'],fulfillment:'pickup'});
  const other={...b,customerId:'c2'};assert.equal(D.checks(D.hydrate(D.copy(s)),other).blocked,false);
  D.confirmMenu(s,b.date,b.meal);D.confirmRoster(s,b.date,b.meal);assert.equal(D.workflow(s,b.date,b.meal).rosterReady,true);
  s.dishes[1].ingredients.push('生抽');assert.equal(D.checks(s,b).reviews.length,1);assert.equal(D.workflow(s,b.date,b.meal).rosterReady,false);
  D.setDietaryReview(s,'egg','花生',false);assert.equal(D.checks(s,b).blocked,false);s.dishes[1].ingredientsVersion=1;assert.equal(D.checks(s,b).reviews.length,1);
});
test('actual positive ingredients, dish names and confirmed contains remain hard conflicts',()=>{
  const {s,b,c}=fixture();c.allergies=['花生'];D.setDietaryReview(s,'egg','花生',true);assert.equal(D.checks(s,b).conflicts.length,1);
  s.dishes[1].ingredientsSource='merchant';assert.throws(()=>D.setDietaryReview(s,'egg','花生',false),/不能直接确认不含/);assert.match(D.checks(s,b).conflicts[0],/本店配料：花生油/);
  c.allergies=['鸡蛋'];assert.equal(D.checks(s,b).conflicts.length,1);assert.throws(()=>D.setDietaryReview(s,'egg','鸡蛋',false),/不能直接确认不含/);
});
test('common dish name synonyms match while fish-fragrant wording is not treated as seafood',()=>{
  const {s,b,c}=fixture();c.restrictions=['牛肉'];s.dishes[1].name='洋葱炒肥牛';assert.equal(D.checks(s,b).conflicts.length,1);
  c.restrictions=['海鲜'];s.dishes[1].name='鱼香茄子';s.dishes[1].category='素';s.dishes[1].ingredients=[];assert.equal(D.checks(s,b).blocked,false);
});
test('serving freezes shop confirmation; later recipe resets do not rewrite completed boxes',()=>{
  const {s,b,c}=fixture();c.allergies=['花生'];for(const d of s.dishes)D.setDietaryReview(s,d.id,'花生',false);D.finish(s,[b.id]);
  for(const d of s.dishes)d.ingredientsVersion=1;assert.equal(D.checks(s,b).blocked,false);assert.equal(b.items[1].snapshot.dietaryReviews[0].contains,false);
});

test('a partial hand-written recipe is not proof that an unlisted allergen is absent',()=>{
  const {s,b,c}=fixture();c.allergies=['花生'];s.dishes[1].ingredientsSource='merchant';s.dishes[1].ingredients=['鸡蛋','番茄'];
  const check=D.itemCheck(s,b,b.items.find(i=>i.dishId==='egg'));assert.equal(check.conflicts.length,0);assert.equal(check.unknown,true);
  D.setDietaryReview(s,'egg','花生',false);assert.equal(D.itemCheck(s,b,b.items.find(i=>i.dishId==='egg')).blocked,false);
});
