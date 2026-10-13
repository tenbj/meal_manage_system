// Isolated real database/API/MCP test. Never run with production configuration.
const fs=require('fs'),assert=require('assert/strict'),dotenv=require('dotenv');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const context=require('../support/context.cjs')();const cfg=context.config;
const base=cfg.PUBLIC_URL,checks=[];
async function request(path,{method='GET',body,cookie,token,origin=base,expected=200}={}){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
 const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={}}
 assert.equal(r.status,expected,path+' '+JSON.stringify(data));
 return {data,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
}
async function main(){
 await request('/api/merchant',{expected:401});await request('/api/state',{expected:401});
 await request('/api/merchant',{token:'bad-token',expected:401});
 await request('/auth/login',{method:'POST',body:{username:'test',password:cfg.INITIAL_PASSWORD},origin:'http://evil.invalid',expected:403});
 await request('/auth/login',{method:'POST',body:{username:'test',password:'incorrect'},expected:401});
 await request('/auth/register',{method:'POST',body:{username:'test',password:'long-password-here'},expected:409});
 await request('/auth/register',{method:'POST',body:{username:'bad',password:'short'},expected:422});
 const test=await request('/auth/login',{method:'POST',body:{username:'test',password:cfg.INITIAL_PASSWORD}});
 assert.match(test.headers.get('set-cookie'),/HttpOnly/);assert.match(test.headers.get('set-cookie'),/SameSite=Strict/);
 const initial=(await request('/api/merchant',{cookie:test.cookie})).data;
 assert(initial.state.customers.some(x=>x.id==='baseline-customer'));
 const users=[];
 for(const username of ['alice','bobby'].map(x=>x+Date.now().toString().slice(-7))){
  const user=await request('/auth/register',{method:'POST',body:{username,password:'isolated-password-'+username,displayName:username},expected:201});
  user.username=username;user.id=user.data.user.id;users.push(user);
  const empty=(await request('/api/merchant',{cookie:user.cookie})).data;assert.equal(empty.state.customers.length,0);assert.equal(empty.state.dishes.length,0);
  const old=(await request('/api/state',{cookie:user.cookie})).data;assert(Object.entries(old).filter(([k])=>k!=='meta').every(([,v])=>v.length===0));
 }
 const [a,b]=users;
 await request('/auth/register',{method:'POST',body:{username:a.username.toUpperCase(),password:'long-password-here'},expected:409});
 checks.push('register-login-validation-and-empty-workspaces');
 // Deliberately identical request IDs and legacy IDs must be independent across users.
 for(const user of users){
  const created=await request('/api/v1/customers',{method:'POST',cookie:user.cookie,body:{request_id:'same-request-id',expected_version:1,evidence:'isolated test',name:user.username+' customer'}});user.created=created.data;
  assert.equal((await request('/api/v1/customers',{method:'POST',cookie:user.cookie,body:{request_id:'same-request-id',expected_version:1,evidence:'isolated test',name:user.username+' customer'}})).data.revision,2);
  await request('/api/v1/customers',{method:'POST',cookie:user.cookie,body:{request_id:'same-request-id',expected_version:1,evidence:'changed',name:'other'},expected:409});
  await request('/api/state',{method:'POST',cookie:user.cookie,body:{customers:[{id:'same-id',name:user.username,phone:'000'}],dishes:[{id:'same-dish',name:user.username+' rice',category:'主食'}]}});
 }
 for(const user of users){const w=(await request('/api/merchant?owner_id=1',{cookie:user.cookie})).data;assert.equal(w.state.customers.length,1);assert.equal(w.state.customers[0].name,user.username+' customer');assert.equal((await request('/api/state',{cookie:user.cookie})).data.customers[0].name,user.username);}
 const all=await Promise.all(Array.from({length:24},(_,i)=>request('/api/merchant',{cookie:users[i%2].cookie})));
 all.forEach((r,i)=>assert.equal(r.data.state.customers[0].name,users[i%2].username+' customer'));
 assert.deepEqual((await request('/api/merchant',{cookie:test.cookie})).data,initial);
 await request('/api/state',{method:'POST',cookie:a.cookie,body:{}});assert.equal((await request('/api/state',{cookie:b.cookie})).data.customers.length,1);
 checks.push('workspace-legacy-write-delete-concurrent-owner-isolation-and-idempotency');
 // Account-bound machine credentials, permissions, revocation and MCP identity.
 for(const user of users){
  user.read=(await request('/auth/tokens',{method:'POST',cookie:user.cookie,body:{name:'reader',scope:'read'},expected:201})).data;
  user.write=(await request('/auth/tokens',{method:'POST',cookie:user.cookie,body:{name:'writer',scope:'write'},expected:201})).data;
  await request('/auth/tokens',{token:user.write.token,expected:403});
  const listed=(await request('/auth/tokens',{cookie:user.cookie})).data;assert(!JSON.stringify(listed).includes(user.read.token));
  await request('/api/v1/customers',{method:'POST',token:user.read.token,body:{},expected:403});
  const mcp=new Client({name:'account-isolation-test',version:'1'});
  await mcp.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+user.read.token}}}));
  assert.equal((await mcp.listTools()).tools.length,13);
  const read=JSON.parse((await mcp.callTool({name:'get_workspace',arguments:{}})).content[0].text);assert.equal(read.state.customers[0].name,user.username+' customer');
  const denied=JSON.parse((await mcp.callTool({name:'create_customer',arguments:{name:'forbidden',request_id:'denied-request',expected_version:2,evidence:'isolated'}})).content[0].text);assert.equal(denied.httpStatus,403);await mcp.close();
  const writer=new Client({name:'account-write-test',version:'1'});await writer.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+user.write.token}}}));
  const saved=JSON.parse((await writer.callTool({name:'create_customer',arguments:{name:user.username+' MCP',request_id:'same-mcp-request',expected_version:2,evidence:'isolated authorized test'}})).content[0].text);assert.equal(saved.httpStatus,200);await writer.close();
 }
 await request('/auth/tokens/'+a.read.id,{method:'DELETE',cookie:b.cookie,expected:404});
 await request('/auth/tokens/'+a.read.id,{method:'DELETE',cookie:a.cookie});await request('/api/merchant',{token:a.read.token,expected:401});
 await request('/api/merchant',{token:b.read.token});
 checks.push('personal-token-scopes-revoke-no-cross-owner-MCP-read-write');
 const bobBefore=(await request('/api/merchant',{cookie:b.cookie})).data;
 await request('/auth/password',{method:'POST',cookie:a.cookie,body:{currentPassword:'incorrect',password:'new-isolated-password'},expected:422});
 await request('/auth/password',{method:'POST',cookie:a.cookie,body:{currentPassword:'isolated-password-'+a.username,password:'new-isolated-password'}});
 await request('/api/merchant',{cookie:a.cookie,expected:401});
 await request('/auth/login',{method:'POST',body:{username:a.username,password:'isolated-password-'+a.username},expected:401});
 const fresh=await request('/auth/login',{method:'POST',body:{username:a.username,password:'new-isolated-password'}});
 await request('/auth/logout',{method:'POST',cookie:fresh.cookie,body:{},expected:302});await request('/api/merchant',{cookie:fresh.cookie,expected:401});
 assert.deepEqual((await request('/api/merchant',{cookie:b.cookie})).data,bobBefore);
 await request('/api/merchant',{cookie:b.cookie,method:'PUT',body:bobBefore,origin:'http://evil.invalid',expected:403});
 checks.push('password-change-session-invalidation-logout-CSRF-other-user-unaffected');
 // Store IDs privately for isolated integration persistence probes and browser tests.
 fs.writeFileSync(require('path').join(context.runDir,'users.json'),JSON.stringify(users));
 fs.writeFileSync(require('path').join(context.runDir,'api-mcp.json'),JSON.stringify({passed:true,checks,users:users.map(x=>({id:x.id,username:x.username})),tested_at:new Date().toISOString()},null,2));
 console.log(JSON.stringify({passed:true,checks}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
