const express = require('express');
const { getPool } = require('./db');
const domain = require('../public/assets/merchant-domain');

function createMerchantRouter(repository, options = {}) {
  const router = express.Router();
  const poolFor = options.getPool || getPool;
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
  router.get('/nutrition/status', (req,res) => res.json({ provider: 'boohee', configured: false, message: '薄荷健康接口待接入。当前可手动录入热量。' }));
  router.get('/nutrition/search', (req,res) => res.status(503).json({ ok: false, code: 'BOOHEE_NOT_CONFIGURED', message: '薄荷健康接口尚未配置，暂时无法查询；可先手动添加。' }));
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
      try { domain.validate(req.body.state); } catch (error) { return res.status(422).json({ message: error.message }); }
      if (!Number.isInteger(req.body.revision)) return res.status(422).json({ message: '缺少数据版本，请刷新后重试' });
      // Provider records are immutable until an authenticated Boohee adapter is available.
      if (req.body.state.dishes.some(d => d.nutrition.source === 'boohee')) return res.status(422).json({ message: '薄荷接口尚未接入，不能保存为薄荷数据' });
      const [result] = await poolFor().query('UPDATE merchant_workspace SET payload=?,revision=revision+1 WHERE id=1 AND revision=?', [JSON.stringify(req.body.state),req.body.revision]);
      if (!result.affectedRows) return res.status(409).json({ message: '其他窗口已更新数据，请刷新后再操作。当前输入尚未保存。' });
      res.json({ ok: true, revision: req.body.revision + 1 });
    } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createMerchantRouter };
