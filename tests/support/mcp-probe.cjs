// Explicit isolated reviewer tool. No production URL/configuration accepted.
const fs=require('node:fs'),path=require('node:path');
const ctx=require('./context.cjs')(process.argv[2]);
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
(async()=>{
 const users=JSON.parse(fs.readFileSync(path.join(ctx.runDir,'users.json'))),user=users.at(-1);
 const client=new Client({name:'isolated-human-or-agent-review',version:'1'});
 try{await client.connect(new StreamableHTTPClientTransport(new URL(ctx.config.PUBLIC_URL+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+user.write.token}}}));
 const result=process.argv[3]?await client.callTool({name:process.argv[3],arguments:JSON.parse(process.argv[4]||'{}')}):await client.listTools();console.log(JSON.stringify(result));
 }finally{await client.close();}
})().catch(()=>{console.error('Isolated MCP review failed');process.exitCode=1});
