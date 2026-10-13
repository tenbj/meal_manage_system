const crypto = require('node:crypto');
const express = require('express');
const { config } = require('./config');
const equal = (a,b) => typeof a==='string' && typeof b==='string' && !!a && !!b && crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(),crypto.createHash('sha256').update(b).digest());
function installAuth(app) {
  const token = process.env.APP_ACCESS_TOKEN || '';
  const readToken = process.env.APP_READ_TOKEN || '';
  if(process.env.NODE_ENV==='production'&&(!token||!readToken||token.length<24||readToken.length<24||equal(token,readToken)))throw new Error('Production requires distinct read/write tokens of at least 24 characters');
  const origin = process.env.PUBLIC_URL || `http://localhost:${config.port}`;
  const sign = value => crypto.createHmac('sha256',token).update(value).digest('hex');
  const cookie = req => {
    const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('meal_session='))?.slice(13)||'';
    const [expiry,signature]=value.split('.');
    return Number(expiry)>Date.now() && equal(signature,sign(expiry));
  };
  app.get('/login',(req,res)=>res.sendFile(require('node:path').resolve('public/login.html')));
  app.post('/auth/login',express.urlencoded({extended:false}), (req,res)=> {
    if (!token || !equal(req.body.token,token)) return res.status(401).send('访问口令不正确，请返回重试。');
    if(req.get('origin') && req.get('origin')!==origin) return res.status(403).send('来源不匹配');
    const expires=String(Date.now()+8*3600*1000);
    res.set('Set-Cookie',`meal_session=${expires}.${sign(expires)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${origin.startsWith('https:')?'; Secure':''}`).redirect('/');
  });
  app.post('/auth/logout',(req,res)=>res.set('Set-Cookie','meal_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0').redirect('/login'));
  app.use((req,res,next)=> {
    if(!token) return next(); // Native legacy compatibility; Docker configuration requires a token.
    if(req.path==='/health/live'||req.path==='/health/ready') return next();
    const bearer=(req.get('authorization')||'').replace(/^Bearer /,'');
    req.access=equal(bearer,token)?'write':equal(bearer,readToken)?'read':cookie(req)?'write':null;
    if(!req.access) return req.path.startsWith('/api/')||req.path==='/mcp'?res.status(401).json({message:'需要有效访问凭据'}):res.redirect('/login');
    if(req.get('origin') && req.get('origin')!==origin) return res.status(403).json({message:'来源不匹配'});
    if(req.access==='read'&&!['GET','HEAD','OPTIONS'].includes(req.method)&&req.path!=='/mcp')return res.status(403).json({message:'只读凭据不能写入'});
    next();
  });
}
module.exports={installAuth};
