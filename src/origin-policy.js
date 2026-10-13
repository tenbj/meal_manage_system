function createOriginPolicy(env=process.env){
 const primary=env.PUBLIC_URL||`http://localhost:${env.PORT||3200}`;
 const values=[primary,...(env.ADDITIONAL_PUBLIC_URLS||'').split(',').map(s=>s.trim()).filter(Boolean)];
 const allowed=new Set(values.map(value=>{
  let url;try{url=new URL(value);}catch{throw Error('Invalid public origin configuration');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Public URLs must be HTTP(S) origins without paths or credentials');
  return url.origin;
 }));
 function requestOrigin({origin,host,secure=false,referer}){
  if(origin)return allowed.has(origin)?origin:null;
  const matches=[...allowed].filter(value=>{
   try{const candidate=new URL(value);return new URL(candidate.protocol+'//'+host).host===candidate.host;}catch{return false;}
  });
  if(secure){const tls=matches.find(value=>value.startsWith('https:'));if(tls)return tls;}
  if(matches.length===1)return matches[0];
  if(referer){try{const value=new URL(referer).origin;if(matches.includes(value))return value;}catch{}}
  return null;
 }
 return {allows:origin=>typeof origin==='string'&&allowed.has(origin),secure:origin=>allowed.has(origin)&&origin.startsWith('https:'),requestOrigin};
}
module.exports={createOriginPolicy};
