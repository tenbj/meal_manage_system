const fs=require('node:fs'),path=require('node:path');
exports.open=async page=>{
 const root=path.resolve(__dirname,'../..'),base='http://fixture.test';
 // API routes already registered by the scenario take precedence when fallback is used.
 await page.route(base+'/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/'))return route.fallback();
  if(url.pathname==='/auth/me')return route.fulfill({json:{user:{id:99,username:'fixture',displayName:'Fixture'}}});
  if(route.request().method()!=='GET')return route.abort('blockedbyclient');
  const rel=url.pathname==='/'?'index.html':url.pathname.slice(1),file=path.resolve(root,'public',rel);
  if(!file.startsWith(path.join(root,'public')+path.sep)||!fs.existsSync(file))return route.abort();
  const contentType=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream';
  return route.fulfill({body:fs.readFileSync(file),contentType});
 });
 await page.goto(base+'/');
};
