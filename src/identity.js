const {AsyncLocalStorage}=require('node:async_hooks');
const identity=new AsyncLocalStorage();
function ownerId(){
 const id=identity.getStore()?.id;
 if(!Number.isSafeInteger(id)||id<1)throw Object.assign(new Error('缺少账号上下文'),{status:401});
 return id;
}
module.exports={identity,ownerId};
