const fs=require('node:fs/promises');
const path=require('node:path');
const credentialsFile=path.resolve(process.cwd(),'.runtime/boohee.json');
function createBoohee(options={}) {
  const request=options.fetch||fetch;
  const readKey=options.readKey|| (async()=>await fs.readFile(credentialsFile,'utf8').then(s=>JSON.parse(s).apiKey).catch(()=>'') || process.env.BOOHEE_API_KEY);
  async function api(endpoint,params,key) {
    key=key||await readKey();if(!key)throw Object.assign(new Error('请先连接薄荷健康，填写账号的 API Key'),{status:503});
    let res;
    try {res=await request(`https://api.boohee.com/open-apis/v1/food/${endpoint}?${new URLSearchParams(params)}`,{headers:{'X-Api-Key':key,Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});}
    catch {throw Object.assign(new Error('薄荷健康暂时无法连接，请稍后重试'),{status:502});}
    let data;try{data=await res.json();}catch{throw Object.assign(new Error('薄荷健康返回格式异常'),{status:502});}
    if(!res.ok||data.code!==0)throw Object.assign(new Error(`薄荷调用未成功（${data.code??res.status}），请核对授权和可用额度`),{status:502});
    return data.data;
  }
  return {
    status:async()=>({provider:'boohee',configured:Boolean(await readKey())}),
    connect:async key=>{
      if(typeof key!=='string'||key.length<10||key.length>500||/[\r\n]/.test(key))throw Object.assign(new Error('请填写有效的 API Key'),{status:422});
      await api('search',{keyword:'米饭',page:1,per_page:1},key.trim());
      await fs.mkdir(path.dirname(credentialsFile),{recursive:true});
      await fs.writeFile(credentialsFile,JSON.stringify({apiKey:key.trim()}),{mode:0o600});
      return {configured:true};
    },
    search:async(q,page=1)=>{
      const data=await api('search',{keyword:q,page,per_page:20});
      if(!Array.isArray(data?.foods))throw Object.assign(new Error('薄荷搜索结果字段不完整'),{status:502});
      return {foods:data.foods.map(f=>({code:String(f.code),name:f.name,kcal100:f.calories,isLiquid:f.is_liquid})),hasMore:Boolean(data.has_more),page};
    },
    detail:async code=>{
      const f=await api('detail',{code,with_materials:true});
      if(String(f?.code)!==code||!f.name||f.calories?.value==null||f.calories?.unit!=='kcal'||!Number.isFinite(Number(f.calories.value))||Number(f.calories.value)<0||f.is_liquid)throw Object.assign(new Error('该条目缺少按克计的有效热量，或属于液体，暂不能作为称重菜品添加'),{status:422});
      return {code:String(f.code),name:f.name,kcal100:Number(f.calories.value),foodType:f.food_type,ingredients:(f.materials?.foods||[]).map(i=>i.name).filter(Boolean)};
    }
  };
}
module.exports={createBoohee};
