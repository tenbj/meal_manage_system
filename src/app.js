const path = require("node:path");
const express = require("express");
const cors = require("cors");
const { readState, writeState, countRows } = require("./repository");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: "25mb" }));
  app.use(express.static(path.resolve(process.cwd(), "public")));

  app.get("/api/health", async (req, res, next) => {
    try {
      const tables = await countRows();
      res.json({ ok: true, storage: "mysql", tables, checkedAt: new Date().toISOString() });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/state", async (req, res, next) => {
    try {
      res.json(await readState());
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/state", async (req, res, next) => {
    try {
      const result = await writeState(req.body || {});
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
