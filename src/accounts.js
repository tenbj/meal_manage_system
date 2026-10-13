const crypto=require('node:crypto');
const scrypt=require('node:util').promisify(crypto.scrypt);
const {getPool}=require('./db');
const domain=require('../public/assets/merchant-domain');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const accountDDL=[
 `CREATE TABLE IF NOT EXISTS app_users (id INT PRIMARY KEY AUTO_INCREMENT, username VARCHAR(32) COLLATE utf8mb4_bin NOT NULL UNIQUE, display_name VARCHAR(80) NOT NULL, password_hash VARCHAR(200) NOT NULL, credentials_migrated TINYINT NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
 `CREATE TABLE IF NOT EXISTS app_sessions (token_hash CHAR(64) PRIMARY KEY, owner_id INT NOT NULL, expires_at DATETIME NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX (owner_id), INDEX (expires_at), FOREIGN KEY (owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
 `CREATE TABLE IF NOT EXISTS app_tokens (id CHAR(36) PRIMARY KEY, owner_id INT NOT NULL, name VARCHAR(80) NOT NULL, token_hash CHAR(64) NOT NULL UNIQUE, scope VARCHAR(10) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX (owner_id), FOREIGN KEY (owner_id) REFERENCES app_users(id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
async function hashPassword(password){const salt=crypto.randomBytes(16).toString('hex');return `scrypt$${salt}$${(await scrypt(password,salt,64)).toString('hex')}`;}
async function checkPassword(password,hash){
 if(typeof password!=='string'||password.length>128)return false;
 const [scheme,salt,encoded]=String(hash).split('$');if(scheme!=='scrypt'||!/^[a-f0-9]{128}$/.test(encoded||''))return false;
 return crypto.timingSafeEqual(await scrypt(password,salt,64),Buffer.from(encoded,'hex'));
}
function credentials(body){
 const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
 if(!/^[a-z][a-z0-9_]{2,31}$/.test(username))throw Object.assign(Error('用户名需为3–32位字母、数字或下划线，以字母开头'),{status:422});
 if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)throw Object.assign(Error('密码需为12–128个字符'),{status:422});
 const displayName=typeof body.displayName==='string'?body.displayName.trim():username;
 if(!displayName||displayName.length>80)throw Object.assign(Error('昵称需为1–80个字符'),{status:422});
 return {username,password:body.password,displayName};
}
async function register(body){
 const input=credentials(body),hash=await hashPassword(input.password),c=await getPool().getConnection();
 try{await c.beginTransaction();
  const [r]=await c.query('INSERT INTO app_users(username,display_name,password_hash) VALUES(?,?,?)',[input.username,input.displayName,hash]);
  await c.query('INSERT INTO merchant_workspace(id,owner_id,revision,payload) VALUES(1,?,1,?)',[r.insertId,JSON.stringify(domain.initial())]);
  await c.commit();return {id:r.insertId,username:input.username,display_name:input.displayName};
 }catch(e){await c.rollback();if(e.code==='ER_DUP_ENTRY')throw Object.assign(Error('该用户名已被使用'),{status:409});throw e;}finally{c.release();}
}
async function migrateAccounts(){
 const db=getPool();for(const ddl of accountDDL)await db.query(ddl);
 const [[flag]]=await db.query("SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='app_users' AND column_name='credentials_migrated'");
 if(!flag.n)await db.query('ALTER TABLE app_users ADD COLUMN credentials_migrated TINYINT NOT NULL DEFAULT 0');
 const [[existing]]=await db.query('SELECT id,username FROM app_users WHERE id=1');
 if(existing&&existing.username!=='test')throw Error('Legacy owner identity mismatch');
 if(!existing){
  const password=process.env.INITIAL_PASSWORD||process.env.APP_ACCESS_TOKEN;
  if(typeof password!=='string'||password.length<12||password.length>128)throw Error('Set INITIAL_PASSWORD (12–128 characters) before first migration');
  await db.query('INSERT INTO app_users(id,username,display_name,password_hash) VALUES(1,?,?,?)',['test','test',await hashPassword(password)]);
 }
 const tables=['customers','orders','dishes','recipes','daily_out','feedbacks','labels','deliveries','posters','merchant_workspace','merchant_integrations','api_requests'];
 for(const table of tables){
  const [[column]]=await db.query('SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',[table,'owner_id']);
  if(!column.n)await db.query(`ALTER TABLE \`${table}\` ADD COLUMN owner_id INT NOT NULL DEFAULT 1`);
  await db.query(`ALTER TABLE \`${table}\` ALTER COLUMN owner_id DROP DEFAULT`);
  const [pk]=await db.query("SELECT column_name FROM information_schema.key_column_usage WHERE table_schema=DATABASE() AND table_name=? AND constraint_name='PRIMARY' ORDER BY ordinal_position",[table]);
  if(!pk.some(x=>(x.COLUMN_NAME||x.column_name)==='owner_id')){
   const key=table==='merchant_integrations'?'provider':table==='api_requests'?'request_id':'id';
   await db.query(`ALTER TABLE \`${table}\` DROP PRIMARY KEY, ADD PRIMARY KEY(owner_id,\`${key}\`)`);
  }
  const [[fk]]=await db.query('SELECT COUNT(*) n FROM information_schema.table_constraints WHERE constraint_schema=DATABASE() AND table_name=? AND constraint_name=?',[table,'fk_'+table+'_owner']);
  if(!fk.n)await db.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT fk_${table}_owner FOREIGN KEY(owner_id) REFERENCES app_users(id)`);
 }
 for(const [table,index,key] of [['orders','uk_orders_order_no','order_no'],['recipes','uk_recipes_date','recipe_date']]){
  const [columns]=await db.query('SELECT column_name FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=?',[table,index]);
  if(!columns.some(x=>(x.COLUMN_NAME||x.column_name)==='owner_id'))await db.query(`ALTER TABLE \`${table}\` DROP INDEX \`${index}\`, ADD UNIQUE KEY \`${index}\`(owner_id,\`${key}\`)`);
 }
 // Atomic marker permits interrupted migration recovery but never resurrects revoked tokens.
 const c=await db.getConnection();
 try{await c.beginTransaction();const [[u]]=await c.query('SELECT credentials_migrated FROM app_users WHERE id=1 FOR UPDATE');
  if(!u.credentials_migrated){for(const [scope,key] of [['write','APP_ACCESS_TOKEN'],['read','APP_READ_TOKEN']]){
   const token=process.env[key];if(token&&token.length>=24)await c.query('INSERT IGNORE INTO app_tokens(id,owner_id,name,token_hash,scope) VALUES(?,1,?,?,?)',['legacy-'+scope,'迁移的'+scope+'凭据',digest(token),scope]);
  }await c.query('UPDATE app_users SET credentials_migrated=1 WHERE id=1');}
  await c.commit();
 }catch(e){await c.rollback();throw e;}finally{c.release();}
}
module.exports={accountDDL,digest,hashPassword,checkPassword,credentials,register,migrateAccounts};
