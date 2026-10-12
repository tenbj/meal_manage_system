const fs=require('node:fs/promises');
const {getPool,closePool}=require('../src/db');
const D=require('../public/assets/merchant-domain');
(async()=>{
  try {
    const pool=getPool(),[rows]=await pool.query('SELECT revision,payload FROM merchant_workspace WHERE id=1');
    const row=rows[0],state=D.hydrate(typeof row.payload==='string'?JSON.parse(row.payload):row.payload);
    if(state.catalogResetAt){console.log('Catalog was already reset; no changes.');return;}
    console.log(JSON.stringify({revision:row.revision,oldDishes:state.dishes.length,customers:state.customers.length,orders:state.orders.length,boxes:state.boxes.length,apply:process.argv.includes('--apply')}));
    if(!process.argv.includes('--apply'))return;
    await fs.mkdir('tmp',{recursive:true});const backup=`tmp/merchant-before-catalog-reset-${Date.now()}.json`;await fs.writeFile(backup,JSON.stringify(row),{flag:'wx'});
    const balances=state.orders.map(o=>D.remaining(state,o));const completed=state.boxes.filter(b=>b.status==='completed').map(b=>({id:b.id,nutrition:D.nutrition(state,b.items)}));
    D.purgeLegacyDishes(state);D.validate(state);
    if(JSON.stringify(balances)!==JSON.stringify(state.orders.map(o=>D.remaining(state,o))))throw new Error('Ledger balance changed unexpectedly');
    for(const b of completed)if(JSON.stringify(b.nutrition)!==JSON.stringify(D.nutrition(state,state.boxes.find(x=>x.id===b.id).items)))throw new Error('Historical nutrition changed');
    const [r]=await pool.query('UPDATE merchant_workspace SET payload=?,revision=revision+1 WHERE id=1 AND revision=?',[JSON.stringify(state),row.revision]);
    if(!r.affectedRows)throw new Error('Concurrent update: abort and retry after refresh');
    const [verify]=await pool.query('SELECT revision,payload FROM merchant_workspace WHERE id=1');const saved=typeof verify[0].payload==='string'?JSON.parse(verify[0].payload):verify[0].payload;
    if(saved.dishes.length)throw new Error('Reset read-back failed');console.log(JSON.stringify({remainingDishes:saved.dishes.length,revision:verify[0].revision,backup,historyAndBalancesPreserved:true}));
  }finally{await closePool();}
})().catch(e=>{console.error(e.message);process.exit(1);});
