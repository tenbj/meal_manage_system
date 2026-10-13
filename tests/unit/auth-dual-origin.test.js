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
  assert.equal((await fetch(base+'/api/probe',{method:'POST',headers:{Cookie:headers.Cookie}})).status,403);
  const out=await fetch(base+'/auth/logout',{method:'POST',headers,redirect:'manual'});assert.equal(out.status,302);assert(out.headers.get('set-cookie').includes('Max-Age=0'));assert.equal(/; Secure/.test(out.headers.get('set-cookie')),origin.startsWith('https:'));
 }
 for(const Origin of ['https://evil.invalid','null'])assert.equal((await fetch(base+'/auth/register',{method:'POST',headers:{Origin,'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/probe',{method:'POST',headers:{Origin:'https://meal.example.com',Cookie:'meal_session=legacy-cookie'}})).status,401);
 }finally{await new Promise(r=>server.close(r));for(const [i,key] of ['PUBLIC_URL','ADDITIONAL_PUBLIC_URLS'].entries()){if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i];}}
});
