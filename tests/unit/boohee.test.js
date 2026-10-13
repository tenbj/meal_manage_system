const test=require('node:test'),assert=require('node:assert/strict');
const {createBoohee}=require('../../src/boohee');
test('Boohee calls documented search and detail endpoints with server-only API key',async()=>{
  const calls=[];const api=createBoohee({readKey:async()=> 'test-key-only',fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({code:0,data:url.includes('/search?')?{foods:[{code:'rice',name:'米饭',calories:116,is_liquid:false}],has_more:true}:{code:'rice',name:'米饭',calories:{value:116,unit:'kcal'},is_liquid:false,food_type:'菜肴',materials:{foods:[{name:'大米'}]}}})};}});
  const result=await api.search('米饭',2);assert.equal(result.foods[0].kcal100,116);assert.equal(result.hasMore,true);
  const detail=await api.detail('rice');assert.equal(detail.kcal100,116);assert.deepEqual(detail.ingredients,['大米']);
  assert.ok(calls[0].url.startsWith('https://api.boohee.com/open-apis/v1/food/search?'));assert.equal(new URL(calls[0].url).searchParams.get('page'),'2');assert.equal(calls[0].options.headers['X-Api-Key'],'test-key-only');assert.equal(JSON.stringify(result).includes('test-key-only'),false);
});
test('Boohee refuses absent credentials, bad units, liquids and provider failures',async()=>{
  await assert.rejects(createBoohee({readKey:async()=>''}).search('米饭'),/API Key/);
  for(const food of [{calories:{value:500,unit:'kJ'}},{calories:{value:20,unit:'kcal'},is_liquid:true},{calories:{unit:'kcal'}},{calories:{value:' ',unit:'kcal'}},{calories:{value:false,unit:'kcal'}}]){
    const api=createBoohee({readKey:async()=> 'key',fetch:async()=>({ok:true,json:async()=>({code:0,data:{code:'x',name:'x',...food}})})});await assert.rejects(api.detail('x'),/有效热量/);
  }
  const api=createBoohee({readKey:async()=> 'key',fetch:async()=>({ok:false,status:401,json:async()=>({code:401,message:'sensitive message'})})});await assert.rejects(api.search('米饭'),/核对授权/);
});

test('connection verification saves only a successful complete response and trims clipboard whitespace',async()=>{
  let stored='previous-valid-key',fail=false,calls=0;
  const api=createBoohee({readKey:async()=>stored,writeKey:async key=>{stored=key;},fetch:async(url,options)=>{calls++;assert.ok(!/\s/.test(options.headers['X-Api-Key']));return {ok:true,status:200,json:async()=>fail?{code:1042,message:'食物搜索接口未开通'}:{code:0,data:{foods:[]}}};}});
  assert.equal((await api.connect('  sk-test-complete-key\n')).verified,true);assert.equal(stored,'sk-test-complete-key');
  fail=true;await assert.rejects(api.connect('sk-test-rejected-key'),e=>e.providerCode===1042&&e.message.includes('食物搜索接口未开通'));assert.equal(stored,'sk-test-complete-key');
  fail=false;assert.equal((await api.check()).verified,true);const before=calls;
  await assert.rejects(api.connect('sk-test****masked'),/完整 API Key/);assert.equal(calls,before);
});
test('connection diagnostics distinguish timeout, certificate, provider and malformed response without leaking keys',async()=>{
  const key='sk-secret-fixture-key';
  for(const [error,kind] of [[{name:'TimeoutError'},'timeout'],[{cause:{code:'SELF_SIGNED_CERT_IN_CHAIN'}},'certificate'],[{cause:{code:'ENOTFOUND'}},'network']]) {
    const api=createBoohee({readKey:async()=>key,fetch:async()=>{throw error;}});await assert.rejects(api.search('米饭'),e=>e.kind===kind&&!e.message.includes(key));
  }
  const api=createBoohee({readKey:async()=>key,fetch:async()=>({ok:true,status:200,json:async()=>({code:1042,message:`接口未开通 ${key} sk-other-secret`})})});
  await assert.rejects(api.check(),e=>e.kind==='provider'&&e.providerCode===1042&&e.message.includes('接口未开通')&&!e.message.includes(key)&&!e.message.includes('sk-other-secret'));
  await assert.rejects(createBoohee({readKey:async()=>key,fetch:async()=>({ok:false,status:502,json:async()=>{throw new Error(key);}})}).check(),/非 JSON.*502/);
});
