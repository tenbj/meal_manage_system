const { getPool } = require("./db");

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function bool(value) {
  return Boolean(Number(value || 0));
}

function stateShape(input = {}) {
  return {
    meta: input.meta && typeof input.meta === "object" ? input.meta : {},
    customers: safeArray(input.customers),
    orders: safeArray(input.orders),
    dishes: safeArray(input.dishes),
    recipes: safeArray(input.recipes),
    dailyOut: safeArray(input.dailyOut),
    feedbacks: safeArray(input.feedbacks),
    labels: safeArray(input.labels),
    deliveries: safeArray(input.deliveries),
    posters: safeArray(input.posters),
  };
}

async function readState() {
  const pool = getPool();
  const [
    [customers],
    [orders],
    [dishes],
    [recipes],
    [dailyOut],
    [feedbacks],
    [labels],
    [deliveries],
    [posters],
  ] = await Promise.all([
    pool.query("SELECT * FROM customers ORDER BY created_at, id"),
    pool.query("SELECT * FROM `orders` ORDER BY start_date, id"),
    pool.query("SELECT * FROM dishes ORDER BY category, name, id"),
    pool.query("SELECT * FROM recipes ORDER BY recipe_date, id"),
    pool.query("SELECT * FROM daily_out ORDER BY out_date, meal, id"),
    pool.query("SELECT * FROM feedbacks ORDER BY feedback_date DESC, id"),
    pool.query("SELECT * FROM labels ORDER BY label_date, meal, id"),
    pool.query("SELECT * FROM deliveries ORDER BY delivery_date, meal, id"),
    pool.query("SELECT * FROM posters ORDER BY generated_at DESC, id"),
  ]);

  return {
    meta: { schemaVersion: 2, savedAt: new Date().toISOString(), storage: "mysql" },
    customers: customers.map(mapCustomer),
    orders: orders.map(mapOrder),
    dishes: dishes.map(mapDish),
    recipes: recipes.map(mapRecipe),
    dailyOut: dailyOut.map(mapDailyOut),
    feedbacks: feedbacks.map(mapFeedback),
    labels: labels.map((row) => parseJson(row.payload, {})),
    deliveries: deliveries.map((row) => parseJson(row.payload, {})),
    posters: posters.map((row) => parseJson(row.payload, {})),
  };
}

async function writeState(rawState) {
  const state = stateShape(rawState);
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const table of ["posters", "deliveries", "labels", "feedbacks", "daily_out", "recipes", "dishes", "orders", "customers"]) {
      await connection.query(`DELETE FROM ${table === "orders" ? "`orders`" : table}`);
    }

    for (const customer of state.customers) await insertCustomer(connection, customer);
    for (const order of state.orders) await insertOrder(connection, order);
    for (const dish of state.dishes) await insertDish(connection, dish);
    for (const recipe of state.recipes) await insertRecipe(connection, recipe);
    for (const row of state.dailyOut) await insertDailyOut(connection, row);
    for (const feedback of state.feedbacks) await insertFeedback(connection, feedback);
    for (const label of state.labels) await insertPayload(connection, "labels", "label_date", "meal", label.date, label.meal, label.customerId, label);
    for (const delivery of state.deliveries) await insertPayload(connection, "deliveries", "delivery_date", "meal", delivery.date, delivery.meal, delivery.customerId, delivery);
    for (const poster of state.posters) await insertPayload(connection, "posters", "generated_at", "order_id", poster.generatedAt, poster.orderId, poster.customerId, poster);

    await connection.commit();
    return { savedAt: new Date().toISOString() };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function countRows() {
  const pool = getPool();
  const tables = ["customers", "orders", "dishes", "recipes", "daily_out", "feedbacks", "labels", "deliveries", "posters"];
  const output = {};
  for (const table of tables) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM ${table === "orders" ? "`orders`" : table}`);
    output[table] = Number(rows[0].count || 0);
  }
  return output;
}

function mapCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname || "",
    phone: row.phone,
    gender: row.gender || "",
    age: Number(row.age || 0),
    height: Number(row.height || 0),
    currentWeight: Number(row.current_weight || 0),
    targetWeight: Number(row.target_weight || 0),
    activity: row.activity || "",
    pace: row.pace || "",
    address: row.address || "",
    restrictions: parseJson(row.restrictions, []),
    dislikes: parseJson(row.dislikes, []),
    allergies: parseJson(row.allergies, []),
    notes: row.notes || "",
    weightRecords: parseJson(row.weight_records, []),
  };
}

function mapOrder(row) {
  return {
    id: row.id,
    orderNo: row.order_no,
    customerId: row.customer_id,
    serviceType: row.service_type,
    startDate: row.start_date,
    endDate: row.end_date,
    price: Number(row.price || 0),
    status: row.status,
    paidStatus: row.paid_status,
    isRepurchase: bool(row.is_repurchase),
    notes: row.notes || "",
    completionRate: Number(row.completion_rate || 0),
    totalMealCredits: Number(row.total_meal_credits || 0),
    pauseRule: row.pause_rule || "",
    weightRecords: parseJson(row.weight_records, []),
  };
}

function mapDish(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    ingredients: parseJson(row.ingredients, []),
    kcal100: Number(row.kcal100 || 0),
    protein: Number(row.protein || 0),
    fat: Number(row.fat || 0),
    carbs: Number(row.carbs || 0),
    source: row.source || "",
    garlic: bool(row.garlic),
    conflicts: parseJson(row.conflicts, []),
    available: bool(row.available),
    notes: row.notes || "",
  };
}

function mapRecipe(row) {
  return {
    id: row.id,
    date: row.recipe_date,
    meals: parseJson(row.meals, {}),
    replacements: parseJson(row.replacements, []),
    generatedAt: row.generated_at || "",
  };
}

function mapDailyOut(row) {
  return {
    id: row.id,
    date: row.out_date,
    meal: row.meal,
    customerId: row.customer_id,
    items: parseJson(row.items, []),
    paused: bool(row.paused),
    pausePolicy: row.pause_policy || "",
    pauseReason: row.pause_reason || "",
    pauseUpdatedAt: row.pause_updated_at || "",
    extensionOrderId: row.extension_order_id || "",
    replaced: bool(row.replaced),
    needsReplacement: bool(row.needs_replacement),
    note: row.note || "",
    generatedAt: row.generated_at || "",
  };
}

function mapFeedback(row) {
  return {
    id: row.id,
    date: row.feedback_date,
    customerId: row.customer_id,
    weight: Number(row.weight || 0),
    lunchFinished: row.lunch_finished || "",
    dinnerFinished: row.dinner_finished || "",
    satiety: row.satiety || "",
    dislikeDish: row.dislike_dish || "",
    bodyNote: row.body_note || "",
    adminNote: row.admin_note || "",
    processed: bool(row.processed),
  };
}

async function insertCustomer(connection, item) {
  if (!item?.id) return;
  await connection.query(
    `INSERT INTO customers
      (id, name, nickname, phone, gender, age, height, current_weight, target_weight, activity, pace, address, restrictions, dislikes, allergies, notes, weight_records)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name || "",
      item.nickname || "",
      item.phone || "",
      item.gender || "",
      item.age || null,
      item.height || null,
      item.currentWeight || null,
      item.targetWeight || null,
      item.activity || "",
      item.pace || "",
      item.address || "",
      json(safeArray(item.restrictions)),
      json(safeArray(item.dislikes)),
      json(safeArray(item.allergies)),
      item.notes || "",
      json(safeArray(item.weightRecords)),
    ]
  );
}

