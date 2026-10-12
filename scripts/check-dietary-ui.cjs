const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),D=require('../public/assets/merchant-domain');
(async()=>{
 fs.mkdirSync('tmp',{recursive:true});const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let state=D.initial(),revision=1;const date=D.nextDate(D.today());
  state.customers=[{id:'plain',name:'无忌口客户',restrictions:[],allergies:[]},{id:'taste',name:'不吃蒜客户',restrictions:['蒜'],allergies:[]},{id:'allergy1',name:'花生过敏客户一',restrictions:[],allergies:['花生']},{id:'allergy2',name:'花生过敏客户二',restrictions:[],allergies:['花生']}].map(c=>({...c,fulfillment:'pickup'}));
  state.dishes=[['rice','米饭','主食',[],116],['egg','番茄炒蛋','荤',['番茄','鸡蛋','花生油'],100],['beef','黑椒牛肉','荤',['牛肉','菜籽油'],140]].map(([id,name,category,ingredients,kcal100])=>({id,name,category,ingredients,defaultGrams:150,nutrition:{source:'boohee',basis:'cooked',kcal100,providerCode:id,reference:'隔离薄荷配方'}}));
  state.menus[date+':lunch']=state.dishes.slice(0,2).map(d=>({dishId:d.id,grams:150}));D.planOf(state,date,'lunch').backups=[{dishId:'beef',grams:150}];let serial=0;state.customers.forEach(c=>D.addDiner(state,c.id,date,'lunch',p=>p+(++serial)));
  await page.route('**/api/merchant',async route=>{if(route.request().method()==='PUT'){const b=route.request().postDataJSON();assert.equal(b.revision,revision);D.validate(b.state);D.validateNutritionChanges(b.state,state);D.refreshPending(b.state);state=b.state;return route.fulfill({json:{ok:true,revision:++revision}});}return route.fulfill({json:{state,revision}});});
  const button=name=>page.getByRole('button',{name,exact:true}),hidden=()=>page.locator('dialog').waitFor({state:'hidden'});
  await page.goto(process.env.MERCHANT_URL||'http://localhost:3201');await button('菜单定好了，确认用餐人 →').click();await button('核对本店用料').first().waitFor();
  assert.equal(await page.locator('.meal-chip.conflict').count(),0);assert.equal(await page.locator('.meal-chip.needs-review').count(),4);assert.equal(await button('换备用菜').count(),0);assert.equal(await button('名单确认，生成标签 →').isDisabled(),true);
  await page.screenshot({path:'tmp/dietary-roster.png',fullPage:true});await button('核对本店用料').first().click();await page.getByText(/薄荷参考配方含 花生油/).waitFor();await page.screenshot({path:'tmp/dietary-review.png',fullPage:true});
  await button('本店不含花生（含用油 / 调料）').first().click();await page.waitForFunction(()=>document.querySelectorAll('.dietary-review-card').length===1);assert.equal(state.dishes[0].ingredients.length,0);
  await button('本店不含花生（含用油 / 调料）').click();await hidden();assert.equal(await button('核对本店用料').count(),0);assert.equal(state.dishes[1].ingredients.includes('花生油'),true);assert.equal(D.activeDietaryReviews(state.dishes[1])[0].contains,false);
  await page.reload();await button('名单确认，生成标签 →').waitFor();assert.equal(await button('核对本店用料').count(),0);await button('名单确认，生成标签 →').click();await page.getByRole('heading',{name:'先贴标签，再照着克重分装'}).waitFor();
  await page.getByRole('button',{name:'我的菜品'}).click();const card=page.locator('.dish-card').filter({has:page.getByRole('heading',{name:'番茄炒蛋',exact:true})});await card.getByRole('button',{name:'本店用料',exact:true}).click();await page.getByText('花生：不含（含用油 / 调料）',{exact:true}).waitFor();await button('做法有变化，重新核对').click();await page.getByText(/暂未确认/).waitFor();await button('关闭').last().click();
  await page.getByRole('button',{name:'备餐工作台'}).click();await button('← 改用餐名单').click();await button('核对本店用料').first().click();await button('本店含花生').click();await hidden();assert.equal(await page.locator('.meal-chip.conflict').count(),2);assert.equal(await button('换备用菜').count(),2);
  await button('换备用菜').first().click();await page.locator('[data-action=review-backup]').click();await button('本店不含花生（含用油 / 调料）').click();await page.locator('[data-action=use-backup]').click();await hidden();
  await button('换备用菜').click();assert.equal(await page.locator('[data-action=review-backup]').count(),0);await page.locator('[data-action=use-backup]').click();await hidden();assert.equal(await button('名单确认，生成标签 →').isDisabled(),false);
  assert.equal(state.dishes[1].nutrition.kcal100,100);assert.equal(D.activeDietaryReviews(state.dishes[1])[0].contains,true);assert.equal(state.boxes.filter(b=>b.items.some(i=>i.dishId==='beef')).length,2);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'我的菜品'}).click();await page.locator('.dish-card').filter({has:page.getByRole('heading',{name:'番茄炒蛋',exact:true})}).getByRole('button',{name:'本店用料',exact:true}).click();await page.screenshot({path:'tmp/dietary-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth));
  assert.deepEqual(errors,[]);console.log('Dietary UI passed: no false red rice/peanut conflicts, reference explanations, one-time shared confirmation, reload, recipe reset, positive conflicts and reviewed backup substitution. Isolated data only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
