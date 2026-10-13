function createOriginPolicy(env=process.env){
 const primary=env.PUBLIC_URL||`http://localhost:${env.PORT||3200}`;
 const values=[primary,...(env.ADDITIONAL_PUBLIC_URLS||'').split(',').map(s=>s.trim()).filter(Boolean)];
 const allowed=new Set(values.map(value=>{
  let url;try{url=new URL(value);}catch{throw Error('Invalid public origin configuration');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Public URLs must be HTTP(S) origins without paths or credentials');
  return url.origin;
 }));
 return {allows:origin=>typeof origin==='string'&&allowed.has(origin),secure:origin=>allowed.has(origin)&&origin.startsWith('https:')};
}
module.exports={createOriginPolicy};
