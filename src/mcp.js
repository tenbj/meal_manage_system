const {McpServer}=require('@modelcontextprotocol/sdk/server/mcp.js');
const {StreamableHTTPServerTransport}=require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {requestSchema}=require('./operations');
const {config}=require('./config');
const {version}=require('../package.json');
function installMcp(app){
 app.post('/mcp',async(req,res,next)=>{
   const server=new McpServer({name:'meal-management',version},{instructions:'先读取工作台及 revision。客户登记必须有明确授权、真实来源 evidence 和唯一 request_id；重试相同请求保持 request_id 不变；409 先重读。旧 AI 接口不与新商家工作台同步。'});
   async function call(path,method='GET',body){
     const authHeaders=req.browserSession?{Cookie:req.get('cookie'),Origin:process.env.PUBLIC_URL||`http://localhost:${config.port}`}:{Authorization:req.get('authorization')};
     const response=await fetch(`http://127.0.0.1:${config.port}${path}`,{method,headers:{...authHeaders,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
     const data=await response.json();return {isError:!response.ok,content:[{type:'text',text:JSON.stringify({httpStatus:response.status,...data})}]};
   }
   server.registerTool('get_system_status',{description:'只读：检查数据库和运行版本。',annotations:{readOnlyHint:true}},()=>call('/api/health'));
   server.registerTool('get_workspace',{description:'只读：仅限当前账号：读取当前客户、订单、菜单、餐盒和 revision。写入前必须调用。',annotations:{readOnlyHint:true}},()=>call('/api/merchant'));
   for(const [name,op] of Object.entries(require('./operation-catalog').operations))server.registerTool(name,{description:`${op.title}；有副作用。需用户授权和来源 evidence；request_id 幂等、expected_version 并发校验。409 先重读；422 修正输入；503 不声称成功。`,inputSchema:op.schema.shape,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}},input=>call('/api/v1'+op.path,'POST',input));
   const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
   res.on('close',()=>{transport.close();server.close();});
   try{await server.connect(transport);await transport.handleRequest(req,res,req.body);}catch(e){if(!res.headersSent)next(e);}
 });
 app.all('/mcp',(req,res)=>res.status(405).set('Allow','POST').json({message:'使用 Streamable HTTP POST'}));
}
module.exports={installMcp};
