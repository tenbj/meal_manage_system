const crypto = require("node:crypto");
const express = require("express");

const MEALS = ["lunch", "dinner"];
const CATEGORIES = ["荤", "海鲜", "素", "主食"];
const SERVICE_TYPES = {
  trial: { days: 6, price: 699 },
  formal: { days: 28, price: 2999 },
};

const ENDPOINTS = [
  {
    method: "POST",
    path: "/customers",
    entity: "customer",
    action: "createCustomer",
    title: "新增客户档案",
    required: ["name", "phone"],
    optional: ["nickname", "gender", "age", "height", "currentWeight", "targetWeight", "activity", "pace", "address", "restrictions", "dislikes", "allergies", "notes", "weightRecords"],
    normalize: normalizeCustomer,
  },
  {
    method: "POST",
    path: "/orders",
    entity: "order",
    action: "createOrder",
    title: "新增服务订单",
    required: ["customerId", "serviceType", "startDate"],
    optional: ["id", "orderNo", "endDate", "price", "status", "paidStatus", "isRepurchase", "notes", "completionRate", "totalMealCredits", "pauseRule", "weightRecords"],
    normalize: normalizeOrder,
  },
  {
    method: "POST",
    path: "/dishes",
    entity: "dish",
    action: "createDish",
    title: "新增菜品",
    required: ["name"],
    optional: ["category", "ingredients", "kcal100", "protein", "fat", "carbs", "source", "garlic", "available", "conflicts", "notes"],
    normalize: normalizeDish,
  },
  {
    method: "POST",
    path: "/recipes",
    entity: "recipe",
    action: "createRecipe",
    title: "新增每日食谱",
    required: ["date", "meals"],
    optional: ["replacements", "generatedAt"],
    normalize: normalizeRecipe,
  },
  {
    method: "POST",
    path: "/daily-out",
    entity: "dailyOut",
    action: "createDailyOut",
    title: "新增单餐出餐记录",
    required: ["date", "meal", "customerId", "items"],
    optional: ["paused", "pausePolicy", "pauseReason", "pauseUpdatedAt", "extensionOrderId", "replaced", "needsReplacement", "note", "generatedAt"],
    normalize: normalizeDailyOut,
  },
  {
    method: "POST",
    path: "/feedbacks",
    entity: "feedback",
    action: "createFeedback",
    title: "新增客户反馈",
    required: ["date", "customerId"],
    optional: ["weight", "lunchFinished", "dinnerFinished", "satiety", "dislikeDish", "bodyNote", "adminNote", "processed"],
    normalize: normalizeFeedback,
  },
  {
    method: "POST",
    path: "/labels",
    entity: "label",
    action: "createLabel",
    title: "新增餐盒标签",
    required: ["date", "meal", "customerId", "text"],
    optional: ["customerName", "kcal", "grams", "protein", "fat", "carbs", "targetRange", "portion", "dayCode", "customerCode", "management", "observe", "generated", "generatedAt"],
    normalize: normalizeLabel,
  },
  {
    method: "POST",
    path: "/deliveries",
    entity: "delivery",
    action: "createDelivery",
    title: "新增配送记录",
    required: ["date", "meal", "customerId", "content", "address"],
    optional: ["customerName", "phone", "note", "generatedAt"],
    normalize: normalizeDelivery,
  },
  {
    method: "POST",
    path: "/posters",
    entity: "poster",
    action: "createPoster",
    title: "新增服务总结海报记录",
    required: ["customerId", "orderId", "summaryText"],
    optional: ["stats", "generatedAt"],
    normalize: normalizePoster,
  },
];

class AiWriteValidationError extends Error {
  constructor(details) {
    super("请求数据不符合 AI 写入 API 要求");
    this.status = 400;
    this.code = "AI_WRITE_VALIDATION_ERROR";
    this.details = details;
  }
}