async function insertOrder(connection, item) {
  if (!item?.id) return;
  await connection.query(
    `INSERT INTO \`orders\`
      (id, order_no, customer_id, service_type, start_date, end_date, price, status, paid_status, is_repurchase, notes, completion_rate, total_meal_credits, pause_rule, weight_records)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.orderNo || item.id,
      item.customerId || "",
      item.serviceType || "",
      item.startDate,
      item.endDate,
      Number(item.price || 0),
      item.status || "",
      item.paidStatus || "",
      item.isRepurchase ? 1 : 0,
      item.notes || "",
      Number(item.completionRate || 0),
      Number(item.totalMealCredits || 0),
      item.pauseRule || "",
      json(safeArray(item.weightRecords)),
    ]
  );
}

async function insertDish(connection, item) {
  if (!item?.id) return;
  await connection.query(
    `INSERT INTO dishes
      (id, name, category, ingredients, kcal100, protein, fat, carbs, source, garlic, conflicts, available, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.name || "",
      item.category || "",
      json(safeArray(item.ingredients)),
      Number(item.kcal100 || 0),
      Number(item.protein || 0),
      Number(item.fat || 0),
      Number(item.carbs || 0),
      item.source || "",
      item.garlic ? 1 : 0,
      json(safeArray(item.conflicts)),
      item.available === false ? 0 : 1,
      item.notes || "",
    ]
  );
}

async function insertRecipe(connection, item) {
  if (!item?.id || !item.date) return;
  await connection.query(
    `INSERT INTO recipes (id, recipe_date, meals, replacements, generated_at)
      VALUES (?, ?, ?, ?, ?)`,
    [item.id, item.date, json(item.meals || {}), json(safeArray(item.replacements)), item.generatedAt || ""]
  );
}

async function insertDailyOut(connection, item) {
  if (!item?.id || !item.date) return;
  await connection.query(
    `INSERT INTO daily_out
      (id, out_date, meal, customer_id, items, paused, pause_policy, pause_reason, pause_updated_at, extension_order_id, replaced, needs_replacement, note, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.date,
      item.meal || "",
      item.customerId || "",
      json(safeArray(item.items)),
      item.paused ? 1 : 0,
      item.pausePolicy || "",
      item.pauseReason || "",
      item.pauseUpdatedAt || "",
      item.extensionOrderId || "",
      item.replaced ? 1 : 0,
      item.needsReplacement ? 1 : 0,
      item.note || "",
      item.generatedAt || "",
    ]
  );
}

async function insertFeedback(connection, item) {
  if (!item?.id || !item.date) return;
  await connection.query(
    `INSERT INTO feedbacks
      (id, feedback_date, customer_id, weight, lunch_finished, dinner_finished, satiety, dislike_dish, body_note, admin_note, processed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.date,
      item.customerId || "",
      item.weight || null,
      item.lunchFinished || "",
      item.dinnerFinished || "",
      item.satiety || "",
      item.dislikeDish || "",
      item.bodyNote || "",
      item.adminNote || "",
      item.processed ? 1 : 0,
    ]
  );
}

async function insertPayload(connection, table, dateColumn, secondaryColumn, dateValue, secondaryValue, customerId, payload) {
  if (!payload?.id) return;
  await connection.query(
    `INSERT INTO ${table} (id, ${dateColumn}, ${secondaryColumn}, customer_id, payload)
      VALUES (?, ?, ?, ?, ?)`,
    [payload.id, dateValue || null, secondaryValue || "", customerId || "", json(payload)]
  );
}

module.exports = {
  readState,
  writeState,
  countRows,
  stateShape,
  parseJson,
};
