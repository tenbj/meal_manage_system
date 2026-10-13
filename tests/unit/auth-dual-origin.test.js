const {test}=require('node:test'),assert=require('node:assert/strict'),express=require('express');
test('HTTP and HTTPS login/logout cookies and session API origin checks coexist',async t=>{
 const db=require('../../src/db');
 const user={id:99,username:'fixture',display_name:'Fixture',password_hash:await require('../../src/accounts').hashPassword('fixture-password-123'),scope:'write'};
 t.mock.method(db,'getPool',()=>({query:async sql=>sql.startsWith('SELECT')?[[user]]:[{affectedRows:1}]}));
 const saved=[process.env.PUBLIC_URL,process.env.ADDITIONAL_PUBLIC_URLS];
 process.env.PUBLIC_URL='https://meal.example.com';process.env.ADDITIONAL_PUBLIC_URLS='http://example.com:13200';
 const app=express();app.use(express.json());require('../../src/auth').installAuth(app);app.post('/api/probe',(req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{for(const origin of ['https://meal.example.com','http://example.com:13200']){
  const r=await fetch(base+'/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'fixture',password:'fixture-password-123'})});
  assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert(cookie.startsWith(origin.startsWith('https:')?'meal_session_https=':'meal_session_http='));assert.equal(/; Secure/.test(cookie),origin.startsWith('https:'));assert(cookie.includes('HttpOnly'));assert(cookie.includes('SameSite=Strict'));assert(!cookie.includes('Domain='));
  const headers={Origin:origin,Cookie:cookie.split(';')[0]};assert.equal((await fetch(base+'/api/probe',{method:'POST',headers})).status,200);
  assert.equal((await fetch(base+'/api/probe',{method:'POST',headers:{...headers,Origin:'https://evil.invalid'}})).status,403);
  assert.equal((await fetch(base+'/api/probe',{method:'POST',headers:{Cookie:headers.Cookie}})).status,401);
  const out=await fetch(base+'/auth/logout',{method:'POST',headers,redirect:'manual'});assert.equal(out.status,302);assert(out.headers.get('set-cookie').includes('Max-Age=0'));assert.equal(/; Secure/.test(out.headers.get('set-cookie')),origin.startsWith('https:'));
 }
 for(const Origin of ['https://evil.invalid','null'])assert.equal((await fetch(base+'/auth/register',{method:'POST',headers:{Origin,'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/probe',{method:'POST',headers:{Origin:'https://meal.example.com',Cookie:'meal_session=legacy-cookie'}})).status,401);
 }finally{await new Promise(r=>server.close(r));for(const [i,key] of ['PUBLIC_URL','ADDITIONAL_PUBLIC_URLS'].entries()){if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];}}
});

test('no-referrer entry reads and logout never borrow the other protocol session',async t=>{
 const request=(url,options={})=>new Promise((resolve,reject)=>{const req=require('node:http').request(url,options,res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,json:async()=>JSON.parse(body)}));});req.on('error',reject);req.end();});
 const db=require('../../src/db'),{digest}=require('../../src/accounts');
 const tokens=new Map([[digest('synthetic-http-session'),{id:91,username:'http_fixture',display_name:'HTTP',scope:'write'}],[digest('synthetic-https-session'),{id:92,username:'https_fixture',display_name:'HTTPS',scope:'write'}]]);
 t.mock.method(db,'getPool',()=>({query:async(sql,args)=>{
  if(sql.startsWith('DELETE')){tokens.delete(args[0]);return[{affectedRows:1}];}
  return [[...(tokens.has(args?.[0])?[tokens.get(args[0])]:[])]];
 }}));
 const saved=[process.env.PUBLIC_URL,process.env.ADDITIONAL_PUBLIC_URLS];
 process.env.PUBLIC_URL='https://meal.example.test:14443';process.env.ADDITIONAL_PUBLIC_URLS='http://meal.example.test:13200';
 delete require.cache[require.resolve('../../src/auth')];
 const app=express();app.use(express.json());require('../../src/auth').installAuth(app);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port,both='meal_session_http=synthetic-http-session; meal_session_https=synthetic-https-session';
 try{
  for(const [origin,username] of [['http://meal.example.test:13200','http_fixture'],['https://meal.example.test:14443','https_fixture']]){
   const r=await request(base+'/auth/me',{headers:{Host:new URL(origin).host,Cookie:both}});assert.equal(r.status,200);assert.equal((await r.json()).user.username,username);
  }
  assert.equal((await request(base+'/auth/me',{headers:{Host:'meal.example.test:14443',Cookie:'meal_session_http=synthetic-http-session'}})).status,401);
  assert.equal((await request(base+'/auth/me',{headers:{Host:'meal.example.test:13200',Cookie:'meal_session_https=synthetic-https-session'}})).status,401);
  assert.equal((await request(base+'/auth/me',{headers:{Host:'unknown.example.test',Cookie:both}})).status,401);
  const out=await request(base+'/auth/logout',{method:'POST',headers:{Origin:'https://meal.example.test:14443',Cookie:both},redirect:'manual'});assert.equal(out.status,302);
  assert.equal((await request(base+'/auth/me',{headers:{Host:'meal.example.test:14443',Cookie:both}})).status,401);
  assert.equal((await request(base+'/auth/me',{headers:{Host:'meal.example.test:13200',Cookie:both}})).status,200);
 }finally{await new Promise(r=>server.close(r));for(const [i,key] of ['PUBLIC_URL','ADDITIONAL_PUBLIC_URLS'].entries()){if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];}}
});
