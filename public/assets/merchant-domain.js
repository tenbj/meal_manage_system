(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MealDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const copy = value => JSON.parse(JSON.stringify(value));
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  function initial(old = {}) {
    const state = { version: 1, settings: { name: '我的健康小饭桌', phone: '', labelWidth: 50, labelHeight: 70 }, customers: copy(old.customers || []), dishes: (old.dishes || []).map(d => ({ ...d, nutrition: { source: 'legacy', kcal100: null, basis: 'cooked', reference: d.source || '' }, defaultGrams: d.category === '主食' ? 120 : 150 })), orders: [], menus: {}, boxes: [] };
    state.orders = (old.orders || []).map(o => ({ ...o, meals: ['lunch', 'dinner'], weekdays: [0,1,2,3,4,5,6], portions: 1, credits: o.totalMealCredits || 0 }));
    for (const recipe of old.recipes || []) for (const meal of ['lunch', 'dinner']) {
      const ids = Object.values(recipe.meals?.[meal]?.categories || {}).filter(Boolean);
      state.menus[`${recipe.date}:${meal}`] = ids.map(dishId => ({ dishId, grams: state.dishes.find(d => d.id === dishId)?.defaultGrams || 150 }));
    }
    state.boxes = (old.dailyOut || []).map(row => ({ ...row, orderId: state.orders.find(o => o.customerId === row.customerId && o.startDate <= row.date && o.endDate >= row.date)?.id || '', status: row.paused ? 'paused' : 'completed', imported: true, version: 1, exportedVersion: 0, items: copy(row.items || []) }));
    return hydrate(state);
  }
  function hydrate(state) {
    // Keep references from historical menus even when their original dish was removed.
    const ids = new Set(state.dishes.map(d => d.id));
    for (const item of [...Object.values(state.menus).flat(), ...state.boxes.flatMap(b => b.items)]) {
      if (!ids.has(item.dishId)) {
        state.dishes.push({ id: item.dishId, name: `历史菜品（${item.dishId}，待补全）`, category: '其他', ingredients: [], defaultGrams: 150, nutrition: { source: 'legacy', kcal100: null, basis: 'cooked', reference: '历史菜品资料缺失' } });
        ids.add(item.dishId);
      }
    }
    return state;
  }
  function dishOf(state, id) { return state.dishes.find(d => d.id === id); }
  function remaining(state, order) { return Math.max(0, Number(order.credits) - state.boxes.filter(b => b.orderId === order.id && b.status === 'completed').length); }
  function validNutrition(dish) {
    const n = dish?.nutrition;
    return !!n && ['manual', 'boohee'].includes(n.source) && n.kcal100 !== null && n.kcal100 !== '' && Number.isFinite(Number(n.kcal100)) && Number(n.kcal100) >= 0 && ['cooked', 'ready'].includes(n.basis);
  }
  function nutrition(state, items) {
    let kcal = 0; const sources = new Set(); let complete = items.length > 0;
    for (const item of items) {
      const dish = item.snapshot || dishOf(state, item.dishId);
      if (!validNutrition(dish) || !Number.isFinite(Number(item.grams)) || Number(item.grams) <= 0) { complete = false; continue; }
      kcal += Number(dish.nutrition.kcal100) * Number(item.grams) / 100;
      sources.add(dish.nutrition.source);
    }
    return { complete, kcal: complete ? Math.round(kcal) : null, source: sources.size > 1 ? '薄荷健康数据＋商家录入' : sources.has('boohee') ? '薄荷健康数据' : '商家录入' };
  }
  function checks(state, box) {
    const customer = box.customerSnapshot || state.customers.find(c => c.id === box.customerId);
    const terms = [...(customer?.restrictions || []), ...(customer?.allergies || [])].filter(Boolean);
    const conflicts = [];
    for (const item of box.items) {
      const dish = dishOf(state, item.dishId);
      for (const term of terms) if (`${dish?.name || ''} ${(dish?.ingredients || []).join(' ')}`.includes(term)) conflicts.push(`${dish.name}含${term}`);
    }
    const unknown = terms.length > 0 && box.items.some(i => !(dishOf(state, i.dishId)?.ingredients || []).length);
    return { conflicts, unknown, blocked: conflicts.length > 0 || unknown };
  }
  function sync(state, date, meal) {
    const menu = state.menus[`${date}:${meal}`] || [];
    const weekday = new Date(`${date}T12:00:00+08:00`).getUTCDay();
    for (const order of state.orders) {
      if (!['服务中','未开始'].includes(order.status) || order.startDate > date || order.endDate < date || !order.meals.includes(meal) || !order.weekdays.includes(weekday)) continue;
      const available = remaining(state, order);
      for (let p = 0; p < order.portions; p++) {
        const id = `box:${order.id}:${date}:${meal}:${p}`;
        if (state.boxes.some(b => b.id === id || (b.imported && b.orderId === order.id && b.date === date && b.meal === meal))) continue;
        if (p >= available) break;
        state.boxes.push({ id, orderId: order.id, customerId: order.customerId, date, meal, items: copy(menu), status: 'pending', version: 1, exportedVersion: 0, custom: false });
      }
    }
    for (const box of state.boxes.filter(b => b.date === date && b.meal === meal && b.status === 'pending' && !b.custom)) {
      if (JSON.stringify(box.items) !== JSON.stringify(menu)) { box.items = copy(menu); touch(box); }
    }
  }
  function touch(box) { box.version = (box.version || 1) + 1; }
  function finish(state, ids) {
    const boxes = ids.map(id => state.boxes.find(b => b.id === id)).filter(b => b && b.status === 'pending');
    const counts = new Map();
    for (const box of boxes) {
      if (!box.items.length) throw new Error('请先设置菜单');
      if (checks(state, box).blocked) throw new Error('请先处理忌口或核对菜品食材');
      const order = state.orders.find(o => o.id === box.orderId);
      if (!order) throw new Error('该餐盒缺少订餐记录');
      counts.set(order.id, (counts.get(order.id) || 0) + 1);
      if (counts.get(order.id) > remaining(state, order)) throw new Error('剩余餐次不足，请先续餐');
    }
    for (const box of boxes) {
      box.items = box.items.map(i => ({ ...i, snapshot: copy(dishOf(state, i.dishId)) }));
      box.customerSnapshot = copy(state.customers.find(c => c.id === box.customerId));
      box.settingsSnapshot = copy(state.settings);
      box.status = 'completed'; box.completedAt = new Date().toISOString();
    }
    return boxes.length;
  }
  function validate(state) {
    if (state?.version !== 1 || !state.settings || !state.menus) throw new Error('数据格式不正确');
    for (const key of ['customers','orders','dishes','boxes']) {
      if (!Array.isArray(state[key]) || state[key].length > 100000) throw new Error('数据格式不正确');
      if (new Set(state[key].map(i => i.id)).size !== state[key].length) throw new Error('存在重复记录');
    }
    if (!String(state.settings.name || '').trim()) throw new Error('请填写店名');
    if (![state.settings.labelWidth, state.settings.labelHeight].every(n => Number.isFinite(n) && n >= 30 && n <= 150)) throw new Error('标签尺寸应在 30–150 mm 之间');
    for (const c of state.customers) if (!String(c.name || '').trim()) throw new Error('请填写客户称呼');
    for (const d of state.dishes) {
      if (!d.name || !d.nutrition || !['legacy','manual','boohee'].includes(d.nutrition.source)) throw new Error('菜品数据不完整');
      if (d.nutrition.source !== 'legacy' && !validNutrition(d)) throw new Error('请填写有效的成品热量与重量口径');
      if (d.nutrition.source === 'manual' && !String(d.nutrition.reference || '').trim()) throw new Error('请填写热量数值依据');
    }
    for (const o of state.orders) {
      if (!state.customers.some(c => c.id === o.customerId) || !o.startDate || !o.endDate || o.startDate > o.endDate || !Number.isInteger(o.portions) || o.portions < 1 || !Number.isInteger(o.credits) || o.credits < 1 || !o.meals?.length || !o.weekdays?.length) throw new Error('订餐日期、份数或餐次不正确');
    }
    const lists = [...Object.values(state.menus), ...state.boxes.map(b => b.items)];
    for (const items of lists) for (const i of items) if (!dishOf(state, i.dishId) || !Number.isFinite(Number(i.grams)) || Number(i.grams) <= 0 || Number(i.grams) > 10000) throw new Error('请填写有效的菜品克重（1–10000 g）');
    return state;
  }
  return { copy, today, initial, hydrate, dishOf, remaining, validNutrition, nutrition, checks, sync, touch, finish, validate };
});
