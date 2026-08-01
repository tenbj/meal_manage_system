const { setupSchema } = require("../src/schema");
const { createApp } = require("../src/app");
const { closePool } = require("../src/db");

async function main() {
  await setupSchema();
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const health = await fetch(`${base}/api/health`).then((res) => res.json());
    if (!health.ok) throw new Error("健康检查失败");
    const state = await fetch(`${base}/api/state`).then((res) => res.json());
    const keys = ["customers", "orders", "dishes", "recipes", "dailyOut", "feedbacks", "labels", "deliveries", "posters"];
    for (const key of keys) {
      if (!Array.isArray(state[key])) throw new Error(`状态字段不是数组：${key}`);
    }
    const capabilities = await fetch(`${base}/api/ai/capabilities`).then((res) => res.json());
    if (!capabilities.ok || !Array.isArray(capabilities.endpoints)) throw new Error("AI 写入能力清单不可用");
    if (!capabilities.endpoints.some((endpoint) => endpoint.path === "/api/ai/customers")) throw new Error("AI 客户写入入口缺失");
    console.log("接口冒烟测试通过");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closePool();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
