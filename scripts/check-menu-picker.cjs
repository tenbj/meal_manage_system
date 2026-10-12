const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),D=require('../public/assets/merchant-domain');
(async()=>{
  fs.mkdirSync('tmp',{recursive:true});const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    let state=D.initial(),revision=1,searches=0,configured=false,searchFails=false;
    const date=D.nextDate(D.today());
    state.dishes=[['rice','杂粮饭','主食'],['beef','香煎牛肉','荤']].map(([id,name,category])=>({id,name,category,ingredients:[name],defaultGrams:150,nutrition:{source:'manual',kcal100:120,basis:'cooked',reference:'隔离测试'}}));
    state.dishes.push({id:'legacy',name:'旧菜热量缺失',category:'素',nutrition:{source:'legacy',kcal100:null,basis:'cooked'}});
    state.menus[date+':lunch']=[{dishId:'rice',grams:180}];
    await page.route('**/api/merchant',async route=>{
      if(route.request().method()==='PUT'){const b=route.request().postDataJSON();D.validate(b.state);D.validateNutritionChanges(b.state,state);assert.equal(b.revision,revision);state=b.state;return route.fulfill({json:{ok:true,revision:++revision}});}
      return route.fulfill({json:{state,revision}});
    });
    await page.route('**/api/merchant/nutrition/**',async route=>{
      const u=new URL(route.request().url());
      if(u.pathname.endsWith('/status'))return route.fulfill({json:{configured}});
      if(u.pathname.endsWith('/connect')){const b=route.request().postDataJSON();if(b.apiKey.includes('*'))return route.fulfill({status:422,json:{message:'请粘贴完整 API Key，不能使用带星号的脱敏值'}});configured=true;return route.fulfill({json:{configured,verified:true}});}
      if(u.pathname.endsWith('/check'))return route.fulfill({status:502,json:{message:'薄荷返回：食物搜索接口未开通（HTTP 200 / 错误码 1042）。'}});
      if(u.pathname.endsWith('/search')){searches++;if(searchFails)return route.fulfill({status:502,json:{message:'连接薄荷超时（12 秒）。请稍后重试；本次尚未验证 Key。'}});const local=state.dishes.filter(d=>d.name.includes(u.searchParams.get('q')));if(local.length&&!u.searchParams.has('remote'))return route.fulfill({json:{source:'local',foods:local}});return route.fulfill({json:{source:'boohee',foods:[{code:'spinach',name:'蒜蓉菠菜',kcal100:45}],hasMore:false}});}
      if(u.pathname.endsWith('/import')){const b=route.request().postDataJSON();assert.equal(b.revision,revision);assert.equal(b.confirmed,true);const dish={id:'boohee:spinach',name:'蒜蓉菠菜',category:b.category,ingredients:['菠菜'],defaultGrams:150,nutrition:{source:'boohee',providerCode:'spinach',kcal100:45,basis:b.basis,reference:'隔离测试'}};state.dishes.push(dish);return route.fulfill({json:{state,revision:++revision,dish}});}
      throw new Error('unexpected nutrition request');
    });
    const button=name=>page.getByRole('button',{name,exact:true});const close=()=>button('关闭').last().click();const hidden=()=>page.locator('dialog').waitFor({state:'hidden'});
    await page.goto(process.env.MERCHANT_URL||'http://localhost:3201');await button('选择主菜').click();
    assert.equal(await page.locator('input[value=legacy]').isDisabled(),true);await page.locator('input[value=beef]').check();
    await page.getByLabel('搜索常用菜').fill('香菇鸡丁');await page.getByText('我的菜品中没有匹配结果。',{exact:true}).waitFor();assert.equal(searches,0);
    await button('手动新建').click();assert.equal(await page.locator('[name=name]').inputValue(),'香菇鸡丁');await close();await page.getByLabel('搜索常用菜').waitFor();assert.equal(await page.locator('input[value=beef]').isChecked(),true);
    await button('手动新建').click();await button('保存并选入本餐').click();assert.equal(await page.locator('[name=kcal]').evaluate(el=>el.validity.valueMissing),true);assert.equal(state.dishes.length,3);
    await page.locator('[name=kcal]').fill('155');await page.locator('[name=reference]').fill('商家配方核算');await page.locator('[name=ingredients]').fill('鸡肉，香菇');await button('保存并选入本餐').click();await page.getByLabel('搜索常用菜').waitFor();
    const manual=state.dishes.find(d=>d.name==='香菇鸡丁');assert.ok(manual);assert.equal(await page.locator(`input[value="${manual.id}"]`).isChecked(),true);assert.equal(await page.locator('input[value=rice]').isChecked(),true);assert.equal(await page.locator('input[value=beef]').isChecked(),true);assert.equal(state.menus[date+':lunch'].length,1);
    await page.getByLabel('搜索常用菜').fill('菠菜');searchFails=true;await button('去薄荷搜索').click();await page.getByText(/连接薄荷超时/).waitFor();await button('手动新建').waitFor();
    await button('连接薄荷健康').click();await page.locator('[name=apiKey]').fill('sk-test****masked');await button('验证并连接').click();await page.locator('#formError').getByText(/完整 API Key/).waitFor();assert.equal(configured,false);
    await page.locator('[name=apiKey]').fill('sk-test-only-fixture');searchFails=false;await button('验证并连接').click();await button('确认添加').click();await page.locator('[name=category]').selectOption('素');await page.locator('[name=confirmed]').check();await button('保存并选入本餐').click();
    await page.getByLabel('搜索常用菜').waitFor();assert.equal(await page.locator('input[value="boohee:spinach"]').isChecked(),true);assert.equal(await page.locator(`input[value="${manual.id}"]`).isChecked(),true);await page.locator('input[value=beef]').uncheck();
    await page.screenshot({path:'tmp/picker-inline-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/picker-inline-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth));await page.setViewportSize({width:1280,height:950});
    await button('使用这些菜').click();await hidden();assert.deepEqual(state.menus[date+':lunch'].map(i=>i.dishId),['rice',manual.id,'boohee:spinach']);assert.equal(state.menus[date+':lunch'][0].grams,180);
    await button('选择主菜').click();await page.getByLabel('搜索常用菜').fill('杂粮');await button('去薄荷搜索').click();await button('选入本餐').click();await page.getByLabel('搜索常用菜').waitFor();assert.equal(await page.locator('input[value=rice]').isChecked(),true);await close();await hidden();
    await page.getByRole('button',{name:'店铺设置'}).click();await button('连接 / 检查薄荷健康').click();await button('检测已保存的连接').click();await page.locator('#connectionResult').getByText(/错误码 1042/).waitFor();assert.equal(await page.locator('[name=apiKey]').inputValue(),'');
    assert.deepEqual(errors,[]);console.log('Menu picker UI passed: draft preservation, mandatory calories, inline manual/provider add, local reuse, connect/retry, diagnostics, desktop/mobile. All writes and provider calls isolated.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
