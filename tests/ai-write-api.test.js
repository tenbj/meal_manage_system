const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { aiWriteCapabilities, normalizeOrder, normalizeRecipe, AiWriteValidationError } = require("../src/ai-write-api");

test("AI write capabilities expose function-scoped endpoints", () => {
  const capabilities = aiWriteCapabilities();
  assert.equal(capabilities.basePath, "/api/ai");
  assert.equal(capabilities.writeSemantics, "function-scoped-create");
  assert.equal(capabilities.endpoints.length, 9);
  assert.ok(capabilities.endpoints.some((endpoint) => endpoint.path === "/api/ai/customers"));
  assert.ok(capabilities.endpoints.every((endpoint) => !endpoint.path.includes("sql")));
});

test("normalizeOrder derives service window fields", () => {
  const order = normalizeOrder({
    customerId: "cus_001",
    serviceType: "trial",
    startDate: "2026-08-02",
  });
  assert.equal(order.endDate, "2026-08-07");
  assert.equal(order.price, 699);
  assert.equal(order.totalMealCredits, 12);
  assert.equal(order.status, "服务中");
});

test("normalizeRecipe rejects empty recipe content", () => {
  assert.throws(
    () => normalizeRecipe({ date: "2026-08-02", meals: {} }),
    (error) => {
      assert.ok(error instanceof AiWriteValidationError);
      assert.equal(error.details[0].field, "meals");
      return true;
    }
  );
});

test("AI write routes require configured token and call scoped action", async (t) => {
  const calls = [];
  const app = createApp({
    aiWrite: {
      token: "secret",
      actions: {
        createCustomer: async (record) => {
          calls.push(record);
          return { savedAt: "2026-08-02T00:00:00.000Z" };
        },
      },
    },
  });
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const blocked = await fetch(`${baseUrl}/api/ai/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "张三", phone: "13800000000" }),
  });
  assert.equal(blocked.status, 401);
  assert.equal(calls.length, 0);

  const created = await fetch(`${baseUrl}/api/ai/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer secret" },
    body: JSON.stringify({ name: "张三", phone: "13800000000", restrictions: "花生，香菜" }),
  });
  const body = await created.json();
  assert.equal(created.status, 201);
  assert.equal(body.ok, true);
  assert.equal(body.entity, "customer");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].restrictions, ["花生", "香菜"]);
  assert.ok(body.record.id.startsWith("cus_"));
});
