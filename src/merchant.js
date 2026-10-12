const express = require('express');
const { getPool } = require('./db');
const domain = require('../public/assets/merchant-domain');
const {createBoohee}=require('./boohee');

function createMerchantRouter(repository, options = {}) {
  const router = express.Router();
  const poolFor = options.getPool || getPool;
  const boohee=options.boohee||createBoohee();
  async function readRecord() {
    await initialize();const [rows]=await poolFor().query('SELECT revision,payload FROM merchant_workspace WHERE id=1');
    return {revision:rows[0].revision,state:domain.hydrate(typeof rows[0].payload==='string'?JSON.parse(rows[0].payload):rows[0].payload)};
  }
  let ready;
  function initialize() {
    if (!ready) ready = (async () => {
      const pool = poolFor();
      await pool.query(`CREATE TABLE IF NOT EXISTS merchant_workspace (id INT PRIMARY KEY, revision INT NOT NULL, payload JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      const [rows] = await pool.query('SELECT id FROM merchant_workspace WHERE id=1');
      if (!rows.length) {
        const original = await repository.readState();
        await pool.query('INSERT IGNORE INTO merchant_workspace (id,revision,payload) VALUES (1,1,?)', [JSON.stringify(domain.initial(original))]);
      }
    })().catch(error => { ready = null; throw error; });
    return ready;
  }
  const providerError=(res,e)=>res.status(e.status||502).json({message:e.message});
  router.get('/nutrition/status',async(req,res)=>{try{res.json(await boohee.status());}catch(e){providerError(res,e);}});
  router.post('/nutrition/connect',async(req,res)=>{
    const address=req.socket.remoteAddress;
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address)||req.get('origin')&&req.get('origin')!==`http://${req.get('host')}`)return res.status(403).json({message:'请在本机系统页面配置连接'});
    try{res.json(await boohee.connect(req.body.apiKey));}catch(e){providerError(res,e);}
  });
  router.get('/nutrition/search',async(req,res)=>{
    try {
      const q=String(req.query.q||'').trim(),page=Math.max(1,Math.min(100,parseInt(req.query.page)||1));
      if(!q||q.length>30)return res.status(422).json({message:'请输入 1–30 字的菜名'});
      const {state}=await readRecord(),local=state.dishes.filter(d=>d.name.includes(q));
      if(local.length&&req.query.remote!=='1')return res.json({source:'local',foods:local,hasMore:false});
      res.json({source:'boohee',...await boohee.search(q,page)});
    }catch(e){providerError(res,e);}
  });
  router.post('/nutrition/import',async(req,res)=>{
    try {
      const {code,category,basis,ingredients,confirmed,revision}=req.body;
      if(typeof code!=='string'||!code||code.length>200||!['荤','素','主食','海鲜'].includes(category)||!['cooked','ready'].includes(basis)||confirmed!==true)return res.status(422).json({message:'请选择菜品分类，并确认是相应熟重或即食食物条目'});
      const current=await readRecord();if(current.revision!==revision)return res.status(409).json({message:'数据已更新，请刷新后再添加'});
      const existing=current.state.dishes.find(d=>d.nutrition?.providerCode===code);
      if(existing)return res.json({...current,dish:existing,existing:true});
      const detail=await boohee.detail(code),id=`boohee:${detail.code}`;
      const dish={id,name:detail.name,category,defaultGrams:150,ingredients:Array.isArray(ingredients)&&ingredients.length?ingredients:detail.ingredients,nutrition:{source:'boohee',providerCode:detail.code,kcal100:detail.kcal100,basis,reference:`薄荷健康：${detail.name} (${detail.code})`,updatedAt:new Date().toISOString()}};
      current.state.dishes.push(dish);domain.validate(current.state);
      const [result]=await poolFor().query('UPDATE merchant_workspace SET payload=?,revision=revision+1 WHERE id=1 AND revision=?',[JSON.stringify(current.state),revision]);
      if(!result.affectedRows)return res.status(409).json({message:'其他窗口已更新，请刷新后重试'});
      res.json({state:current.state,revision:revision+1,dish});
    }catch(e){providerError(res,e);}
  });
  router.get('/', async (req,res,next) => {
    try {
      await initialize();
      const [rows] = await poolFor().query('SELECT revision,payload FROM merchant_workspace WHERE id=1');
      res.set('Cache-Control','no-store').json({ revision: rows[0].revision, state: domain.hydrate(typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload) });
    } catch (error) { next(error); }
  });
  router.put('/', async (req,res,next) => {
    try {
      await initialize();
      try { domain.validate(req.body.state); domain.refreshPending(req.body.state); domain.validate(req.body.state); } catch (error) { return res.status(422).json({ message: error.message }); }
      if (!Number.isInteger(req.body.revision)) return res.status(422).json({ message: '缺少数据版本，请刷新后重试' });
      const previous=await readRecord();
      if(req.body.state.dishes.some(d=>d.nutrition.source==='boohee'&&JSON.stringify(d.nutrition)!==JSON.stringify(previous.state.dishes.find(x=>x.id===d.id)?.nutrition)))return res.status(422).json({message:'薄荷热量必须通过真实查询添加，不可伪造或改写'});
      if(JSON.stringify((req.body.state.creditAdjustments||[]).slice(0,(previous.state.creditAdjustments||[]).length))!==JSON.stringify(previous.state.creditAdjustments||[]))return res.status(422).json({message:'原有餐次调整流水不能删除或改写'});
      for(const old of previous.state.orders){const current=req.body.state.orders.find(o=>o.id===old.id);if(!current||current.credits!==old.credits||current.customerId!==old.customerId)return res.status(422).json({message:'原购买记录不能删除或改写，请通过餐次调整流水补扣'});}
      if(previous.state.boxes.some(old=>!req.body.state.boxes.some(b=>b.id===old.id)))return res.status(422).json({message:'原用餐记录不能删除，请使用取消操作'});
      for(const old of previous.state.boxes)if(old.events?.length&&JSON.stringify(req.body.state.boxes.find(b=>b.id===old.id)?.events?.slice(0,old.events.length))!==JSON.stringify(old.events))return res.status(422).json({message:'原有取消与恢复记录不能删除或改写'});
      const [result] = await poolFor().query('UPDATE merchant_workspace SET payload=?,revision=revision+1 WHERE id=1 AND revision=?', [JSON.stringify(req.body.state),req.body.revision]);
      if (!result.affectedRows) return res.status(409).json({ message: '其他窗口已更新数据，请刷新后再操作。当前输入尚未保存。' });
      res.json({ ok: true, revision: req.body.revision + 1 });
    } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createMerchantRouter };
