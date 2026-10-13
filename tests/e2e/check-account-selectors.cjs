// Full current UI workflow against synthetic intercepted interfaces; never a runtime-auth claim.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const D=require('../../public/assets/merchant-domain');
const root=path.resolve(__dirname,'../..'),runDir=path.join(root,'.test-runs/e2e/accounts');
fs.mkdirSync(runDir,{recursive:true});
const users=new Map([['test',{id:1,username:'test',displayName:'Synthetic test',state:D.initial(),revision:0}]]),sessions=new Map();
const cfg={PUBLIC_URL:'http://fixture.test:18080',ADDITIONAL_PUBLIC_URLS:'https://fixture.test:18443',INITIAL_PASSWORD:'synthetic-ui-password'};
require('../support/browser-flow.cjs')({root,runDir,config:cfg,synthetic:true},async context=>{
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.protocol==='file:')return route.continue();
  if(url.hostname!=='fixture.test')return route.abort('blockedbyclient');
  const secure=url.protocol==='https:',name=secure?'meal_session_https':'meal_session_http';
  const cookies=Object.fromEntries((request.headers().cookie||'').split(';').filter(x=>x.includes('=')).map(x=>x.trim().split('=')));
  const user=sessions.get(cookies[name]),cookie=value=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
  if(['/auth/login','/auth/register'].includes(url.pathname)){
   const body=request.postDataJSON();
   if(url.pathname.endsWith('register'))users.set(body.username,{id:users.size+1,username:body.username,displayName:body.displayName,state:D.initial(),revision:0});
   const account=users.get(body.username),token=crypto.randomBytes(20).toString('hex');sessions.set(token,account);
   return route.fulfill({json:{user:{id:account.id,username:account.username,displayName:account.displayName}},headers:{'set-cookie':cookie(token)}});
  }
  if(url.pathname==='/auth/logout'){sessions.delete(cookies[name]);return route.fulfill({headers:{'set-cookie':cookie('')+'; Max-Age=0'},contentType:'text/html',body:fs.readFileSync(path.join(root,'public/login.html'))});}
  if(url.pathname==='/auth/me')return route.fulfill({status:user?200:401,json:user?{user:{id:user.id,username:user.username,displayName:user.displayName}}:{message:'Synthetic signed out'}});
  if(url.pathname==='/api/merchant'){
   if(!user)return route.fulfill({status:401,json:{message:'Synthetic signed out'}});
   if(request.method()==='PUT'){const body=request.postDataJSON();D.validate(body.state);if(body.revision!==user.revision)return route.fulfill({status:409,json:{message:'Synthetic conflict'}});user.state=body.state;user.revision++;return route.fulfill({json:{ok:true,revision:user.revision}});}
   return route.fulfill({json:{state:user.state,revision:user.revision}});
  }
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:{configured:false}});
  const file=url.pathname.startsWith('/diagrams/')?path.join(root,'docs',url.pathname.slice(1)):path.join(root,'public',url.pathname==='/'?'index.html':url.pathname==='/login'?'login.html':url.pathname.slice(1));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort('blockedbyclient');
  const contentType=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
  return route.fulfill({body:fs.readFileSync(file),contentType});
 });
}).then(()=>console.log('Synthetic full account UI flow passed; runtime authentication requires Docker acceptance')).catch(e=>{console.error(e.message);process.exitCode=1});
