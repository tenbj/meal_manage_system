const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const {createMerchantRouter}=require('../src/merchant');
const D=require('../public/assets/merchant-domain');

test('merchant API persists revisions, rejects stale writes and unconfigured source claims',async()=>{
  let record=null;
  const pool={query:async(sql,args)=>{
    if(sql.startsWith('CREATE'))return [{}];
    if(sql.startsWith('SELECT id'))return [record?[{id:1}]:[]];
    if(sql.startsWith('INSERT')){if(!record)record={revision:1,payload:args[0]};return [{}];}
    if(sql.startsWith('SELECT revision'))return [[structuredClone(record)]];
    if(sql.startsWith('UPDATE')){if(record.revision!==args[1])return [{affectedRows:0}];record={revision:record.revision+1,payload:args[0]};return [{affectedRows:1}];}
    throw new Error(`Unexpected SQL: ${sql}`);
  }};
  const app=express();app.use(express.json());app.use('/api/merchant',createMerchantRouter({readState:async()=>({})},{getPool:()=>pool}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/merchant`;
  try{
    const first=await fetch(url).then(r=>r.json());assert.equal(first.revision,1);
    first.state.settings.name='保存测试';
    const put=body=>fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await put(first)).status,200);
    const saved=await fetch(url).then(r=>r.json());assert.equal(saved.state.settings.name,'保存测试');assert.equal(saved.revision,2);
    first.state.settings.name='过期内容';assert.equal((await put(first)).status,409);
    assert.equal((await fetch(url).then(r=>r.json())).state.settings.name,'保存测试');
    const fabricated=D.copy(saved);fabricated.state.dishes.push({id:'fake',name:'伪造条目',nutrition:{source:'boohee',basis:'cooked',kcal100:100}});
    assert.equal((await put(fabricated)).status,422);
    const invalid=D.copy(saved);invalid.state.settings.labelWidth=-1;assert.equal((await put(invalid)).status,422);
    assert.equal((await fetch(`${url}/nutrition/status`).then(r=>r.json())).configured,false);
    assert.equal((await fetch(`${url}/nutrition/search?q=米饭`)).status,503);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
