const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const code=fs.readFileSync(require('node:path').join(__dirname,'../../public/assets/merchant.js'),'utf8');
const source=code.slice(code.indexOf('  const uid ='),code.indexOf('  const list ='))+'\nuid;';
test('non-secure browser without randomUUID still creates unique RFC4122 v4 business identifiers',()=>{
 const uid=vm.runInNewContext(source,{crypto:{getRandomValues:crypto.webcrypto.getRandomValues.bind(crypto.webcrypto)}});
 const ids=Array.from({length:1000},()=>uid('customer'));assert.equal(new Set(ids).size,1000);
 for(const id of ids)assert.match(id,/^customer_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('secure browser preserves native UUID behavior',()=>{
 const expected='11111111-2222-4333-8444-555555555555';
 const uid=vm.runInNewContext(source,{crypto:{randomUUID:()=>expected,getRandomValues:()=>{throw Error('Unexpected fallback')}}});assert.equal(uid('dish'),'dish_'+expected);
});
