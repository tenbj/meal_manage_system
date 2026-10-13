const context=require('../support/context.cjs')();
require('../support/browser-flow.cjs')(context).catch(e=>{console.error(e.message);process.exitCode=1});