function createAiWriteRouter({ actions = {}, token = "" } = {}) {
  const router = express.Router();

  router.get("/capabilities", (req, res) => {
    res.json({ ok: true, ...aiWriteCapabilities() });
  });

  router.use((req, res, next) => {
    if (req.method === "GET" || !token) return next();
    const provided = bearerToken(req) || req.get("x-ai-write-token") || "";
    if (provided !== token) {
      res.status(401).json({ ok: false, code: "AI_WRITE_UNAUTHORIZED", message: "缺少或错误的 AI 写入令牌" });
      return;
    }
    next();
  });

  ENDPOINTS.forEach((endpoint) => {
    router.post(endpoint.path, async (req, res, next) => {
      try {
        const action = actions[endpoint.action];
        if (typeof action !== "function") throw new Error(`AI 写入动作未配置：${endpoint.action}`);
        const record = endpoint.normalize(req.body);
        const result = await action(record);
        res.status(201).json({
          ok: true,
          entity: endpoint.entity,
          action: endpoint.action,
          id: record.id,
          record,
          savedAt: result?.savedAt || new Date().toISOString(),
        });
      } catch (error) {
        handleAiWriteError(error, res, next);
      }
    });
  });

  return router;
}

function aiWriteCapabilities() {
  return {
    basePath: "/api/ai",
    writeSemantics: "function-scoped-create",
    endpoints: ENDPOINTS.map(({ method, path, entity, action, title, required, optional }) => ({
      method,
      path: `/api/ai${path}`,
      entity,
      action,
      title,
      required,
      optional,
    })),
  };
}

