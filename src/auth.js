const crypto=require('node:crypto'),express=require('express');
const {getPool}=require('./db');
const {digest,checkPassword,hashPassword,credentials,register}=require('./accounts');
const {identity}=require('./identity');
const {config}=require('./config');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function installAuth(app){
 const origins=require('./origin-policy').createOriginPolicy();
 const requestOrigin=req=>origins.requestOrigin({origin:req.get('origin'),host:req.get('host'),secure:req.socket.encrypted===true,referer:req.get('referer')});
 const cookie=(req,value)=>`meal_session_${origins.secure(req.get('origin'))?'https':'http'}=${value}; Path=/; HttpOnly; SameSite=Strict${origins.secure(req.get('origin'))?'; Secure':''}`;
 const cookieToken=req=>{
  const values=new Map((req.headers.cookie||'').split(';').map(x=>{const p=x.trim().indexOf('=');return [x.trim().slice(0,p),x.trim().slice(p+1)];}));
  const origin=requestOrigin(req);if(!origin)return '';
  return values.get(origins.secure(origin)?'meal_session_https':'meal_session_http')||'';
 };
 const safeUser=u=>({id:u.id,username:u.username,displayName:u.display_name});
 const counters=new Map();
 const limited=(req,action)=>{
  const key=action+':'+digest(req.socket.remoteAddress||'unknown'),now=Date.now(),window=action==='register'?3600000:60000;
  if(counters.size>10000)for(const [k,v] of counters)if(v.until<now)counters.delete(k);
  let entry=counters.get(key);if(!entry||entry.until<now){entry={n:0,until:now+window};counters.set(key,entry);}
  return ++entry.n>(action==='register'?10:30);
 };
 const sameOrigin=(req,res,next)=>origins.allows(req.get('origin'))?next():res.status(403).json({message:'来源不匹配，请从系统页面操作'});
 const session=async(req,res,user)=>{
  const token=crypto.randomBytes(32).toString('base64url');
  await getPool().query('INSERT INTO app_sessions(token_hash,owner_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))',[digest(token),user.id]);
  await getPool().query('DELETE FROM app_sessions WHERE expires_at<=UTC_TIMESTAMP() LIMIT 1000');
  res.set('Set-Cookie',cookie(req,token)+'; Max-Age=604800');
 };
 app.use('/auth',express.urlencoded({extended:false}), (req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.get('/login',(req,res)=>res.set('Cache-Control','no-store').sendFile(require('node:path').resolve('public/login.html')));
 app.post('/auth/register',sameOrigin,wrap(async(req,res)=>{
  if(limited(req,'register'))return res.status(429).json({message:'注册过于频繁，请稍后再试'});
  const user=await register(req.body);await session(req,res,user);res.status(201).json({user:safeUser(user)});
 }));
 app.post('/auth/login',sameOrigin,wrap(async(req,res)=>{
  if(limited(req,'login'))return res.status(429).json({message:'尝试过于频繁，请稍后再试'});
  const username=typeof req.body.username==='string'?req.body.username.trim().toLowerCase():'';
  const [[user]]=await getPool().query('SELECT * FROM app_users WHERE username=?',[username]);
  const dummy='scrypt$00000000000000000000000000000000$'+'0'.repeat(128);
  if(!await checkPassword(req.body.password,user?.password_hash||dummy)||!user)return res.status(401).json({message:'用户名或密码不正确'});
  await session(req,res,user);res.json({user:safeUser(user)});
 }));
 app.post('/auth/logout',sameOrigin,wrap(async(req,res)=>{
  await getPool().query('DELETE FROM app_sessions WHERE token_hash=?',[digest(cookieToken(req))]);
  res.set('Set-Cookie',cookie(req,'')+'; Max-Age=0').redirect('/login');
 }));
 app.use(wrap(async(req,res,next)=>{
  if(['/health/live','/health/ready'].includes(req.path))return next();
  if(req.get('origin')&&!origins.allows(req.get('origin')))return res.status(403).json({message:'来源不匹配'});
  const bearer=/^Bearer (\S+)$/i.exec(req.get('authorization')||'')?.[1];let user;
  if(bearer){const [[row]]=await getPool().query('SELECT u.id,u.username,u.display_name,t.scope FROM app_tokens t JOIN app_users u ON u.id=t.owner_id WHERE t.token_hash=?',[digest(bearer)]);user=row;}
  else if(cookieToken(req)){const [[row]]=await getPool().query("SELECT u.id,u.username,u.display_name,'write' scope FROM app_sessions s JOIN app_users u ON u.id=s.owner_id WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP()",[digest(cookieToken(req))]);user=row;req.browserSession=!!row;}
  if(!user)return req.path.startsWith('/api/')||req.path.startsWith('/auth/')||req.path==='/mcp'?res.status(401).json({message:'请先登录'}):res.redirect('/login');
  if(req.browserSession&&!['GET','HEAD','OPTIONS'].includes(req.method)&&!origins.allows(req.get('origin')))return res.status(403).json({message:'来源不匹配'});
  if(user.scope==='read'&&!['GET','HEAD','OPTIONS'].includes(req.method)&&req.path!=='/mcp')return res.status(403).json({message:'只读凭据不能写入'});
  req.user=safeUser(user);req.access=user.scope;res.set('Cache-Control','no-store');
  identity.run({id:user.id},next);
 }));
 const browserOnly=(req,res,next)=>req.browserSession?next():res.status(403).json({message:'请在已登录的账号页面操作'});
 app.get('/auth/me',(req,res)=>res.json({user:req.user}));
 app.post('/auth/password',browserOnly,wrap(async(req,res)=>{
  if(limited(req,'password'))return res.status(429).json({message:'尝试过于频繁，请稍后再试'});
  credentials({username:req.user.username,password:req.body.password});
  const [[user]]=await getPool().query('SELECT password_hash FROM app_users WHERE id=?',[req.user.id]);
  if(!await checkPassword(req.body.currentPassword,user.password_hash))return res.status(422).json({message:'当前密码不正确'});
  const hash=await hashPassword(req.body.password),c=await getPool().getConnection();
  try{await c.beginTransaction();const [r]=await c.query('UPDATE app_users SET password_hash=? WHERE id=? AND password_hash=?',[hash,req.user.id,user.password_hash]);if(!r.affectedRows)throw Object.assign(Error('密码已变更，请重新登录'),{status:409});await c.query('DELETE FROM app_sessions WHERE owner_id=?',[req.user.id]);await c.commit();}catch(e){await c.rollback();throw e;}finally{c.release();}
  res.set('Set-Cookie',cookie(req,'')+'; Max-Age=0').json({ok:true,message:'密码已更新，请重新登录'});
 }));
 app.get('/auth/tokens',browserOnly,wrap(async(req,res)=>{const [tokens]=await getPool().query('SELECT id,name,scope,created_at FROM app_tokens WHERE owner_id=? ORDER BY created_at',[req.user.id]);res.json({tokens});}));
 app.post('/auth/tokens',browserOnly,wrap(async(req,res)=>{
  const name=typeof req.body.name==='string'?req.body.name.trim():'';if(!name||name.length>80||!['read','write'].includes(req.body.scope))return res.status(422).json({message:'请填写名称并选择权限'});
  const c=await getPool().getConnection(),token='meal_'+crypto.randomBytes(32).toString('base64url'),id=crypto.randomUUID();
  try{await c.beginTransaction();await c.query('SELECT id FROM app_users WHERE id=? FOR UPDATE',[req.user.id]);const [[count]]=await c.query('SELECT COUNT(*) n FROM app_tokens WHERE owner_id=?',[req.user.id]);if(count.n>=20)throw Object.assign(Error('最多保留20个凭据，请先撤销不用的凭据'),{status:422});await c.query('INSERT INTO app_tokens(id,owner_id,name,scope,token_hash) VALUES(?,?,?,?,?)',[id,req.user.id,name,req.body.scope,digest(token)]);await c.commit();}catch(e){await c.rollback();throw e;}finally{c.release();}
  res.status(201).json({id,token,scope:req.body.scope});
 }));
 app.delete('/auth/tokens/:id',browserOnly,wrap(async(req,res)=>{const [r]=await getPool().query('DELETE FROM app_tokens WHERE id=? AND owner_id=?',[req.params.id,req.user.id]);res.status(r.affectedRows?200:404).json({ok:!!r.affectedRows});}));
}
module.exports={installAuth};
