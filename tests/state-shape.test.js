const test = require("node:test");
const assert = require("node:assert/strict");
const { stateShape, parseJson } = require("../src/repository");

test("stateShape keeps all entity arrays present", () => {
  const state = stateShape({ customers: [{ id: "cus_1" }] });
  assert.equal(state.customers.length, 1);
  assert.deepEqual(state.orders, []);
  assert.deepEqual(state.dailyOut, []);
  assert.deepEqual(state.posters, []);
});

test("parseJson tolerates mysql JSON object and empty values", () => {
  assert.deepEqual(parseJson('["蒜"]', []), ["蒜"]);
  assert.deepEqual(parseJson(["虾"], []), ["虾"]);
  assert.deepEqual(parseJson("", []), []);
});
