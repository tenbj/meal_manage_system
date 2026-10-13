const {setupSchema}=require('../src/schema');
const {setupOperations}=require('../src/operations');
const {getPool,closePool}=require('../src/db');
const domain=require('../public/assets/merchant-domain');
async function migrate(){
 await setupSchema();await setupOperations();await require('../src/integrations').setupIntegrations();
 await getPool().query(`CREATE TABLE IF NOT EXISTS merchant_workspace (id INT PRIMARY KEY, revision INT NOT NULL, payload JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 const [rows]=await getPool().query('SELECT id FROM merchant_workspace WHERE id=1');
 if(!rows.length)await getPool().query('INSERT IGNORE INTO merchant_workspace (id,revision,payload) VALUES (1,1,?)',[JSON.stringify(domain.initial(await require('../src/repository').readState()))]);
 console.log('Schema 0.3.0 ready; existing business records preserved');await closePool();
}
migrate().catch(async e=>{console.error({code:e.code||'MIGRATION_FAILED'});await closePool();process.exitCode=1;});
