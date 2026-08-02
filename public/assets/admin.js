(() => {
  "use strict";

  const STORE_KEY = "meal_admin_system_v2_cache";
  const API_STATE_URL = "/api/state";
  const TABLE_KEYS = [
    "customers",
    "orders",
    "dishes",
    "recipes",
    "dailyOut",
    "feedbacks",
    "labels",
    "deliveries",
    "posters",
  ];
  const CATEGORIES = ["荤", "海鲜", "素", "主食"];
  const MEALS = { lunch: "午餐", dinner: "晚餐" };
  const SERVICE_TYPES = {
    trial: { label: "6 天体验服务", days: 6, price: 699 },
    formal: { label: "28 天正式服务", days: 28, price: 2999 },
  };
  const PAUSE_POLICIES = {
    retain: { label: "截止前暂停，保留 1 餐次", color: "green" },
    consume: { label: "截止后/已备餐，消耗 1 餐次", color: "amber" },
    provider_makeup: { label: "店方原因，补偿 1 餐次", color: "blue" },
    refund: { label: "取消结算，待退款 1 餐次", color: "red" },
  };
  const REFUND_MEAL_AMOUNT = 25;
  const LABEL_PAGE_WIDTH_MM = 50;
  const LABEL_PAGE_HEIGHT_MM = 70;
  const LABEL_PAGE_WIDTH_PT = mmToPt(LABEL_PAGE_WIDTH_MM);
  const LABEL_PAGE_HEIGHT_PT = mmToPt(LABEL_PAGE_HEIGHT_MM);
  const LABEL_CANVAS_DPI = 203;
  const LABEL_QR_SRC = [
    "data:image/png;base64,",
    "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",
  ].join("");
  let labelQrImage = null;
  let labelQrImagePromise = null;
  const ACTIVITY_FACTORS = {
    久坐: 1.2,
    轻运动: 1.375,
    中等运动: 1.55,
    高运动: 1.725,
  };
  const PACE_DEFICIT = {
    稳定: 320,
    标准: 450,
    快速: 580,
  };
  const PAGE_KICKERS = {
    dashboard: "今日工作",
    customers: "客户服务资料",
    orders: "购买与周期",
    dishes: "菜品库维护",
    recipes: "午晚餐食谱",
    daily: "出餐执行",
    feedbacks: "每日跟进",
    logistics: "餐盒与配送",
    posters: "服务结束复盘",
  };
  const PAGES = [
    { id: "dashboard", title: "首页看板", icon: "首" },
    { id: "customers", title: "客户档案", icon: "客" },
    { id: "orders", title: "服务订单", icon: "单" },
    { id: "dishes", title: "菜品管理", icon: "菜" },
    { id: "recipes", title: "食谱管理", icon: "谱" },
    { id: "daily", title: "每日出餐", icon: "出" },
    { id: "feedbacks", title: "客户反馈", icon: "反" },
    { id: "logistics", title: "标签与配送", icon: "配" },
    { id: "posters", title: "服务总结海报", icon: "海" },
  ];
  const WEEKLY_RECIPE_TEMPLATE = [
    {
      lunch: { 荤: "板栗炖鸡", 海鲜: "番茄龙利鱼", 素: "蒜蓉西兰花胡萝卜", 主食: "米饭" },
      dinner: { 荤: "柠檬手撕鸡", 海鲜: "葱姜蛏子", 素: "手撕包菜胡萝卜", 主食: "玉米" },
    },
    {
      lunch: { 荤: "青椒肉丝", 海鲜: "蛤蜊煎蛋", 素: "干煸豆角", 主食: "糙米饭" },
      dinner: { 荤: "葱姜鸡腿肉", 海鲜: "葱油龙利鱼黄瓜", 素: "蒜蓉娃娃菜口蘑", 主食: "玉米" },
    },
    {
      lunch: { 荤: "香煎鸡胸", 海鲜: "清蒸鳕鱼", 素: "荷兰豆木耳", 主食: "紫薯块" },
      dinner: { 荤: "番茄牛肉", 海鲜: "柠檬巴沙鱼", 素: "彩椒西葫芦", 主食: "藜麦南瓜饭" },
    },
    {
      lunch: { 荤: "黑椒鸡腿丁", 海鲜: "虾仁西兰花", 素: "芦笋口蘑", 主食: "荞麦面" },
      dinner: { 荤: "低脂牛肉丸", 海鲜: "清蒸龙利鱼", 素: "清炒菠菜", 主食: "玉米" },
    },
    {
      lunch: { 荤: "黑椒里脊", 海鲜: "葱油蛏子", 素: "蒜蓉娃娃菜口蘑", 主食: "糙米饭" },
      dinner: { 荤: "番茄鸡腿肉", 海鲜: "蛤蜊煎蛋", 素: "香菇青菜", 主食: "红薯" },
    },
    {
      lunch: { 荤: "板栗炖鸡", 海鲜: "清蒸巴沙鱼", 素: "手撕包菜胡萝卜", 主食: "米饭" },
      dinner: { 荤: "柠檬手撕鸡", 海鲜: "葱油龙利鱼黄瓜", 素: "西葫芦口蘑", 主食: "玉米" },
    },
  ];

  let state = loadState();
  let currentFormSubmit = null;
  let pendingConfirm = null;
  let comboIdSeed = 0;
  let remoteSaveEnabled = false;
  let remoteSaveTimer = null;
  let remoteSaveInFlight = false;
  let remoteSaveQueued = false;
  const copyCache = {};

  const view = {
    page: getPageFromHash(),
    date: todayKey(),
    dashboardOffset: 0,
    mealTab: "lunch",
    selectedCustomerId: state.customers[0]?.id || "",
    selectedOrderId: "",
    selectedFeedbackCustomerId: state.customers[0]?.id || "",
    posterCustomerId: state.customers[0]?.id || "",
    posterOrderId: "",
    posterDraft: "",
    filters: {
      customers: { query: "", status: "全部" },
      orders: { query: "", status: "全部" },
      dishes: { query: "", category: "全部", available: "全部" },
      daily: {
        lunch: { query: "", status: "全部" },
        dinner: { query: "", status: "全部" },
      },
      feedbacks: { query: "", date: todayKey(), satiety: "全部" },
      logistics: { date: todayKey() },
      posters: { query: "" },
    },
  };

  document.addEventListener("DOMContentLoaded", bootApp);
  window.addEventListener("hashchange", () => {
    view.page = getPageFromHash();
    render();
  });
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("input", handleInput);
  document.addEventListener("keydown", handleKeydown);

  async function bootApp() {
    try {
      const remoteState = await fetchRemoteState();
      state = isEmptyEntityState(remoteState) ? seedState() : remoteState;
    } catch (error) {
      console.error(error);
      toast("数据库读取失败，已使用本地缓存临时显示。");
    }
    resetViewSelections();
    remoteSaveEnabled = true;
    normalizeState();
    preloadLabelQrImage();
    render();
    queueRemoteSave();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return seedState();
      const parsed = JSON.parse(raw);
      TABLE_KEYS.forEach((key) => {
        if (!Array.isArray(parsed[key])) parsed[key] = [];
      });
      return parsed;
    } catch (error) {
      console.warn(error);
      return seedState();
    }
  }

  async function fetchRemoteState() {
    const response = await fetch(API_STATE_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`读取数据失败：${response.status}`);
    const remote = await response.json();
    TABLE_KEYS.forEach((key) => {
      if (!Array.isArray(remote[key])) remote[key] = [];
    });
    return remote;
  }

  function isEmptyEntityState(candidate) {
    if (!candidate) return true;
    return TABLE_KEYS.every((key) => !Array.isArray(candidate[key]) || candidate[key].length === 0);
  }

  function resetViewSelections() {
    if (!state.customers.some((customer) => customer.id === view.selectedCustomerId)) {
      view.selectedCustomerId = state.customers[0]?.id || "";
    }
    if (!state.orders.some((order) => order.id === view.selectedOrderId)) {
      view.selectedOrderId = state.orders[0]?.id || "";
    }
    if (!state.customers.some((customer) => customer.id === view.selectedFeedbackCustomerId)) {
      view.selectedFeedbackCustomerId = state.customers[0]?.id || "";
    }
    if (!state.customers.some((customer) => customer.id === view.posterCustomerId)) {
      view.posterCustomerId = state.customers[0]?.id || "";
      view.posterOrderId = "";
    }
    if (!state.orders.some((order) => order.id === view.posterOrderId)) {
      view.posterOrderId = "";
    }
  }

  function normalizeState() {
    TABLE_KEYS.forEach((key) => {
      if (!Array.isArray(state[key])) state[key] = [];
    });
    if (!state.meta) state.meta = { schemaVersion: 1 };
    normalizeOrders();
    normalizeServiceCredits();
    rebuildAllCustomerOrderSchedules();
    normalizeDishLibrary();
    if (!state.recipes.length) {
      generateRecipe(todayKey(), true, false);
    }
    if (!state.dailyOut.some((row) => row.date === todayKey())) {
      generateDailyOut(todayKey(), false, false);
    }
    saveState();
  }

  function normalizeServiceCredits() {
    state.orders.forEach((order) => {
      const type = SERVICE_TYPES[order.serviceType];
      if (!order.totalMealCredits) order.totalMealCredits = (type?.days || 0) * 2;
      if (!order.pauseRule) order.pauseRule = "按餐次权益管理：午餐、晚餐分别消耗 1 餐次";
    });
    state.dailyOut.forEach((row) => {
      row.paused = Boolean(row.paused);
      if (row.paused && !row.pausePolicy) row.pausePolicy = "retain";
      if (!row.pauseReason) row.pauseReason = "";
      if (row.paused && shouldExtendPause(row.pausePolicy) && !row.extensionOrderId) {
        const order = state.orders.find((item) => item.customerId === row.customerId && item.status !== "已取消" && inDateRange(row.date, item.startDate, item.endDate));
        row.extensionOrderId = order?.id || "";
      }
      if (!row.paused || !shouldExtendPause(row.pausePolicy)) row.extensionOrderId = "";
    });
  }

  function saveState() {
    state.meta = { ...(state.meta || {}), schemaVersion: 2, storage: "mysql", savedAt: new Date().toISOString() };
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (remoteSaveEnabled) queueRemoteSave();
  }

  function queueRemoteSave() {
    window.clearTimeout(remoteSaveTimer);
    remoteSaveTimer = window.setTimeout(() => persistRemoteState(), 260);
  }

  async function persistRemoteState() {
    if (!remoteSaveEnabled) return;
    if (remoteSaveInFlight) {
      remoteSaveQueued = true;
      return;
    }
    remoteSaveInFlight = true;
    remoteSaveQueued = false;
    const payload = JSON.stringify(state);
    try {
      const response = await fetch(API_STATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!response.ok) throw new Error(`保存失败：${response.status}`);
    } catch (error) {
      console.error(error);
      toast("保存到数据库失败，请检查服务是否运行。");
    } finally {
      remoteSaveInFlight = false;
      if (remoteSaveQueued) queueRemoteSave();
    }
  }

  function seedState() {
    const today = todayKey();
    const yesterday = addDays(today, -1);
    const customers = [
      {
        id: "cus_001",
        name: "林乔",
        nickname: "Lynn",
        phone: "13800010001",
        gender: "女",
        age: 32,
        height: 164,
        currentWeight: 66.2,
        targetWeight: 58,
        activity: "轻运动",
        pace: "标准",
        address: "滨江花园 3 栋 1201",
        restrictions: ["蒜", "香菜"],
        dislikes: ["苦瓜"],
        allergies: [],
        notes: "午餐送公司，晚餐送家里。",
        weightRecords: [
          { date: addDays(today, -8), weight: 67.1 },
          { date: yesterday, weight: 66.2 },
        ],
      },
      {
        id: "cus_002",
        name: "陈然",
        nickname: "小然",
        phone: "13800010002",
        gender: "女",
        age: 28,
        height: 160,
        currentWeight: 59.4,
        targetWeight: 53,
        activity: "久坐",
        pace: "稳定",
        address: "云谷中心 B 座 808",
        restrictions: ["虾"],
        dislikes: ["洋葱"],
        allergies: ["花生"],
        notes: "不吃海虾，龙利鱼可以。",
        weightRecords: [
          { date: addDays(today, -4), weight: 60.1 },
          { date: yesterday, weight: 59.4 },
        ],
      },
      {
        id: "cus_003",
        name: "王珂",
        nickname: "Keke",
        phone: "13800010003",
        gender: "男",
        age: 36,
        height: 176,
        currentWeight: 82.5,
        targetWeight: 74,
        activity: "中等运动",
        pace: "标准",
        address: "望京 SOHO T2 15 层",
        restrictions: [],
        dislikes: ["芹菜"],
        allergies: [],
        notes: "训练日容易饿。",
        weightRecords: [
          { date: addDays(today, -12), weight: 84.0 },
          { date: yesterday, weight: 82.5 },
        ],
      },
      {
        id: "cus_004",
        name: "周怡",
        nickname: "Zoey",
        phone: "13800010004",
        gender: "女",
        age: 41,
        height: 168,
        currentWeight: 70.8,
        targetWeight: 62,
        activity: "轻运动",
        pace: "快速",
        address: "海棠公寓 6 号楼 902",
        restrictions: ["牛肉"],
        dislikes: ["西兰花"],
        allergies: [],
        notes: "本周晚餐提前 30 分钟配送。",
        weightRecords: [
          { date: addDays(today, -20), weight: 73.2 },
          { date: yesterday, weight: 70.8 },
        ],
      },
      {
        id: "cus_005",
        name: "蒋南",
        nickname: "南南",
        phone: "13800010005",
        gender: "女",
        age: 30,
        height: 162,
        currentWeight: 63.0,
        targetWeight: 56,
        activity: "久坐",
        pace: "标准",
        address: "金融街丰融园 2 单元",
        restrictions: ["辣椒"],
        dislikes: ["南瓜"],
        allergies: [],
        notes: "体验服务客户，需观察饱腹感。",
        weightRecords: [
          { date: addDays(today, -3), weight: 63.5 },
          { date: yesterday, weight: 63.0 },
        ],
      },
      {
        id: "cus_006",
        name: "赵敏",
        nickname: "Mia",
        phone: "13800010006",
        gender: "女",
        age: 34,
        height: 165,
        currentWeight: 57.8,
        targetWeight: 54,
        activity: "轻运动",
        pace: "稳定",
        address: "远洋国际 C 座 2307",
        restrictions: ["鸡蛋"],
        dislikes: ["番茄"],
        allergies: [],
        notes: "上一期已结束，可能复购。",
        weightRecords: [
          { date: addDays(today, -35), weight: 60.0 },
          { date: addDays(today, -8), weight: 57.8 },
        ],
      },
    ];

    const orders = [
      makeOrder("ord_001", "cus_001", "formal", addDays(today, -10), "服务中", true, "第二周，执行稳定。"),
      makeOrder("ord_002", "cus_002", "trial", addDays(today, -4), "服务中", true, "体验服务第 5 天。"),
      makeOrder("ord_003", "cus_003", "formal", addDays(today, -24), "服务中", true, "即将结束，准备总结。"),
      makeOrder("ord_004", "cus_004", "formal", addDays(today, -18), "服务中", true, "晚餐提前送。"),
      makeOrder("ord_005", "cus_005", "trial", addDays(today, -2), "服务中", true, "体验新客。"),
      makeOrder("ord_006", "cus_006", "formal", addDays(today, -36), "已结束", true, "上一期已完成。"),
    ];

    const dishes = [
      dish("dish_001", "香煎鸡胸", "荤", ["鸡胸肉", "迷迭香", "黑胡椒", "橄榄油"], 165, 31, 3.6, 0, "中国食物成分表及熟重估算", false, [], true, "稳定高蛋白菜。"),
      dish("dish_002", "黑椒里脊", "荤", ["猪里脊", "黑胡椒", "彩椒"], 178, 27, 6.2, 2, "中国食物成分表及门店称重", false, [], true, ""),
      dish("dish_003", "蒜香牛肉粒", "荤", ["牛肉", "蒜", "彩椒", "芦笋"], 192, 26, 8.4, 3, "中国食物成分表及熟重估算", true, [], true, "不适合忌蒜或忌牛肉客户。"),
      dish("dish_004", "番茄鸡腿肉", "荤", ["鸡腿肉", "番茄", "洋葱"], 184, 24, 7.8, 4, "中国食物成分表及熟重估算", false, [], true, ""),
      dish("dish_005", "清蒸鳕鱼", "海鲜", ["鳕鱼", "姜", "小葱"], 116, 22, 2.5, 1, "包装营养标识及熟重估算", false, [], true, ""),
      dish("dish_006", "虾仁西兰花", "海鲜", ["虾", "西兰花", "胡萝卜", "蒜"], 98, 16, 2.1, 5, "中国食物成分表及熟重估算", true, [], true, "有虾和蒜。"),
      dish("dish_007", "番茄龙利鱼", "海鲜", ["龙利鱼", "番茄", "金针菇"], 108, 19, 2.8, 4, "供应商营养标识及熟重估算", false, [], true, ""),
      dish("dish_008", "柠檬巴沙鱼", "海鲜", ["巴沙鱼", "柠檬", "芦笋"], 112, 20, 2.7, 2, "供应商营养标识及熟重估算", false, [], true, ""),
      dish("dish_009", "香菇青菜", "素", ["小青菜", "香菇", "蒜"], 46, 2.7, 1.3, 5, "中国食物成分表及熟重估算", true, [], true, ""),
      dish("dish_010", "荷兰豆木耳", "素", ["荷兰豆", "木耳", "胡萝卜"], 54, 3.1, 1.1, 8, "中国食物成分表及熟重估算", false, [], true, ""),
      dish("dish_011", "彩椒西葫芦", "素", ["西葫芦", "彩椒", "洋葱"], 42, 1.8, 1.0, 7, "中国食物成分表及熟重估算", false, [], true, ""),
      dish("dish_012", "芦笋口蘑", "素", ["芦笋", "口蘑", "黑胡椒"], 48, 3.2, 1.2, 6, "中国食物成分表及熟重估算", false, [], true, ""),
      dish("dish_013", "糙米饭", "主食", ["糙米"], 125, 2.8, 1.0, 26, "中国食物成分表熟重", false, [], true, ""),
      dish("dish_014", "藜麦南瓜", "主食", ["藜麦", "南瓜"], 118, 4.1, 1.8, 22, "中国食物成分表及熟重估算", false, [], true, ""),
      dish("dish_015", "紫薯块", "主食", ["紫薯"], 106, 1.6, 0.2, 25, "中国食物成分表熟重", false, [], true, ""),
      dish("dish_016", "荞麦面", "主食", ["荞麦面", "小葱"], 132, 5.0, 1.1, 27, "包装营养标识熟重换算", false, [], true, ""),
      dish("dish_017", "清炒菠菜", "素", ["菠菜", "芝麻"], 39, 3.0, 1.1, 4, "中国食物成分表及熟重估算", false, ["豆腐"], true, ""),
      dish("dish_018", "低脂豆腐", "素", ["豆腐", "小葱"], 82, 8.2, 4.1, 3, "中国食物成分表及熟重估算", false, ["菠菜"], true, ""),
    ];

    const feedbacks = [
      {
        id: "fb_001",
        date: yesterday,
        customerId: "cus_001",
        weight: 66.2,
        lunchFinished: "是",
        dinnerFinished: "是",
        satiety: "刚好",
        dislikeDish: "",
        bodyNote: "状态正常。",
        adminNote: "继续当前克重。",
        processed: true,
      },
      {
        id: "fb_002",
        date: yesterday,
        customerId: "cus_003",
        weight: 82.5,
        lunchFinished: "是",
        dinnerFinished: "是",
        satiety: "偏饿",
        dislikeDish: "",
        bodyNote: "训练后晚上饿。",
        adminNote: "明日晚餐主食略增。",
        processed: true,
      },
      {
        id: "fb_003",
        date: yesterday,
        customerId: "cus_004",
        weight: 70.8,
        lunchFinished: "否",
        dinnerFinished: "是",
        satiety: "偏撑",
        dislikeDish: "西兰花",
        bodyNote: "中午吃不完。",
        adminNote: "明日午餐减克重。",
        processed: true,
      },
    ];

    const seeded = {
      meta: { schemaVersion: 1, savedAt: new Date().toISOString() },
      customers,
      orders,
      dishes,
      recipes: [],
      dailyOut: [],
      feedbacks,
      labels: [],
      deliveries: [],
      posters: [],
    };
    return seeded;
  }

  function dish(id, name, category, ingredients, kcal100, protein, fat, carbs, source, garlic, conflicts, available, notes) {
    return {
      id,
      name,
      category,
      ingredients,
      kcal100,
      protein,
      fat,
      carbs,
      source,
      garlic,
      conflicts,
      available,
      notes,
    };
  }

  function normalizeDishLibrary() {
    const idMap = {};
    const byKey = new Map();
    const normalized = [];
    state.dishes.forEach((dishItem) => {
      const cleanName = stripWeeklyMarker(dishItem.name);
      dishItem.name = cleanName;
      const nutrition = authorityNutritionForDish(cleanName, dishItem.category);
      dishItem.kcal100 = nutrition.kcal100;
      dishItem.protein = nutrition.protein;
      dishItem.fat = nutrition.fat;
      dishItem.carbs = nutrition.carbs;
      dishItem.source = nutrition.source;
      if (dishItem.notes?.includes("本地原型自动估算")) dishItem.notes = "";
      const key = `${dishItem.category}|${cleanName}`;
      if (byKey.has(key)) {
        idMap[dishItem.id] = byKey.get(key).id;
        return;
      }
      byKey.set(key, dishItem);
      normalized.push(dishItem);
    });
    if (Object.keys(idMap).length) remapDishReferences(idMap);
    state.dishes = normalized;
  }

  function remapDishReferences(idMap) {
    state.recipes.forEach((recipe) => {
      ["lunch", "dinner"].forEach((meal) => {
        CATEGORIES.forEach((category) => {
          const id = recipe.meals[meal]?.categories?.[category];
          if (idMap[id]) recipe.meals[meal].categories[category] = idMap[id];
        });
      });
      (recipe.replacements || []).forEach((item) => {
        if (idMap[item.oldDishId]) item.oldDishId = idMap[item.oldDishId];
        if (idMap[item.newDishId]) item.newDishId = idMap[item.newDishId];
      });
    });
    state.dailyOut.forEach((row) => {
      row.items.forEach((item) => {
        if (idMap[item.dishId]) item.dishId = idMap[item.dishId];
      });
    });
  }

  function stripWeeklyMarker(name) {
    return String(name || "").replace(/（第\d+周）/g, "").replace(/\(第\d+周\)/g, "").trim();
  }

  function makeOrder(id, customerId, serviceType, startDate, status, paid, notes) {
    const info = SERVICE_TYPES[serviceType];
    return {
      id,
      orderNo: makeOrderNo(startDate, id),
      customerId,
      serviceType,
      startDate,
      endDate: addDays(startDate, info.days - 1),
      price: info.price,
      status,
      paidStatus: paid ? "已付款" : "未付款",
      isRepurchase: false,
      notes,
      completionRate: status === "已结束" ? 96 : 0,
      totalMealCredits: info.days * 2,
      pauseRule: "按餐次权益管理：午餐、晚餐分别消耗 1 餐次",
      weightRecords: [],
    };
  }

  function normalizeOrders() {
    state.orders.forEach((order) => {
      if (!order.orderNo) order.orderNo = makeOrderNo(order.startDate, order.id);
      const duration = orderDurationDays(order);
      if (!order.endDate && order.startDate) order.endDate = addDays(order.startDate, duration - 1);
    });
  }

  function render() {
    const page = PAGES.find((item) => item.id === view.page) || PAGES[0];
    comboIdSeed = 0;
    document.querySelector("#sideNav").innerHTML = PAGES.map((item) => {
      const active = item.id === page.id ? " active" : "";
      return `<a class="nav-item${active}" href="#${item.id}" data-page="${item.id}">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.title}</span>
      </a>`;
    }).join("");
    document.querySelector("#pageTitle").textContent = page.title;
    document.querySelector("#pageKicker").textContent = PAGE_KICKERS[page.id] || "";
    document.querySelector("#topDate").textContent = `今天 ${formatCnDate(todayKey())}`;
    const output = renderers[page.id]();
    document.querySelector("#topActions").innerHTML = output.actions || "";
    document.querySelector("#content").innerHTML = output.body || "";
  }

  const renderers = {
    dashboard: renderDashboard,
    customers: renderCustomers,
    orders: renderOrders,
    dishes: renderDishes,
    recipes: renderRecipes,
    daily: renderDaily,
    feedbacks: renderFeedbacks,
    logistics: renderLogistics,
    posters: renderPosters,
  };

  function renderDashboard() {
    const date = addDays(todayKey(), view.dashboardOffset);
    const recipe = getRecipe(date);
    const rows = state.dailyOut.filter((row) => row.date === date);
    const activeCustomers = getActiveCustomers(date);
    const lunchRows = rows.filter((row) => row.meal === "lunch" && !row.paused);
    const dinnerRows = rows.filter((row) => row.meal === "dinner" && !row.paused);
    const lunchCount = lunchRows.length || activeCustomers.length;
    const dinnerCount = dinnerRows.length || activeCustomers.length;
    const labelsNeed = rows.filter((row) => !row.paused).length;
    const labelsReady = state.labels.filter((item) => item.date === date).length;
    const deliveriesReady = state.deliveries.filter((item) => item.date === date).length;
    const feedbackNeed = activeCustomers.length - uniqueCount(state.feedbacks.filter((fb) => fb.date === date), "customerId");
    const replacements = recipe?.replacements?.filter((item) => !item.confirmed).length || 0;
    const checks = recipe ? checkRecipe(recipe) : [{ level: "danger", text: "当天未生成食谱" }];
    const conflicts = checks.filter((item) => item.level === "danger");
    const warnings = checks.filter((item) => item.level === "warning");
    const status = serviceStatusCounts();
    const creditSummary = serviceCreditSummary(date);
    const tomorrowDate = addDays(todayKey(), 1);
    const tomorrowRecipe = getRecipe(tomorrowDate);
    const tomorrowDaily = state.dailyOut.filter((row) => row.date === tomorrowDate).length;
    const tomorrowLabels = state.labels.filter((item) => item.date === tomorrowDate).length;

    return {
      actions: `
        <div class="segmented">
          ${btn("今", "今日", "dashboard-offset", view.dashboardOffset === 0 ? "active" : "", 'data-offset="0"')}
          ${btn("明", "明日", "dashboard-offset", view.dashboardOffset === 1 ? "active" : "", 'data-offset="1"')}
        </div>
        ${btn("+", "新增客户", "open-customer-new", "primary")}
        ${btn("出", "生成出餐", "generate-daily", "", `data-date="${date}"`)}
      `,
      body: `
        <div class="section-title">
          <div>
            <h2>${view.dashboardOffset === 0 ? "今日出餐概览" : "明日出餐准备"}</h2>
            <small>${formatCnDate(date)}</small>
          </div>
          <div class="section-actions">
            ${btn("谱", "去食谱", "goto-page", "", 'data-target="recipes"')}
            ${btn("配", "去标签配送", "goto-page", "", 'data-target="logistics"')}
          </div>
        </div>

        <div class="grid grid-3 mb-12">
          ${metricCard("午餐人数", lunchCount, "点击查看午餐出餐表", "daily", "lunch")}
          ${metricCard("晚餐人数", dinnerCount, "点击查看晚餐出餐表", "daily", "dinner")}
          ${metricCard("今日总餐盒数", lunchCount + dinnerCount, `服务客户 ${activeCustomers.length} 人`, "logistics")}
        </div>

        <div class="grid grid-2">
          <div class="panel">
            <div class="section-title">
              <h3>待处理事项</h3>
              <small>点击进入对应页面</small>
            </div>
            <div class="grid grid-3">
              ${pendingCard("未生成食谱", recipe ? 0 : 1, "recipes", "danger")}
              ${pendingCard("未确认替换", replacements, "recipes", replacements ? "warning" : "pass")}
              ${pendingCard("未填写反馈", Math.max(0, feedbackNeed), "feedbacks", feedbackNeed ? "warning" : "pass")}
              ${pendingCard("待导出标签", Math.max(0, labelsNeed - labelsReady), "logistics", labelsNeed > labelsReady ? "warning" : "pass")}
              ${pendingCard("待导出配送单", Math.max(0, labelsNeed - deliveriesReady), "logistics", labelsNeed > deliveriesReady ? "warning" : "pass")}
              ${pendingCard("待补餐次", creditSummary.makeup, "orders", creditSummary.makeup ? "warning" : "pass")}
              ${pendingCard("食谱规则警告", warnings.length + conflicts.length, "recipes", conflicts.length ? "danger" : warnings.length ? "warning" : "pass")}
            </div>
          </div>

          <div class="panel">
            <div class="section-title">
              <h3>服务状态统计</h3>
              <small>按当前日期计算</small>
            </div>
            <div class="grid grid-4">
              ${smallStat("服务中客户", status.active, "green")}
              ${smallStat("即将结束", status.nearEnd, "amber")}
              ${smallStat("已结束客户", status.ended, "gray")}
              ${smallStat("复购客户", status.repurchase, "purple")}
            </div>
            <div class="notice ${tomorrowRecipe && tomorrowDaily ? "pass" : "warning"} mt-12">
              <span>${tomorrowRecipe && tomorrowDaily ? "通过" : "提醒"}</span>
              <div>明日准备状态：食谱${tomorrowRecipe ? "已生成" : "未生成"}，出餐表 ${tomorrowDaily ? "已生成" : "未生成"}，标签 ${tomorrowLabels ? "已生成" : "未生成"}。</div>
            </div>
          </div>
        </div>

        <div class="panel mt-16">
          <div class="section-title">
            <h3>今日异常提醒</h3>
            <small>${conflicts.length ? "需要优先处理" : "暂无高风险冲突"}</small>
          </div>
          <div class="check-list">
            ${checks.map((item) => noticeLine(item)).join("")}
          </div>
        </div>
      `,
    };
  }

  function metricCard(title, value, foot, target, meal) {
    return `<button class="metric-card clickable" data-action="goto-page" data-target="${target}" ${meal ? `data-meal="${meal}"` : ""}>
      <div class="metric-title">${title}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-foot"><span>${foot}</span><span>查看</span></div>
    </button>`;
  }

  function pendingCard(title, value, target, level) {
    const cls = level === "danger" ? " danger" : level === "warning" ? " warning" : "";
    return `<button class="metric-card clickable${cls}" data-action="goto-page" data-target="${target}">
      <div class="metric-title">${title}</div>
      <div class="metric-value">${value}</div>
      <div class="metric-foot"><span>${value ? "待处理" : "已完成"}</span><span>进入</span></div>
    </button>`;
  }

  function smallStat(label, value, color) {
    return `<div class="detail-item">
      <span>${label}</span>
      <strong>${badge(value, color)}</strong>
    </div>`;
  }

  function renderCustomers() {
    const f = view.filters.customers;
    const customers = filteredCustomers();
    const selected = getCustomer(view.selectedCustomerId) || customers[0] || state.customers[0];
    if (selected) view.selectedCustomerId = selected.id;
    return {
      actions: `
        ${btn("+", "新增客户", "open-customer-new", "primary")}
        ${btn("重", "记录体重", "open-weight-new", "", selected ? `data-id="${selected.id}"` : "")}
      `,
      body: `
        <div class="split-layout">
          <div class="table-panel">
            <div class="filter-bar">
              <input id="customerSearch" class="search-input" value="${escapeAttr(f.query)}" placeholder="搜索姓名 / 电话" />
              ${btn("搜", "搜索", "apply-search", "", 'data-page="customers" data-input="customerSearch" data-key="query"')}
              <label class="field-inline"><span>服务状态</span>
                ${actionCombo("set-filter", ["全部", "服务中", "即将结束", "已结束", "未开始"], f.status, { page: "customers", key: "status" }, "输入服务状态")}
              </label>
            </div>
            ${customerTable(customers)}
          </div>
          ${selected ? customerDetail(selected) : empty("暂无客户，先新增一个客户档案。")}
        </div>
      `,
    };
  }

  function customerTable(customers) {
    if (!customers.length) return empty("没有匹配的客户。");
    const rows = customers
      .map((customer) => {
        const info = customerServiceInfo(customer.id, todayKey());
        const credits = info.order ? mealCreditInfo(info.order, todayKey()) : null;
        const active = customer.id === view.selectedCustomerId ? " selected-row" : "";
        return `<tr class="row-click${active}" data-action="select-customer" data-id="${customer.id}">
          <td class="cell-strong">${escapeHtml(customer.name)}<br><span class="muted">${escapeHtml(customer.phone)}</span></td>
          <td>${statusBadge(info.status)}</td>
          <td>${escapeHtml(info.serviceLabel)}</td>
          <td>${info.remainingDays} 天${credits ? `<br><span class="muted">${credits.remaining} 餐</span>` : ""}</td>
        </tr>`;
      })
      .join("");
    return table(["姓名 / 电话", "状态", "当前服务", "剩余天数/餐次"], rows);
  }

  function customerDetail(customer) {
    const calc = calculateCustomerPlan(customer, view.date, "day");
    const records = state.orders
      .filter((order) => order.customerId === customer.id)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    const recentFeedback = state.feedbacks
      .filter((fb) => fb.customerId === customer.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4);
    return `<aside class="detail-panel">
      <div class="section-title">
        <div>
          <h3>${escapeHtml(customer.name)} · 客户详情</h3>
          <small>${escapeHtml(customer.nickname || "未填昵称")}</small>
        </div>
        <div class="section-actions">
          ${btn("编", "编辑资料", "open-customer-edit", "", `data-id="${customer.id}"`)}
          ${btn("删", "删除客户", "delete-customer", "danger", `data-id="${customer.id}"`)}
        </div>
      </div>
      <div class="detail-grid">
        ${detail("性别 / 年龄", `${customer.gender} · ${customer.age} 岁`)}
        ${detail("身高 / 当前体重", `${customer.height} cm · ${latestWeight(customer)} kg`)}
        ${detail("目标体重", `${customer.targetWeight} kg`)}
        ${detail("希望速度", customer.pace)}
        ${detail("运动量", customer.activity)}
        ${detail("电话", customer.phone)}
        ${detail("配送地址", customer.address, true)}
        ${detail("忌口食材", listText(customer.restrictions), true)}
        ${detail("不喜欢的菜", listText(customer.dislikes), true)}
        ${detail("过敏信息", listText(customer.allergies), true)}
        ${detail("特殊备注", customer.notes || "无", true)}
      </div>

      <div class="panel mt-12">
        <div class="section-title"><h3>代谢与热量计算</h3><small>${calc.adjustmentText}</small></div>
        <div class="detail-grid">
          ${detail("基础代谢 BMR", `${calc.bmr} kcal`)}
          ${detail("每日建议摄入", `${calc.dailyKcal} kcal`)}
          ${detail("午餐建议热量", `${calc.lunch.kcal} kcal`)}
          ${detail("晚餐建议热量", `${calc.dinner.kcal} kcal`)}
          ${detail("午餐建议克重", `${calc.lunch.grams} g`)}
          ${detail("晚餐建议克重", `${calc.dinner.grams} g`)}
        </div>
      </div>

      ${customerCreditPanel(customer)}

      <div class="panel mt-12">
        <div class="section-title"><h3>历史服务记录</h3>${btn("+", "新增订单", "open-order-new", "small", `data-customer-id="${customer.id}"`)}</div>
        ${records.length ? records.map((order) => orderMini(order)).join("") : '<div class="muted">暂无订单记录。</div>'}
      </div>

      <div class="panel mt-12">
        <div class="section-title"><h3>连续反馈</h3>${btn("+", "录入反馈", "open-feedback-new", "small", `data-customer-id="${customer.id}"`)}</div>
        ${recentFeedback.length ? recentFeedback.map((fb) => feedbackMini(fb)).join("") : '<div class="muted">暂无反馈。</div>'}
      </div>
    </aside>`;
  }

  function customerCreditPanel(customer) {
    const info = customerServiceInfo(customer.id, todayKey());
    if (!info.order) return "";
    const credits = mealCreditInfo(info.order, todayKey());
    return `<div class="panel mt-12">
      <div class="section-title">
        <h3>服务餐次权益</h3>
        <small>服务日按日期走，午晚餐按餐次消耗</small>
      </div>
      <div class="detail-grid">
        ${detail("服务周期剩余", `${info.remainingDays} 天`)}
        ${detail("餐次剩余", `${credits.remaining} / ${credits.total} 餐`)}
        ${detail("已消耗餐次", `${credits.consumed} 餐`)}
        ${detail("待补餐次", `${credits.makeup} 餐`)}
        ${detail("待退款餐次", `${credits.refundCredits} 餐`)}
        ${detail("单餐估算", money(credits.unitPrice))}
      </div>
    </div>`;
  }

  function renderOrders() {
    const f = view.filters.orders;
    const orders = filteredOrders();
    const selected = getOrder(view.selectedOrderId) || orders[0] || state.orders[0];
    if (selected) view.selectedOrderId = selected.id;
    return {
      actions: `${btn("+", "新增服务订单", "open-order-new", "primary")}`,
      body: `
        <div class="split-layout">
          <div class="table-panel">
            <div class="filter-bar">
              <input id="orderSearch" class="search-input" value="${escapeAttr(f.query)}" placeholder="搜索客户 / 电话 / 备注" />
              ${btn("搜", "搜索", "apply-search", "", 'data-page="orders" data-input="orderSearch" data-key="query"')}
              <label class="field-inline"><span>订单状态</span>
                ${actionCombo("set-filter", ["全部", "服务中", "即将结束", "已结束", "已取消", "未开始"], f.status, { page: "orders", key: "status" }, "输入订单状态")}
              </label>
            </div>
            ${orderTable(orders)}
          </div>
          ${selected ? orderDetail(selected) : empty("暂无订单。")}
        </div>
      `,
    };
  }

  function orderTable(orders) {
    if (!orders.length) return empty("没有匹配的订单。");
    const rows = orders
      .map((order) => {
        const customer = getCustomer(order.customerId);
        const effective = effectiveOrderStatus(order, todayKey());
        const credits = mealCreditInfo(order, todayKey());
        const active = order.id === view.selectedOrderId ? " selected-row" : "";
        return `<tr class="row-click${active}" data-action="select-order" data-id="${order.id}">
          <td class="cell-strong">${escapeHtml(order.orderNo || makeOrderNo(order.startDate, order.id))}</td>
          <td class="cell-strong">${escapeHtml(customer?.name || "未知客户")}<br><span class="muted">${escapeHtml(customer?.phone || "")}</span></td>
          <td>${SERVICE_TYPES[order.serviceType]?.label || ""}</td>
          <td>${order.startDate}</td>
          <td>${order.endDate}</td>
          <td>${money(order.price)}</td>
          <td>${statusBadge(effective)}</td>
          <td>${remainingDays(order, todayKey())}</td>
          <td>${credits.remaining}${credits.makeup ? `<br><span class="muted">待补 ${credits.makeup}</span>` : ""}</td>
          <td>${order.isRepurchase ? badge("复购", "purple") : badge("首单", "gray")}</td>
          <td>
            <div class="cell-actions">
              ${btn("编", "编辑", "open-order-edit", "small", `data-id="${order.id}"`)}
              ${btn("海", "总结海报", "poster-from-order", "small", `data-id="${order.id}"`)}
              ${btn("删", "删除", "delete-order", "small danger", `data-id="${order.id}"`)}
            </div>
          </td>
        </tr>`;
      })
      .join("");
    return table(["订单编号", "客户", "服务类型", "开始日期", "结束日期", "价格", "状态", "剩余天数", "剩余餐次", "复购", "操作"], rows);
  }

  function orderDetail(order) {
    const customer = getCustomer(order.customerId);
    const feedbackCount = state.feedbacks.filter((fb) => inDateRange(fb.date, order.startDate, order.endDate) && fb.customerId === order.customerId).length;
    const days = dateDiff(order.startDate, order.endDate) + 1;
    const completion = Math.round((feedbackCount / days) * 100);
    const credits = mealCreditInfo(order, todayKey());
    return `<aside class="detail-panel">
      <div class="section-title">
        <div>
          <h3>${escapeHtml(customer?.name || "未知客户")} · 订单详情</h3>
          <small>${SERVICE_TYPES[order.serviceType]?.label || ""}</small>
        </div>
        ${btn("编", "编辑订单", "open-order-edit", "", `data-id="${order.id}"`)}
      </div>
      <div class="detail-grid">
        ${detail("订单编号", order.orderNo || makeOrderNo(order.startDate, order.id))}
        ${detail("服务周期", `${order.startDate} 至 ${order.endDate}`, true)}
        ${detail("付款状态", order.paidStatus)}
        ${detail("订单状态", statusBadge(effectiveOrderStatus(order, todayKey())))}
        ${detail("剩余天数", `${remainingDays(order, todayKey())} 天`)}
        ${detail("餐次权益", `${credits.consumed}/${credits.total} 已消耗 · 剩余 ${credits.remaining} 餐`, true)}
        ${detail("待补餐次", `${credits.makeup} 餐`)}
        ${detail("待退款餐次", `${credits.refundCredits} 餐 · ${money(credits.refundAmount)}`)}
        ${detail("价格", money(order.price))}
        ${detail("完成率", `${Math.min(100, completion || order.completionRate || 0)}%`)}
        ${detail("关联客户", `${customer?.name || ""} ${customer?.phone || ""}`, true)}
        ${detail("备注", order.notes || "无", true)}
      </div>
      <div class="notice ${credits.makeup || credits.refundCredits ? "warning" : "pass"} mt-12">
        <span>餐次规则</span>
        <div>${order.pauseRule || "午餐、晚餐分别消耗 1 餐次。"}${credits.makeup ? ` 当前有 ${credits.makeup} 餐待补，已顺延服务结束日期。` : ""}${credits.refundCredits ? ` 取消餐次按 ${money(REFUND_MEAL_AMOUNT)} / 餐退款。` : ""}</div>
      </div>
      <div class="panel mt-12">
        <div class="section-title"><h3>服务期间体重记录</h3>${btn("+", "记录体重", "open-weight-new", "small", `data-id="${order.customerId}"`)}</div>
        ${weightTimeline(customer, order.startDate, order.endDate)}
      </div>
      <div class="notice ${remainingDays(order, todayKey()) <= 3 && effectiveOrderStatus(order, todayKey()) === "服务中" ? "warning" : "pass"} mt-12">
        <span>提醒</span>
        <div>${remainingDays(order, todayKey()) <= 3 ? "该服务即将结束，可提前准备总结海报和复购沟通。" : "当前服务周期正常。"}</div>
      </div>
    </aside>`;
  }

  function renderDishes() {
    const f = view.filters.dishes;
    const dishes = filteredDishes();
    return {
      actions: `
        ${btn("+", "新增菜品", "open-dish-new", "primary")}
      `,
      body: `
        <div class="table-panel">
          <div class="filter-bar">
            <input id="dishSearch" class="search-input" value="${escapeAttr(f.query)}" placeholder="搜索菜名 / 食材" />
            ${btn("搜", "搜索", "apply-search", "", 'data-page="dishes" data-input="dishSearch" data-key="query"')}
            <label class="field-inline"><span>分类</span>
              ${actionCombo("set-filter", ["全部", ...CATEGORIES], f.category, { page: "dishes", key: "category" }, "输入菜品分类")}
            </label>
            <label class="field-inline"><span>可用状态</span>
              ${actionCombo("set-filter", ["全部", "可用", "今日不可用"], f.available, { page: "dishes", key: "available" }, "输入可用状态")}
            </label>
          </div>
          ${dishTable(dishes)}
        </div>
      `,
    };
  }

  function dishTable(dishes) {
    if (!dishes.length) return empty("没有匹配的菜品。");
    const rows = dishes
      .map((dishItem) => `<tr>
        <td class="cell-strong">${escapeHtml(dishItem.name)}</td>
        <td>${badge(dishItem.category, categoryColor(dishItem.category))}</td>
        <td>${tagRow(dishItem.ingredients, "gray")}</td>
        <td>${dishItem.kcal100} kcal / 100g</td>
        <td>${dishItem.garlic ? badge("含蒜", "amber") : badge("无蒜味", "gray")}</td>
        <td>${dishItem.available ? badge("可用", "green") : badge("今日不可用", "red")}</td>
        <td>${escapeHtml(dishItem.source || "未填写")}</td>
        <td>
          <div class="cell-actions">
            ${btn("换", dishItem.available ? "标记不可用" : "恢复可用", "toggle-dish-available", "small", `data-id="${dishItem.id}"`)}
            ${btn("编", "编辑", "open-dish-edit", "small", `data-id="${dishItem.id}"`)}
            ${btn("删", "删除", "delete-dish", "small danger", `data-id="${dishItem.id}"`)}
          </div>
        </td>
      </tr>`)
      .join("");
    return table(["菜名", "分类", "主要食材", "熟重单位热量", "蒜味", "状态", "热量出处", "操作"], rows);
  }

  function renderRecipes() {
    const recipe = getRecipe(view.date);
    return {
      actions: `
        ${btn("生", "一键生成食谱", "generate-recipe", "primary", `data-date="${view.date}"`)}
        ${btn("填", "手工填写食谱", "open-recipe-manual", "", `data-date="${view.date}"`)}
        ${btn("周", "生成6天食谱", "generate-weekly-recipes", "", `data-date="${view.date}"`)}
        ${btn("备", "导出一周备菜单", "export-weekly-prep", "", `data-date="${view.date}"`)}
        ${btn("替", "客户单独替换", "open-replacement-new", "", recipe ? "" : "disabled")}
        ${btn("复", "复制通知文字", "copy-recipe-notice", "", recipe ? "" : "disabled")}
      `,
      body: `
        <div class="filter-bar">
          <label class="field-inline"><span>日期</span>
            <input type="date" value="${view.date}" data-action="set-view-date" />
          </label>
          ${btn("明", "切到明日", "set-date-offset", "", 'data-offset="1"')}
          ${btn("今", "切回今日", "set-date-offset", "", 'data-offset="0"')}
        </div>
        ${recipeCalendarStrip(view.date)}
        ${recipe ? recipeWorkspace(recipe) : emptyRecipe()}
      `,
    };
  }

  function recipeCalendarStrip(centerDate) {
    const days = Array.from({ length: 15 }, (_, index) => addDays(centerDate, index - 5));
    return `<div class="calendar-strip" aria-label="食谱生成日历">
      ${days.map((date) => {
        const recipe = getRecipe(date);
        const active = date === view.date ? " active" : "";
        const generated = recipe ? " generated" : "";
        return `<button class="calendar-day${active}${generated}" data-action="set-calendar-date" data-date="${date}">
          <span>${calendarWeekLabel(date)}</span>
          <strong>${monthDayLabel(date)}</strong>
          <em>${recipe ? "已生成" : "未生成"}</em>
        </button>`;
      }).join("")}
    </div>`;
  }

  function recipeWorkspace(recipe) {
    const checks = checkRecipe(recipe);
    return `
      <div class="recipe-grid">
        ${renderRecipeMeal(recipe, "lunch")}
        ${renderRecipeMeal(recipe, "dinner")}
      </div>
      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="section-title">
            <h3>每日食材统计</h3>
            <small>总食材种类 ${recipeIngredients(recipe).length}</small>
          </div>
          <div class="ingredient-cloud">${tagRow(recipeIngredients(recipe), "green")}</div>
        </div>
        <div class="panel">
          <div class="section-title">
            <h3>规则检查结果</h3>
            <small>通过 / 警告 / 冲突</small>
          </div>
          <div class="grid">
            ${checks.map((item) => noticeLine(item)).join("")}
          </div>
        </div>
      </div>
      <div class="grid grid-2 mt-16">
        <div class="panel">
          <div class="section-title">
            <h3>客户单独替换</h3>
            ${btn("+", "新增替换", "open-replacement-new", "small")}
          </div>
          ${replacementTable(recipe)}
        </div>
        <div class="panel">
          <div class="section-title">
            <h3>明日餐品通知文字</h3>
            ${btn("复", "复制", "copy-recipe-notice", "small")}
          </div>
          <textarea class="copy-box" readonly>${escapeHtml(recipeNoticeText(recipe))}</textarea>
        </div>
      </div>
    `;
  }

  function renderRecipeMeal(recipe, meal) {
    const mealData = recipe.meals[meal] || { categories: {} };
    return `<div class="meal-card">
      <div class="section-title">
        <h3>${MEALS[meal]}食谱</h3>
        <div class="section-actions">
          ${btn("填", "手工填写", "open-recipe-manual", "small", `data-date="${recipe.date}" data-meal="${meal}"`)}
          ${btn("缺", "替换不可用菜", "replace-unavailable", "small", `data-meal="${meal}"`)}
        </div>
      </div>
      ${CATEGORIES.map((category) => {
        const dishId = mealData.categories?.[category] || "";
        const selectedDish = getDish(dishId);
        const dishOptions = state.dishes
          .filter((item) => item.category === category)
          .map((item) => ({ value: item.id, label: `${item.name}${item.available ? "" : "（今日不可用）"}` }));
        return `<div class="dish-slot">
          <div class="slot-label">${category}</div>
          <div>
            ${actionCombo("recipe-dish-change", dishOptions, dishId, { meal, category }, `输入${category}菜品`)}
            <div class="dish-meta">
              ${selectedDish ? `${selectedDish.kcal100} kcal / 100g · 出处：${escapeHtml(selectedDish.source || "未填写")}<br>食材：${escapeHtml(selectedDish.ingredients.join("、"))}` : "未选择菜品"}
            </div>
          </div>
        </div>`;
      }).join("")}
    </div>`;
  }

  function emptyRecipe() {
    return `<div class="empty-state">
      当前日期还没有食谱。
      <div class="mt-12">
        ${btn("生", "一键生成当天食谱", "generate-recipe", "primary", `data-date="${view.date}"`)}
        ${btn("填", "手工填写食谱", "open-recipe-manual", "", `data-date="${view.date}"`)}
      </div>
    </div>`;
  }

  function replacementTable(recipe) {
    const replacements = recipe.replacements || [];
    if (!replacements.length) return empty("暂无客户单独替换。");
    const rows = replacements
      .map((item, index) => {
        const customer = getCustomer(item.customerId);
        const oldDish = getDish(item.oldDishId);
        const newDish = getDish(item.newDishId);
        return `<tr>
          <td>${escapeHtml(customer?.name || "")}</td>
          <td>${MEALS[item.meal]}</td>
          <td>${escapeHtml(oldDish?.name || "")}</td>
          <td>${escapeHtml(newDish?.name || "")}</td>
          <td>${escapeHtml(item.reason || "")}</td>
          <td>${item.confirmed ? badge("已确认", "green") : badge("待确认", "amber")}</td>
          <td>
            <div class="cell-actions">
              ${btn("确", "确认", "confirm-replacement", "small", `data-index="${index}"`)}
              ${btn("删", "删除", "delete-replacement", "small danger", `data-index="${index}"`)}
            </div>
          </td>
        </tr>`;
      })
      .join("");
    return table(["客户", "餐次", "原菜品", "替换为", "原因", "状态", "操作"], rows);
  }

  function renderDaily() {
    const hasRows = state.dailyOut.some((row) => row.date === view.date);
    return {
      actions: `
        ${btn("生", hasRows ? "重新生成出餐表" : "生成出餐表", "generate-daily", "primary", `data-date="${view.date}"`)}
        ${btn("午", "复制午餐清单", "copy-meal-out", "", `data-date="${view.date}" data-meal="lunch"`)}
        ${btn("晚", "复制晚餐清单", "copy-meal-out", "", `data-date="${view.date}" data-meal="dinner"`)}
      `,
      body: `
        <div class="filter-bar">
          <label class="field-inline"><span>日期</span>
            <input type="date" value="${view.date}" data-action="set-view-date" />
          </label>
          ${btn("谱", "查看当天食谱", "goto-page", "", 'data-target="recipes"')}
        </div>
        ${renderMealOut("lunch")}
        <div class="mt-16">${renderMealOut("dinner")}</div>
      `,
    };
  }

  function renderMealOut(meal) {
    const rows = state.dailyOut.filter((row) => row.date === view.date && row.meal === meal);
    const visibleRows = filterMealOutRows(rows, meal);
    const summary = mealOutSummary(rows);
    return `<div class="table-panel">
      <div class="section-title">
        <div>
          <h3>${MEALS[meal]}出餐表</h3>
          <small>${summary.portions} 份 · 特殊餐盒 ${summary.specialCount} 个 · 当前显示 ${visibleRows.length}/${rows.length}</small>
        </div>
        <div class="section-actions">
          ${btn("复", "复制清单", "copy-meal-out", "small", `data-date="${view.date}" data-meal="${meal}"`)}
          ${btn("签", "生成标签配送", "generate-labels", "small", `data-date="${view.date}" data-meal="${meal}"`)}
        </div>
      </div>
      ${dailyMealFilterBar(meal, rows, visibleRows)}
      ${mealOutTable(visibleRows, meal, rows.length)}
      <div class="panel mt-12">
        <div class="section-title"><h3>${MEALS[meal]}汇总</h3><small>给出餐人核对</small></div>
        <div class="summary-pills">
          ${badge(`总份数 ${summary.portions}`, "green")}
          ${badge(`特殊餐盒 ${summary.specialCount}`, summary.specialCount ? "amber" : "gray")}
          ${Object.entries(summary.categoryTotals).map(([key, val]) => badge(`${key} ${val}g`, categoryColor(key))).join("")}
        </div>
        <div class="mt-12">${dishTotalsTable(summary.dishTotals)}</div>
      </div>
    </div>`;
  }

  function dailyMealFilterBar(meal, rows, visibleRows) {
    const filter = getDailyMealFilter(meal);
    const inputId = `daily-${meal}-query`;
    const hasFilter = Boolean(filter.query || filter.status !== "全部");
    return `<div class="filter-bar meal-filter">
      <label class="field-inline meal-filter-search"><span>筛选客户</span>
        <input id="${inputId}" type="search" value="${escapeAttr(filter.query)}" placeholder="姓名 / 电话 / 暂停原因 / 菜品" data-action="daily-meal-query" data-meal="${meal}" />
      </label>
      <label class="field-inline"><span>出餐状态</span>
        ${actionCombo("daily-meal-status", ["全部", "正常出餐", "已暂停", "需单独替换", "已替换"], filter.status, { meal }, "输入出餐状态")}
      </label>
      <span class="muted">显示 ${visibleRows.length} / ${rows.length}</span>
      ${btn("筛", "筛选", "apply-daily-meal-filter", "small", `data-meal="${meal}" data-input="${inputId}"`)}
      ${hasFilter ? btn("清", "清空", "clear-daily-meal-filter", "small ghost", `data-meal="${meal}"`) : ""}
    </div>`;
  }

  function getDailyMealFilter(meal) {
    view.filters.daily = view.filters.daily || {};
    view.filters.daily[meal] = view.filters.daily[meal] || { query: "", status: "全部" };
    return view.filters.daily[meal];
  }

  function filterMealOutRows(rows, meal) {
    const filter = getDailyMealFilter(meal);
    const query = String(filter.query || "").trim().toLowerCase();
    return rows.filter((row) => {
      if (filter.status === "正常出餐" && row.paused) return false;
      if (filter.status === "已暂停" && !row.paused) return false;
      if (filter.status === "需单独替换" && !row.needsReplacement) return false;
      if (filter.status === "已替换" && !row.replaced) return false;
      if (!query) return true;
      const customer = getCustomer(row.customerId);
      const info = customerServiceInfo(row.customerId, row.date);
      const dishNames = row.items.map((item) => getDish(item.dishId)?.name || "").join(" ");
      const haystack = [
        customer?.name,
        customer?.nickname,
        customer?.phone,
        info.status,
        row.paused ? "已暂停 暂停" : "正常出餐 正常",
        pausePolicyText(row.pausePolicy),
        row.pauseReason,
        row.needsReplacement ? "需单独替换" : "",
        row.replaced ? "已替换" : "",
        row.note,
        dishNames,
        ...(customer?.restrictions || []),
        ...(customer?.allergies || []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }

  function applyDailyMealFilter(meal, inputId) {
    const filter = getDailyMealFilter(meal);
    const input = document.getElementById(inputId);
    filter.query = input?.value || "";
    render();
  }

  function clearDailyMealFilter(meal) {
    const filter = getDailyMealFilter(meal);
    filter.query = "";
    filter.status = "全部";
    render();
  }

  function mealOutTable(rows, meal, totalRows = rows.length) {
    if (!rows.length) return empty(totalRows ? `没有符合筛选条件的${MEALS[meal]}客户。` : `还没有${MEALS[meal]}出餐表，请先生成。`);
    const tableRows = rows
      .map((row) => {
        const customer = getCustomer(row.customerId);
        const info = customerServiceInfo(row.customerId, row.date);
        const totals = rowTotals(row);
        return `<tr>
          <td class="cell-strong">${escapeHtml(customer?.name || "")}</td>
          <td>${statusBadge(info.status)}</td>
          <td>${tagRow([...(customer?.restrictions || []), ...(customer?.allergies || [])], "amber")}</td>
          <td>${row.items
            .map((item) => {
              const dishItem = getDish(item.dishId);
              return `<div class="item-editor">
                <span>${escapeHtml(dishItem?.name || "")}</span>
                <input type="number" min="0" step="5" value="${item.grams}" data-action="daily-grams" data-row-id="${row.id}" data-dish-id="${item.dishId}" />
              </div>`;
            })
            .join("")}</td>
          <td>${totals.grams}g</td>
          <td>${totals.kcal} kcal</td>
          <td>${row.needsReplacement ? badge("需单独替换", "amber") : row.replaced ? badge("已替换", "purple") : badge("常规", "gray")}</td>
          <td>${pauseCell(row)}</td>
        </tr>`;
      })
      .join("");
    return `<div class="table-wrap meal-table">
      <table>
        <thead>
          <tr>
            <th>客户姓名</th>
            <th>服务状态</th>
            <th>忌口提醒</th>
            <th>餐品内容 / 每道菜克重</th>
            <th>总克重</th>
            <th>总热量</th>
            <th>替换</th>
            <th>暂停/餐次</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
  }

  function pauseCell(row) {
    if (row.paused) {
      return `<div class="pause-cell">
        ${badge("已暂停", PAUSE_POLICIES[row.pausePolicy]?.color || "amber")}
        <span class="muted">${escapeHtml(pausePolicyText(row.pausePolicy))}</span>
        ${row.pauseReason ? `<span class="muted">${escapeHtml(row.pauseReason)}</span>` : ""}
        <div class="cell-actions">
          ${btn("改", "修改", "open-pause-meal", "small", `data-row-id="${row.id}"`)}
          ${btn("恢", "恢复", "resume-meal", "small", `data-row-id="${row.id}"`)}
        </div>
      </div>`;
    }
    return `<div class="pause-cell">
      ${badge("正常出餐", "green")}
      ${btn("停", "暂停本餐", "open-pause-meal", "small warning", `data-row-id="${row.id}"`)}
    </div>`;
  }

  function renderFeedbacks() {
    const f = view.filters.feedbacks;
    const feedbacks = filteredFeedbacks();
    const selectedCustomer = getCustomer(view.selectedFeedbackCustomerId) || state.customers[0];
    if (selectedCustomer) view.selectedFeedbackCustomerId = selectedCustomer.id;
    return {
      actions: `${btn("+", "录入每日反馈", "open-feedback-new", "primary")}`,
      body: `
        <div class="grid grid-2">
          <div class="table-panel">
            <div class="filter-bar">
              <label class="field-inline"><span>日期</span>
                <input type="date" value="${f.date}" data-action="set-filter" data-page="feedbacks" data-key="date" />
              </label>
              <input id="feedbackSearch" class="search-input" value="${escapeAttr(f.query)}" placeholder="搜索客户 / 备注" />
              ${btn("搜", "搜索", "apply-search", "", 'data-page="feedbacks" data-input="feedbackSearch" data-key="query"')}
              <label class="field-inline"><span>饱腹感</span>
                ${actionCombo("set-filter", ["全部", "偏饿", "刚好", "偏撑"], f.satiety, { page: "feedbacks", key: "satiety" }, "输入饱腹感")}
              </label>
            </div>
            ${feedbackTable(feedbacks)}
          </div>
          <div class="detail-panel">
            <div class="section-title">
              <h3>连续反馈</h3>
              ${actionCombo("select-feedback-customer", customerComboOptions(), view.selectedFeedbackCustomerId, {}, "输入客户名搜索")}
            </div>
            ${selectedCustomer ? continuousFeedback(selectedCustomer) : empty("暂无客户。")}
          </div>
        </div>
      `,
    };
  }

  function feedbackTable(feedbacks) {
    if (!feedbacks.length) return empty("没有匹配的反馈。");
    const rows = feedbacks
      .map((fb) => {
        const customer = getCustomer(fb.customerId);
        const adjustment = feedbackSuggestion(fb);
        return `<tr>
          <td>${fb.date}</td>
          <td class="cell-strong">${escapeHtml(customer?.name || "")}</td>
          <td>${fb.lunchFinished}</td>
          <td>${fb.dinnerFinished}</td>
          <td>${satietyBadge(fb.satiety)}</td>
          <td>${fb.weight ? `${fb.weight} kg` : "-"}</td>
          <td>${escapeHtml(fb.dislikeDish || "-")}</td>
          <td>${escapeHtml(adjustment)}</td>
          <td>${fb.processed ? badge("已处理", "green") : badge("待处理", "amber")}</td>
          <td>
            <div class="cell-actions">
              ${btn("编", "编辑", "open-feedback-edit", "small", `data-id="${fb.id}"`)}
              ${btn("删", "删除", "delete-feedback", "small danger", `data-id="${fb.id}"`)}
            </div>
          </td>
        </tr>`;
      })
      .join("");
    return table(["日期", "客户", "午餐吃完", "晚餐吃完", "饱腹感", "体重", "不喜欢的菜", "明日建议", "处理", "操作"], rows);
  }

  function renderLogistics() {
    const date = view.filters.logistics.date;
    return {
      actions: `
        ${btn("全", "一键生成全天标签", "generate-all-labels", "primary", `data-date="${date}"`)}
        ${btn("PDF", "导出标签PDF", "export-label-pdf", "blue", `data-date="${date}"`)}
        ${btn("复", "复制全天配送清单", "copy-all-delivery", "", `data-date="${date}"`)}
      `,
      body: `
        <div class="filter-bar">
          <label class="field-inline"><span>日期</span>
            <input type="date" value="${date}" data-action="set-filter" data-page="logistics" data-key="date" />
          </label>
          ${btn("出", "查看每日出餐", "goto-page", "", 'data-target="daily"')}
        </div>
        ${renderLogisticsMeal(date, "lunch")}
        <div class="mt-16">${renderLogisticsMeal(date, "dinner")}</div>
      `,
    };
  }

  function renderLogisticsMeal(date, meal) {
    const labels = state.labels.filter((item) => item.date === date && item.meal === meal);
    const deliveries = state.deliveries.filter((item) => item.date === date && item.meal === meal);
    return `<div class="panel">
      <div class="section-title">
        <div>
          <h3>${MEALS[meal]}标签与配送</h3>
          <small>标签 ${labels.length} 张 · 配送 ${deliveries.length} 条</small>
        </div>
        <div class="section-actions">
          ${btn("签", "生成标签", "generate-labels", "small", `data-date="${date}" data-meal="${meal}"`)}
          ${btn("PDF", "导出PDF", "export-label-pdf", "small", `data-date="${date}"`)}
          ${btn("复", "复制配送", "copy-delivery", "small", `data-date="${date}" data-meal="${meal}"`)}
        </div>
      </div>
      ${labelExportStatus(date, meal, labels, deliveries)}
      <div class="mt-16">
        <div class="section-title"><h3>${MEALS[meal]}配送清单</h3>${btn("复", "复制文字版", "copy-delivery", "small", `data-date="${date}" data-meal="${meal}"`)}</div>
        ${deliveryTable(deliveries)}
      </div>
    </div>`;
  }

  function labelExportStatus(date, meal, labels, deliveries) {
    const rows = state.dailyOut.filter((row) => row.date === date && row.meal === meal && !row.paused);
    const ready = rows.length > 0 && labels.length === rows.length;
    return `<div class="notice ${ready ? "pass" : "warning"}">
      <span>${ready ? "可导出" : "待生成"}</span>
      <div>
        ${MEALS[meal]}共 ${rows.length} 个餐盒，已准备 ${labels.length} 页标签，配送清单 ${deliveries.length} 条。导出 PDF 时每个标签单独一页，页面尺寸为 ${LABEL_PAGE_WIDTH_MM}mm x ${LABEL_PAGE_HEIGHT_MM}mm。
      </div>
    </div>`;
  }

  function labelCard(label) {
    const vm = getLabelViewModel(label);
    const copyId = cacheCopy(labelTextFromVm(vm));
    return `<div class="label-card sticker-card">
      <div class="sticker-head">
        <div>
          <div class="sticker-brand">${escapeHtml(vm.dayCode)} ${MEALS[vm.meal]} | ${escapeHtml(vm.customerName)}</div>
          <div class="sticker-sub">本餐热量、餐品和反馈重点</div>
        </div>
        <div class="sticker-size">${escapeHtml(vm.portion)}</div>
      </div>
      <div class="sticker-line"></div>
      <div class="sticker-main">
        <div class="sticker-kcal">
          <span>本餐热量</span>
          <strong>${vm.kcal}</strong><b>kcal</b>
        </div>
        <div class="sticker-side">
          <div><span>目标</span><strong>${escapeHtml(vm.targetRange)}kcal</strong></div>
          <div><span>熟重</span><strong>${vm.grams}g</strong></div>
        </div>
      </div>
      <div class="sticker-macros">
        <div><span>蛋白</span><strong>${vm.protein}g</strong></div>
        <div><span>脂肪</span><strong>${vm.fat}g</strong></div>
        <div><span>碳水</span><strong>${vm.carbs}g</strong></div>
      </div>
      <div class="sticker-food">
        <div class="sticker-section-title"><span>餐品</span></div>
        ${vm.foodGroups.map((group) => `<div class="sticker-food-line"><b>${escapeHtml(group.label)}</b><span>${escapeHtml(group.text)}</span></div>`).join("")}
      </div>
      <div class="sticker-tip"><b>本餐管理</b><span>${escapeHtml(vm.management)}</span></div>
      <div class="sticker-tip"><b>饭后观察</b><span>${escapeHtml(vm.observe)}</span></div>
      <div class="sticker-foot">
        <span>仅作本餐饮食管理参考，不作为医疗营养处方</span>
        ${btn("复", "复制", "copy-cached", "small", `data-copy-id="${copyId}"`)}
      </div>
    </div>`;
  }

  function deliveryTable(deliveries) {
    if (!deliveries.length) return empty("暂无配送清单。");
    const rows = deliveries
      .map((item) => `<tr>
        <td>${item.date}</td>
        <td>${escapeHtml(item.customerName)}</td>
        <td>${escapeHtml(item.phone)}</td>
        <td>${escapeHtml(item.address)}</td>
        <td>${MEALS[item.meal]}</td>
        <td>${escapeHtml(item.content)}</td>
        <td>${escapeHtml(item.note || "-")}</td>
      </tr>`)
      .join("");
    return table(["日期", "客户", "电话", "配送地址", "午餐 / 晚餐", "餐品内容", "特殊备注"], rows);
  }

  function renderPosters() {
    const customer = getCustomer(view.posterCustomerId) || state.customers[0];
    if (customer) view.posterCustomerId = customer.id;
    const customerOrders = state.orders.filter((order) => order.customerId === view.posterCustomerId);
    const order = getOrder(view.posterOrderId) || customerOrders[0] || state.orders[0];
    if (order) view.posterOrderId = order.id;
    const stats = customer && order ? posterStats(customer, order) : null;
    const draft = view.posterDraft || defaultPosterSummary(customer, stats);
    const posterRows = state.posters
      .filter((poster) => {
        const q = view.filters.posters.query.trim();
        if (!q) return true;
        const c = getCustomer(poster.customerId);
        return [c?.name, poster.summaryText].join(" ").includes(q);
      })
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    return {
      actions: `
        ${btn("生", "生成海报预览", "refresh-poster", "primary")}
        ${btn("存", "保存海报记录", "save-poster", "")}
        ${btn("图", "导出图片", "export-poster", "blue")}
      `,
      body: `
        <div class="poster-workspace">
          <div class="panel">
            <div class="section-title"><h3>选择客户和服务订单</h3><small>服务结束后使用</small></div>
            <div class="form-grid">
              <div class="form-field full">
                <label>客户</label>
                ${actionCombo("select-poster-customer", customerComboOptions(), view.posterCustomerId, {}, "输入客户名搜索")}
              </div>
              <div class="form-field full">
                <label>服务订单</label>
                ${actionCombo("select-poster-order", customerOrders.map((o) => ({ value: o.id, label: `${o.orderNo || makeOrderNo(o.startDate, o.id)} · ${SERVICE_TYPES[o.serviceType]?.label || ""} · ${o.startDate} 至 ${o.endDate}` })), view.posterOrderId, {}, "输入订单编号或日期")}
              </div>
              <div class="form-field full">
                <label>总结文案</label>
                <textarea data-action="poster-draft">${escapeHtml(draft)}</textarea>
              </div>
            </div>
            <div class="grid grid-2 mt-12">
              ${stats ? detail("开始体重", `${stats.startWeight} kg`) : ""}
              ${stats ? detail("结束体重", `${stats.endWeight} kg`) : ""}
              ${stats ? detail("总减重", `${stats.loss} kg`) : ""}
              ${stats ? detail("坚持率", `${stats.persistence}%`) : ""}
              ${stats ? detail("打卡天数", `${stats.checkinDays} 天`) : ""}
              ${stats ? detail("复购状态", stats.repurchase ? "已复购 / 可复购" : "首单客户") : ""}
            </div>
          </div>
          <div class="panel">
            <div class="section-title"><h3>海报预览</h3><small>清爽可信，有温度</small></div>
            ${customer && order && stats ? posterPreview(customer, order, stats, draft) : empty("请选择客户和订单。")}
          </div>
        </div>
        <div class="table-panel mt-16">
          <div class="filter-bar">
            <input id="posterSearch" class="search-input" value="${escapeAttr(view.filters.posters.query)}" placeholder="搜索客户 / 文案" />
            ${btn("搜", "搜索", "apply-search", "", 'data-page="posters" data-input="posterSearch" data-key="query"')}
          </div>
          ${posterTable(posterRows)}
        </div>
      `,
    };
  }

  function posterPreview(customer, order, stats, summary) {
    return `<div id="posterPreview" class="poster-preview">
      <div class="poster-brand">
        <span>减脂餐服务总结</span>
        <span>品牌位置预留</span>
      </div>
      <div>
        <div class="poster-title">${escapeHtml(customer.nickname || customer.name)} 的阶段成果</div>
        <div class="poster-subtitle">${order.startDate} 至 ${order.endDate} · ${SERVICE_TYPES[order.serviceType]?.label || ""}</div>
      </div>
      <div class="poster-stats">
        <div class="poster-stat"><span>总减重</span><strong>${stats.loss} kg</strong></div>
        <div class="poster-stat"><span>坚持率</span><strong>${stats.persistence}%</strong></div>
        <div class="poster-stat"><span>服务天数</span><strong>${stats.serviceDays} 天</strong></div>
        <div class="poster-stat"><span>打卡天数</span><strong>${stats.checkinDays} 天</strong></div>
      </div>
      <div class="poster-summary">${escapeHtml(summary)}</div>
      <div class="muted">饮食完成情况：午晚餐反馈 ${stats.feedbackCount} 条，服务记录完整度 ${stats.persistence}%。</div>
    </div>`;
  }

  function posterTable(posters) {
    if (!posters.length) return empty("暂无已保存海报记录。");
    const rows = posters
      .map((poster) => {
        const customer = getCustomer(poster.customerId);
        const order = getOrder(poster.orderId);
        return `<tr>
          <td>${escapeHtml(customer?.name || "")}</td>
          <td>${order ? `${order.startDate} 至 ${order.endDate}` : ""}</td>
          <td>${poster.stats?.loss || 0} kg</td>
          <td>${poster.stats?.persistence || 0}%</td>
          <td>${new Date(poster.generatedAt).toLocaleString("zh-CN")}</td>
          <td>
            <div class="cell-actions">
              ${btn("用", "载入", "load-poster", "small", `data-id="${poster.id}"`)}
              ${btn("删", "删除", "delete-poster", "small danger", `data-id="${poster.id}"`)}
            </div>
          </td>
        </tr>`;
      })
      .join("");
    return table(["客户", "服务周期", "总减重", "坚持率", "生成时间", "操作"], rows);
  }

  function handleClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (target.disabled) return;

    if (action === "goto-page") {
      if (target.dataset.meal) view.mealTab = target.dataset.meal;
      if (target.dataset.target === "daily" || target.dataset.target === "recipes") view.date = addDays(todayKey(), view.dashboardOffset);
      if (target.dataset.target === "logistics") view.filters.logistics.date = addDays(todayKey(), view.dashboardOffset);
      location.hash = target.dataset.target;
      return;
    }
    if (action === "dashboard-offset") {
      view.dashboardOffset = Number(target.dataset.offset || 0);
      render();
      return;
    }
    if (action === "set-date-offset") {
      view.date = addDays(todayKey(), Number(target.dataset.offset || 0));
      render();
      return;
    }
    if (action === "set-calendar-date") {
      view.date = target.dataset.date || view.date;
      render();
      return;
    }
    if (action === "set-view-date") return;
    if (action === "apply-search") {
      const input = document.getElementById(target.dataset.input);
      view.filters[target.dataset.page][target.dataset.key] = input?.value || "";
      render();
      return;
    }

    const handlers = {
      "open-customer-new": () => openCustomerModal(),
      "open-customer-edit": () => openCustomerModal(target.dataset.id),
      "delete-customer": () => deleteCustomer(target.dataset.id),
      "select-customer": () => {
        view.selectedCustomerId = target.dataset.id;
        render();
      },
      "open-weight-new": () => openWeightModal(target.dataset.id || view.selectedCustomerId),
      "open-order-new": () => openOrderModal("", target.dataset.customerId),
      "open-order-edit": () => openOrderModal(target.dataset.id),
      "delete-order": () => deleteOrder(target.dataset.id),
      "select-order": () => {
        view.selectedOrderId = target.dataset.id;
        render();
      },
      "poster-from-order": () => openPosterFromOrder(target.dataset.id),
      "open-dish-new": () => openDishModal(),
      "open-dish-edit": () => openDishModal(target.dataset.id),
      "delete-dish": () => deleteDish(target.dataset.id),
      "toggle-dish-available": () => toggleDishAvailable(target.dataset.id),
      "generate-recipe": () => requestGenerateRecipe(target.dataset.date || view.date),
      "open-recipe-manual": () => openManualRecipeModal(target.dataset.date || view.date, target.dataset.meal || ""),
      "generate-weekly-recipes": () => generateWeeklyRecipes(target.dataset.date || view.date),
      "export-weekly-prep": () => exportWeeklyPrep(target.dataset.date || view.date),
      "open-replacement-new": () => openReplacementModal(),
      "confirm-replacement": () => confirmReplacement(Number(target.dataset.index)),
      "delete-replacement": () => deleteReplacement(Number(target.dataset.index)),
      "replace-unavailable": () => replaceUnavailableDishes(target.dataset.meal),
      "copy-recipe-notice": () => copyText(recipeNoticeText(getRecipe(view.date))),
      "generate-daily": () => requestGenerateDaily(target.dataset.date || view.date),
      "apply-daily-meal-filter": () => applyDailyMealFilter(target.dataset.meal, target.dataset.input),
      "clear-daily-meal-filter": () => clearDailyMealFilter(target.dataset.meal),
      "open-pause-meal": () => openPauseMealModal(target.dataset.rowId),
      "resume-meal": () => resumeMeal(target.dataset.rowId),
      "copy-meal-out": () => copyText(mealOutText(target.dataset.date || view.date, target.dataset.meal || "lunch")),
      "generate-labels": () => generateLabelsAndDeliveries(target.dataset.date || view.filters.logistics.date || view.date, target.dataset.meal || "lunch"),
      "generate-all-labels": () => generateAllLabelsAndDeliveries(target.dataset.date || view.filters.logistics.date || view.date),
      "export-label-pdf": () => exportLabelPdf(target.dataset.date || view.filters.logistics.date || view.date),
      "copy-delivery": () => copyText(deliveryText(target.dataset.date || view.filters.logistics.date, target.dataset.meal)),
      "copy-all-delivery": () => copyText(["lunch", "dinner"].map((meal) => deliveryText(target.dataset.date, meal)).join("\n\n")),
      "copy-cached": () => copyText(copyCache[target.dataset.copyId] || ""),
      "open-feedback-new": () => openFeedbackModal("", target.dataset.customerId),
      "open-feedback-edit": () => openFeedbackModal(target.dataset.id),
      "delete-feedback": () => deleteFeedback(target.dataset.id),
      "refresh-poster": () => {
        view.posterDraft = "";
        render();
      },
      "save-poster": () => savePosterRecord(),
      "export-poster": () => exportPosterPng(),
      "load-poster": () => loadPoster(target.dataset.id),
      "delete-poster": () => deletePoster(target.dataset.id),
      "modal-close": closeModal,
      "confirm-ok": () => {
        const fn = pendingConfirm;
        pendingConfirm = null;
        closeModal();
        if (fn) fn();
      },
      "reset-demo": () => resetDemo(),
    };
    if (handlers[action]) {
      const result = handlers[action]();
      if (result && typeof result.then === "function") {
        target.disabled = true;
        target.classList.add("is-loading");
        result
          .catch((error) => {
            console.error(error);
            toast(error?.message ? `操作失败：${error.message}` : "操作失败，请刷新后重试。");
          })
          .finally(() => {
            target.disabled = false;
            target.classList.remove("is-loading");
          });
      }
    }
  }

  function handleChange(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "combo-input") {
      const value = syncComboInput(target, { commitPartial: true, rewrite: true });
      if (target.dataset.comboAction && target.checkValidity()) {
        handleComboAction(target.dataset.comboAction, value, target);
      }
      return;
    }
    if (action === "set-filter") {
      view.filters[target.dataset.page][target.dataset.key] = target.value;
      render();
      return;
    }
    if (action === "set-view-date") {
      view.date = target.value || todayKey();
      render();
      return;
    }
    if (action === "daily-meal-query") {
      getDailyMealFilter(target.dataset.meal).query = target.value;
      render();
      return;
    }
    if (action === "daily-meal-status") {
      getDailyMealFilter(target.dataset.meal).status = target.value || "全部";
      render();
      return;
    }
    if (action === "recipe-dish-change") {
      const recipe = getRecipe(view.date);
      if (!recipe) return;
      recipe.meals[target.dataset.meal].categories[target.dataset.category] = target.value;
      saveState();
      toast("食谱已更新，出餐表可按需重新生成。");
      render();
      return;
    }
    if (action === "daily-grams") {
      const row = state.dailyOut.find((item) => item.id === target.dataset.rowId);
      const item = row?.items.find((dishItem) => dishItem.dishId === target.dataset.dishId);
      if (item) {
        item.grams = Number(target.value || 0);
        saveState();
        render();
      }
      return;
    }
    if (action === "toggle-row-field") {
      const row = state.dailyOut.find((item) => item.id === target.dataset.rowId);
      if (row) {
        if (target.dataset.field === "paused") {
          if (target.checked) openPauseMealModal(row.id);
          else resumeMeal(row.id);
          return;
        }
        row[target.dataset.field] = target.checked;
        saveState();
        render();
      }
      return;
    }
    if (action === "select-feedback-customer") {
      view.selectedFeedbackCustomerId = target.value;
      render();
      return;
    }
    if (action === "select-poster-customer") {
      view.posterCustomerId = target.value;
      view.posterOrderId = "";
      view.posterDraft = "";
      render();
      return;
    }
    if (action === "select-poster-order") {
      view.posterOrderId = target.value;
      view.posterDraft = "";
      render();
    }
  }

  function handleInput(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (target.dataset.action === "combo-input") {
      syncComboInput(target, { commitPartial: false, rewrite: false });
      return;
    }
    if (target.dataset.action === "poster-draft") {
      view.posterDraft = target.value;
    }
  }

  function handleKeydown(event) {
    const target = event.target.closest("[data-action]");
    if (target?.dataset.action === "combo-input" && event.key === "Enter") {
      event.preventDefault();
      const value = syncComboInput(target, { commitPartial: true, rewrite: true });
      if (target.dataset.comboAction && target.checkValidity()) handleComboAction(target.dataset.comboAction, value, target);
      return;
    }
    if (!target || target.dataset.action !== "daily-meal-query" || event.key !== "Enter") return;
    event.preventDefault();
    applyDailyMealFilter(target.dataset.meal, target.id);
  }

  function handleSubmit(event) {
    if (event.target.id !== "recordForm") return;
    event.preventDefault();
    if (!syncFormCombos(event.target)) return;
    const data = collectForm(event.target);
    if (currentFormSubmit) currentFormSubmit(data);
  }

  function openCustomerModal(id = "") {
    const existing = getCustomer(id);
    openForm({
      title: existing ? "编辑客户档案" : "新增客户档案",
      fields: [
        field("name", "姓名", "text", true),
        field("nickname", "客户昵称", "text"),
        field("phone", "电话", "text", true),
        field("gender", "性别", "select", true, ["女", "男"]),
        field("age", "年龄", "number", true),
        field("height", "身高 cm", "number", true),
        field("currentWeight", "当前体重 kg", "number", true),
        field("targetWeight", "目标体重 kg", "number", true),
        field("activity", "运动量", "select", true, ["久坐", "轻运动", "中等运动", "高运动"]),
        field("pace", "希望减脂速度", "select", true, ["稳定", "标准", "快速"]),
        field("address", "配送地址", "textarea", true, null, "full"),
        field("restrictions", "忌口食材（逗号分隔）", "text", false),
        field("dislikes", "不喜欢的菜（逗号分隔）", "text", false),
        field("allergies", "过敏信息（逗号分隔）", "text", false),
        field("notes", "特殊备注", "textarea", false, null, "full"),
      ],
      values: existing
        ? { ...existing, restrictions: existing.restrictions.join("，"), dislikes: existing.dislikes.join("，"), allergies: existing.allergies.join("，") }
        : {
            gender: "女",
            age: 30,
            height: 165,
            currentWeight: 60,
            targetWeight: 55,
            activity: "轻运动",
            pace: "标准",
          },
      onSubmit: (data) => {
        const record = {
          ...(existing || {}),
          id: existing?.id || uid("cus"),
          name: data.name,
          nickname: data.nickname,
          phone: data.phone,
          gender: data.gender,
          age: Number(data.age),
          height: Number(data.height),
          currentWeight: Number(data.currentWeight),
          targetWeight: Number(data.targetWeight),
          activity: data.activity,
          pace: data.pace,
          address: data.address,
          restrictions: parseList(data.restrictions),
          dislikes: parseList(data.dislikes),
          allergies: parseList(data.allergies),
          notes: data.notes,
          weightRecords: existing?.weightRecords?.length ? existing.weightRecords : [{ date: todayKey(), weight: Number(data.currentWeight) }],
        };
        upsert(state.customers, record);
        view.selectedCustomerId = record.id;
        saveState();
        closeModal();
        toast(existing ? "客户档案已更新。" : "客户档案已新增。");
        render();
      },
    });
  }

  function openWeightModal(customerId) {
    const customer = getCustomer(customerId);
    if (!customer) return toast("请先选择客户。");
    openForm({
      title: `记录体重 · ${customer.name}`,
      fields: [field("date", "日期", "date", true), field("weight", "体重 kg", "number", true)],
      values: { date: todayKey(), weight: latestWeight(customer) },
      onSubmit: (data) => {
        const record = { date: data.date, weight: Number(data.weight) };
        customer.weightRecords = customer.weightRecords || [];
        const exists = customer.weightRecords.find((item) => item.date === record.date);
        if (exists) exists.weight = record.weight;
        else customer.weightRecords.push(record);
        customer.currentWeight = record.weight;
        saveState();
        closeModal();
        toast("体重记录已保存。");
        render();
      },
    });
  }

  function openOrderModal(id = "", customerId = "") {
    const existing = getOrder(id);
    const defaultCustomerId = customerId || view.selectedCustomerId || state.customers[0]?.id;
    openForm({
      title: existing ? "编辑服务订单" : "新增服务订单",
      fields: [
        field("customerId", "关联客户", "select", true, state.customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` }))),
        field("serviceType", "服务类型", "select", true, [
          { value: "trial", label: "6 天体验服务 · 699 元" },
          { value: "formal", label: "28 天正式服务 · 2999 元" },
        ]),
        field("startDate", "开始日期", "date", true),
        field("status", "订单状态", "select", true, ["服务中", "已结束", "已取消", "未开始"]),
        field("paidStatus", "付款状态", "select", true, ["已付款", "部分付款", "未付款"]),
        field("notes", "备注", "textarea", false, null, "full"),
      ],
      values: existing || {
        customerId: defaultCustomerId,
        serviceType: "formal",
        startDate: todayKey(),
        status: "服务中",
        paidStatus: "已付款",
      },
      onSubmit: (data) => {
        const info = SERVICE_TYPES[data.serviceType];
        const endDate = addDays(data.startDate, info.days - 1);
        const dateCheck = validateOrderDateWindow(data.customerId, data.startDate, endDate, existing?.id || "");
        if (!dateCheck.valid) {
          showMessage("订单日期重叠", orderOverlapMessage(dateCheck, data.serviceType), "danger");
          return;
        }
        const record = {
          ...(existing || {}),
          id: existing?.id || uid("ord"),
          orderNo: existing?.orderNo || nextOrderNo(data.startDate),
          customerId: data.customerId,
          serviceType: data.serviceType,
          startDate: data.startDate,
          endDate,
          price: info.price,
          status: data.status,
          paidStatus: data.paidStatus,
          isRepurchase: state.orders.some((order) => order.customerId === data.customerId && order.id !== existing?.id),
          notes: data.notes,
          completionRate: existing?.completionRate || 0,
          totalMealCredits: existing?.totalMealCredits || info.days * 2,
          pauseRule: existing?.pauseRule || "按餐次权益管理：午餐、晚餐分别消耗 1 餐次",
          weightRecords: existing?.weightRecords || [],
        };
        upsert(state.orders, record);
        if (existing?.customerId && existing.customerId !== record.customerId) rebuildCustomerOrderSchedule(existing.customerId);
        rebuildCustomerOrderSchedule(record.customerId);
        view.selectedOrderId = record.id;
        saveState();
        closeModal();
        toast(existing ? "订单已更新。" : "服务订单已新增。");
        render();
      },
    });
  }

  function openDishModal(id = "") {
    const existing = getDish(id);
    if (!existing) {
      openForm({
        title: "新增菜品",
        fields: [
          field("name", "菜品名称", "text", true),
        ],
        values: {},
        onSubmit: (data) => {
          const record = autoBuildDish(data.name);
          upsert(state.dishes, record);
          saveState();
          closeModal();
          toast(`已新增「${record.name}」，分类、食材和营养数据已自动生成，可再编辑校准。`);
          render();
        },
      });
      return;
    }
    openForm({
      title: "编辑菜品",
      fields: [
        field("name", "菜品名称", "text", true),
        field("category", "分类", "select", true, CATEGORIES),
        field("ingredients", "食材组成（逗号分隔）", "textarea", true, null, "full"),
        field("kcal100", "每 100g 熟重热量", "number", true),
        field("protein", "蛋白质字段预留", "number"),
        field("fat", "脂肪字段预留", "number"),
        field("carbs", "碳水字段预留", "number"),
        field("source", "热量数据出处", "text", true),
        field("garlic", "是否蒜味为主", "checkbox"),
        field("available", "今日是否可用", "checkbox"),
        field("conflicts", "不适合搭配的食材（逗号分隔）", "text", false, null, "full"),
        field("notes", "备注", "textarea", false, null, "full"),
      ],
      values: { ...existing, ingredients: existing.ingredients.join("，"), conflicts: existing.conflicts.join("，") },
      onSubmit: (data) => {
        const record = {
          ...(existing || {}),
          id: existing?.id || uid("dish"),
          name: data.name,
          category: data.category,
          ingredients: parseList(data.ingredients),
          kcal100: Number(data.kcal100),
          protein: Number(data.protein || 0),
          fat: Number(data.fat || 0),
          carbs: Number(data.carbs || 0),
          source: data.source,
          garlic: Boolean(data.garlic),
          available: Boolean(data.available),
          conflicts: parseList(data.conflicts),
          notes: data.notes,
        };
        upsert(state.dishes, record);
        saveState();
        closeModal();
        toast(existing ? "菜品已更新。" : "菜品已新增。");
        render();
      },
    });
  }

  function autoBuildDish(name, categoryOverride = "") {
    const cleanName = String(name || "").trim();
    const category = categoryOverride || inferDishCategory(cleanName);
    const ingredients = inferDishIngredients(cleanName, category);
    const nutrition = authorityNutritionForDish(cleanName, category);
    return {
      id: uid("dish"),
      name: cleanName,
      category,
      ingredients,
      kcal100: nutrition.kcal100,
      protein: nutrition.protein,
      fat: nutrition.fat,
      carbs: nutrition.carbs,
      source: nutrition.source,
      garlic: cleanName.includes("蒜"),
      available: true,
      conflicts: inferDishConflicts(cleanName, ingredients),
      notes: "新增时按权威食物库匹配基础营养；正式接库后可用 API 继续校准。",
    };
  }

  function inferDishCategory(name) {
    if (/(虾|鱼|鳕|龙利|巴沙|贝|蟹|海鲜|鱿|扇贝|三文鱼|蛏|蛤蜊|蛤|贝)/.test(name)) return "海鲜";
    if (/(饭|米|薯|红薯|面|藜麦|玉米|南瓜|芋|荞麦|意面|杂粮)/.test(name)) return "主食";
    if (/(鸡|牛|猪|肉|鸭|蛋|里脊|鸡胸|鸡腿)/.test(name)) return "荤";
    return "素";
  }

  function inferDishIngredients(name, category) {
    const ingredients = [];
    const keywordMap = [
      ["鸡胸", "鸡胸肉"], ["鸡腿", "鸡腿肉"], ["鸡", "鸡肉"], ["牛", "牛肉"], ["猪", "猪肉"],
      ["虾", "虾"], ["鳕鱼", "鳕鱼"], ["龙利鱼", "龙利鱼"], ["巴沙鱼", "巴沙鱼"], ["蛏", "蛏子"], ["蛤蜊", "蛤蜊"], ["鱼", "鱼肉"],
      ["西兰花", "西兰花"], ["番茄", "番茄"], ["菠菜", "菠菜"], ["芦笋", "芦笋"], ["口蘑", "口蘑"],
      ["香菇", "香菇"], ["木耳", "木耳"], ["荷兰豆", "荷兰豆"], ["胡萝卜", "胡萝卜"], ["彩椒", "彩椒"],
      ["西葫芦", "西葫芦"], ["青菜", "小青菜"], ["娃娃菜", "娃娃菜"], ["包菜", "包菜"], ["豆角", "豆角"], ["黄瓜", "黄瓜"], ["板栗", "板栗"], ["蒜", "蒜"], ["洋葱", "洋葱"], ["芹菜", "芹菜"],
      ["米饭", "米饭"], ["米", "米饭"], ["糙米", "糙米"], ["紫薯", "紫薯"], ["红薯", "红薯"], ["藜麦", "藜麦"],
      ["南瓜", "南瓜"], ["荞麦", "荞麦面"], ["玉米", "玉米"],
    ];
    keywordMap.forEach(([keyword, ingredient]) => {
      if (name.includes(keyword) && !ingredients.includes(ingredient)) ingredients.push(ingredient);
    });
    const fallback = {
      荤: ["鸡胸肉", "黑胡椒", "彩椒"],
      海鲜: ["鱼肉", "姜", "小葱"],
      素: ["时蔬", "口蘑", "胡萝卜"],
      主食: ["糙米", "藜麦"],
    };
    return ingredients.length ? ingredients : fallback[category];
  }

  function authorityNutritionForDish(name, category) {
    const sourceChina = "食物营养成分查询平台（中国营养学会/中国疾控营养所）/《中国食物成分表》，熟重估算";
    const sourceBoohee = "薄荷健康食物库 / 包装营养标识，熟重估算";
    const rules = [
      [/米饭/, { kcal100: 116, protein: 2.6, fat: 0.3, carbs: 25.9, source: sourceChina }],
      [/糙米/, { kcal100: 125, protein: 2.8, fat: 1.0, carbs: 26.0, source: sourceChina }],
      [/玉米/, { kcal100: 112, protein: 4.0, fat: 1.2, carbs: 22.8, source: sourceChina }],
      [/紫薯|红薯/, { kcal100: 106, protein: 1.6, fat: 0.2, carbs: 25.0, source: sourceChina }],
      [/荞麦/, { kcal100: 132, protein: 5.0, fat: 1.1, carbs: 27.0, source: sourceBoohee }],
      [/藜麦|南瓜/, { kcal100: 118, protein: 4.1, fat: 1.8, carbs: 22.0, source: sourceChina }],
      [/鸡胸|手撕鸡|柠檬手撕鸡|香煎鸡胸/, { kcal100: 151, protein: 29.0, fat: 3.0, carbs: 0.0, source: "USDA FoodData Central 鸡胸肉熟重数据 / 中国食物成分表熟重估算" }],
      [/鸡腿|葱姜鸡腿|番茄鸡腿|黑椒鸡腿/, { kcal100: 184, protein: 24.0, fat: 7.8, carbs: 4.0, source: sourceChina }],
      [/板栗炖鸡/, { kcal100: 168, protein: 18.5, fat: 6.0, carbs: 10.5, source: sourceChina }],
      [/青椒肉丝|里脊|猪/, { kcal100: 178, protein: 27.0, fat: 6.2, carbs: 2.0, source: sourceChina }],
      [/牛肉|牛肉丸|番茄牛肉/, { kcal100: 188, protein: 26.0, fat: 8.0, carbs: 3.0, source: sourceChina }],
      [/龙利鱼/, { kcal100: 108, protein: 19.0, fat: 2.8, carbs: 4.0, source: sourceBoohee }],
      [/鳕鱼/, { kcal100: 116, protein: 22.0, fat: 2.5, carbs: 1.0, source: sourceBoohee }],
      [/巴沙鱼/, { kcal100: 112, protein: 20.0, fat: 2.7, carbs: 2.0, source: sourceBoohee }],
      [/虾/, { kcal100: 98, protein: 16.0, fat: 2.1, carbs: 5.0, source: sourceChina }],
      [/蛏|蛤蜊|蛤/, { kcal100: 63, protein: 10.0, fat: 1.1, carbs: 3.0, source: sourceChina }],
      [/煎蛋|鸡蛋/, { kcal100: 135, protein: 13.0, fat: 8.8, carbs: 1.5, source: sourceChina }],
      [/西兰花/, { kcal100: 40, protein: 3.5, fat: 0.6, carbs: 5.6, source: sourceChina }],
      [/娃娃菜|包菜|生菜|小白菜|青菜/, { kcal100: 34, protein: 2.0, fat: 0.6, carbs: 5.0, source: sourceChina }],
      [/豆角/, { kcal100: 75, protein: 3.1, fat: 3.0, carbs: 9.0, source: sourceChina }],
      [/菠菜/, { kcal100: 39, protein: 3.0, fat: 1.1, carbs: 4.0, source: sourceChina }],
      [/口蘑|香菇|木耳|荷兰豆|芦笋|西葫芦|黄瓜|胡萝卜|番茄|彩椒/, { kcal100: 48, protein: 3.0, fat: 1.1, carbs: 6.0, source: sourceChina }],
      [/豆腐/, { kcal100: 82, protein: 8.2, fat: 4.1, carbs: 3.0, source: sourceChina }],
    ];
    const match = rules.find(([pattern]) => pattern.test(name));
    if (match) return match[1];
    const fallback = {
      荤: { kcal100: 175, protein: 24.0, fat: 7.0, carbs: 2.0, source: sourceChina },
      海鲜: { kcal100: 108, protein: 19.0, fat: 2.5, carbs: 2.0, source: sourceChina },
      素: { kcal100: 48, protein: 3.0, fat: 1.1, carbs: 6.0, source: sourceChina },
      主食: { kcal100: 120, protein: 3.5, fat: 1.0, carbs: 25.0, source: sourceChina },
    };
    return fallback[category] || fallback.素;
  }

  function inferDishConflicts(name, ingredients) {
    const conflicts = [];
    if (ingredients.includes("菠菜")) conflicts.push("豆腐");
    if (ingredients.includes("豆腐")) conflicts.push("菠菜");
    return conflicts;
  }

  function generateWeeklyRecipes(startDate) {
    const dates = nextServiceDates(startDate, 6);
    const existing = dates.filter((date) => getRecipe(date));
    if (existing.length) {
      confirmAction(`这 6 天里已有 ${existing.length} 天食谱，重新生成会覆盖这些日期的午餐和晚餐食谱。`, () => {
        createWeeklyRecipes(startDate, true);
      });
      return;
    }
    createWeeklyRecipes(startDate, false);
  }

  function createWeeklyRecipes(startDate, force) {
    const dates = nextServiceDates(startDate, 6);
    dates.forEach((date, dayIndex) => generateRecipeForPlan(date, force, dayIndex));
    saveState();
    toast(`已生成 ${dates[0]} 至 ${dates.at(-1)} 的 6 天食谱，共 12 套午晚餐。`);
    render();
  }

  function generateRecipeForPlan(date, force, dayIndex = 0) {
    if (force) state.recipes = state.recipes.filter((recipe) => recipe.date !== date);
    if (getRecipe(date)) return;
    const plan = WEEKLY_RECIPE_TEMPLATE[dayIndex % WEEKLY_RECIPE_TEMPLATE.length];
    const recipe = {
      id: uid("recipe"),
      date,
      meals: {
        lunch: { categories: {} },
        dinner: { categories: {} },
      },
      replacements: [],
      generatedAt: new Date().toISOString(),
    };
    ["lunch", "dinner"].forEach((meal, mealIndex) => {
      CATEGORIES.forEach((category, categoryIndex) => {
        const name = plan?.[meal]?.[category];
        const dishItem = name ? ensureDishByName(name, category) : null;
        recipe.meals[meal].categories[category] = dishItem?.id || "";
      });
      limitGarlicDishes(recipe, meal);
    });
    state.recipes.push(recipe);
  }

  function ensureDishByName(name, category) {
    const cleanName = stripWeeklyMarker(name);
    let dishItem = state.dishes.find((item) => stripWeeklyMarker(item.name) === cleanName);
    if (dishItem) {
      dishItem.name = cleanName;
      if (category && dishItem.category !== category) dishItem.category = category;
      if (!dishItem.kcal100 || !dishItem.source) {
        const nutrition = authorityNutritionForDish(cleanName, dishItem.category || category);
        dishItem.kcal100 = nutrition.kcal100;
        dishItem.protein = nutrition.protein;
        dishItem.fat = nutrition.fat;
        dishItem.carbs = nutrition.carbs;
        dishItem.source = nutrition.source;
      }
      if (!Array.isArray(dishItem.ingredients) || !dishItem.ingredients.length) dishItem.ingredients = inferDishIngredients(cleanName, dishItem.category || category);
    }
    if (!dishItem) {
      dishItem = autoBuildDish(cleanName, category);
      state.dishes.push(dishItem);
    }
    return dishItem;
  }

  function openManualRecipeModal(date = view.date, meal = "") {
    const recipe = getRecipe(date);
    const mealList = meal ? [meal] : ["lunch", "dinner"];
    const fields = [field("date", "日期", "date", true)];
    const values = { date };
    mealList.forEach((item) => {
      fields.push(field(`${item}Text`, `${MEALS[item]}食谱`, "textarea", mealList.length === 1, null, "full"));
      values[`${item}Text`] = recipeMealText(recipe, item);
    });
    openForm({
      title: meal ? `手工填写${MEALS[meal]}食谱` : "手工填写午晚餐食谱",
      fields,
      values,
      onSubmit: (data) => {
        const result = saveManualRecipe(data.date || view.date, data, meal);
        if (!result.changed) {
          toast("请填写至少一个餐次的菜品。");
          return;
        }
        view.date = data.date || view.date;
        saveState();
        closeModal();
        toast(`食谱已保存，${result.added} 个新菜品已同步进菜品管理。出餐表可按需重新生成。`);
        render();
      },
    });
  }

  function recipeMealText(recipe, meal) {
    if (!recipe) return "";
    return CATEGORIES
      .map((category) => getDish(recipe.meals[meal]?.categories?.[category])?.name)
      .filter(Boolean)
      .join(" + ");
  }

  function saveManualRecipe(date, data, mealScope = "") {
    const mealList = mealScope ? [mealScope] : ["lunch", "dinner"];
    const parsedMeals = mealList
      .map((meal) => [meal, parseManualRecipeText(data[`${meal}Text`])])
      .filter(([, names]) => names.length);
    if (!parsedMeals.length) return { changed: false, added: 0 };

    let recipe = getRecipe(date);
    if (!recipe) {
      recipe = createEmptyRecipe(date);
      state.recipes.push(recipe);
    }

    let added = 0;
    parsedMeals.forEach(([meal, names]) => {
      const assigned = assignManualRecipeDishes(names);
      recipe.meals[meal] = recipe.meals[meal] || { categories: {} };
      CATEGORIES.forEach((category) => {
        const name = assigned[category];
        recipe.meals[meal].categories[category] = "";
        if (!name) return;
        const beforeCount = state.dishes.length;
        const dishItem = ensureDishByName(name, category);
        if (state.dishes.length > beforeCount) added += 1;
        recipe.meals[meal].categories[category] = dishItem.id;
      });
      limitGarlicDishes(recipe, meal);
    });

    recipe.updatedAt = new Date().toISOString();
    return { changed: true, added };
  }

  function createEmptyRecipe(date) {
    return {
      id: uid("recipe"),
      date,
      meals: {
        lunch: { categories: {} },
        dinner: { categories: {} },
      },
      replacements: [],
      generatedAt: new Date().toISOString(),
    };
  }

  function parseManualRecipeText(value) {
    const cleaned = String(value || "")
      .replace(/\r/g, "\n")
      .replace(/Day\s*\d+/gi, "")
      .replace(/[午晚]餐\s*[:：]/g, "")
      .replace(/（[^）]*?kcal[^）]*?）/g, "");
    const seen = new Set();
    return cleaned
      .split(/[+＋、，,；;\n]/)
      .map((item) => stripWeeklyMarker(item).replace(/^[:：]+/, "").trim())
      .filter((item) => item && !seen.has(item) && seen.add(item));
  }

  function assignManualRecipeDishes(names) {
    const assigned = {};
    names.forEach((name, index) => {
      let category = names.length === CATEGORIES.length ? CATEGORIES[index] : inferDishCategory(name);
      if (assigned[category]) category = inferDishCategory(name);
      if (assigned[category]) category = CATEGORIES.find((item) => !assigned[item]) || category;
      assigned[category] = name;
    });
    return assigned;
  }

  function limitGarlicDishes(recipe, meal) {
    const garlicDishes = CATEGORIES.map((category) => getDish(recipe.meals[meal].categories[category])).filter((item) => item?.garlic);
    if (garlicDishes.length <= 1) return;
    garlicDishes.slice(1).forEach((dishItem) => {
      const replacement = state.dishes.find((item) => item.category === dishItem.category && item.available && !item.garlic && item.id !== dishItem.id);
      if (replacement) recipe.meals[meal].categories[dishItem.category] = replacement.id;
    });
  }

  function nextServiceDates(startDate, days) {
    return Array.from({ length: days }, (_, index) => addDays(startDate, index));
  }

  function exportWeeklyPrep(startDate) {
    const dates = nextServiceDates(startDate, 6);
    const missing = dates.filter((date) => !getRecipe(date));
    if (missing.length) {
      missing.forEach((date, index) => generateRecipeForPlan(date, false, index));
      saveState();
    }
    copyText(weeklyPrepText(startDate));
    toast(`已复制 ${dates[0]} 至 ${dates.at(-1)} 的一周备菜单。`);
    render();
  }

  function weeklyPrepText(startDate) {
    const dates = nextServiceDates(startDate, 6);
    const lines = [`${dates[0]} 至 ${dates.at(-1)} 一周食谱`, ""];
    dates.forEach((date, index) => {
      const recipe = getRecipe(date);
      lines.push(`Day ${index + 1}`);
      lines.push("");
      if (!recipe) {
        lines.push("  未生成食谱");
        lines.push("");
        return;
      }
      ["lunch", "dinner"].forEach((meal) => {
        const dishNames = [];
        CATEGORIES.forEach((category) => {
          const dishItem = getDish(recipe.meals[meal]?.categories?.[category]);
          if (!dishItem) return;
          dishNames.push(dishItem.name);
        });
        lines.push(`${MEALS[meal]}：${dishNames.join(" + ")}`);
        lines.push("");
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  function openReplacementModal() {
    const recipe = getRecipe(view.date);
    if (!recipe) return toast("请先生成食谱。");
    const oldOptions = recipeDishIds(recipe).map((id) => {
      const dishItem = getDish(id);
      return { value: id, label: `${dishItem?.name || ""} · ${dishItem?.category || ""}` };
    });
    openForm({
      title: "客户单独替换菜品",
      fields: [
        field("customerId", "客户", "select", true, state.customers.map((c) => ({ value: c.id, label: c.name }))),
        field("meal", "餐次", "select", true, [
          { value: "lunch", label: "午餐" },
          { value: "dinner", label: "晚餐" },
        ]),
        field("oldDishId", "原菜品", "select", true, oldOptions),
        field("newDishId", "从菜品库选择替换菜品", "select", false, [{ value: "", label: "手动输入新菜品" }, ...state.dishes.map((d) => ({ value: d.id, label: `${d.name} · ${d.category}${d.available ? "" : "（不可用）"}` }))]),
        field("newDishName", "手动输入替换菜品", "text", false),
        field("newDishCategory", "新菜品分类", "select", false, [{ value: "", label: "跟随原菜分类" }, ...CATEGORIES]),
        field("reason", "替换原因", "textarea", false, null, "full"),
      ],
      values: { meal: "lunch", customerId: view.selectedCustomerId || state.customers[0]?.id },
      onSubmit: (data) => {
        const newDish = resolveReplacementDish(data);
        if (!newDish) {
          toast("请选择替换菜品，或手动输入新菜品名称。");
          return;
        }
        recipe.replacements = recipe.replacements || [];
        recipe.replacements.push({
          id: uid("rep"),
          customerId: data.customerId,
          meal: data.meal,
          oldDishId: data.oldDishId,
          newDishId: newDish.id,
          reason: data.reason,
          confirmed: false,
        });
        saveState();
        closeModal();
        toast(data.newDishName?.trim() ? `客户替换已记录，「${newDish.name}」已同步进菜品管理。` : "客户替换已记录，重新生成出餐表后会带入。");
        render();
      },
    });
  }

  function resolveReplacementDish(data) {
    const manualName = String(data.newDishName || "").trim();
    if (!manualName && data.newDishId) return getDish(data.newDishId);
    if (!manualName) return null;
    const oldDish = getDish(data.oldDishId);
    const category = data.newDishCategory || oldDish?.category || inferDishCategory(manualName);
    return ensureDishByName(manualName, category);
  }

  function openFeedbackModal(id = "", customerId = "") {
    const existing = state.feedbacks.find((item) => item.id === id);
    openForm({
      title: existing ? "编辑客户反馈" : "录入每日反馈",
      fields: [
        field("date", "日期", "date", true),
        field("customerId", "客户", "select", true, state.customers.map((c) => ({ value: c.id, label: c.name }))),
        field("weight", "今日体重", "number"),
        field("lunchFinished", "午餐是否吃完", "select", true, ["是", "否"]),
        field("dinnerFinished", "晚餐是否吃完", "select", true, ["是", "否"]),
        field("satiety", "饱腹感", "select", true, ["偏饿", "刚好", "偏撑"]),
        field("dislikeDish", "不喜欢的菜", "text"),
        field("bodyNote", "身体状态备注", "textarea", false, null, "full"),
        field("adminNote", "管理员处理备注", "textarea", false, null, "full"),
        field("processed", "已处理", "checkbox"),
      ],
      values: existing || {
        date: todayKey(),
        customerId: customerId || view.selectedFeedbackCustomerId || state.customers[0]?.id,
        lunchFinished: "是",
        dinnerFinished: "是",
        satiety: "刚好",
        processed: true,
      },
      onSubmit: (data) => {
        const record = {
          ...(existing || {}),
          id: existing?.id || uid("fb"),
          date: data.date,
          customerId: data.customerId,
          weight: Number(data.weight || 0),
          lunchFinished: data.lunchFinished,
          dinnerFinished: data.dinnerFinished,
          satiety: data.satiety,
          dislikeDish: data.dislikeDish,
          bodyNote: data.bodyNote,
          adminNote: data.adminNote,
          processed: Boolean(data.processed),
        };
        upsert(state.feedbacks, record);
        const customer = getCustomer(record.customerId);
        if (customer) {
          if (record.weight) {
            customer.currentWeight = record.weight;
            customer.weightRecords = customer.weightRecords || [];
            const weightRecord = customer.weightRecords.find((item) => item.date === record.date);
            if (weightRecord) weightRecord.weight = record.weight;
            else customer.weightRecords.push({ date: record.date, weight: record.weight });
          }
          if (record.dislikeDish && !customer.dislikes.includes(record.dislikeDish)) {
            customer.dislikes.push(record.dislikeDish);
          }
        }
        view.selectedFeedbackCustomerId = record.customerId;
        saveState();
        closeModal();
        toast("反馈已保存，明日克重建议会自动参考。");
        render();
      },
    });
  }

  function openForm(config) {
    currentFormSubmit = config.onSubmit;
    const body = `<form id="recordForm">
      <div class="form-grid">${config.fields.map((item) => formField(item, config.values?.[item.name])).join("")}</div>
    </form>`;
    openModal(
      config.title,
      body,
      `${btn("取", "取消", "modal-close")}<button class="btn primary" form="recordForm" type="submit"><span class="btn-icon">存</span>保存</button>`
    );
  }

  function deleteCustomer(id) {
    const customer = getCustomer(id);
    if (!customer) return;
    confirmAction(`确认删除客户「${customer.name}」？相关订单和反馈会保留为历史模拟数据。`, () => {
      state.customers = state.customers.filter((item) => item.id !== id);
      if (view.selectedCustomerId === id) view.selectedCustomerId = state.customers[0]?.id || "";
      saveState();
      toast("客户已删除。");
      render();
    });
  }

  function deleteOrder(id) {
    const order = getOrder(id);
    if (!order) return;
    confirmAction("确认删除该服务订单？", () => {
      state.orders = state.orders.filter((item) => item.id !== id);
      if (view.selectedOrderId === id) view.selectedOrderId = state.orders[0]?.id || "";
      saveState();
      toast("订单已删除。");
      render();
    });
  }

  function deleteDish(id) {
    const dishItem = getDish(id);
    if (!dishItem) return;
    confirmAction(`确认删除菜品「${dishItem.name}」？已生成食谱中的引用会显示为空。`, () => {
      state.dishes = state.dishes.filter((item) => item.id !== id);
      saveState();
      toast("菜品已删除。");
      render();
    });
  }

  function deleteFeedback(id) {
    confirmAction("确认删除这条反馈？", () => {
      state.feedbacks = state.feedbacks.filter((item) => item.id !== id);
      saveState();
      toast("反馈已删除。");
      render();
    });
  }

  function deletePoster(id) {
    confirmAction("确认删除这条海报记录？", () => {
      state.posters = state.posters.filter((item) => item.id !== id);
      saveState();
      toast("海报记录已删除。");
      render();
    });
  }

  function toggleDishAvailable(id) {
    const dishItem = getDish(id);
    if (!dishItem) return;
    dishItem.available = !dishItem.available;
    saveState();
    toast(dishItem.available ? "菜品已恢复可用。" : "菜品已标记为今日不可用。");
    render();
  }

  function requestGenerateRecipe(date) {
    const exists = getRecipe(date);
    if (exists) {
      confirmAction("当天已存在食谱，重新生成会覆盖午餐和晚餐菜品，客户单独替换也会清空。", () => {
        generateRecipe(date, true, true);
      });
    } else {
      generateRecipe(date, true, true);
    }
  }

  function generateRecipe(date, force = false, shouldRender = true) {
    if (force) state.recipes = state.recipes.filter((recipe) => recipe.date !== date);
    if (getRecipe(date)) return;
    const recipe = {
      id: uid("recipe"),
      date,
      meals: {
        lunch: { categories: {} },
        dinner: { categories: {} },
      },
      replacements: [],
      generatedAt: new Date().toISOString(),
    };
    ["lunch", "dinner"].forEach((meal, mealIndex) => {
      CATEGORIES.forEach((category, categoryIndex) => {
        const candidates = state.dishes.filter((item) => item.category === category && item.available);
        const fallback = state.dishes.filter((item) => item.category === category);
        const list = candidates.length ? candidates : fallback;
        recipe.meals[meal].categories[category] = list[(hashCode(`${date}-${meal}-${category}`) + mealIndex + categoryIndex) % list.length]?.id || "";
      });
      const garlicDishes = CATEGORIES.map((category) => getDish(recipe.meals[meal].categories[category])).filter((item) => item?.garlic);
      if (garlicDishes.length > 1) {
        garlicDishes.slice(1).forEach((dishItem) => {
          const replacement = state.dishes.find((item) => item.category === dishItem.category && item.available && !item.garlic && item.id !== dishItem.id);
          if (replacement) recipe.meals[meal].categories[dishItem.category] = replacement.id;
        });
      }
    });
    state.recipes.push(recipe);
    saveState();
    if (shouldRender) {
      toast("食谱已生成。");
      render();
    }
  }

  function requestGenerateDaily(date) {
    const exists = state.dailyOut.some((row) => row.date === date);
    if (exists) {
      confirmAction("当天已存在出餐表，重新生成会覆盖手工调整的克重和暂停状态。", () => generateDailyOut(date, true, true));
    } else {
      generateDailyOut(date, true, true);
    }
  }

  function generateDailyOut(date, force = false, shouldRender = true) {
    const recipe = getRecipe(date);
    if (!recipe) {
      toast("请先生成当天食谱。");
      return;
    }
    if (force) state.dailyOut = state.dailyOut.filter((row) => row.date !== date);
    if (state.dailyOut.some((row) => row.date === date)) return;
    const rows = [];
    getActiveCustomers(date).forEach((customer) => {
      ["lunch", "dinner"].forEach((meal) => {
        const mealDishes = CATEGORIES.map((category) => getDish(recipe.meals[meal].categories[category])).filter(Boolean);
        const replacements = recipe.replacements?.filter((item) => item.customerId === customer.id && item.meal === meal && item.confirmed) || [];
        const finalDishes = mealDishes.map((dishItem) => {
          const replacement = replacements.find((item) => item.oldDishId === dishItem.id);
          return replacement ? getDish(replacement.newDishId) || dishItem : dishItem;
        });
        const plan = calculateCustomerPlan(customer, date, meal);
        const shares = { 荤: 0.3, 海鲜: 0.25, 素: 0.18, 主食: 0.27 };
        const items = finalDishes.map((dishItem) => {
          const categoryShare = shares[dishItem.category] || 0.25;
          const grams = Math.round(((plan.kcal * categoryShare) / (dishItem.kcal100 / 100)) / 5) * 5;
          return { dishId: dishItem.id, grams: Math.max(25, grams) };
        });
        const conflicts = finalDishes.some((dishItem) => customerConflictsDish(customer, dishItem));
        rows.push({
          id: uid("out"),
          date,
          meal,
          customerId: customer.id,
          items,
          paused: false,
          pausePolicy: "",
          pauseReason: "",
          pauseUpdatedAt: "",
          replaced: replacements.length > 0,
          needsReplacement: conflicts && replacements.length === 0,
          note: plan.adjustmentText,
          generatedAt: new Date().toISOString(),
        });
      });
    });
    state.dailyOut.push(...rows);
    saveState();
    if (shouldRender) {
      toast("每日出餐表已生成。");
      render();
    }
  }

  function openPauseMealModal(rowId) {
    const row = state.dailyOut.find((item) => item.id === rowId);
    if (!row) return toast("没有找到这条出餐记录。");
    const customer = getCustomer(row.customerId);
    const order = customerServiceInfo(row.customerId, row.date).order;
    openForm({
      title: `暂停${MEALS[row.meal]} · ${customer?.name || ""}`,
      fields: [
        field("pausePolicy", "餐次处理", "select", true, pausePolicyOptions()),
        field("pauseReason", "暂停原因 / 备注", "textarea", false, null, "full"),
      ],
      values: {
        pausePolicy: row.pausePolicy || "retain",
        pauseReason: row.pauseReason || "",
      },
      onSubmit: (data) => {
        row.paused = true;
        row.pausePolicy = data.pausePolicy || "retain";
        row.pauseReason = data.pauseReason || "";
        row.pauseUpdatedAt = new Date().toISOString();
        const extended = shouldExtendPause(row.pausePolicy);
        row.extensionOrderId = extended ? order?.id || "" : "";
        rebuildCustomerOrderSchedule(row.customerId);
        clearLogisticsForRow(row);
        saveState();
        closeModal();
        toast(`${customer?.name || "客户"}${MEALS[row.meal]}已暂停：${pausePolicyText(row.pausePolicy)}。${extended ? "订单结束日期已顺延。" : ""}`);
        render();
      },
    });
  }

  function resumeMeal(rowId) {
    const row = state.dailyOut.find((item) => item.id === rowId);
    if (!row) return;
    const customer = getCustomer(row.customerId);
    confirmAction(`恢复 ${customer?.name || "客户"} 的${MEALS[row.meal]}出餐？恢复后会重新计入餐次消耗，标签和配送可重新生成。`, () => {
      row.paused = false;
      row.pausePolicy = "";
      row.pauseReason = "";
      row.pauseUpdatedAt = "";
      row.extensionOrderId = "";
      rebuildCustomerOrderSchedule(row.customerId);
      saveState();
      toast("本餐已恢复出餐，可重新生成标签和配送。");
      render();
    });
  }

  function confirmReplacement(index) {
    const recipe = getRecipe(view.date);
    if (!recipe?.replacements?.[index]) return;
    const replacement = recipe.replacements[index];
    replacement.confirmed = true;
    syncDailyOutForRecipeReplacement(recipe, replacement);
    saveState();
    toast("替换已确认。");
    render();
  }

  function syncDailyOutForRecipeReplacement(recipe, replacement) {
    const row = state.dailyOut.find((item) => item.date === recipe.date && item.meal === replacement.meal && item.customerId === replacement.customerId);
    if (!row) return;
    const target = row.items.find((item) => item.dishId === replacement.oldDishId);
    if (target) {
      const oldDish = getDish(replacement.oldDishId);
      const newDish = getDish(replacement.newDishId);
      if (oldDish && newDish && oldDish.kcal100 && newDish.kcal100) {
        const keepKcal = (target.grams * oldDish.kcal100) / 100;
        target.grams = Math.max(25, Math.round((keepKcal / (newDish.kcal100 / 100)) / 5) * 5);
      }
      target.dishId = replacement.newDishId;
    }
    const customer = getCustomer(row.customerId);
    row.replaced = true;
    row.needsReplacement = row.items.some((item) => customerConflictsDish(customer, getDish(item.dishId)));
  }

  function deleteReplacement(index) {
    const recipe = getRecipe(view.date);
    if (!recipe?.replacements?.[index]) return;
    recipe.replacements.splice(index, 1);
    saveState();
    toast("替换记录已删除。");
    render();
  }

  function replaceUnavailableDishes(meal) {
    const recipe = getRecipe(view.date);
    if (!recipe) return;
    let changed = 0;
    CATEGORIES.forEach((category) => {
      const current = getDish(recipe.meals[meal].categories[category]);
      if (current && !current.available) {
        const replacement = state.dishes.find((item) => item.category === category && item.available && item.id !== current.id);
        if (replacement) {
          recipe.meals[meal].categories[category] = replacement.id;
          changed += 1;
        }
      }
    });
    saveState();
    toast(changed ? `已替换 ${changed} 个不可用菜品。` : "当前餐次没有不可用菜品。");
    render();
  }

  function generateAllLabelsAndDeliveries(date) {
    if (!state.dailyOut.some((row) => row.date === date)) {
      if (!getRecipe(date)) {
        toast("请先生成当天食谱和出餐表。");
        return;
      }
      generateDailyOut(date, false, false);
    }
    generateLabelsAndDeliveries(date, "lunch", false);
    generateLabelsAndDeliveries(date, "dinner", false);
    saveState();
    toast("全天标签和配送清单已生成。");
    render();
  }

  function generateLabelsAndDeliveries(date, meal, shouldRender = true) {
    const rows = state.dailyOut.filter((row) => row.date === date && row.meal === meal && !row.paused);
    if (!rows.length) {
      toast("请先生成对应餐次的出餐表。");
      return;
    }
    state.labels = state.labels.filter((item) => !(item.date === date && item.meal === meal));
    state.deliveries = state.deliveries.filter((item) => !(item.date === date && item.meal === meal));
    rows.forEach((row) => {
      const customer = getCustomer(row.customerId);
      const vm = buildLabelViewModel(row);
      const content = row.items.map((item) => `${getDish(item.dishId)?.name || ""}${item.grams}g`).join("、");
      const text = labelTextFromVm(vm);
      state.labels.push({
        id: uid("label"),
        date,
        meal,
        customerId: row.customerId,
        customerName: customer?.name || "",
        text,
        kcal: vm.kcal,
        grams: vm.grams,
        protein: vm.protein,
        fat: vm.fat,
        carbs: vm.carbs,
        targetRange: vm.targetRange,
        portion: vm.portion,
        dayCode: vm.dayCode,
        customerCode: vm.customerCode,
        management: vm.management,
        observe: vm.observe,
        generated: true,
        generatedAt: new Date().toISOString(),
      });
      state.deliveries.push({
        id: uid("del"),
        date,
        meal,
        customerId: row.customerId,
        customerName: customer?.name || "",
        phone: customer?.phone || "",
        address: customer?.address || "",
        content,
        note: row.needsReplacement ? "需核对忌口替换" : customer?.notes || "",
        generatedAt: new Date().toISOString(),
      });
    });
    saveState();
    if (shouldRender) {
      toast(`${MEALS[meal]}标签和配送清单已生成。`);
      render();
    }
  }

  function buildLabelViewModel(row) {
    const customer = getCustomer(row.customerId);
    const totals = rowTotals(row);
    const macros = rowMacroTotals(row);
    const order = customerServiceInfo(row.customerId, row.date).order;
    const serviceDay = order ? Math.max(1, dateDiff(order.startDate, row.date) + 1) : 1;
    const customerIndex = state.customers.findIndex((item) => item.id === row.customerId) + 1;
    return {
      date: row.date,
      meal: row.meal,
      customerId: row.customerId,
      customerName: customer?.name || "",
      customerCode: `C${String(Math.max(1, customerIndex)).padStart(3, "0")}`,
      dayCode: `D${serviceDay}`,
      portion: portionLabel(totals.kcal, totals.grams),
      kcal: totals.kcal,
      grams: totals.grams,
      targetRange: `${Math.max(0, totals.kcal - 25)}-${totals.kcal + 25}`,
      protein: formatDecimal1(macros.protein),
      fat: formatDecimal1(macros.fat),
      carbs: formatDecimal1(macros.carbs),
      foodGroups: labelFoodGroups(row),
      alert: labelAlert(customer, row),
      management: labelManagement(customer, row, totals, macros),
      observe: labelObserve(customer, row),
    };
  }

  function getLabelViewModel(label) {
    const row = state.dailyOut.find((item) => item.date === label.date && item.meal === label.meal && item.customerId === label.customerId);
    if (row) return buildLabelViewModel(row);
    return {
      date: label.date,
      meal: label.meal,
      customerId: label.customerId,
      customerName: label.customerName,
      customerCode: label.customerCode || "C---",
      dayCode: label.dayCode || "D-",
      portion: label.portion || "标准",
      kcal: label.kcal || 0,
      grams: label.grams || 0,
      targetRange: label.targetRange || "-",
      protein: formatDecimal1(label.protein || 0),
      fat: formatDecimal1(label.fat || 0),
      carbs: formatDecimal1(label.carbs || 0),
      foodGroups: [{ label: "餐品", text: label.text || "" }],
      alert: "",
      management: label.management || "高蛋白搭配；主食稳饱腹",
      observe: label.observe || "饱腹感/是否吃完/3小时饿感",
    };
  }

  function rowMacroTotals(row) {
    return row.items.reduce((acc, item) => {
      const dishItem = getDish(item.dishId);
      if (!dishItem) return acc;
      const factor = Number(item.grams || 0) / 100;
      acc.protein += Number(dishItem.protein || 0) * factor;
      acc.fat += Number(dishItem.fat || 0) * factor;
      acc.carbs += Number(dishItem.carbs || 0) * factor;
      return acc;
    }, { protein: 0, fat: 0, carbs: 0 });
  }

  function labelFoodGroups(row) {
    const groups = [
      { label: "主食", categories: ["主食"], items: [] },
      { label: "蛋白", categories: ["荤", "海鲜"], items: [] },
      { label: "蔬菜", categories: ["素"], items: [] },
    ];
    row.items.forEach((item) => {
      const dishItem = getDish(item.dishId);
      if (!dishItem) return;
      const group = groups.find((entry) => entry.categories.includes(dishItem.category));
      if (group) group.items.push(`${dishItem.name}${item.grams}g`);
    });
    return groups.filter((group) => group.items.length).map((group) => ({ label: group.label, text: group.items.join(" | ") }));
  }

  function portionLabel(kcal, grams) {
    if (kcal <= 380 || grams <= 390) return "小份";
    if (kcal <= 460 || grams <= 460) return "中份-";
    if (kcal <= 540 || grams <= 540) return "中份";
    return "大份";
  }

  function labelTextFromVm(vm) {
    return [
      `${vm.dayCode} ${MEALS[vm.meal]} | ${vm.customerName}`,
      `份量：${vm.portion}`,
      `本餐热量：${vm.kcal} kcal`,
      `目标热量：${vm.targetRange}kcal`,
      `熟重：${vm.grams}g`,
      `蛋白 ${vm.protein}g / 脂肪 ${vm.fat}g / 碳水 ${vm.carbs}g`,
      "餐品：",
      ...vm.foodGroups.map((group) => `${group.label}：${group.text}`),
      `本餐管理：${vm.management}`,
      `饭后观察：${vm.observe}`,
      "扫码反馈 / 联系我",
    ].join("\n");
  }

  async function exportLabelPdf(date) {
    try {
      let labels = state.labels.filter((item) => item.date === date);
      if (!labels.length) {
        generateAllLabelsAndDeliveries(date);
        labels = state.labels.filter((item) => item.date === date);
      }
      if (!labels.length) {
        toast("当前日期没有可导出的标签。");
        return;
      }
      const qrImage = labelQrImage || await loadLabelQrImage();
      if (!qrImage) {
        toast("二维码加载失败，请刷新页面后重试。");
        return;
      }

      toast("正在生成标签 PDF...");
      const ordered = labels.sort((a, b) => `${a.meal}-${a.customerName}`.localeCompare(`${b.meal}-${b.customerName}`));
      const images = ordered.map((label) => labelCanvasImage(getLabelViewModel(label), qrImage));
      const pdfBytes = buildImagePdf(images, LABEL_PAGE_WIDTH_PT, LABEL_PAGE_HEIGHT_PT);
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${date}-餐盒标签.pdf`, "标签 PDF 已生成");
      toast(`已导出 ${ordered.length} 页标签 PDF。`);
    } catch (error) {
      console.error(error);
      toast(error?.message ? `标签 PDF 导出失败：${error.message}` : "标签 PDF 导出失败，请刷新后重试。");
    }
  }

  function preloadLabelQrImage() {
    loadLabelQrImage();
  }

  function loadLabelQrImage() {
    if (labelQrImage) return Promise.resolve(labelQrImage);
    if (labelQrImagePromise) return labelQrImagePromise;
    labelQrImagePromise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        labelQrImage = image;
        resolve(image);
      };
      image.onerror = () => resolve(null);
      image.src = LABEL_QR_SRC;
    });
    return labelQrImagePromise;
  }

  function labelCanvasImage(vm, qrImage) {
    const canvas = renderLabelCanvas(vm, qrImage);
    try {
      return {
        width: canvas.width,
        height: canvas.height,
        bytes: thermalCanvasImageBytes(canvas),
        colorSpace: "/DeviceGray",
        bitsPerComponent: 8,
      };
    } catch (error) {
      if (!qrImage) throw error;
      console.warn("Label QR image could not be exported with canvas, retrying without QR.", error);
      const fallbackCanvas = renderLabelCanvas(vm, null);
      return {
        width: fallbackCanvas.width,
        height: fallbackCanvas.height,
        bytes: thermalCanvasImageBytes(fallbackCanvas),
        colorSpace: "/DeviceGray",
        bitsPerComponent: 8,
      };
    }
  }

  function renderLabelCanvas(vm, qrImage = null) {
    const canvas = document.createElement("canvas");
    const scale = LABEL_CANVAS_DPI / 25.4;
    const px = (value) => Math.round(value * scale);
    const pt = (value) => Math.round(value * LABEL_CANVAS_DPI / 72);
    canvas.width = px(LABEL_PAGE_WIDTH_MM);
    canvas.height = px(LABEL_PAGE_HEIGHT_MM);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const colors = {
      ink: "#000000",
      muted: "#000000",
      soft: "#ffffff",
      line: "#000000",
      border: "#000000",
      qrFrame: "#000000",
    };

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.textBaseline = "alphabetic";

    const x0 = px(2.4);
    const x1 = canvas.width - px(2.4);
    let y = px(2);
    labelRoundRect(ctx, px(0.8), px(0.8), canvas.width - px(1.6), canvas.height - px(1.6), px(1.5), {
      stroke: colors.line,
      width: 2,
    });

    labelText(ctx, `${vm.dayCode} ${MEALS[vm.meal]} | ${vm.customerName}`, x0, y + px(3.15), 10, 800, colors.ink);
    drawLabelPill(ctx, vm.portion, x1 - px(9.2), y - px(0.2), px(9.2), px(4.4), pt, colors);

    y += px(5);
    labelLine(ctx, x0, y, x1, y, 2, colors.line);
    y += px(0.9);

    const heatBoxHeight = px(12.8);
    labelRoundRect(ctx, x0, y, x1 - x0, heatBoxHeight, px(1), {
      stroke: colors.line,
      width: 2,
    });
    labelText(ctx, "本餐热量", x0 + px(1.7), y + px(3.05), 6.25, 400, colors.ink);
    const kcalValue = String(vm.kcal);
    const kcalFont = labelFont(23.5, 900);
    const unitFont = labelFont(8.3, 800);
    ctx.font = kcalFont;
    const kcalWidth = ctx.measureText(kcalValue).width;
    ctx.font = unitFont;
    const unitWidth = ctx.measureText("kcal").width;
    const heatGroupWidth = kcalWidth + px(0.9) + unitWidth;
    const heatGroupX = (x0 + x1 - heatGroupWidth) / 2;
    labelText(ctx, kcalValue, heatGroupX, y + px(9.2), 23.5, 900, colors.ink);
    labelText(ctx, "kcal", heatGroupX + kcalWidth + px(0.9), y + px(8.0), 8.3, 800, colors.ink);

    y += heatBoxHeight + px(1);
    const infoGap = px(1);
    const targetWidth = px(28.6);
    const weightWidth = x1 - x0 - infoGap - targetWidth;
    drawCenteredInfoBox(ctx, "目标", `${vm.targetRange}kcal`, x0, y, targetWidth, px(5.4), pt, colors);
    drawCenteredInfoBox(ctx, "熟重", `${vm.grams}g`, x0 + targetWidth + infoGap, y, weightWidth, px(5.4), pt, colors);

    y += px(6.4);
    const macroGap = px(1);
    const macroWidth = Math.floor((x1 - x0 - macroGap * 2) / 3);
    [
      ["蛋白", `${vm.protein}g`],
      ["脂肪", `${vm.fat}g`],
      ["碳水", `${vm.carbs}g`],
    ].forEach(([label, value], index) => {
      drawCompactMacroBox(ctx, label, value, x0 + index * (macroWidth + macroGap), y, macroWidth, px(6.5), pt, colors);
    });

    y += px(7.8);
    labelText(ctx, "餐品", x0, y + px(2.5), 7.4, 800, colors.ink);
    labelLine(ctx, x0 + px(7.1), y + px(1.8), x1, y + px(1.8), 1, colors.border);
    y += px(3.9);

    const qrSize = px(15.8);
    const qrX = x1 - qrSize;
    const qrY = y;
    const foodTextRight = qrX - px(1.6);
    if (qrImage) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      ctx.restore();
    }
    labelText(ctx, "扫码反馈", qrX + qrSize / 2, qrY + qrSize + px(2.35), 4.7, 800, colors.ink, "center");

    const foodRows = normalizeLabelFoodGroups(vm.foodGroups);
    y = drawLabelFoodRow(ctx, foodRows[0]?.label || "主食", foodRows[0]?.text || "-", x0, foodTextRight, y, px(4.4), pt, colors);
    y = drawLabelFoodRow(ctx, foodRows[1]?.label || "蛋白", foodRows[1]?.text || "-", x0, foodTextRight, y, px(7.0), pt, colors);
    y = drawLabelFoodRow(ctx, foodRows[2]?.label || "蔬菜", foodRows[2]?.text || "-", x0, foodTextRight, y, px(4.5), pt, colors);

    y = Math.max(y + px(0.3), qrY + qrSize + px(3.0));
    drawManagementRow(ctx, "本餐管理", vm.management, x0, y, x1 - x0, px(4.8), pt, colors, true);
    y += px(5.7);
    drawManagementRow(ctx, "饭后观察", vm.observe, x0, y, x1 - x0, px(4.8), pt, colors, false);
    thresholdLabelCanvas(canvas, 185);
    return canvas;
  }

  function labelPrintWeight(weight = 400) {
    if (weight >= 900) return 900;
    if (weight >= 800) return 850;
    return Math.max(weight, 700);
  }

  function labelFont(sizePt, weight = 400) {
    return `${labelPrintWeight(weight)} ${Math.round(sizePt * LABEL_CANVAS_DPI / 72)}px Microsoft YaHei, PingFang SC, Arial, sans-serif`;
  }

  function labelText(ctx, text, x, y, sizePt, weight, color, align = "left") {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = labelFont(sizePt, weight);
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(text ?? ""), Math.round(x), Math.round(y));
    ctx.restore();
  }

  function thresholdLabelCanvas(canvas, threshold) {
    const ctx = canvas.getContext("2d");
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3] / 255;
      const red = 255 + (data[index] - 255) * alpha;
      const green = 255 + (data[index + 1] - 255) * alpha;
      const blue = 255 + (data[index + 2] - 255) * alpha;
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      const value = luminance < threshold ? 0 : 255;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  function thermalCanvasImageBytes(canvas) {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const bytes = new Uint8Array(canvas.width * canvas.height);
    for (let source = 0, target = 0; source < data.length; source += 4, target += 1) {
      bytes[target] = data[source] < 128 ? 0 : 255;
    }
    return bytes;
  }

  function labelRoundRect(ctx, x, y, width, height, radius, options = {}) {
    ctx.save();
    roundRect(ctx, Math.round(x), Math.round(y), Math.round(width), Math.round(height), Math.round(radius));
    if (options.fill) {
      ctx.fillStyle = options.fill;
      ctx.fill();
    }
    if (options.stroke) {
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options.width || 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function labelLine(ctx, x1, y1, x2, y2, width, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(Math.round(x1), Math.round(y1));
    ctx.lineTo(Math.round(x2), Math.round(y2));
    ctx.stroke();
    ctx.restore();
  }

  function drawLabelPill(ctx, text, x, y, width, height, pt, colors) {
    labelRoundRect(ctx, x, y, width, height, height / 2, { stroke: colors.line, width: 2 });
    ctx.save();
    ctx.fillStyle = colors.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = labelFont(6.8, 850);
    ctx.fillText(text, Math.round(x + width / 2), Math.round(y + height / 2 + 1));
    ctx.restore();
  }

  function drawCenteredInfoBox(ctx, label, value, x, y, width, height, pt, colors) {
    labelRoundRect(ctx, x, y, width, height, Math.round(height * 0.18), { stroke: colors.border, width: 2 });
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = colors.muted;
    ctx.font = labelFont(5.0, 700);
    ctx.fillText(label, Math.round(x + width / 2), Math.round(y + height * 0.34));
    ctx.fillStyle = colors.ink;
    ctx.font = labelFont(6.9, 850);
    ctx.fillText(value, Math.round(x + width / 2), Math.round(y + height * 0.78));
    ctx.restore();
  }

  function drawCompactMacroBox(ctx, label, value, x, y, width, height, pt, colors) {
    labelRoundRect(ctx, x, y, width, height, Math.round(height * 0.22), { stroke: colors.border, width: 2 });
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = colors.muted;
    ctx.font = labelFont(5.65, 750);
    ctx.fillText(label, Math.round(x + width / 2), Math.round(y + height * 0.32));
    ctx.fillStyle = colors.ink;
    ctx.font = labelFont(8.6, 900);
    ctx.fillText(value, Math.round(x + width / 2), Math.round(y + height * 0.78));
    ctx.restore();
  }

  function normalizeLabelFoodGroups(groups) {
    const byLabel = Object.fromEntries((groups || []).map((group) => [group.label, group.text]));
    return [
      { label: "主食", text: byLabel.主食 || "" },
      { label: "蛋白", text: byLabel.蛋白 || "" },
      { label: "蔬菜", text: byLabel.蔬菜 || "" },
    ];
  }

  function drawLabelFoodRow(ctx, label, text, x, textRight, y, rowHeight, pt, colors) {
    const tagWidth = Math.round((6.6 * LABEL_CANVAS_DPI) / 25.4);
    const tagHeight = Math.round((4.2 * LABEL_CANVAS_DPI) / 25.4);
    labelRoundRect(ctx, x, y, tagWidth, tagHeight, Math.round(tagHeight * 0.22), { stroke: colors.line, width: 2 });
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = colors.ink;
    ctx.font = labelFont(5.5, 900);
    ctx.fillText(label, Math.round(x + tagWidth / 2), Math.round(y + tagHeight / 2));
    ctx.restore();

    const textX = x + tagWidth + Math.round((1.4 * LABEL_CANVAS_DPI) / 25.4);
    const maxWidth = textRight - textX;
    const lines = labelFoodLines(ctx, text, labelFont(6.7, 700), maxWidth);
    ctx.save();
    ctx.fillStyle = colors.ink;
    ctx.font = labelFont(6.7, 700);
    ctx.fillText(lines[0] || "", Math.round(textX), Math.round(y + rowHeight * (lines.length > 1 ? 0.34 : 0.68)));
    if (lines[1]) ctx.fillText(lines[1], Math.round(textX), Math.round(y + rowHeight * 0.82));
    ctx.restore();
    return y + rowHeight;
  }

  function labelFoodLines(ctx, text, fontValue, maxWidth) {
    const raw = String(text || "-");
    ctx.save();
    ctx.font = fontValue;
    const parts = raw.split("|").map((item) => item.trim()).filter(Boolean);
    if (parts.length === 2 && parts.every((part) => ctx.measureText(part).width <= maxWidth)) {
      ctx.restore();
      return parts;
    }
    if (ctx.measureText(raw).width <= maxWidth) {
      ctx.restore();
      return [raw];
    }
    const lines = [];
    let current = "";
    for (const char of raw) {
      if (ctx.measureText(current + char).width > maxWidth && current) {
        lines.push(current);
        current = char;
        if (lines.length === 1) continue;
      } else {
        current += char;
      }
    }
    if (current) lines.push(current);
    if (lines.length > 2) lines.splice(1, lines.length - 1, fitCanvasText(ctx, lines.slice(1).join(""), maxWidth));
    ctx.restore();
    return lines.slice(0, 2);
  }

  function drawManagementRow(ctx, label, text, x, y, width, height, pt, colors, strong) {
    labelRoundRect(ctx, x, y, width, height, Math.round(height * 0.2), { stroke: colors.border, width: 2 });
    const labelWidth = Math.round((11.4 * LABEL_CANVAS_DPI) / 25.4);
    labelLine(ctx, x + labelWidth, y, x + labelWidth, y + height, 1, colors.border);
    labelText(ctx, label, x + labelWidth / 2, y + Math.round(height * 0.63), 5.35, 700, colors.ink, "center");
    const bodyX = x + labelWidth + Math.round((1.2 * LABEL_CANVAS_DPI) / 25.4);
    ctx.save();
    ctx.fillStyle = colors.ink;
    ctx.font = labelFont(strong ? 5.9 : 5.7, strong ? 900 : 700);
    ctx.fillText(fitCanvasText(ctx, text, width - (bodyX - x) - Math.round((1.0 * LABEL_CANVAS_DPI) / 25.4)), Math.round(bodyX), Math.round(y + height * 0.6));
    ctx.restore();
  }

  function fitCanvasText(ctx, text, maxWidth) {
    const value = String(text || "");
    if (ctx.measureText(value).width <= maxWidth) return value;
    let output = "";
    for (const char of value) {
      if (ctx.measureText(`${output}${char}...`).width > maxWidth) return `${output}...`;
      output += char;
    }
    return output;
  }

  function drawPill(ctx, text, x, y, width, height) {
    ctx.save();
    ctx.strokeStyle = "#15212b";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, width, height, 28);
    ctx.stroke();
    ctx.fillStyle = "#15212b";
    ctx.font = "800 28px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + width / 2, y + height / 2 + 1);
    ctx.restore();
  }

  function drawInfoBox(ctx, label, value, x, y, width, height) {
    ctx.save();
    ctx.strokeStyle = "#a9b3bd";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, width, height, 14);
    ctx.stroke();
    ctx.fillStyle = "#66727c";
    ctx.font = "800 26px Microsoft YaHei, sans-serif";
    ctx.fillText(label, x + 24, y + 42);
    ctx.fillStyle = "#15212b";
    ctx.font = "900 35px Microsoft YaHei, sans-serif";
    ctx.fillText(value, x + 24, y + 92);
    ctx.restore();
  }

  function drawMacroBox(ctx, label, value, x, y, width, height) {
    ctx.save();
    ctx.strokeStyle = "#15212b";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, width, height, 16);
    ctx.stroke();
    ctx.fillStyle = "#15212b";
    ctx.textAlign = "center";
    ctx.font = "800 28px Microsoft YaHei, sans-serif";
    ctx.fillText(label, x + width / 2, y + 44);
    ctx.font = "900 40px Microsoft YaHei, sans-serif";
    ctx.fillText(value, x + width / 2, y + 92);
    ctx.restore();
  }

  function drawSmallTag(ctx, label, x, y) {
    ctx.save();
    ctx.strokeStyle = "#15212b";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, 100, 42, 10);
    ctx.stroke();
    ctx.fillStyle = "#15212b";
    ctx.textAlign = "center";
    ctx.font = "800 25px Microsoft YaHei, sans-serif";
    ctx.fillText(label, x + 50, y + 29);
    ctx.restore();
  }

  function drawTipRow(ctx, label, text, x, y, width, height) {
    ctx.save();
    ctx.strokeStyle = "#15212b";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, width, height, 15);
    ctx.stroke();
    line(ctx, x + 170, y, x + 170, y + height, 2, "#15212b");
    ctx.fillStyle = "#15212b";
    ctx.font = "800 25px Microsoft YaHei, sans-serif";
    label.split("\n").forEach((part, index) => ctx.fillText(part, x + 58, y + 34 + index * 28));
    ctx.font = "900 31px Microsoft YaHei, sans-serif";
    wrapCanvasText(ctx, text, x + 190, y + 54, width - 220, 36);
    ctx.restore();
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  function line(ctx, x1, y1, x2, y2, width, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function buildImagePdf(images, pageWidth, pageHeight) {
    const objects = [];
    const pages = [];
    images.forEach((image, index) => {
      const rawImage = Boolean(image.bytes);
      const imageBytes = image.bytes || dataUrlBytes(image.dataUrl);
      const colorSpace = image.colorSpace || "/DeviceRGB";
      const bitsPerComponent = image.bitsPerComponent || 8;
      const filter = rawImage ? "" : ` /Filter ${image.filter || "/DCTDecode"}`;
      const imageId = 3 + index * 3;
      const contentId = imageId + 1;
      const pageId = imageId + 2;
      objects[imageId] = {
        binary: true,
        before: `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace ${colorSpace} /BitsPerComponent ${bitsPerComponent}${filter} /Length ${imageBytes.length} >>\nstream\n`,
        bytes: imageBytes,
        after: "\nendstream",
      };
      const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im${index + 1} Do\nQ`;
      objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
      objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`;
      pages.push(`${pageId} 0 R`);
    });
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${pages.join(" ")}] /Count ${pages.length} >>`;

    const chunks = [asciiBytes("%PDF-1.4\n")];
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
      if (!objects[id]) continue;
      offsets[id] = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      chunks.push(asciiBytes(`${id} 0 obj\n`));
      if (typeof objects[id] === "string") {
        chunks.push(asciiBytes(objects[id]));
      } else {
        chunks.push(asciiBytes(objects[id].before));
        chunks.push(objects[id].bytes);
        chunks.push(asciiBytes(objects[id].after));
      }
      chunks.push(asciiBytes("\nendobj\n"));
    }
    const xrefOffset = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) {
      xref += `${String(offsets[id] || 0).padStart(10, "0")} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    chunks.push(asciiBytes(xref));
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {
      result.set(chunk, offset);
      offset += chunk.length;
    });
    return result;
  }

  function dataUrlBytes(dataUrl) {
    const base64 = dataUrl.split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function asciiBytes(text) {
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index) & 0xff;
    return bytes;
  }

  function downloadBlob(blob, filename, message = "文件已生成") {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    showDownloadLink(url, filename, message);
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function showDownloadLink(url, filename, message) {
    const root = document.getElementById("toastRoot");
    const item = document.createElement("div");
    const text = document.createElement("span");
    const anchor = document.createElement("a");
    item.className = "toast toast-action";
    text.textContent = `${message}。若没有自动下载，`;
    anchor.href = url;
    anchor.download = filename;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.textContent = "打开 PDF";
    item.append(text, anchor);
    root.appendChild(item);
    window.setTimeout(() => item.remove(), 12000);
  }

  function savePosterRecord() {
    const customer = getCustomer(view.posterCustomerId);
    const order = getOrder(view.posterOrderId);
    if (!customer || !order) return toast("请先选择客户和订单。");
    const stats = posterStats(customer, order);
    const summaryText = view.posterDraft || defaultPosterSummary(customer, stats);
    state.posters.push({
      id: uid("poster"),
      customerId: customer.id,
      orderId: order.id,
      summaryText,
      stats,
      generatedAt: new Date().toISOString(),
    });
    saveState();
    toast("海报记录已保存。");
    render();
  }

  function loadPoster(id) {
    const poster = state.posters.find((item) => item.id === id);
    if (!poster) return;
    view.posterCustomerId = poster.customerId;
    view.posterOrderId = poster.orderId;
    view.posterDraft = poster.summaryText;
    render();
  }

  function exportPosterPng() {
    const customer = getCustomer(view.posterCustomerId);
    const order = getOrder(view.posterOrderId);
    if (!customer || !order) return toast("请先选择客户和订单。");
    const stats = posterStats(customer, order);
    const summary = view.posterDraft || defaultPosterSummary(customer, stats);
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1280;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f6f8f5";
    ctx.fillRect(48, 48, 804, 1184);
    ctx.strokeStyle = "#dfe6df";
    ctx.lineWidth = 3;
    ctx.strokeRect(48, 48, 804, 1184);
    ctx.fillStyle = "#2f8f66";
    ctx.font = "700 28px Microsoft YaHei, sans-serif";
    ctx.fillText("减脂餐服务总结", 92, 118);
    ctx.fillStyle = "#68736d";
    ctx.font = "600 22px Microsoft YaHei, sans-serif";
    ctx.fillText("品牌位置预留", 660, 118);
    ctx.fillStyle = "#1f2a24";
    ctx.font = "800 56px Microsoft YaHei, sans-serif";
    wrapCanvasText(ctx, `${customer.nickname || customer.name} 的阶段成果`, 92, 215, 710, 68);
    ctx.fillStyle = "#68736d";
    ctx.font = "500 28px Microsoft YaHei, sans-serif";
    ctx.fillText(`${order.startDate} 至 ${order.endDate}`, 92, 330);
    const statCards = [
      ["总减重", `${stats.loss} kg`],
      ["坚持率", `${stats.persistence}%`],
      ["服务天数", `${stats.serviceDays} 天`],
      ["打卡天数", `${stats.checkinDays} 天`],
    ];
    statCards.forEach(([label, value], index) => {
      const x = 92 + (index % 2) * 358;
      const y = 398 + Math.floor(index / 2) * 158;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, 320, 118);
      ctx.strokeStyle = "#dfe6df";
      ctx.strokeRect(x, y, 320, 118);
      ctx.fillStyle = "#68736d";
      ctx.font = "600 24px Microsoft YaHei, sans-serif";
      ctx.fillText(label, x + 28, y + 42);
      ctx.fillStyle = "#1f2a24";
      ctx.font = "800 42px Microsoft YaHei, sans-serif";
      ctx.fillText(value, x + 28, y + 92);
    });
    ctx.fillStyle = "#e8f5ee";
    ctx.fillRect(92, 745, 716, 260);
    ctx.fillStyle = "#265742";
    ctx.font = "500 29px Microsoft YaHei, sans-serif";
    wrapCanvasText(ctx, summary, 128, 810, 650, 46);
    ctx.fillStyle = "#68736d";
    ctx.font = "500 24px Microsoft YaHei, sans-serif";
    wrapCanvasText(ctx, `饮食完成情况：午晚餐反馈 ${stats.feedbackCount} 条，服务记录完整度 ${stats.persistence}%。`, 92, 1092, 716, 38);
    const link = document.createElement("a");
    link.download = `${customer.name}-服务总结海报.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast("海报图片已导出。");
  }

  function resetDemo() {
    confirmAction("确认重置全部示例数据？本地修改会被清空。", () => {
      localStorage.removeItem(STORE_KEY);
      state = seedState();
      saveState();
      toast("示例数据已重置。");
      render();
    });
  }

  function filteredCustomers() {
    const f = view.filters.customers;
    const query = f.query.trim();
    return state.customers.filter((customer) => {
      const info = customerServiceInfo(customer.id, todayKey());
      const matchQuery = !query || [customer.name, customer.phone].join(" ").includes(query);
      const matchStatus = f.status === "全部" || info.status === f.status;
      return matchQuery && matchStatus;
    });
  }

  function filteredOrders() {
    const f = view.filters.orders;
    const query = f.query.trim();
    return state.orders.filter((order) => {
      const customer = getCustomer(order.customerId);
      const effective = effectiveOrderStatus(order, todayKey());
      const matchQuery = !query || [customer?.name, customer?.phone, order.notes].join(" ").includes(query);
      const matchStatus = f.status === "全部" || effective === f.status;
      return matchQuery && matchStatus;
    });
  }

  function filteredDishes() {
    const f = view.filters.dishes;
    const query = f.query.trim();
    return state.dishes.filter((dishItem) => {
      const matchQuery = !query || [dishItem.name, dishItem.ingredients.join(" ")].join(" ").includes(query);
      const matchCategory = f.category === "全部" || dishItem.category === f.category;
      const matchAvailable = f.available === "全部" || (f.available === "可用" ? dishItem.available : !dishItem.available);
      return matchQuery && matchCategory && matchAvailable;
    });
  }

  function filteredFeedbacks() {
    const f = view.filters.feedbacks;
    const query = f.query.trim();
    return state.feedbacks
      .filter((fb) => {
        const customer = getCustomer(fb.customerId);
        const matchQuery = !query || [customer?.name, fb.bodyNote, fb.adminNote, fb.dislikeDish].join(" ").includes(query);
        const matchDate = !f.date || fb.date === f.date;
        const matchSatiety = f.satiety === "全部" || fb.satiety === f.satiety;
        return matchQuery && matchDate && matchSatiety;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function serviceStatusCounts() {
    const customerIds = new Set(state.customers.map((c) => c.id));
    const active = state.customers.filter((c) => customerServiceInfo(c.id, todayKey()).status === "服务中").length;
    const nearEnd = state.customers.filter((c) => customerServiceInfo(c.id, todayKey()).status === "即将结束").length;
    const ended = state.customers.filter((c) => customerServiceInfo(c.id, todayKey()).status === "已结束").length;
    const repurchase = Array.from(customerIds).filter((id) => state.orders.filter((order) => order.customerId === id && order.status !== "已取消").length > 1 || state.orders.some((order) => order.customerId === id && order.isRepurchase)).length;
    return { active, nearEnd, ended, repurchase };
  }

  function getActiveCustomers(date) {
    return state.customers.filter((customer) => ["服务中", "即将结束"].includes(customerServiceInfo(customer.id, date).status));
  }

  function validateOrderDateWindow(customerId, startDate, endDate, ignoreOrderId = "") {
    const conflicts = state.orders
      .filter((order) => order.customerId === customerId && order.status !== "已取消" && order.id !== ignoreOrderId)
      .filter((order) => rangesOverlap(startDate, endDate, order.startDate, order.endDate))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (!conflicts.length) return { valid: true, conflicts: [], validStartDate: startDate };
    const days = Math.max(1, dateDiff(startDate, endDate) + 1);
    const validStartDate = nextAvailableOrderStart(customerId, startDate, days, ignoreOrderId);
    return {
      valid: false,
      conflicts,
      validStartDate,
      validEndDate: addDays(validStartDate, days - 1),
    };
  }

  function nextAvailableOrderStart(customerId, requestedStart, durationDays, ignoreOrderId = "") {
    let candidate = requestedStart;
    const orders = state.orders
      .filter((order) => order.customerId === customerId && order.status !== "已取消" && order.id !== ignoreOrderId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    orders.forEach((order) => {
      const candidateEnd = addDays(candidate, durationDays - 1);
      if (rangesOverlap(candidate, candidateEnd, order.startDate, order.endDate)) {
        candidate = addDays(order.endDate, 1);
      }
    });
    return candidate;
  }

  function rangesOverlap(startA, endA, startB, endB) {
    return startA <= endB && startB <= endA;
  }

  function orderOverlapMessage(result, serviceType) {
    const conflictText = result.conflicts
      .map((order) => `${order.orderNo || makeOrderNo(order.startDate, order.id)}（${order.startDate} 至 ${order.endDate}）`)
      .join("、");
    return `该客户已有订单与当前日期重叠：${conflictText}。请选择不重叠的服务周期。当前服务类型最早可创建的开始日期是 ${result.validStartDate}，预计结束日期 ${result.validEndDate}。`;
  }

  function rebuildAllCustomerOrderSchedules() {
    state.customers.forEach((customer) => rebuildCustomerOrderSchedule(customer.id));
  }

  function rebuildCustomerOrderSchedule(customerId) {
    const orders = state.orders
      .filter((order) => order.customerId === customerId && order.status !== "已取消")
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
    orders.forEach((order, index) => {
      const durationDays = orderDurationDays(order);
      if (index > 0) {
        const previous = orders[index - 1];
        if (dateDiff(order.startDate, previous.endDate) >= 0) {
          order.startDate = addDays(previous.endDate, 1);
        }
      }
      order.endDate = addDays(order.startDate, durationDays - 1);
    });
  }

  function orderDurationDays(order) {
    const typeDays = SERVICE_TYPES[order?.serviceType]?.days;
    const baseDays = typeDays || Math.max(1, dateDiff(order.startDate, order.endDate) + 1);
    return baseDays + orderExtensionDays(order);
  }

  function orderExtensionDays(order) {
    if (!order) return 0;
    return state.dailyOut.filter((row) => row.extensionOrderId === order.id && row.paused && shouldExtendPause(row.pausePolicy)).length;
  }

  function shouldExtendPause(policy) {
    return ["retain", "provider_makeup"].includes(policy || "retain");
  }

  function customerServiceInfo(customerId, date) {
    const orders = state.orders
      .filter((order) => order.customerId === customerId && order.status !== "已取消")
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    const active = orders.find((order) => {
      const status = effectiveOrderStatus(order, date);
      return status === "服务中" || status === "即将结束";
    });
    if (active) {
      const remaining = remainingDays(active, date);
      return {
        status: remaining <= 3 ? "即将结束" : "服务中",
        serviceLabel: SERVICE_TYPES[active.serviceType]?.label || "",
        remainingDays: remaining,
        order: active,
      };
    }
    const future = orders.find((order) => dateDiff(date, order.startDate) > 0 && order.status !== "已结束");
    if (future) {
      return { status: "未开始", serviceLabel: SERVICE_TYPES[future.serviceType]?.label || "", remainingDays: dateDiff(date, future.startDate), order: future };
    }
    return { status: orders.length ? "已结束" : "未开始", serviceLabel: orders[0] ? SERVICE_TYPES[orders[0].serviceType]?.label : "无服务", remainingDays: 0, order: orders[0] };
  }

  function effectiveOrderStatus(order, date) {
    if (order.status === "已取消") return "已取消";
    if (order.status === "已结束") return "已结束";
    if (dateDiff(date, order.startDate) > 0) return "未开始";
    if (dateDiff(order.endDate, date) > 0) return "已结束";
    const remaining = remainingDays(order, date);
    if (remaining <= 3) return "即将结束";
    return "服务中";
  }

  function remainingDays(order, date) {
    if (!order || order.status === "已取消") return 0;
    return Math.max(0, dateDiff(date, order.endDate) + 1);
  }

  function serviceMealCredits(order) {
    const type = SERVICE_TYPES[order?.serviceType];
    return Number(order?.totalMealCredits || ((type?.days || 0) * 2));
  }

  function orderUnitMealPrice(order) {
    const total = serviceMealCredits(order);
    return total ? Math.round((Number(order.price || 0) / total) * 10) / 10 : 0;
  }

  function pausePolicyText(policy) {
    return PAUSE_POLICIES[policy]?.label || PAUSE_POLICIES.retain.label;
  }

  function pausePolicyOptions() {
    return Object.entries(PAUSE_POLICIES).map(([value, config]) => ({
      value,
      label: value === "refund" ? `${config.label}，退款 ${money(REFUND_MEAL_AMOUNT)}` : config.label,
    }));
  }

  function mealCreditInfo(order, date = todayKey()) {
    if (!order) {
      return { total: 0, consumed: 0, remaining: 0, makeup: 0, refundCredits: 0, refundAmount: 0, unitPrice: 0 };
    }
    const total = serviceMealCredits(order);
    const serviceDays = Math.max(0, dateDiff(order.startDate, order.endDate) + 1);
    const elapsedDaysBefore = Math.max(0, Math.min(serviceDays, dateDiff(order.startDate, date)));
    const serviceRows = state.dailyOut.filter((row) => row.customerId === order.customerId && inDateRange(row.date, order.startDate, order.endDate));
    const rowsBeforeDate = serviceRows.filter((row) => dateDiff(row.date, date) > 0);
    const rowsToday = serviceRows.filter((row) => row.date === date);
    const nonConsumedPause = (row) => row.paused && row.pausePolicy !== "consume";
    const pausedBeforeNonConsumed = rowsBeforeDate.filter(nonConsumedPause).length;
    const activeToday = rowsToday.filter((row) => !row.paused).length;
    const consumedPausedToday = rowsToday.filter((row) => row.paused && row.pausePolicy === "consume").length;
    const consumed = Math.max(0, Math.min(total, (elapsedDaysBefore * 2) - pausedBeforeNonConsumed + activeToday + consumedPausedToday));
    const rowsUntilDate = serviceRows.filter((row) => dateDiff(row.date, date) >= 0);
    const makeup = rowsUntilDate.filter((row) => row.paused && ["retain", "provider_makeup"].includes(row.pausePolicy || "retain")).length;
    const refundCredits = rowsUntilDate.filter((row) => row.paused && row.pausePolicy === "refund").length;
    const unitPrice = orderUnitMealPrice(order);
    return {
      total,
      consumed,
      remaining: Math.max(0, total - consumed - refundCredits),
      makeup,
      refundCredits,
      refundAmount: REFUND_MEAL_AMOUNT * refundCredits,
      unitPrice,
    };
  }

  function serviceCreditSummary(date = todayKey()) {
    return state.orders
      .filter((order) => order.status !== "已取消")
      .map((order) => mealCreditInfo(order, date))
      .reduce((sum, info) => ({
        makeup: sum.makeup + info.makeup,
        refundCredits: sum.refundCredits + info.refundCredits,
        remaining: sum.remaining + info.remaining,
      }), { makeup: 0, refundCredits: 0, remaining: 0 });
  }

  function clearLogisticsForRow(row) {
    state.labels = state.labels.filter((item) => !(item.date === row.date && item.meal === row.meal && item.customerId === row.customerId));
    state.deliveries = state.deliveries.filter((item) => !(item.date === row.date && item.meal === row.meal && item.customerId === row.customerId));
  }

  function calculateCustomerPlan(customer, date, meal) {
    const weight = Number(latestWeight(customer));
    const bmrRaw = customer.gender === "男"
      ? 10 * weight + 6.25 * customer.height - 5 * customer.age + 5
      : 10 * weight + 6.25 * customer.height - 5 * customer.age - 161;
    const bmr = Math.round(bmrRaw);
    const tdee = bmr * (ACTIVITY_FACTORS[customer.activity] || 1.375);
    const dailyBase = Math.round(Math.max(customer.gender === "男" ? 1300 : 1050, tdee - (PACE_DEFICIT[customer.pace] || 450)));
    const mealBudget = Math.max(700, dailyBase - 400);
    const lunchAdjustment = mealAdjustment(customer.id, date, "lunch");
    const dinnerAdjustment = mealAdjustment(customer.id, date, "dinner");
    const lunchWeight = 0.55 * lunchAdjustment.multiplier;
    const dinnerWeight = 0.45 * dinnerAdjustment.multiplier;
    const lunchKcal = Math.round(mealBudget * lunchWeight / (lunchWeight + dinnerWeight));
    const dinnerKcal = mealBudget - lunchKcal;
    const output = {
      bmr,
      dailyKcal: dailyBase,
      lunch: { kcal: lunchKcal, grams: Math.round(lunchKcal / 1.35) },
      dinner: { kcal: dinnerKcal, grams: Math.round(dinnerKcal / 1.35) },
      adjustmentText: meal === "dinner" ? dinnerAdjustment.text : meal === "lunch" ? lunchAdjustment.text : `早餐预留 400kcal；${lunchAdjustment.text} / ${dinnerAdjustment.text}`,
    };
    if (meal === "lunch") return { kcal: lunchKcal, grams: output.lunch.grams, adjustmentText: lunchAdjustment.text };
    if (meal === "dinner") return { kcal: dinnerKcal, grams: output.dinner.grams, adjustmentText: dinnerAdjustment.text };
    return output;
  }

  function mealAdjustment(customerId, date, meal) {
    const fb = state.feedbacks.find((item) => item.customerId === customerId && item.date === addDays(date, -1));
    if (!fb) return { multiplier: 1, text: "无昨日反馈，按基础建议" };
    if (fb.satiety === "偏饿") return { multiplier: 1.06, text: "昨日偏饿，建议适当增加克重" };
    if (fb.satiety === "偏撑") return { multiplier: 0.94, text: "昨日偏撑，建议适当减少克重" };
    if (meal === "lunch" && fb.lunchFinished === "否") return { multiplier: 0.94, text: "昨日午餐未吃完，午餐减量" };
    if (meal === "dinner" && fb.dinnerFinished === "否") return { multiplier: 0.94, text: "昨日晚餐未吃完，晚餐减量" };
    return { multiplier: 1, text: "昨日反馈刚好，维持克重" };
  }

  function feedbackSuggestion(fb) {
    if (fb.satiety === "偏饿") return "第二天建议适当增加克重";
    if (fb.satiety === "偏撑") return "第二天建议适当减少克重";
    if (fb.lunchFinished === "否" || fb.dinnerFinished === "否") return "未吃完餐次建议减量";
    return "维持当前克重";
  }

  function checkRecipe(recipe) {
    if (!recipe) return [{ level: "danger", text: "未生成食谱" }];
    const checks = [];
    const ingredients = recipeIngredients(recipe);
    checks.push(ingredients.length > 12 ? { level: "pass", text: `总食材种类 ${ingredients.length} 种，已超过 12 种` } : { level: "warning", text: `总食材种类 ${ingredients.length} 种，未超过 12 种` });
    ["lunch", "dinner"].forEach((meal) => {
      const dishes = CATEGORIES.map((category) => getDish(recipe.meals[meal].categories[category])).filter(Boolean);
      const garlicCount = dishes.filter((dishItem) => dishItem.garlic).length;
      checks.push(garlicCount <= 1 ? { level: "pass", text: `${MEALS[meal]}蒜味菜 ${garlicCount} 个` } : { level: "danger", text: `${MEALS[meal]}蒜味为主菜品超过 1 个` });
      const missingSource = dishes.filter((dishItem) => !dishItem.source || !dishItem.kcal100);
      checks.push(missingSource.length ? { level: "warning", text: `${MEALS[meal]}有菜品缺少热量或出处` } : { level: "pass", text: `${MEALS[meal]}菜品热量和出处完整` });
      const unavailable = dishes.filter((dishItem) => !dishItem.available);
      if (unavailable.length) checks.push({ level: "warning", text: `${MEALS[meal]}包含今日不可用菜品：${unavailable.map((d) => d.name).join("、")}` });
      const mealIngredients = new Set(dishes.flatMap((dishItem) => dishItem.ingredients));
      dishes.forEach((dishItem) => {
        const conflicts = dishItem.conflicts?.filter((item) => mealIngredients.has(item)) || [];
        if (conflicts.length) checks.push({ level: "warning", text: `${MEALS[meal]} ${dishItem.name} 与 ${conflicts.join("、")} 不适合搭配` });
      });
    });
    const conflictDetails = customerRecipeConflicts(recipe);
    checks.push(conflictDetails.length ? { level: "danger", text: `发现 ${conflictDetails.length} 个客户忌口/过敏冲突：${conflictDetails.slice(0, 6).map((item) => `${item.customerName}-${MEALS[item.meal]}-${item.dishName}(${item.terms.join("、")})`).join("；")}${conflictDetails.length > 6 ? "；..." : ""}，请单独替换` } : { level: "pass", text: "未发现客户忌口或过敏冲突" });
    return checks;
  }

  function customerConflictsDish(customer, dishItem) {
    if (!customer || !dishItem) return false;
    const avoid = [...(customer.restrictions || []), ...(customer.allergies || [])].filter(Boolean);
    return avoid.some((item) => dishItem.ingredients.some((ingredient) => ingredient.includes(item) || item.includes(ingredient)) || dishItem.name.includes(item));
  }

  function customerRecipeConflicts(recipe) {
    const conflicts = [];
    getActiveCustomers(recipe.date).forEach((customer) => {
      ["lunch", "dinner"].forEach((meal) => {
        effectiveMealDishesForCustomer(recipe, customer, meal).forEach((dishItem) => {
          if (!dishItem) return;
          const terms = conflictingTerms(customer, dishItem);
          if (terms.length) {
            conflicts.push({
              customerId: customer.id,
              customerName: customer.name,
              meal,
              dishId: dishItem.id,
              dishName: dishItem.name,
              terms,
            });
          }
        });
      });
    });
    return conflicts;
  }

  function effectiveMealDishesForCustomer(recipe, customer, meal) {
    const replacements = recipe.replacements?.filter((item) => item.customerId === customer.id && item.meal === meal && item.confirmed) || [];
    return CATEGORIES.map((category) => {
      const original = getDish(recipe.meals[meal]?.categories?.[category]);
      if (!original) return null;
      const replacement = replacements.find((item) => item.oldDishId === original.id);
      return replacement ? getDish(replacement.newDishId) || original : original;
    }).filter(Boolean);
  }

  function conflictingTerms(customer, dishItem) {
    if (!customer || !dishItem) return [];
    const avoid = [...(customer.restrictions || []), ...(customer.allergies || [])].filter(Boolean);
    return avoid.filter((item) => dishItem.ingredients.some((ingredient) => ingredient.includes(item) || item.includes(ingredient)) || dishItem.name.includes(item));
  }

  function recipeIngredients(recipe) {
    return [...new Set(recipeDishIds(recipe).flatMap((id) => getDish(id)?.ingredients || []))];
  }

  function recipeDishIds(recipe) {
    if (!recipe) return [];
    return ["lunch", "dinner"].flatMap((meal) => CATEGORIES.map((category) => recipe.meals[meal]?.categories?.[category]).filter(Boolean));
  }

  function recipeNoticeText(recipe) {
    if (!recipe) return "当天还没有生成食谱。";
    const lines = [`${formatCnDate(recipe.date)} 餐品通知`, ""];
    ["lunch", "dinner"].forEach((meal) => {
      lines.push(`${MEALS[meal]}：`);
      CATEGORIES.forEach((category) => {
        const dishItem = getDish(recipe.meals[meal].categories[category]);
        if (dishItem) lines.push(`- ${category}：${dishItem.name}`);
      });
      lines.push("");
    });
    lines.push("如有临时忌口、过敏或配送变动，请提前告知。");
    return lines.join("\n");
  }

  function mealOutSummary(rows) {
    const activeRows = rows.filter((row) => !row.paused);
    const dishTotals = {};
    const categoryTotals = { 荤: 0, 海鲜: 0, 素: 0, 主食: 0 };
    activeRows.forEach((row) => {
      row.items.forEach((item) => {
        const dishItem = getDish(item.dishId);
        if (!dishItem) return;
        dishTotals[dishItem.name] = (dishTotals[dishItem.name] || 0) + Number(item.grams);
        categoryTotals[dishItem.category] = (categoryTotals[dishItem.category] || 0) + Number(item.grams);
      });
    });
    return {
      portions: activeRows.length,
      specialCount: activeRows.filter((row) => row.needsReplacement || row.replaced).length,
      dishTotals,
      categoryTotals,
    };
  }

  function rowTotals(row) {
    let grams = 0;
    let kcal = 0;
    row.items.forEach((item) => {
      const dishItem = getDish(item.dishId);
      grams += Number(item.grams || 0);
      kcal += dishItem ? (Number(item.grams || 0) * dishItem.kcal100) / 100 : 0;
    });
    return { grams: Math.round(grams), kcal: Math.round(kcal) };
  }

  function dishTotalsTable(totals) {
    const entries = Object.entries(totals);
    if (!entries.length) return empty("暂无汇总。");
    const rows = entries.map(([name, grams]) => `<tr><td>${escapeHtml(name)}</td><td>${Math.round(grams)}g</td></tr>`).join("");
    return table(["菜品", "总克重"], rows);
  }

  function mealOutText(date, meal) {
    const allRows = state.dailyOut.filter((row) => row.date === date && row.meal === meal);
    const rows = allRows.filter((row) => !row.paused);
    const pausedRows = allRows.filter((row) => row.paused);
    if (!allRows.length) return `${date} ${MEALS[meal]}暂无出餐表。`;
    const lines = [`${date} ${MEALS[meal]}出餐清单`, ""];
    rows.forEach((row, index) => {
      const customer = getCustomer(row.customerId);
      const totals = rowTotals(row);
      lines.push(`${index + 1}. ${customer?.name || ""} ${row.replaced ? "【已替换】" : row.needsReplacement ? "【需替换】" : ""}`);
      row.items.forEach((item) => lines.push(`   ${getDish(item.dishId)?.name || ""} ${item.grams}g`));
      lines.push(`   合计 ${totals.grams}g / ${totals.kcal} kcal`);
      if (customer?.restrictions?.length || customer?.allergies?.length) lines.push(`   忌口/过敏：${[...customer.restrictions, ...customer.allergies].join("、")}`);
    });
    if (pausedRows.length) {
      lines.push("");
      lines.push("暂停不出餐：");
      pausedRows.forEach((row) => {
        const customer = getCustomer(row.customerId);
        lines.push(`- ${customer?.name || ""}：${pausePolicyText(row.pausePolicy)}${row.pauseReason ? `；${row.pauseReason}` : ""}`);
      });
    }
    return lines.join("\n");
  }

  function deliveryText(date, meal) {
    const deliveries = state.deliveries.filter((item) => item.date === date && item.meal === meal);
    if (!deliveries.length) return `${date} ${MEALS[meal]}暂无配送清单。`;
    return [`${date} ${MEALS[meal]}配送清单`, ""]
      .concat(deliveries.map((item, index) => `${index + 1}. ${item.customerName}｜${item.phone}｜${item.address}\n   餐品：${item.content}\n   备注：${item.note || "无"}`))
      .join("\n");
  }

  function labelAlert(customer, row) {
    const tags = [...(customer?.restrictions || []), ...(customer?.allergies || [])];
    const status = row.replaced ? "已做单独替换" : row.needsReplacement ? "需核对替换" : "无";
    return `${tags.length ? tags.join("、") : "无"}；${status}`;
  }

  function labelManagement(customer, row, totals, macros) {
    const feedback = state.feedbacks.find((item) => item.customerId === row.customerId && item.date === addDays(row.date, -1));
    if (row.note?.includes("偏撑") || feedback?.satiety === "偏撑") return "控克重减负担；观察舒适度";
    if (row.note?.includes("未吃完") || (feedback?.lunchFinished === "否" && row.meal === "lunch") || (feedback?.dinnerFinished === "否" && row.meal === "dinner")) return "轻量控负担；观察是否吃完";
    if (row.note?.includes("偏饿") || feedback?.satiety === "偏饿") return "提高饱腹感；主食适度加量";
    if (row.meal === "dinner" && ["中等运动", "高运动"].includes(customer?.activity)) return "训练日高蛋白；晚间稳饱腹";
    if (Number(macros.protein || 0) >= 40) return "高蛋白搭配；主食稳饱腹";
    if (Number(totals.grams || 0) <= 390) return "轻量控热量；观察饱腹感";
    return "高蛋白搭配；稳定饱腹";
  }

  function labelObserve(customer, row) {
    const feedback = state.feedbacks.find((item) => item.customerId === row.customerId && item.date === addDays(row.date, -1));
    if (row.meal === "dinner" && ["中等运动", "高运动"].includes(customer?.activity)) return "训练后饿感/是否吃完";
    if (feedback?.satiety === "偏撑") return "是否吃完/胃口负担";
    if (feedback?.satiety === "偏饿") return "3小时饿感/饱腹变化";
    return "饱腹感/是否吃完/3小时饿感";
  }

  function continuousFeedback(customer) {
    const rows = state.feedbacks
      .filter((fb) => fb.customerId === customer.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
    if (!rows.length) return empty("暂无连续反馈。");
    return `<div class="grid">
      ${rows.map((fb) => `<div class="notice ${fb.satiety === "偏饿" || fb.satiety === "偏撑" ? "warning" : "pass"}">
        <span>${fb.date}</span>
        <div>${satietyBadge(fb.satiety)} 体重 ${fb.weight || "-"}kg · 午餐${fb.lunchFinished} / 晚餐${fb.dinnerFinished}<br><span class="muted">${escapeHtml(fb.adminNote || fb.bodyNote || "")}</span></div>
      </div>`).join("")}
    </div>`;
  }

  function posterStats(customer, order) {
    const serviceDays = dateDiff(order.startDate, order.endDate) + 1;
    const feedbacks = state.feedbacks.filter((fb) => fb.customerId === customer.id && inDateRange(fb.date, order.startDate, order.endDate));
    const sortedFeedbacks = [...feedbacks].sort((a, b) => a.date.localeCompare(b.date));
    const weights = (customer.weightRecords || []).filter((item) => inDateRange(item.date, order.startDate, order.endDate)).sort((a, b) => a.date.localeCompare(b.date));
    const startWeight = Number(weights[0]?.weight || customer.currentWeight || 0);
    const endWeight = Number(weights[weights.length - 1]?.weight || sortedFeedbacks.at(-1)?.weight || customer.currentWeight || 0);
    const checkinDays = uniqueCount(feedbacks, "date");
    const satietyCounts = {
      偏饿: feedbacks.filter((fb) => fb.satiety === "偏饿").length,
      刚好: feedbacks.filter((fb) => fb.satiety === "刚好").length,
      偏撑: feedbacks.filter((fb) => fb.satiety === "偏撑").length,
    };
    const lunchUnfinished = feedbacks.filter((fb) => fb.lunchFinished === "否").length;
    const dinnerUnfinished = feedbacks.filter((fb) => fb.dinnerFinished === "否").length;
    const unfinishedMeals = lunchUnfinished + dinnerUnfinished;
    const dislikeDishes = [...new Set(feedbacks.map((fb) => fb.dislikeDish).filter(Boolean))];
    const finishRate = feedbacks.length ? Math.round(((feedbacks.length * 2 - unfinishedMeals) / (feedbacks.length * 2)) * 100) : 0;
    return {
      startWeight: round1(startWeight),
      endWeight: round1(endWeight),
      loss: round1(Math.max(0, startWeight - endWeight)),
      serviceDays,
      checkinDays,
      persistence: Math.min(100, Math.round((checkinDays / serviceDays) * 100)),
      feedbackCount: feedbacks.length,
      satietyCounts,
      unfinishedMeals,
      lunchUnfinished,
      dinnerUnfinished,
      dislikeDishes,
      finishRate,
      repurchase: state.orders.filter((item) => item.customerId === customer.id && item.status !== "已取消").length > 1 || order.isRepurchase,
    };
  }

  function defaultPosterSummary(customer, stats) {
    if (!customer || !stats) return "";
    const name = customer.nickname || customer.name;
    const lossPart = stats.loss > 0
      ? `你这期从 ${stats.startWeight}kg 到 ${stats.endWeight}kg，累计减重 ${stats.loss}kg，这个变化来自你一餐一餐的配合`
      : `你这期体重基本稳定在 ${stats.endWeight}kg，虽然数字没有明显下降，但先把吃饭节奏稳住也是有价值的一步`;
    const checkinPart = `服务 ${stats.serviceDays} 天里，你记录了 ${stats.checkinDays} 天反馈，坚持率 ${stats.persistence}%`;
    const executionPart = stats.feedbackCount
      ? stats.unfinishedMeals
        ? `中间有 ${stats.unfinishedMeals} 次餐次没有完全吃完，这不算失败，只说明克重和口味还要继续调到更适合你`
        : `你午晚餐完成得很稳，饮食完成率 ${stats.finishRate}%，这套节奏对你是可执行的`
      : `这期反馈记录还不够连续，下一阶段我们可以把体重、饱腹感和不喜欢的菜记得更细一点`;
    const satietyPart = stats.satietyCounts.偏饿 > stats.satietyCounts.偏撑 && stats.satietyCounts.偏饿 > 0
      ? `下一阶段我会优先帮你校准主食和蛋白克重，让减脂不是靠硬扛`
      : stats.satietyCounts.偏撑 > 0
        ? `后面我们会继续照顾舒适度，不把餐盒做成负担`
        : `目前这个节奏比较适合你继续坚持`;
    const preferencePart = stats.dislikeDishes.length ? `你提到不喜欢 ${stats.dislikeDishes.slice(0, 2).join("、")}，我会帮你避开。` : "";
    return `${name}，想认真跟你说：${lossPart}。${checkinPart}，${executionPart}。${satietyPart}。${preferencePart}`;
  }

  function orderMini(order) {
    const credits = mealCreditInfo(order, todayKey());
    return `<div class="notice mt-12">
      <span>${statusBadge(effectiveOrderStatus(order, todayKey()))}</span>
      <div>${escapeHtml(order.orderNo || makeOrderNo(order.startDate, order.id))} · ${SERVICE_TYPES[order.serviceType]?.label || ""} · ${order.startDate} 至 ${order.endDate}<br><span class="muted">剩余 ${remainingDays(order, todayKey())} 天 / ${credits.remaining} 餐${credits.makeup ? `，待补 ${credits.makeup} 餐` : ""} · ${escapeHtml(order.notes || "")}</span></div>
    </div>`;
  }

  function feedbackMini(fb) {
    return `<div class="notice ${fb.satiety === "刚好" ? "pass" : "warning"} mt-12">
      <span>${fb.date}</span>
      <div>${satietyBadge(fb.satiety)} · 午餐${fb.lunchFinished} / 晚餐${fb.dinnerFinished}<br><span class="muted">${escapeHtml(feedbackSuggestion(fb))}</span></div>
    </div>`;
  }

  function weightTimeline(customer, start, end) {
    const records = (customer?.weightRecords || []).filter((item) => inDateRange(item.date, start, end)).sort((a, b) => a.date.localeCompare(b.date));
    if (!records.length) return '<div class="muted">暂无体重记录。</div>';
    return records.map((item) => `<div class="notice mt-12"><span>${item.date}</span><div>${item.weight} kg</div></div>`).join("");
  }

  function openPosterFromOrder(orderId) {
    const order = getOrder(orderId);
    if (!order) return;
    view.posterCustomerId = order.customerId;
    view.posterOrderId = order.id;
    view.posterDraft = "";
    location.hash = "posters";
  }

  function getRecipe(date) {
    return state.recipes.find((recipe) => recipe.date === date);
  }

  function getCustomer(id) {
    return state.customers.find((item) => item.id === id);
  }

  function getOrder(id) {
    return state.orders.find((item) => item.id === id);
  }

  function getDish(id) {
    return state.dishes.find((item) => item.id === id);
  }

  function table(headers, rows) {
    return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function empty(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function detail(label, value, full = false) {
    return `<div class="detail-item${full ? " full" : ""}"><span>${escapeHtml(label)}</span><strong>${value || "未填写"}</strong></div>`;
  }

  function noticeLine(item) {
    const label = item.level === "danger" ? "冲突" : item.level === "warning" ? "警告" : "通过";
    return `<div class="notice ${item.level}"><span>${label}</span><div>${escapeHtml(item.text)}</div></div>`;
  }

  function btn(icon, label, action, cls = "", attrs = "") {
    return `<button class="btn ${cls}" data-action="${action}" ${attrs}><span class="btn-icon">${icon}</span>${label}</button>`;
  }

  function badge(text, color = "gray") {
    return `<span class="badge ${color}">${escapeHtml(text)}</span>`;
  }

  function statusBadge(status) {
    const color = status === "服务中" ? "green" : status === "即将结束" ? "amber" : status === "已结束" ? "gray" : status === "已取消" ? "red" : "blue";
    return badge(status || "未知", color);
  }

  function satietyBadge(status) {
    const color = status === "偏饿" ? "amber" : status === "偏撑" ? "red" : "green";
    return badge(status, color);
  }

  function tagRow(items, color = "gray") {
    const clean = (items || []).filter(Boolean);
    if (!clean.length) return badge("无", "gray");
    return `<div class="tag-row">${clean.map((item) => `<span class="tag ${color}">${escapeHtml(item)}</span>`).join("")}</div>`;
  }

  function categoryColor(category) {
    return { 荤: "red", 海鲜: "blue", 素: "green", 主食: "amber" }[category] || "gray";
  }

  function listText(list) {
    return list?.length ? escapeHtml(list.join("、")) : "无";
  }

  function field(name, label, type, required = false, optionsList = null, span = "") {
    return { name, label, type, required, options: optionsList, span };
  }

  function formField(config, value) {
    const full = config.span === "full" || config.type === "textarea" ? " full" : "";
    const required = config.required ? "required" : "";
    const safeValue = value ?? "";
    let control = "";
    if (config.type === "select") {
      control = comboControl({
        name: config.name,
        options: config.options || [],
        value: safeValue,
        required: config.required,
        placeholder: `输入${config.label}搜索`,
      });
    } else if (config.type === "textarea") {
      control = `<textarea name="${config.name}" ${required}>${escapeHtml(safeValue)}</textarea>`;
    } else if (config.type === "checkbox") {
      control = `<label class="checkbox-line"><input type="checkbox" name="${config.name}" ${safeValue ? "checked" : ""} /> 是</label>`;
    } else {
      const step = config.type === "number" ? 'step="0.1"' : "";
      control = `<input type="${config.type}" name="${config.name}" value="${escapeAttr(safeValue)}" ${required} ${step} />`;
    }
    return `<div class="form-field${full}"><label>${escapeHtml(config.label)}</label>${control}</div>`;
  }

  function actionCombo(action, optionsList, value, attrs = {}, placeholder = "输入文字搜索") {
    return comboControl({
      action,
      options: optionsList,
      value,
      required: true,
      attrs,
      placeholder,
    });
  }

  function comboControl(config) {
    const listId = `comboList_${++comboIdSeed}`;
    const inputId = `comboInput_${comboIdSeed}`;
    const fieldName = config.name || "";
    const items = normalizeOptionItems(config.options || []);
    const selected = items.find((item) => String(item.value) === String(config.value));
    const inputValue = selected ? selected.label : "";
    const comboAction = config.action ? `data-combo-action="${escapeAttr(config.action)}"` : "";
    const required = config.required ? "required" : "";
    const attrs = Object.entries(config.attrs || {})
      .map(([key, val]) => `data-${escapeAttr(key)}="${escapeAttr(val)}"`)
      .join(" ");
    const hidden = fieldName
      ? `<input type="hidden" name="${escapeAttr(fieldName)}" value="${escapeAttr(selected ? selected.value : config.value ?? "")}" data-combo-hidden="${inputId}" />`
      : "";
    return `<div class="combo-select">
      <input id="${inputId}" class="combo-input" type="search" list="${listId}" value="${escapeAttr(inputValue)}" placeholder="${escapeAttr(config.placeholder || "输入文字搜索")}" autocomplete="off" data-action="combo-input" data-combo-list="${listId}" data-combo-value="${escapeAttr(selected ? selected.value : config.value ?? "")}" data-combo-required="${config.required ? "1" : ""}" ${comboAction} ${attrs} ${required} />
      ${hidden}
      <datalist id="${listId}">
        ${items.map((item) => `<option value="${escapeAttr(item.label)}" data-option-value="${escapeAttr(item.value)}"></option>`).join("")}
      </datalist>
    </div>`;
  }

  function normalizeOptionItems(items) {
    return (items || []).map((item) => ({
      value: typeof item === "object" ? item.value : item,
      label: String(typeof item === "object" ? item.label : item),
    }));
  }

  function customerComboOptions() {
    return state.customers.map((customer) => ({
      value: customer.id,
      label: `${customer.name} · ${customer.phone || customer.nickname || ""}`,
    }));
  }

  function syncFormCombos(form) {
    let ok = true;
    form.querySelectorAll('[data-action="combo-input"]').forEach((input) => {
      syncComboInput(input, { commitPartial: true, rewrite: true });
      if (!input.checkValidity()) ok = false;
    });
    if (!ok) form.reportValidity();
    return ok;
  }

  function syncComboInput(input, optionsConfig = {}) {
    const { commitPartial = false, rewrite = false } = optionsConfig;
    const query = normalizeSearch(input.value);
    const list = document.getElementById(input.dataset.comboList);
    const optionsList = Array.from(list?.options || []).map((option) => ({
      value: option.dataset.optionValue ?? option.value,
      label: option.value,
    }));
    const exact = optionsList.find((item) => normalizeSearch(item.label) === query);
    const partial = commitPartial && query
      ? optionsList.find((item) => normalizeSearch(item.label).includes(query) || normalizeSearch(item.value).includes(query))
      : null;
    const match = exact || partial;
    if (!query && input.dataset.comboRequired !== "1") {
      setComboValue(input, "");
      input.setCustomValidity("");
      return "";
    }
    if (match) {
      if (rewrite) input.value = match.label;
      setComboValue(input, match.value);
      input.setCustomValidity("");
      return match.value;
    }
    setComboValue(input, "");
    input.setCustomValidity(input.dataset.comboRequired === "1" ? "请从列表中选择一项。" : "");
    return "";
  }

  function setComboValue(input, value) {
    input.dataset.comboValue = value;
    const hidden = input.closest(".combo-select")?.querySelector(`input[type="hidden"][data-combo-hidden="${input.id}"]`);
    if (hidden) hidden.value = value;
  }

  function handleComboAction(action, value, target) {
    if (action === "set-filter") {
      view.filters[target.dataset.page][target.dataset.key] = value;
      render();
      return;
    }
    if (action === "daily-meal-status") {
      getDailyMealFilter(target.dataset.meal).status = value || "全部";
      render();
      return;
    }
    if (action === "recipe-dish-change") {
      const recipe = getRecipe(view.date);
      if (!recipe) return;
      recipe.meals[target.dataset.meal].categories[target.dataset.category] = value;
      saveState();
      toast("食谱已更新，出餐表可按需重新生成。");
      render();
      return;
    }
    if (action === "select-feedback-customer") {
      view.selectedFeedbackCustomerId = value;
      render();
      return;
    }
    if (action === "select-poster-customer") {
      view.posterCustomerId = value;
      view.posterOrderId = "";
      view.posterDraft = "";
      render();
      return;
    }
    if (action === "select-poster-order") {
      view.posterOrderId = value;
      view.posterDraft = "";
      render();
    }
  }

  function options(items, selected) {
    return (items || [])
      .map((item) => {
        const value = typeof item === "object" ? item.value : item;
        const label = typeof item === "object" ? item.label : item;
        return `<option value="${escapeAttr(value)}" ${String(value) === String(selected) ? "selected" : ""}>${escapeHtml(label)}</option>`;
      })
      .join("");
  }

  function collectForm(form) {
    const data = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      if (el.type === "checkbox") data[el.name] = el.checked;
      else data[el.name] = el.value;
    });
    return data;
  }

  function openModal(title, body, footer) {
    const root = document.getElementById("modalRoot");
    root.classList.add("open");
    root.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
      <div class="modal-header"><h2>${escapeHtml(title)}</h2>${btn("×", "关闭", "modal-close", "small ghost")}</div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">${footer}</div>
    </div>`;
  }

  function closeModal() {
    const root = document.getElementById("modalRoot");
    root.classList.remove("open");
    root.innerHTML = "";
    currentFormSubmit = null;
  }

  function confirmAction(message, onConfirm) {
    pendingConfirm = onConfirm;
    openModal("确认操作", `<div class="notice warning"><span>确认</span><div>${escapeHtml(message)}</div></div>`, `${btn("取", "取消", "modal-close")}${btn("确", "确认", "confirm-ok", "primary")}`);
  }

  function showMessage(title, message, level = "warning") {
    openModal(title, `<div class="notice ${level}"><span>提示</span><div>${escapeHtml(message)}</div></div>`, `${btn("知", "知道了", "modal-close", "primary")}`);
  }

  function toast(message) {
    const root = document.getElementById("toastRoot");
    const item = document.createElement("div");
    item.className = "toast";
    item.textContent = message;
    root.appendChild(item);
    window.setTimeout(() => item.remove(), 2600);
  }

  function copyText(text) {
    const value = text || "";
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).then(() => toast("文字已复制。")).catch(() => fallbackCopy(value));
    } else {
      fallbackCopy(value);
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    toast("文字已复制。");
  }

  function cacheCopy(text) {
    const id = uid("copy");
    copyCache[id] = text;
    return id;
  }

  function upsert(list, record) {
    const index = list.findIndex((item) => item.id === record.id);
    if (index >= 0) list[index] = record;
    else list.push(record);
  }

  function parseList(value) {
    return String(value || "")
      .split(/[，,、\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeSearch(value) {
    return String(value || "").trim().toLowerCase();
  }

  function latestWeight(customer) {
    const records = [...(customer?.weightRecords || [])].sort((a, b) => b.date.localeCompare(a.date));
    return round1(records[0]?.weight || customer?.currentWeight || 0);
  }

  function money(value) {
    return `¥${Number(value || 0).toLocaleString("zh-CN")}`;
  }

  function uniqueCount(list, key) {
    return new Set(list.map((item) => item[key])).size;
  }

  function inDateRange(date, start, end) {
    return date >= start && date <= end;
  }

  function todayKey() {
    return dateToKey(new Date());
  }

  function dateToKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function addDays(value, amount) {
    const date = parseDate(value);
    date.setDate(date.getDate() + amount);
    return dateToKey(date);
  }

  function dateDiff(start, end) {
    return Math.round((parseDate(end) - parseDate(start)) / 86400000);
  }

  function formatCnDate(value) {
    const date = parseDate(value);
    const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${week}`;
  }

  function calendarWeekLabel(value) {
    const date = parseDate(value);
    if (value === todayKey()) return "今天";
    return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  }

  function monthDayLabel(value) {
    const date = parseDate(value);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function makeOrderNo(startDate, seed = "") {
    const compactDate = String(startDate || todayKey()).replace(/-/g, "");
    const suffixSource = String(seed || uid("ord"));
    const suffix = suffixSource.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase().padStart(4, "0");
    return `SO${compactDate}${suffix}`;
  }

  function nextOrderNo(startDate) {
    const compactDate = String(startDate || todayKey()).replace(/-/g, "");
    const count = state.orders.filter((order) => String(order.orderNo || "").startsWith(`SO${compactDate}`)).length + 1;
    return `SO${compactDate}${String(count).padStart(4, "0")}`;
  }

  function round1(value) {
    return Math.round(Number(value || 0) * 10) / 10;
  }

  function mmToPt(value) {
    return Number(value) * 72 / 25.4;
  }

  function formatDecimal1(value) {
    return Number(value || 0).toFixed(1);
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function hashCode(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function getPageFromHash() {
    const id = location.hash.replace("#", "");
    return PAGES.some((page) => page.id === id) ? id : "dashboard";
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = String(text).split("");
    let line = "";
    let cursorY = y;
    chars.forEach((char) => {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = char;
        cursorY += lineHeight;
      } else {
        line = test;
      }
    });
    if (line) ctx.fillText(line, x, cursorY);
  }
})();
