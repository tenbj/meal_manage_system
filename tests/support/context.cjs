const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
module.exports=function(file=process.argv[2]){
 assert(file,'Pass the run.json created by tests/docker/run.py; production configurations are not accepted');
 const root=path.resolve(__dirname,'../..'),runFile=path.resolve(file),privateRoot=path.join(root,'.test-runs')+path.sep;
 assert(runFile.startsWith(privateRoot),'Run context must belong to .test-runs');
 const ctx=JSON.parse(fs.readFileSync(runFile));
 assert(/^h02test-meal-[a-f0-9]{12}$/.test(ctx.project));
 const cfg=ctx.config;assert.equal(cfg.DB_HOST,'db');assert.equal(cfg.DB_NAME,'meal_release_test');
 const url=new URL(cfg.PUBLIC_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');
 const inspected=JSON.parse(cp.execFileSync('docker',['inspect',ctx.project+'-app-1']))[0];
 assert.equal(inspected.Config.Labels['com.docker.compose.project'],ctx.project);
 const env=Object.fromEntries(inspected.Config.Env.map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)]}));
 assert.equal(env.DB_NAME,cfg.DB_NAME);assert.equal(env.DB_PASSWORD,cfg.DB_PASSWORD);assert.equal(env.PUBLIC_URL,cfg.PUBLIC_URL);
 return {...ctx,runDir:path.dirname(runFile),root,config:cfg};
};
