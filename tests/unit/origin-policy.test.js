const {test}=require('node:test'),assert=require('node:assert/strict');
const {createOriginPolicy}=require('../../src/origin-policy');
test('single origin remains default; absent, null, lookalike and different port origins fail closed',()=>{
 const policy=createOriginPolicy({PUBLIC_URL:'https://meal.example.com'});
 assert(policy.allows('https://meal.example.com'));
 for(const origin of [undefined,'','null','http://meal.example.com','https://meal.example.com:444','https://meal.example.com.evil.invalid','https://evil.invalid','https://meal.example.com/'])assert.equal(policy.allows(origin),false);
});
test('explicit HTTP and HTTPS entries coexist with per-origin Secure cookies',()=>{
 const policy=createOriginPolicy({PUBLIC_URL:'https://meal.example.com/',ADDITIONAL_PUBLIC_URLS:' http://example.com:13200, https://meal.example.com '});
 assert(policy.allows('https://meal.example.com'));assert(policy.allows('http://example.com:13200'));
 assert(policy.secure('https://meal.example.com'));assert.equal(policy.secure('http://example.com:13200'),false);
 assert.equal(policy.secure('https://evil.invalid'),false);assert.equal(policy.allows('http://example.com'),false);
});
test('invalid allowlist configuration fails before accepting requests',()=>{
 for(const value of ['*','null','ftp://meal.example.com','https://u:p@meal.example.com','https://meal.example.com/path','https://meal.example.com/?x=1','https://meal.example.com/#x'])assert.throws(()=>createOriginPolicy({PUBLIC_URL:'https://meal.example.com',ADDITIONAL_PUBLIC_URLS:value}));
});
