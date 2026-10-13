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
  await context.route('**/*',route=>{const headers=route.request().headers();delete headers.referer;return route.continue({headers});});
  const read=async(page,base)=>{const response=await page.request.get(base+'/api/merchant');assert.equal(response.status(),200);return (await response.json()).state;};
  const addCustomer=async(page,base,name)=>{await page.getByRole('button',{name:'客户与订单',exact:true}).click();await page.getByRole('button',{name:'登记新客户',exact:true}).click();await page.locator('#dialog input[name=name]').fill(name);await page.locator('select[name=fulfillment]').selectOption('pickup');await page.getByRole('button',{name:'保存客户',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});assert((await read(page,base)).customers.some(c=>c.name===name));};
  const logout=async page=>{await page.locator('.session-menu summary').click();await page.getByRole('button',{name:'退出登录',exact:true}).click();await page.locator('#username').waitFor();};
  const pages=[];
  for(const base of [cfg.PUBLIC_URL,cfg.ADDITIONAL_PUBLIC_URLS]){
   const page=await context.newPage();await page.goto(base+'/login');await page.locator('#username').fill('test');await page.locator('#password').fill(cfg.INITIAL_PASSWORD);await page.locator('#submit').click();await page.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();pages.push(page);
   assert.equal(new URL(page.url()).origin,base,'Entry unexpectedly redirected to another protocol');
   assert.equal((await page.request.get(base+'/auth/me')).status(),200);
   await page.screenshot({path:path.join(ctx.runDir,base.startsWith('https')?'https.jpg':'http.jpg'),fullPage:true});
  }
  const cookies=await context.cookies();
  assert(cookies.some(c=>c.name==='meal_session_http'&&!c.secure));
  assert(cookies.some(c=>c.name==='meal_session_https'&&c.secure));
  checks.push('same-host real HTTP and local TLS simultaneous login with independent cookie names and Secure attributes');
  const [page,secure]=pages;
  await addCustomer(page,cfg.PUBLIC_URL,'Isolated HTTP customer');
  await secure.reload();await secure.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();
  assert((await read(secure,cfg.ADDITIONAL_PUBLIC_URLS)).customers.some(c=>c.name==='Isolated HTTP customer'));
  await addCustomer(secure,cfg.ADDITIONAL_PUBLIC_URLS,'Isolated HTTPS customer');
  assert((await read(page,cfg.PUBLIC_URL)).customers.some(c=>c.name==='Isolated HTTPS customer'));checks.push('both protocols real business writes and shared-account readback without Referer');
  await logout(page);assert.equal((await page.request.get(cfg.PUBLIC_URL+'/auth/me')).status(),401);await secure.reload();await secure.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();checks.push('HTTP logout remains logged out while HTTPS session stays valid');
  await secure.goto(cfg.ADDITIONAL_PUBLIC_URLS+'/diagrams/erd.html');assert.equal(await secure.locator('.entity').count(),15);
  for(let i=0;i<20;i++)await secure.locator('#toggle').click();assert.equal(await secure.locator('.entity').count(),15);
  await secure.locator('.entity').first().click();assert((await secure.locator('#details').innerText()).length>30);
  await secure.locator('.entity').first().click({button:'right'});await secure.locator('#hide').click();assert.equal(await secure.locator('.entity').count(),14);await secure.locator('#show').click();assert.equal(await secure.locator('.entity').count(),15);
  await secure.screenshot({path:path.join(ctx.runDir,'erd.jpg'),fullPage:true});checks.push('15 entity ER details/toggle20/hide/show');
  await secure.goto(cfg.ADDITIONAL_PUBLIC_URLS+'/diagrams/architecture.html');assert.equal(await secure.locator('svg').count(),1);await secure.screenshot({path:path.join(ctx.runDir,'architecture.jpg'),fullPage:true});
  for(const name of ['erd','architecture']){await secure.goto(require('node:url').pathToFileURL(path.join(ctx.root,'docs/diagrams',name+'.html')).href);assert.equal(await secure.locator('svg').count(),1);}checks.push('both diagrams rendered offline');
  await secure.goto(cfg.ADDITIONAL_PUBLIC_URLS+'/');await secure.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();await logout(secure);
  const entries=[[page,cfg.PUBLIC_URL,'http'],[secure,cfg.ADDITIONAL_PUBLIC_URLS,'https']];
  for(const [entry,base,label] of entries){
   await entry.setViewportSize({width:390,height:844});await entry.goto(base+'/login');await entry.locator('#register-tab').click();await entry.locator('#displayName').fill('Browser '+label);await entry.locator('#username').fill('browser_'+label+'_'+Date.now().toString(36));await entry.locator('#password').fill('isolated-browser-password');await entry.locator('#confirm').fill('isolated-browser-password');await entry.locator('#submit').click();await entry.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();assert.equal(new URL(entry.url()).origin,base);
   assert.equal((await read(entry,base)).customers.length,0);await addCustomer(entry,base,'Private '+label+' customer');assert(await entry.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await entry.screenshot({path:path.join(ctx.runDir,'mobile-'+label+'.jpg'),fullPage:true});
  }
  for(const [entry,base,label] of entries){const state=await read(entry,base);assert.equal(state.customers.length,1);assert.equal(state.customers[0].name,'Private '+label+' customer');}
  checks.push('HTTP and HTTPS mobile registration, independent empty accounts, both business writes and cross-account isolation');
  await logout(secure);assert.equal((await secure.request.get(cfg.ADDITIONAL_PUBLIC_URLS+'/auth/me')).status(),401);assert.equal((await read(page,cfg.PUBLIC_URL)).customers[0].name,'Private http customer');await page.reload();await page.getByRole('heading',{name:'备餐工作台',exact:true}).waitFor();await logout(page);assert.equal((await page.request.get(cfg.PUBLIC_URL+'/auth/me')).status(),401);checks.push('HTTPS logout cannot borrow HTTP cookie and leaves HTTP account working; both final logouts verified');
  fs.writeFileSync(path.join(ctx.runDir,'browser.json'),JSON.stringify({passed:true,checks}));console.log(JSON.stringify({passed:true,checks}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
