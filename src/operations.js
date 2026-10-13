const {ownerId}=require('./identity');
const express=require('express');
const crypto=require('node:crypto');
const {getPool}=require('./db');
const domain=require('../public/assets/merchant-domain');
const {z}=require('zod');
const requestSchema=z.object({request_id:z.string().min(8).max(100),expected_version:z.number().int().positive(),evidence:z.string().min(1).max(1000),name:z.string().trim().min(1).max(80),phone:z.string().max(40).default(''),address:z.string().max(1000).default('')}).strict();
async function setupOperations(){await getPool().query(`CREATE TABLE IF NOT EXISTS api_requests (request_id VARCHAR(100) PRIMARY KEY, fingerprint CHAR(64) NOT NULL, actor VARCHAR(30) NOT NULL, evidence TEXT NOT NULL, response JSON NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);}
function createOperationsRouter(){
 const router=express.Router();
 for(const [name,operation] of Object.entries(require('./operation-catalog').operations))router.post(operation.path,async(req,res,next)=>{
   const parsed=operation.schema.safeParse(req.body);if(!parsed.success)return res.status(422).json({message:'请核对操作字段、request_id、expected_version 和 evidence'});
   const input=parsed.data,hash=crypto.createHash('sha256').update(name+JSON.stringify(input)).digest('hex');
   let connection;
   try{
     connection=await getPool().getConnection();await connection.beginTransaction();
     const [rows]=await connection.query('SELECT revision,payload FROM merchant_workspace WHERE id=1 AND owner_id=? FOR UPDATE',[ownerId()]);
     if(!rows.length){await connection.rollback();return res.status(409).json({message:'请先读取商家工作台初始化'});}
     const [requests]=await connection.query('SELECT fingerprint,response FROM api_requests WHERE request_id=? AND owner_id=?',[input.request_id,ownerId()]);
     if(requests.length){await connection.rollback();if(requests[0].fingerprint!==hash)return res.status(409).json({message:'request_id 已用于不同内容'});return res.json(typeof requests[0].response==='string'?JSON.parse(requests[0].response):requests[0].response);}
     if(rows[0].revision!==input.expected_version){await connection.rollback();return res.status(409).json({message:'数据版本已变化，请重读并使用新 request_id'});}
     const state=domain.hydrate(typeof rows[0].payload==='string'?JSON.parse(rows[0].payload):rows[0].payload);
     let result;
     try{result=operation.apply(state,input);domain.refreshPending(state);domain.validate(state);}catch(error){await connection.rollback();return res.status(422).json({message:error.message});}
     const response={ok:true,revision:rows[0].revision+1,result};
     await connection.query('UPDATE merchant_workspace SET payload=?,revision=revision+1 WHERE id=1 AND owner_id=?',[JSON.stringify(state),ownerId()]);
     await connection.query('INSERT INTO api_requests(request_id,fingerprint,actor,evidence,response,owner_id) VALUES(?,?,?,?,?,?)',[input.request_id,hash,'authenticated-client',input.evidence,JSON.stringify(response),ownerId()]);
     await connection.commit();res.json(response);
   }catch(error){if(connection)await connection.rollback();next(error);}finally{if(connection)connection.release();}
 });
 return router;
}
module.exports={setupOperations,createOperationsRouter,requestSchema};
