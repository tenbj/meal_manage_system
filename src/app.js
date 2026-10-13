const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { config } = require("./config");
const repository = require("./repository");
const { createAiWriteRouter } = require("./ai-write-api");
const { createMerchantRouter } = require("./merchant");

function createApp(options = {}) {
  const repo = options.repository || repository;
  const aiWrite = options.aiWrite || {};
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "25mb" }));
  require('./auth').installAuth(app);
  app.get('/health/live',(req,res)=>res.json({ok:true,version:require('../package.json').version}));
  app.get('/health/ready',async(req,res)=>{try{await require('./db').getPool().query('SELECT revision FROM merchant_workspace WHERE id=1');res.json({ok:true,version:require('../package.json').version});}catch{res.status(503).json({ok:false});}});
  app.use("/api/merchant", createMerchantRouter(repo));
  app.use('/api/v1',require('./operations').createOperationsRouter());
  require('./mcp').installMcp(app);
  app.use('/diagrams',express.static(path.resolve('docs/diagrams')));
  app.use('/docs',express.static(path.resolve('docs')));
  app.use(express.static(path.resolve(process.cwd(), "public")));
  app.use("/api/ai", createAiWriteRouter({ actions: aiWrite.actions || repo, token: aiWrite.token ?? config.aiWriteToken }));

  app.get("/api/health", async (req, res, next) => {
    try {
      const tables = await repo.countRows();
      res.json({ ok: true, version:require('../package.json').version, storage: "mysql", tables, checkedAt: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/state", async (req, res, next) => {
    try {
      res.json(await repo.readState());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/state", async (req, res, next) => {
    try {
      const result = await repo.writeState(req.body || {});
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ ok: false, message: "接口不存在" });
      return;
    }
    res.sendFile(path.resolve(process.cwd(), "public", "index.html"));
  });

  app.use((error, req, res, next) => {
    console.error({code:error.code||'APPLICATION_ERROR'});
    res.status(503).json({ ok: false, message: "服务暂不可用，请稍后重试" });
  });

  return app;
}

module.exports = { createApp };
