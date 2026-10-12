const fs=require('node:fs/promises');
const path=require('node:path');
const credentialsFile=path.resolve(process.cwd(),'.runtime/boohee.json');
function createBoohee(options={}) {
  const request=options.fetch||fetch;
  const writeKey=options.writeKey|| (async apiKey=>{await fs.mkdir(path.dirname(credentialsFile),{recursive:true});await fs.writeFile(credentialsFile,JSON.stringify({apiKey}),{mode:0o600});});
  const readKey=options.readKey|| (async()=>await fs.readFile(credentialsFile,'utf8').then(s=>JSON.parse(s).apiKey).catch(()=>'') || process.env.BOOHEE_API_KEY);
  const fail=(message,kind,extra={})=>Object.assign(new Error(message),{status:502,kind,...extra});
  function safeMessage(value,key) {
    return String(value||'').split(key).join('[密钥已隐藏]').replace(/sk-[\w*.-]+/gi,'[密钥已隐藏]').replace(/Bearer\s+\S+/gi,'Bearer [已隐藏]').replace(/[\r\n<>]/g,' ').slice(0,240);
  }
  async function api(endpoint,params,key) {
    key=key||await readKey();if(!key)throw Object.assign(new Error('请先连接薄荷健康，填写账号的 API Key'),{status:503});
    let res;
    try {res=await request(`https://api.boohee.com/open-apis/v1/food/${endpoint}?${new URLSearchParams(params)}`,{headers:{'X-Api-Key':key,Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});}
    catch(e) {
      const code=e.cause?.code||e.code;
      if(['TimeoutError','AbortError'].includes(e.name)||['UND_ERR_CONNECT_TIMEOUT','ETIMEDOUT'].includes(code))throw fail('连接薄荷超时（12 秒）。请稍后重试；本次尚未验证 Key。','timeout');
      if(['ENOTFOUND','EAI_AGAIN'].includes(code))throw fail('无法解析薄荷接口地址，请检查本机网络 / DNS；本次尚未验证 Key。','network');
      if(['CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT'].includes(code))throw fail('薄荷 HTTPS 证书验证失败，请检查本机时间或网络代理证书；本次尚未验证 Key。','certificate');
      throw fail('本机服务无法连接薄荷接口，请检查网络或代理后重试；本次尚未验证 Key。','network');
    }
    let data;try{data=await res.json();}catch{throw fail(`薄荷接口返回非 JSON 响应（HTTP ${res.status}），请稍后重试。`,'response',{httpStatus:res.status});}
    if(!res.ok||data?.code!==0) {
      const providerCode=typeof data?.code==='number'?data.code:undefined;
      const detail=safeMessage(data?.message,key);
      const hint=res.status===401||[1049,1050].includes(providerCode)?'请核对授权，使用薄荷开放平台的完整 API Key。':res.status===403?'请确认该 Key 开通了食物搜索接口权限。':res.status===429?'请求过于频繁，请稍后重试。':res.status>=500?'薄荷服务暂时异常，请稍后重试。':'请按上述原因检查薄荷控制台的接口权限及对应套餐；有余额不代表每个接口均已开通。';
      throw fail(`薄荷返回：${detail||'请求未成功'}（HTTP ${res.status}${providerCode!==undefined?` / 错误码 ${providerCode}`:''}）。${hint}`,'provider',{httpStatus:res.status,providerCode});
    }
    return data.data;
  }
  async function verify(key) {
    const data=await api('search',{keyword:'米饭',page:1,per_page:1},key);
    if(!Array.isArray(data?.foods))throw fail('薄荷搜索响应缺少菜品列表，连接尚未确认。','response');
    return {configured:true,verified:true,message:'已成功调用薄荷食物搜索接口',checkedAt:new Date().toISOString()};
  }
  return {
    status:async()=>({provider:'boohee',configured:Boolean(await readKey())}),
    check:async()=>verify(),
    connect:async key=>{
      key=typeof key==='string'?key.trim():'';
      if(key.length<10||key.length>500||/[\s*•…]/.test(key)||!/^[\x21-\x7e]+$/.test(key))throw Object.assign(new Error('请粘贴完整 API Key，不能使用带星号的脱敏值或含空格的文本'),{status:422});
      const result=await verify(key);
      try{await writeKey(key);}catch{throw fail('薄荷验证已通过，但本机无法保存连接。请检查 .runtime 目录的写入权限。','storage');}
      return result;
    },
    search:async(q,page=1)=>{
      const data=await api('search',{keyword:q,page,per_page:20});
      if(!Array.isArray(data?.foods))throw Object.assign(new Error('薄荷搜索结果字段不完整'),{status:502});
      return {foods:data.foods.map(f=>({code:String(f.code),name:f.name,kcal100:f.calories,isLiquid:f.is_liquid})),hasMore:Boolean(data.has_more),page};
    },
    detail:async code=>{
      const f=await api('detail',{code,with_materials:true});
      if(String(f?.code)!==code||!f.name||!['number','string'].includes(typeof f.calories?.value)||String(f.calories.value).trim()===''||f.calories?.unit!=='kcal'||!Number.isFinite(Number(f.calories.value))||Number(f.calories.value)<0||f.is_liquid)throw Object.assign(new Error('该条目缺少按克计的有效热量，或属于液体，暂不能作为称重菜品添加'),{status:422});
      return {code:String(f.code),name:f.name,kcal100:Number(f.calories.value),foodType:f.food_type,ingredients:(f.materials?.foods||[]).map(i=>i.name).filter(Boolean)};
    }
  };
}
module.exports={createBoohee};
