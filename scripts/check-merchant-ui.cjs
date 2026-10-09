const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const D = require('../public/assets/merchant-domain');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));require('node:fs').mkdirSync('tmp',{recursive:true});
    await page.goto(process.env.MERCHANT_URL||'http://localhost:3201');
    await page.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();
    assert.equal(await page.getByLabel('用餐日期').inputValue(),D.nextDate(D.today()));
    await page.screenshot({path:'tmp/preparation-live.png',fullPage:true});
    let s=D.initial(),rev=1;const date=D.nextDate(D.today());
    s.settings.name='禾日健康小饭桌';
    s.customers=[
      {id:'c1',name:'小林',nickname:'林林',restrictions:['番茄'],allergies:[],phone:'测试电话',address:'春和路12号3栋201室（测试）',fulfillment:'delivery'},
      {id:'c2',name:'小周',nickname:'周周',restrictions:[],allergies:[],address:'',fulfillment:'pickup'},
      {id:'c3',name:'小陈',nickname:'',restrictions:[],allergies:[],address:'春和路20号（测试）',fulfillment:'delivery'}
    ];
    s.dishes=[['rice','杂粮饭','主食',120,120,['大米']],['chicken','番茄鸡肉','荤',120,150,['鸡肉','番茄']],['fish','清蒸鱼','海鲜',100,110,['鱼']],['veg','清炒时蔬','素',100,60,['青菜']],['cucumber','清炒黄瓜','素',100,50,['黄瓜']],['beef','黑椒牛肉','荤',120,170,['牛肉','黑胡椒']],['carrot','清炒胡萝卜','素',100,50,['胡萝卜']]].map(([id,name,category,grams,kcal,ingredients])=>({id,name,category,defaultGrams:grams,ingredients,nutrition:{source:'manual',basis:'cooked',kcal100:kcal,reference:'浏览器隔离测试'}}));
    s.menus[`${date}:lunch`]=s.dishes.slice(0,5).map(d=>({dishId:d.id,grams:d.defaultGrams}));
    s.orders=s.customers.slice(0,2).map((c,i)=>({id:`o${i}`,customerId:c.id,status:'服务中',serviceType:'包餐',startDate:D.today(),endDate:date,credits:10,portions:1,meals:['lunch'],weekdays:[0,1,2,3,4,5,6]}));
    await page.route('**/api/merchant',async route=>{
      if(route.request().method()==='PUT'){const body=route.request().postDataJSON();D.validate(body.state);assert.equal(body.revision,rev);s=body.state;rev++;return route.fulfill({json:{ok:true,revision:rev}});}
      return route.fulfill({json:{state:s,revision:rev}});
    });
    await page.reload();await page.getByRole('heading',{name:'本餐主菜单',exact:true}).waitFor();
    assert.ok(await page.getByRole('button',{name:'菜单定好了，确认用餐人 →'}).isDisabled());
    await page.getByRole('button',{name:'选择备用菜',exact:true}).click();
    await page.locator('input[name=dish][value=beef]').check();await page.locator('input[name=dish][value=carrot]').check();
    await page.getByLabel('搜索常用菜').fill('牛肉');assert.equal(await page.locator('.pick-row:visible').count(),1);
    await page.getByRole('button',{name:'使用这些菜',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});
    assert.equal(D.planOf(s,date,'lunch').backups.length,2);assert.equal(s.boxes[0].items.length,5);
    await page.screenshot({path:'tmp/preparation-menu.png',fullPage:true});
    await page.getByRole('button',{name:'菜单定好了，确认用餐人 →'}).click();await page.getByRole('heading',{name:'确认这餐谁来吃'}).waitFor();
    assert.ok(await page.getByRole('button',{name:'名单确认，生成标签 →'}).isDisabled());
    await page.screenshot({path:'tmp/preparation-conflict.png',fullPage:true});
    await page.getByRole('button',{name:'换备用菜',exact:true}).click();await page.locator('[data-action=use-backup][data-dish=beef]').click();await page.locator('dialog').waitFor({state:'hidden'});
    assert.equal(s.boxes[0].items[1].dishId,'beef');assert.equal(s.boxes[1].items[1].dishId,'chicken');
    await page.getByLabel('周周吃这餐').uncheck();await page.getByText('本餐已暂停，不扣餐次',{exact:true}).waitFor();assert.equal(D.remaining(s,s.orders[1]),10);
    await page.getByLabel('周周吃这餐').check();await page.getByText('已恢复本餐',{exact:true}).waitFor();
    await page.getByRole('button',{name:'＋ 添加用餐人',exact:true}).click();await page.locator('input[name=customer][value=c3]').check();await page.getByRole('button',{name:'添加到本餐',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(s.boxes.length,3);
    await page.getByRole('button',{name:'名单确认，生成标签 →'}).click();await page.getByRole('heading',{name:'先贴标签，再照着克重分装'}).waitFor();
    const first=page.locator('.label-tile').first();await first.getByText('林林',{exact:false}).waitFor();await first.getByText('春和路12号3栋201室（测试）',{exact:true}).waitFor();
    assert.equal(await first.getByText('黑椒牛肉',{exact:true}).count(),1);assert.equal(await first.getByText('番茄鸡肉',{exact:true}).count(),0);
    assert.ok(await page.getByRole('button',{name:'本餐分装完成',exact:true}).isDisabled());
    await page.screenshot({path:'tmp/preparation-labels.png',fullPage:true});
    await page.evaluate(()=>{window.print=()=>{window.printCalls=(window.printCalls||0)+1;};});
    await page.getByRole('button',{name:'打印全部 3 张',exact:true}).click();await page.getByRole('button',{name:'确认已打印 / 已保存 PDF'}).waitFor();
    await page.emulateMedia({media:'print'});assert.ok(await page.locator('.print-label').evaluateAll(labels=>labels.every(el=>el.scrollHeight<=el.clientHeight&&el.scrollWidth<=el.clientWidth)));
    await page.pdf({path:'tmp/preparation-labels.pdf',preferCSSPageSize:true,printBackground:true});await page.screenshot({path:'tmp/preparation-print.png',fullPage:true});await page.emulateMedia({media:'screen'});
    await page.getByRole('button',{name:'确认已打印 / 已保存 PDF'}).click();await page.locator('dialog').waitFor({state:'hidden'});assert.ok(s.boxes.every(b=>b.version===b.exportedVersion));assert.equal(D.remaining(s,s.orders[0]),10);
    await page.getByRole('button',{name:'改这份餐',exact:true}).first().click();await page.locator('input[name=grams0]').fill('90');await page.getByRole('button',{name:'保存本餐调整'}).click();await page.locator('dialog').waitFor({state:'hidden'});
    assert.notEqual(s.boxes[0].version,s.boxes[0].exportedVersion);assert.ok(await page.getByRole('button',{name:'打印全部 3 张',exact:true}).isDisabled());
    await page.getByRole('button',{name:'返回核对',exact:true}).click();await page.getByRole('button',{name:'名单确认，生成标签 →'}).click();await page.getByRole('button',{name:'只重打这些标签',exact:true}).click();await page.getByRole('button',{name:'确认已打印 / 已保存 PDF'}).click();await page.locator('dialog').waitFor({state:'hidden'});
    await page.reload();await page.getByRole('heading',{name:'先贴标签，再照着克重分装'}).waitFor();
    // Missing calories require explicit acknowledgement and never become a zero total.
    const beforeMissing=D.copy(s);s.dishes.find(d=>d.id==='rice').nutrition={source:'legacy',basis:'cooked',kcal100:null};rev++;
    await page.reload();await page.getByRole('button',{name:'名单确认，生成标签 →'}).click();await page.getByRole('button',{name:'打印全部 3 张',exact:true}).waitFor();await page.evaluate(()=>{window.print=()=>{window.printCalls=(window.printCalls||0)+1;};});
    await page.getByRole('button',{name:'打印全部 3 张',exact:true}).click();await page.getByRole('heading',{name:'还有热量未补齐'}).waitFor();assert.equal(await page.evaluate(()=>window.printCalls||0),0);
    await page.getByRole('button',{name:'仍打印，标明热量待补充'}).click();await page.getByRole('button',{name:'确认已打印 / 已保存 PDF'}).waitFor();assert.equal(await page.locator('#printArea').getByText('待补充',{exact:true}).count(),3);await page.getByRole('button',{name:'关闭',exact:true}).last().click();
    // Oversized content is caught before opening the print dialog, not silently clipped.
    s=beforeMissing;s.settings.labelWidth=30;s.settings.labelHeight=30;rev++;
    await page.reload();await page.getByRole('button',{name:'打印全部 3 张',exact:true}).waitFor();await page.evaluate(()=>{window.print=()=>{window.printCalls=(window.printCalls||0)+1;};});
    await page.getByRole('button',{name:'打印全部 3 张',exact:true}).click();await page.getByRole('heading',{name:'标签内容超出纸张'}).waitFor();assert.equal(await page.evaluate(()=>window.printCalls||0),0);await page.getByRole('button',{name:'关闭',exact:true}).last().click();
    s.settings.labelWidth=50;s.settings.labelHeight=70;rev++;await page.reload();await page.getByRole('heading',{name:'先贴标签，再照着克重分装'}).waitFor();
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:'tmp/preparation-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.setViewportSize({width:1440,height:1100});
    await page.getByRole('button',{name:'今天分装',exact:true}).click();await page.getByRole('button',{name:'沿用上次',exact:true}).click();
    // Simulate the next day by switching the fixture dates to today, then reload; no clock/timezone assumptions.
    const original=D.copy(s);s.menus[`${D.today()}:lunch`]=D.copy(s.menus[`${date}:lunch`]);D.planOf(s,D.today(),'lunch').backups=D.copy(D.planOf(s,date,'lunch').backups);D.sync(s,D.today(),'lunch');
    s.customers[0].restrictions=[];D.confirmMenu(s,D.today(),'lunch');D.confirmRoster(s,D.today(),'lunch');rev++;
    await page.reload();await page.getByRole('button',{name:'今天分装',exact:true}).click();await page.getByRole('button',{name:'本餐分装完成',exact:true}).click();await page.getByRole('button',{name:'确认完成',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(D.remaining(s,s.orders[0]),9);
    await page.getByRole('button',{name:'客户与订餐'}).click();await page.getByRole('button',{name:'新增客户',exact:true}).click();await page.locator('input[name=name]').fill('新客户测试');await page.locator('select[name=fulfillment]').selectOption('pickup');await page.getByRole('button',{name:'保存客户',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(s.customers.at(-1).fulfillment,'pickup');
    await page.getByRole('button',{name:'＋ 记一单',exact:true}).click();await page.locator('input[name=name]').fill('新订餐测试');await page.locator('input[name=nickname]').fill('小禾');await page.locator('input[name=address]').fill('测试配送地址 8 号');await page.getByRole('button',{name:'保存并安排出餐'}).click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(s.customers.at(-1).nickname,'小禾');assert.equal(s.customers.at(-1).address,'测试配送地址 8 号');
    await page.getByRole('button',{name:'我的菜品'}).click();await page.getByRole('button',{name:'＋ 手动添加'}).click();await page.locator('input[name=name]').fill('测试菜');await page.locator('input[name=kcal]').fill('80');await page.locator('input[name=reference]').fill('测试包装标签');await page.getByRole('button',{name:'保存菜品',exact:true}).click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(s.dishes.at(-1).nutrition.source,'manual');
    assert.deepEqual(errors,[]);console.log('Browser checks passed: tomorrow, main/reserves, one-click allergy substitution, roster, pause, add diner, nickname/address labels, print-fit, reprint, reload, mobile, next-day completion, customer and manual calories. No live data writes.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
