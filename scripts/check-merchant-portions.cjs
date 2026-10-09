const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const D=require('../public/assets/merchant-domain');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    let s=D.initial(),rev=1;const date=D.nextDate(D.today());
    s.customers=[{id:'c',name:'配餐测试',gender:'女',age:30,height:160,currentWeight:60,fulfillment:'pickup',restrictions:[],allergies:[]},{id:'c2',name:'资料不全测试',gender:'男',fulfillment:'pickup'}];
    s.dishes=[['rice','杂粮饭','主食',100,120],['beef','黑椒牛肉','荤',180,150],['veg','清炒时蔬','素',60,100],['chicken','香煎鸡肉','荤',120,150]].map(([id,name,category,kcal100,defaultGrams])=>({id,name,category,defaultGrams,ingredients:[name],nutrition:{source:'manual',basis:'cooked',kcal100,reference:'隔离测试'}}));
    s.orders=s.customers.map((c,i)=>({id:`o${i}`,customerId:c.id,status:'服务中',startDate:date,endDate:date,meals:['lunch'],weekdays:[0,1,2,3,4,5,6],portions:1,credits:2}));
    s.menus[`${date}:lunch`]=s.dishes.slice(0,3).map(d=>({dishId:d.id,grams:d.defaultGrams}));D.planOf(s,date,'lunch').backups=[{dishId:'chicken',grams:150}];
    await page.route('**/api/merchant',async route=>{
      if(route.request().method()==='PUT'){const b=route.request().postDataJSON();D.validate(b.state);D.refreshPending(b.state);assert.equal(b.revision,rev);s=b.state;return route.fulfill({json:{ok:true,revision:++rev}});}
      return route.fulfill({json:{state:s,revision:rev}});
    });
    await page.goto(process.env.MERCHANT_URL||'http://localhost:3201');
    await page.getByRole('button',{name:'查看计算规则',exact:true}).click();await page.getByRole('heading',{name:'热量和克重怎么算'}).waitFor();await page.getByRole('button',{name:'关闭',exact:true}).last().click();
    await page.getByRole('button',{name:'菜单定好了，确认用餐人 →'}).click();
    await page.getByText('目标 464 kcal',{exact:true}).waitFor();await page.getByText('实际 465 kcal',{exact:true}).waitFor();await page.getByText('目标 1600 kcal',{exact:true}).waitFor();
    await page.screenshot({path:'tmp/portions-roster.png',fullPage:true});
    await page.getByRole('button',{name:'身体资料',exact:true}).first().click();await page.locator('input[name=currentWeight]').fill('80');
    await page.locator('#targetPreview').getByText(/本餐目标 536 kcal/).waitFor();
    await page.getByRole('button',{name:'保存客户',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});
    assert.equal(s.boxes[0].allocation.target.kcal,536);await page.getByText('目标 536 kcal',{exact:true}).waitFor();
    await page.getByRole('button',{name:'改克重 / 菜品',exact:true}).first().click();await page.locator('input[name=grams0]').fill('90');
    await page.getByRole('button',{name:'保存本餐调整',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(s.boxes[0].portionMode,'manual');
    await page.getByRole('button',{name:'改克重 / 菜品',exact:true}).first().click();await page.getByRole('button',{name:'恢复自动配餐',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});
    assert.equal(s.boxes[0].portionMode,'auto');assert.notEqual(s.boxes[0].items[0].grams,90);
    await page.getByRole('button',{name:'名单确认，生成标签 →'}).click();await page.getByRole('heading',{name:'先贴标签，再照着克重分装'}).waitFor();
    assert.equal(await page.locator('.label-tile').first().locator('.label-kcal strong').innerText(),`${D.nutrition(s,s.boxes[0].items).kcal} kcal`);
    await page.getByRole('button',{name:'店铺设置'}).click();await page.locator('select[name=fallbackCalorieBasis]').selectOption('daily-base');await page.getByRole('button',{name:'保存设置',exact:true}).click();await page.getByText('店铺设置已保存',{exact:true}).waitFor();
    assert.equal(s.boxes[1].allocation.target.kcal,576);assert.equal(s.boxes[0].allocation.target.kcal,536);
    await page.getByRole('button',{name:'客户与订餐'}).click();await page.getByRole('button',{name:'新增客户',exact:true}).click();await page.locator('input[name=name]').fill('身体资料测试');await page.locator('select[name=fulfillment]').selectOption('pickup');
    await page.locator('select[name=gender]').selectOption('女');await page.locator('input[name=age]').fill('30');await page.locator('input[name=height]').fill('160');await page.locator('input[name=currentWeight]').fill('60');
    await page.locator('#targetPreview').getByText(/本餐目标 464 kcal/).waitFor();await page.screenshot({path:'tmp/portions-customer.png',fullPage:true});
    await page.getByRole('button',{name:'保存客户',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(s.customers.at(-1).currentWeight,60);
    await page.reload();await page.getByRole('heading',{name:'确认这餐谁来吃'}).waitFor();await page.getByText('目标 576 kcal',{exact:true}).waitFor();
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/portions-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);console.log('Portion UI passed: live profile preview, per-customer kcal/grams, manual/auto switching, actual label kcal, fallback units, persistence, mobile. No live data writes.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
