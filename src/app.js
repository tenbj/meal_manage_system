const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { config } = require("./config");
const repository = require("./repository");
const { createAiWriteRouter } = require("./ai-write-api");

function createApp(options = {}) {
  const repo = options.repository || repository;
  const aiWrite = options.aiWrite || {};
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "25mb" }));
  app.use(express.static(path.resolve(process.cwd(), "public")));
  app.use("/api/ai", createAiWriteRouter({ actions: aiWrite.actions || repo, token: aiWrite.token ?? config.aiWriteToken }));

  app.get("/api/health", async (req, res, next) => {
    try {
      const tables = await repo.countRows();
      res.json({ ok: true, storage: "mysql", tables, checkedAt: new Date().toISOString() });
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
    console.error(error);
    res.status(500).json({ ok: false, message: error.message || "服务异常" });
  });

  return app;
}

module.exports = { createApp };
