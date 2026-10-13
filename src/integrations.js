const fs=require('node:fs/promises'),path=require('node:path');
const {getPool}=require('./db');
const ddl=`CREATE TABLE IF NOT EXISTS merchant_integrations (
 provider VARCHAR(40) PRIMARY KEY,
 credential TEXT NOT NULL,
 version INT NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
async function setupIntegrations(){await getPool().query(ddl);}
const unavailable=()=>Object.assign(new Error('商家连接配置数据库暂不可用，请稍后重试'),{status:503,kind:'storage'});
const conflict=()=>Object.assign(new Error('连接配置已变更，请重新打开后再操作；不会覆盖已保存配置'),{status:409,kind:'conflict'});
function createIntegrationStore(options={}){
 const poolFor=options.getPool||getPool;
 const legacy=options.readLegacy||(async()=>{
  const file=await fs.readFile(path.resolve(process.cwd(),'.runtime/boohee.json'),'utf8').then(s=>JSON.parse(s).apiKey).catch(()=>'');
  return file?{key:file,source:'file'}:process.env.BOOHEE_API_KEY?{key:process.env.BOOHEE_API_KEY,source:'environment'}:{key:'',source:null};
 });
 async function load(){try{const [rows]=await poolFor().query('SELECT credential,version FROM merchant_integrations WHERE provider=?',['boohee']);return rows[0]||null;}catch{throw unavailable();}}
 return {
  readKey:async()=>((await load())?.credential||''),
  readLegacy:legacy,
  status:async()=>{const row=await load(),old=await legacy();return {provider:'boohee',configured:Boolean(row?.credential),source:row?'database':null,version:row?.version||0,legacyAvailable:Boolean(old.key),legacySource:old.source};},
  save:async(key,expectedVersion)=>{
   if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw Object.assign(new Error('缺少有效连接配置版本，请重新打开连接窗口'),{status:422});
   let c;
   try{
    c=await poolFor().getConnection();await c.beginTransaction();
    if(expectedVersion===0)await c.query('INSERT INTO merchant_integrations (provider,credential,version) VALUES (?,?,1)',['boohee',key]);
    else{const [r]=await c.query('UPDATE merchant_integrations SET credential=?,version=version+1 WHERE provider=? AND version=?',[key,'boohee',expectedVersion]);if(r.affectedRows!==1)throw conflict();}
    await c.commit();return {version:expectedVersion+1};
   }catch(e){if(c)await c.rollback().catch(()=>{});if(e.code==='ER_DUP_ENTRY'||e.status===409)throw conflict();throw unavailable();}
   finally{c?.release();}
  }
 };
}
module.exports={setupIntegrations,createIntegrationStore};
