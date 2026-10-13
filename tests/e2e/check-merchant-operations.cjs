const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),D=require('../../public/assets/merchant-domain');
(async()=>{
  fs.mkdirSync('tmp',{recursive:true});const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.abort('blockedbyclient'));
    let s=D.initial(),rev=1;const tomorrow=D.nextDate(D.today());
    s.settings.name='禾日健康小饭桌';s.customers=[{id:'c',name:'测试客户',nickname:'林林',fulfillment:'pickup',restrictions:['番茄'],allergies:[]}];
    s.dishes=[['rice','杂粮饭','主食',120,['大米']],['chicken','番茄鸡肉','荤',150,['番茄','鸡肉']],['veg','清炒时蔬','素',60,['青菜']],['beef','黑椒牛肉','荤',170,['牛肉']],['reserve','清炒黄瓜','素',50,['黄瓜']]].map(([id,name,category,kcal100,ingredients])=>({id,name,category,ingredients,defaultGrams:150,nutrition:{source:'manual',basis:'cooked',kcal100,reference:'隔离测试'}}));
    s.menus[`${tomorrow}:lunch`]=s.dishes.slice(0,3).map(d=>({dishId:d.id,grams:150}));
    await page.route('**/api/merchant',async route=>{
      if(route.request().method()==='PUT'){const b=route.request().postDataJSON();D.validate(b.state);D.refreshPending(b.state);assert.equal(b.revision,rev);s=b.state;return route.fulfill({json:{ok:true,revision:++rev}});}
      return route.fulfill({json:{state:s,revision:rev}});
    });
    let remoteSearches=0;
    await page.route('**/api/merchant/nutrition/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('/status'))return route.fulfill({json:{configured:false}});
      if(url.pathname.endsWith('/search')){const local=s.dishes.filter(d=>d.name.includes(url.searchParams.get('q')));if(local.length&&!url.searchParams.has('remote'))return route.fulfill({json:{source:'local',foods:local}});remoteSearches++;return route.fulfill({json:{source:'boohee',foods:[{code:'newfood',name:'燕麦饭（隔离接口数据）',kcal100:110}],hasMore:false}});}
      if(url.pathname.endsWith('/import')){const b=route.request().postDataJSON();assert.equal(b.confirmed,true);s.dishes.push({id:'boohee:newfood',name:'燕麦饭（隔离接口数据）',category:b.category,defaultGrams:150,ingredients:['燕麦'],nutrition:{source:'boohee',providerCode:'newfood',kcal100:110,basis:b.basis,reference:'隔离接口数据'}});return route.fulfill({json:{state:s,revision:++rev}});}
      return route.fulfill({status:503,json:{message:'隔离测试：未提供真实 API Key'}});
    });
    const button=name=>page.getByRole('button',{name,exact:true});const close=()=>page.getByRole('button',{name:'关闭',exact:true}).last().click();const hidden=()=>page.locator('#dialog').waitFor({state:'hidden',timeout:5000}).catch(async e=>{console.error(await page.locator('#dialog').innerText(),errors);throw e});
    await require('../support/browser-fixture.cjs').open(page);await page.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();assert.equal(await button('沿用上次').count(),0);
    await button('＋ 添加备用菜').click();await page.locator('input[name=dish][value=beef]').check();await button('使用这些菜').click();await hidden();assert.equal(D.planOf(s,tomorrow,'lunch').backups.length,1);await button('＋ 添加备用菜').click();assert.equal(await page.locator('input[name=dish][value=beef]').isChecked(),true);await page.locator('input[name=dish][value=reserve]').check();await button('使用这些菜').click();await hidden();
    await page.screenshot({path:'tmp/operations-menu.png',fullPage:true});await button('菜单定好了，确认用餐人 →').click();assert.equal(s.boxes.length,0);
    await button('登记新客户').click();assert.equal(await page.locator('input[name=height]').isVisible(),true);await page.locator('#dialog input[name=name]').fill('小周');await page.locator('select[name=fulfillment]').selectOption('pickup');await button('保存客户').click();await hidden();assert.equal(s.boxes.length,0);
    await page.getByRole('button',{name:'客户与订单'}).click();await button('购买 / 续订包餐').first().click();await page.locator('input[name=credits]').fill('2');await button('保存本期包餐').click();await hidden();assert.equal(s.boxes.length,0);
    await button('购买 / 续订包餐').first().click();await page.locator('input[name=credits]').fill('5');await button('保存本期包餐').click();await hidden();assert.equal(s.orders.length,2);
    await button('包餐账本 / 记录').first().click();await page.getByRole('heading',{name:'包餐 · 第 1 期',exact:true}).waitFor();await page.getByRole('heading',{name:'包餐 · 第 2 期',exact:true}).waitFor();await close();
    await page.screenshot({path:'tmp/operations-customers.png',fullPage:true});
    await page.getByRole('button',{name:'备餐工作台'}).click();await button('＋ 添加用餐人').click();await page.locator('input[name=customer]').first().check();await page.locator('input[name=customer]').last().check();await button('添加到本餐').click();await hidden();
    assert.equal(s.boxes.length,2);assert.equal(s.boxes[0].orderId,s.orders[0].id);assert.equal(D.orderKind(s.orders.at(-1)),'single');
    await page.getByText('目标 500 kcal',{exact:true}).first().waitFor();await button('换备用菜').click();await page.locator('[data-action=use-backup][data-dish=beef]').click();await hidden();assert.equal(s.boxes[0].items[1].dishId,'beef');
    // Default portions outside the range block labels until repaired.
    await button('改克重 / 菜品').first().click();for(const el of await page.locator('input[name^=grams]').all())await el.fill('300');await button('保存本餐调整').click();await hidden();assert.equal(await button('名单确认，生成标签 →').isDisabled(),true);await page.getByText(/须调整至 400–600 kcal/).first().waitFor();
    await button('改克重 / 菜品').first().click();await button('恢复自动配餐').click();await hidden();assert.equal(await button('名单确认，生成标签 →').isEnabled(),true);
    // Visible profile fields, live calculation and manual/automatic switching.
    await button('身体资料').first().click();await page.locator('select[name=gender]').selectOption('女');await page.locator('input[name=age]').fill('30');await page.locator('input[name=height]').fill('160');await page.locator('input[name=currentWeight]').fill('60');await page.locator('#targetPreview').getByText(/464/).waitFor();await button('保存客户').click();await hidden();assert.equal(s.boxes[0].allocation.target.kcal,464);
    await button('改克重 / 菜品').first().click();await page.locator('input[name=grams0]').fill('90');await button('保存本餐调整').click();await hidden();assert.equal(s.boxes[0].portionMode,'manual');
    await button('改克重 / 菜品').first().click();await button('恢复自动配餐').click();await hidden();assert.equal(s.boxes[0].portionMode,'auto');
    await button('名单确认，生成标签 →').click();await page.getByRole('heading',{name:'先贴标签，再照着克重分装'}).waitFor();assert.equal(await button('本餐分装完成').count(),0);await page.evaluate(()=>window.print=()=>{});await button('打印全部 2 张').click();await button('确认已打印 / 已保存 PDF').waitFor();
    await page.emulateMedia({media:'print'});assert.ok(await page.locator('.print-label').evaluateAll(labels=>labels.every(el=>el.scrollHeight<=el.clientHeight&&el.scrollWidth<=el.clientWidth)));await page.screenshot({path:'tmp/operations-print.png',fullPage:true});await page.emulateMedia({media:'screen'});await button('确认已打印 / 已保存 PDF').click();await hidden();assert.equal(D.remaining(s,s.orders[0]),2);
    // Cancel before serving: never consume, retain both order period and audit trail.
    await button('← 改用餐名单').click();await button('取消').first().click();await page.locator('input[name=reason]').fill('临时有事');await button('确认取消').click();await hidden();assert.equal(D.remaining(s,s.orders[0]),2);assert.equal(s.boxes[0].status,'cancelled');await button('恢复').click();await page.getByText('已恢复用餐',{exact:true}).waitFor();
    // Simulate prepared meals arriving on the serving day, with no live data writes.
    s.menus[`${D.today()}:lunch`]=s.menus[`${tomorrow}:lunch`];delete s.menus[`${tomorrow}:lunch`];s.plans[`${D.today()}:lunch`]=s.plans[`${tomorrow}:lunch`];delete s.plans[`${tomorrow}:lunch`];s.boxes.forEach(b=>b.date=D.today());s.orders.forEach(o=>o.startDate=D.today());D.confirmMenu(s,D.today(),'lunch');D.confirmRoster(s,D.today(),'lunch');rev++;
    await page.reload();await button('今天分装').click();await page.getByRole('heading',{name:'照着这张清单装盒'}).waitFor();assert.equal(await page.locator('.workflow-steps').count(),0);assert.equal(await page.locator('.packing-row').count(),2);
    assert.equal(await button('本餐分装完成').isEnabled(),true);assert.equal(await page.locator('.packing-card,.packing-grid,.label-paper').count(),0);await page.screenshot({path:'tmp/operations-packing.png',fullPage:true});await button('这盒装好了').first().click();await page.getByText('这盒已完成，扣除 1 次',{exact:true}).waitFor();assert.equal(D.remaining(s,s.orders[0]),1);
    await button('取消 / 退餐').first().click();await page.locator('input[name=reason]').fill('商家同意返还');await button('确认取消').click();await hidden();assert.equal(D.remaining(s,s.orders[0]),2);
    await button('本餐分装完成').click();await page.getByText('将完成 1 份餐盒，并分别扣除对应的餐次。',{exact:true}).waitFor();await button('确认完成').click();await hidden();assert.equal(s.boxes[1].status,'completed');assert.equal(await button('本餐分装完成').isDisabled(),true);
    await page.getByRole('button',{name:'客户与订单'}).click();await button('包餐账本 / 记录').first().click();await page.getByText(/商家同意返还/).waitFor();await page.screenshot({path:'tmp/operations-ledger.png',fullPage:true});await button('调整剩余次数').last().click();await page.locator('input[name=balance]').fill('4');await page.locator('input[name=reason]').fill('商家赠送两餐');await button('保存调整流水').click();await hidden();assert.equal(D.remaining(s,s.orders[0]),4);assert.equal(s.orders[0].credits,2);
    await page.getByRole('button',{name:'我的菜品'}).click();await button('搜索并添加').click();await page.getByLabel('搜索菜名').fill('杂粮');await button('搜索').click();await page.getByText('已在我的菜品',{exact:true}).waitFor();assert.equal(remoteSearches,0);
    await page.getByLabel('搜索菜名').fill('燕麦');await button('搜索').click();await button('确认添加').click();await page.locator('select[name=category]').selectOption('主食');await page.locator('input[name=confirmed]').check();await button('添加到我的菜品').click();await hidden();assert.equal(s.dishes.at(-1).nutrition.source,'boohee');
    await page.getByRole('button',{name:'店铺设置'}).click();await page.getByText(/400–600 kcal 均在可接受范围/).waitFor();await button('连接 / 检查薄荷健康').click();await page.locator('input[name=apiKey]').waitFor();await close();
    await page.getByRole('button',{name:'备餐工作台'}).click();await button('今天分装').click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/operations-mobile.png',fullPage:true});if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,text:el.textContent.slice(0,50)}))));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);console.log('Operations UI passed: registration, renewal periods, local-first search and import fixture, profiles, incremental reserves, manual roster, print-fit, packing, cancellation/refund, adjustment audit, mobile. No live business writes or real provider claims.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
