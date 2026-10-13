const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ctx=require('../support/context.cjs')(),cfg=ctx.config;
(async()=>{
 if(fs.existsSync(path.join(ctx.runDir,'review.request'))){
  const deadline=Date.now()+180000;
  fs.writeFileSync(path.join(ctx.runDir,'review.ready'),'ready');
  while(!fs.existsSync(path.join(ctx.runDir,'review.done'))){assert(Date.now()<deadline,'Independent review gate timed out');await new Promise(r=>setTimeout(r,500));}
 }

 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),checks=[];
 try{
  const pages=[];
  for(const base of [cfg.PUBLIC_URL,cfg.ADDITIONAL_PUBLIC_URLS]){
   const page=await context.newPage();await page.goto(base+'/login');await page.locator('#username').fill('test');await page.locator('#password').fill(cfg.INITIAL_PASSWORD);await page.locator('#submit').click();await page.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();pages.push(page);
   assert.equal((await page.request.get(base+'/auth/me')).status(),200);
   await page.screenshot({path:path.join(ctx.runDir,base.startsWith('https')?'https.jpg':'http.jpg'),fullPage:true});
  }
  const cookies=await context.cookies();
  assert(cookies.some(c=>c.name==='meal_session_http'&&!c.secure));
  assert(cookies.some(c=>c.name==='meal_session_https'&&c.secure));
  checks.push('same-host real HTTP and local TLS simultaneous login with independent cookie names and Secure attributes');
  const [page,secure]=pages;
  await page.getByRole('button',{name:'客户与订单',exact:true}).click();await page.getByRole('button',{name:'登记新客户',exact:true}).click();
  await page.locator('#dialog input[name=name]').fill('Isolated browser customer');await page.locator('select[name=fulfillment]').selectOption('pickup');await page.getByRole('button',{name:'保存客户',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
  assert((await (await page.request.get(cfg.PUBLIC_URL+'/api/merchant')).json()).state.customers.some(c=>c.name==='Isolated browser customer'));checks.push('real browser customer write and API readback');
  await secure.reload();await secure.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();
  await page.locator('.session-menu summary').click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.locator('#username').waitFor();await secure.reload();await secure.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();checks.push('HTTP logout leaves HTTPS session valid');
  await secure.goto(cfg.ADDITIONAL_PUBLIC_URLS+'/diagrams/erd.html');assert.equal(await secure.locator('.entity').count(),15);
  for(let i=0;i<20;i++)await secure.locator('#toggle').click();assert.equal(await secure.locator('.entity').count(),15);
  await secure.locator('.entity').first().click();assert((await secure.locator('#details').innerText()).length>30);
  await secure.locator('.entity').first().click({button:'right'});await secure.locator('#hide').click();assert.equal(await secure.locator('.entity').count(),14);await secure.locator('#show').click();assert.equal(await secure.locator('.entity').count(),15);
  await secure.screenshot({path:path.join(ctx.runDir,'erd.jpg'),fullPage:true});checks.push('15 entity ER details/toggle20/hide/show');
  await secure.goto(cfg.ADDITIONAL_PUBLIC_URLS+'/diagrams/architecture.html');assert.equal(await secure.locator('svg').count(),1);await secure.screenshot({path:path.join(ctx.runDir,'architecture.jpg'),fullPage:true});
  for(const name of ['erd','architecture']){await secure.goto(require('node:url').pathToFileURL(path.join(ctx.root,'docs/diagrams',name+'.html')).href);assert.equal(await secure.locator('svg').count(),1);}checks.push('both diagrams rendered offline');
  await page.setViewportSize({width:390,height:844});await page.goto(cfg.PUBLIC_URL+'/login');await page.locator('#register-tab').click();await page.locator('#displayName').fill('Browser fixture');const username='browser_'+Date.now().toString(36);await page.locator('#username').fill(username);await page.locator('#password').fill('isolated-browser-password');await page.locator('#confirm').fill('isolated-browser-password');await page.locator('#submit').click();await page.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();
  assert.equal((await(await page.request.get(cfg.PUBLIC_URL+'/api/merchant')).json()).state.customers.length,0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(ctx.runDir,'mobile.jpg'),fullPage:true});checks.push('mobile real registration and empty independent workspace');
  fs.writeFileSync(path.join(ctx.runDir,'browser.json'),JSON.stringify({passed:true,checks}));console.log(JSON.stringify({passed:true,checks}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