function handleAiWriteError(error, res, next) {
  if (error instanceof AiWriteValidationError) {
    res.status(error.status).json({
      ok: false,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }
  if (error?.code === "ER_DUP_ENTRY") {
    res.status(409).json({ ok: false, code: "AI_WRITE_CONFLICT", message: "记录已存在，请换用新 id 或先人工确认是否需要更新" });
    return;
  }
  next(error);
}

function normalizeCustomer(raw) {
  const input = objectBody(raw);
  const errors = [];
  const currentWeight = numberValue(input, "currentWeight", errors, { defaultValue: 0, min: 0 });
  const record = {
    id: textValue(input, "id", errors) || makeId("cus"),
    name: textValue(input, "name", errors, { required: true, max: 80 }),
    nickname: textValue(input, "nickname", errors, { max: 80 }),
    phone: textValue(input, "phone", errors, { required: true, max: 40 }),
    gender: textValue(input, "gender", errors, { max: 20 }),
    age: numberValue(input, "age", errors, { defaultValue: 0, min: 0, max: 120 }),
    height: numberValue(input, "height", errors, { defaultValue: 0, min: 0 }),
    currentWeight,
    targetWeight: numberValue(input, "targetWeight", errors, { defaultValue: 0, min: 0 }),
    activity: textValue(input, "activity", errors, { max: 40 }),
    pace: textValue(input, "pace", errors, { max: 40 }),
    address: textValue(input, "address", errors),
    restrictions: listValue(input, "restrictions", errors),
    dislikes: listValue(input, "dislikes", errors),
    allergies: listValue(input, "allergies", errors),
    notes: textValue(input, "notes", errors),
    weightRecords: arrayValue(input, "weightRecords", errors),
  };
  if (!record.weightRecords.length && currentWeight > 0) record.weightRecords.push({ date: todayKey(), weight: currentWeight });
  throwIfInvalid(errors);
  return record;
}

function normalizeOrder(raw) {
  const input = objectBody(raw);
  const errors = [];
  const serviceType = enumValue(input, "serviceType", errors, Object.keys(SERVICE_TYPES), { required: true });
  const info = SERVICE_TYPES[serviceType] || SERVICE_TYPES.formal;
  const startDate = dateValue(input, "startDate", errors, { required: true });
  const id = textValue(input, "id", errors) || makeId("ord");
  const record = {
    id,
    orderNo: textValue(input, "orderNo", errors, { max: 64 }) || id,
    customerId: textValue(input, "customerId", errors, { required: true, max: 64 }),
    serviceType,
    startDate,
    endDate: dateValue(input, "endDate", errors) || (startDate ? addDays(startDate, info.days - 1) : ""),
    price: numberValue(input, "price", errors, { defaultValue: info.price, min: 0 }),
    status: textValue(input, "status", errors, { max: 40 }) || "服务中",
    paidStatus: textValue(input, "paidStatus", errors, { max: 40 }) || "已付款",
    isRepurchase: booleanValue(input, "isRepurchase", false),
    notes: textValue(input, "notes", errors),
    completionRate: numberValue(input, "completionRate", errors, { defaultValue: 0, min: 0 }),
    totalMealCredits: numberValue(input, "totalMealCredits", errors, { defaultValue: info.days * 2, min: 0 }),
    pauseRule: textValue(input, "pauseRule", errors) || "按餐次权益管理：午餐、晚餐分别消耗 1 餐次",
    weightRecords: arrayValue(input, "weightRecords", errors),
  };
  throwIfInvalid(errors);
  return record;
}

function normalizeDish(raw) {
  const input = objectBody(raw);
  const errors = [];
  const name = textValue(input, "name", errors, { required: true, max: 120 });
  const category = enumValue(input, "category", errors, CATEGORIES) || inferDishCategory(name);
  const record = {
    id: textValue(input, "id", errors) || makeId("dish"),
    name,
    category,
    ingredients: listValue(input, "ingredients", errors),
    kcal100: numberValue(input, "kcal100", errors, { defaultValue: 0, min: 0 }),
    protein: numberValue(input, "protein", errors, { defaultValue: 0, min: 0 }),
    fat: numberValue(input, "fat", errors, { defaultValue: 0, min: 0 }),
    carbs: numberValue(input, "carbs", errors, { defaultValue: 0, min: 0 }),
    source: textValue(input, "source", errors) || "AI 写入，待人工校准",
    garlic: booleanValue(input, "garlic", name.includes("蒜")),
    conflicts: listValue(input, "conflicts", errors),
    available: booleanValue(input, "available", true),
    notes: textValue(input, "notes", errors),
  };
  throwIfInvalid(errors);
  return record;
}

function normalizeRecipe(raw) {
  const input = objectBody(raw);
  const errors = [];
  const meals = objectValue(input, "meals", errors, { required: true });
  validateRecipeMeals(meals, errors);
  const record = {
    id: textValue(input, "id", errors) || makeId("recipe"),
    date: dateValue(input, "date", errors, { required: true }),
    meals,
    replacements: arrayValue(input, "replacements", errors),
    generatedAt: textValue(input, "generatedAt", errors) || new Date().toISOString(),
  };
  throwIfInvalid(errors);
  return record;
}

function normalizeDailyOut(raw) {
  const input = objectBody(raw);
  const errors = [];
  const items = arrayValue(input, "items", errors, { required: true });
  const record = {
    id: textValue(input, "id", errors) || makeId("out"),
    date: dateValue(input, "date", errors, { required: true }),
    meal: enumValue(input, "meal", errors, MEALS, { required: true }),
    customerId: textValue(input, "customerId", errors, { required: true, max: 64 }),
    items: normalizeDailyItems(items, errors),
    paused: booleanValue(input, "paused", false),
    pausePolicy: textValue(input, "pausePolicy", errors, { max: 40 }),
    pauseReason: textValue(input, "pauseReason", errors),
    pauseUpdatedAt: textValue(input, "pauseUpdatedAt", errors),
    extensionOrderId: textValue(input, "extensionOrderId", errors, { max: 64 }),
    replaced: booleanValue(input, "replaced", false),
    needsReplacement: booleanValue(input, "needsReplacement", false),
    note: textValue(input, "note", errors),
    generatedAt: textValue(input, "generatedAt", errors) || new Date().toISOString(),
  };
  throwIfInvalid(errors);
  return record;
}

function normalizeFeedback(raw) {
  const input = objectBody(raw);
  const errors = [];
  const record = {
    id: textValue(input, "id", errors) || makeId("fb"),
    date: dateValue(input, "date", errors, { required: true }),
    customerId: textValue(input, "customerId", errors, { required: true, max: 64 }),
    weight: numberValue(input, "weight", errors, { defaultValue: 0, min: 0 }),
    lunchFinished: textValue(input, "lunchFinished", errors, { max: 20 }) || "是",
    dinnerFinished: textValue(input, "dinnerFinished", errors, { max: 20 }) || "是",
    satiety: textValue(input, "satiety", errors, { max: 20 }) || "刚好",
    dislikeDish: textValue(input, "dislikeDish", errors),
    bodyNote: textValue(input, "bodyNote", errors),
    adminNote: textValue(input, "adminNote", errors),
    processed: booleanValue(input, "processed", false),
  };
  throwIfInvalid(errors);
  return record;
}

function normalizeLabel(raw) {
  const input = objectBody(raw);
  const errors = [];
  const record = {
    id: textValue(input, "id", errors) || makeId("label"),
    date: dateValue(input, "date", errors, { required: true }),
    meal: enumValue(input, "meal", errors, MEALS, { required: true }),
    customerId: textValue(input, "customerId", errors, { required: true, max: 64 }),
    customerName: textValue(input, "customerName", errors),
    text: textValue(input, "text", errors, { required: true }),
    kcal: numberValue(input, "kcal", errors, { defaultValue: 0, min: 0 }),
    grams: numberValue(input, "grams", errors, { defaultValue: 0, min: 0 }),
    protein: numberValue(input, "protein", errors, { defaultValue: 0, min: 0 }),
    fat: numberValue(input, "fat", errors, { defaultValue: 0, min: 0 }),
    carbs: numberValue(input, "carbs", errors, { defaultValue: 0, min: 0 }),
    targetRange: textValue(input, "targetRange", errors),
    portion: textValue(input, "portion", errors),
    dayCode: textValue(input, "dayCode", errors),
    customerCode: textValue(input, "customerCode", errors),
    management: textValue(input, "management", errors),
    observe: textValue(input, "observe", errors),
    generated: booleanValue(input, "generated", true),
    generatedAt: textValue(input, "generatedAt", errors) || new Date().toISOString(),
  };
  throwIfInvalid(errors);
  return record;
}

function normalizeDelivery(raw) {
  const input = objectBody(raw);
  const errors = [];
  const record = {
    id: textValue(input, "id", errors) || makeId("del"),
    date: dateValue(input, "date", errors, { required: true }),
    meal: enumValue(input, "meal", errors, MEALS, { required: true }),
    customerId: textValue(input, "customerId", errors, { required: true, max: 64 }),
    customerName: textValue(input, "customerName", errors),
    phone: textValue(input, "phone", errors, { max: 40 }),
    address: textValue(input, "address", errors, { required: true }),
    content: textValue(input, "content", errors, { required: true }),
    note: textValue(input, "note", errors),
    generatedAt: textValue(input, "generatedAt", errors) || new Date().toISOString(),
  };
  throwIfInvalid(errors);
  return record;
}

function normalizePoster(raw) {
  const input = objectBody(raw);
  const errors = [];
  const record = {
    id: textValue(input, "id", errors) || makeId("poster"),
    customerId: textValue(input, "customerId", errors, { required: true, max: 64 }),
    orderId: textValue(input, "orderId", errors, { required: true, max: 64 }),
    summaryText: textValue(input, "summaryText", errors, { required: true }),
    stats: objectValue(input, "stats", errors),
    generatedAt: textValue(input, "generatedAt", errors) || new Date().toISOString(),
  };
  throwIfInvalid(errors);
  return record;
}

function objectBody(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AiWriteValidationError([{ field: "body", message: "请求体必须是 JSON 对象" }]);
  }
  return raw;
}

function textValue(input, field, errors, options = {}) {
  const value = input[field];
  if (value == null || value === "") {
    if (options.required) errors.push({ field, message: "必填" });
    return "";
  }
  if (!["string", "number", "boolean"].includes(typeof value)) {
    errors.push({ field, message: "必须是文本、数字或布尔值" });
    return "";
  }
  const text = String(value).trim();
  if (!text && options.required) errors.push({ field, message: "必填" });
  if (options.max && text.length > options.max) errors.push({ field, message: `长度不能超过 ${options.max}` });
  return text;
}

function numberValue(input, field, errors, options = {}) {
  const value = input[field];
  if (value == null || value === "") {
    if (options.required) errors.push({ field, message: "必填" });
    return options.defaultValue ?? 0;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    errors.push({ field, message: "必须是数字" });
    return options.defaultValue ?? 0;
  }
  if (options.min != null && number < options.min) errors.push({ field, message: `不能小于 ${options.min}` });
  if (options.max != null && number > options.max) errors.push({ field, message: `不能大于 ${options.max}` });
  return number;
}

function booleanValue(input, field, defaultValue = false) {
  const value = input[field];
  if (value == null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (["false", "0", "no", "n", "否", "不是"].includes(text)) return false;
  if (["true", "1", "yes", "y", "是"].includes(text)) return true;
  return Boolean(value);
}

function dateValue(input, field, errors, options = {}) {
  const value = textValue(input, field, errors, options);
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) errors.push({ field, message: "日期必须使用 YYYY-MM-DD" });
  return value;
}

function enumValue(input, field, errors, choices, options = {}) {
  const value = textValue(input, field, errors, options);
  if (!value) return "";
  if (!choices.includes(value)) errors.push({ field, message: `只能是：${choices.join("、")}` });
  return value;
}

function listValue(input, field, errors) {
  const value = input[field];
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return parseList(value);
  errors.push({ field, message: "必须是数组或逗号分隔文本" });
  return [];
}

function arrayValue(input, field, errors, options = {}) {
  const value = input[field];
  if (value == null) {
    if (options.required) errors.push({ field, message: "必填" });
    return [];
  }
  if (!Array.isArray(value)) {
    errors.push({ field, message: "必须是数组" });
    return [];
  }
  if (options.required && !value.length) errors.push({ field, message: "不能为空数组" });
  return value;
}

function objectValue(input, field, errors, options = {}) {
  const value = input[field];
  if (value == null) {
    if (options.required) errors.push({ field, message: "必填" });
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.push({ field, message: "必须是对象" });
    return {};
  }
  return value;
}

function validateRecipeMeals(meals, errors) {
  let hasCategories = false;
  MEALS.forEach((meal) => {
    if (meals[meal] != null && (typeof meals[meal] !== "object" || Array.isArray(meals[meal]))) {
      errors.push({ field: `meals.${meal}`, message: "餐次必须是对象" });
      return;
    }
    const categories = meals[meal]?.categories;
    if (categories == null) return;
    if (typeof categories !== "object" || Array.isArray(categories)) {
      errors.push({ field: `meals.${meal}.categories`, message: "必须是对象" });
      return;
    }
    if (Object.keys(categories).length) hasCategories = true;
    Object.keys(categories).forEach((category) => {
      if (!CATEGORIES.includes(category)) errors.push({ field: `meals.${meal}.categories.${category}`, message: `分类只能是：${CATEGORIES.join("、")}` });
      if (categories[category] && typeof categories[category] !== "string") errors.push({ field: `meals.${meal}.categories.${category}`, message: "菜品值必须是菜品 id 文本" });
    });
  });
  if (!hasCategories) errors.push({ field: "meals", message: "至少填写一个餐次的分类菜品映射" });
}

function normalizeDailyItems(items, errors) {
  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push({ field: `items.${index}`, message: "每个出餐明细必须是对象" });
      return { dishId: "", grams: 0 };
    }
    const dishId = textValue(item, "dishId", errors, { required: true, max: 64 });
    const grams = numberValue(item, "grams", errors, { required: true, min: 1 });
    return { dishId, grams };
  });
}

function parseList(value) {
  return String(value || "")
    .split(/[，,、；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function throwIfInvalid(errors) {
  if (errors.length) throw new AiWriteValidationError(errors);
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function inferDishCategory(name) {
  if (/(虾|鱼|鳕|龙利|巴沙|贝|蟹|海鲜|鱿|扇贝|三文鱼|蛏|蛤蜊|蛤|贝)/.test(name)) return "海鲜";
  if (/(饭|米|薯|红薯|面|藜麦|玉米|南瓜|芋|荞麦|意面|杂粮)/.test(name)) return "主食";
  if (/(鸡|牛|猪|肉|鸭|蛋|里脊|鸡胸|鸡腿)/.test(name)) return "荤";
  return "素";
}

function bearerToken(req) {
  const header = req.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

module.exports = {
  createAiWriteRouter,
  aiWriteCapabilities,
  normalizeCustomer,
  normalizeOrder,
  normalizeDish,
  normalizeRecipe,
  normalizeDailyOut,
  normalizeFeedback,
  normalizeLabel,
  normalizeDelivery,
  normalizePoster,
  AiWriteValidationError,
};
