(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MealDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const copy = value => JSON.parse(JSON.stringify(value));
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  function nextDate(date, days = 1) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
  const keyOf = (date, meal) => `${date}:${meal}`;
  function planOf(state, date, meal) {
    state.plans ||= {};
    return state.plans[keyOf(date,meal)] ||= { backups: [], menuConfirmed: '', rosterConfirmed: '' };
  }
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
    state.plans ||= {};
    // Keep references from historical menus even when their original dish was removed.
    const ids = new Set(state.dishes.map(d => d.id));
    for (const item of [...Object.values(state.menus).flat(), ...Object.values(state.plans).flatMap(p=>p.backups||[]), ...state.boxes.flatMap(b => b.items)]) {
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
      const dish = item.snapshot || dishOf(state, item.dishId);
      conflicts.push(...dishConflicts(dish, terms));
    }
    const unknown = terms.length > 0 && box.items.some(i => !((i.snapshot || dishOf(state, i.dishId))?.ingredients || []).length);
    return { conflicts, unknown, blocked: conflicts.length > 0 || unknown };
  }
  function dishConflicts(dish, terms) {
    const haystack = `${dish?.name || ''} ${dish?.category || ''} ${(dish?.ingredients || []).join(' ')}`.toLowerCase();
    const groups = { '海鲜':['鱼','虾','蟹','贝','鱿鱼','海鲜'], '坚果':['花生','核桃','杏仁','腰果','坚果'], '奶制品':['牛奶','奶酪','奶油','酸奶'], '豆制品':['大豆','黄豆','豆腐','豆浆','豆皮'] };
    return terms.filter(term=>[term,...(groups[term]||[])].some(t=>haystack.includes(t.toLowerCase()))).map(term=>`${dish?.name}：${term}`);
  }
  function itemCheck(state, box, item) { return checks(state,{...box,items:[item]}); }
  function menuSignature(state,date,meal) { return JSON.stringify({main:state.menus[keyOf(date,meal)]||[],backups:planOf(state,date,meal).backups}); }
  function rosterSignature(state,date,meal) {
    return JSON.stringify(state.boxes.filter(b=>b.date===date&&b.meal===meal&&b.status!=='paused').map(b=>({id:b.id,items:b.items.map(i=>({dishId:i.dishId,grams:i.grams})),customer:b.customerSnapshot||state.customers.find(c=>c.id===b.customerId)})));
  }
  function workflow(state,date,meal) {
    const plan=planOf(state,date,meal), main=state.menus[keyOf(date,meal)]||[], live=state.boxes.filter(b=>b.date===date&&b.meal===meal&&b.status!=='paused');
    const menuValid=main.length>0&&plan.backups.length>=1&&plan.backups.length<=2&&!plan.backups.some(i=>main.some(m=>m.dishId===i.dishId));
    const menuReady=menuValid&&plan.menuConfirmed===menuSignature(state,date,meal);
    const conflicts=live.filter(b=>checks(state,b).blocked);
    const missingNutrition=live.filter(b=>!nutrition(state,b.items).complete);
    const missingAddress=live.filter(b=>{const c=b.customerSnapshot||state.customers.find(c=>c.id===b.customerId);return c?.fulfillment!=='pickup'&&!String(c?.address||'').trim();});
    const rosterReady=menuReady&&live.length>0&&!conflicts.length&&!missingAddress.length&&plan.rosterConfirmed===rosterSignature(state,date,meal);
    return {menuValid,menuReady,rosterReady,live,conflicts,missingNutrition,missingAddress,stage:rosterReady?3:menuReady?2:1};
  }
  function confirmMenu(state,date,meal) {
    if(!workflow(state,date,meal).menuValid)throw new Error('请选择主菜单，并准备 1–2 道不重复的备用菜');
    const plan=planOf(state,date,meal);plan.menuConfirmed=menuSignature(state,date,meal);sync(state,date,meal);
  }
  function confirmRoster(state,date,meal) {
    const w=workflow(state,date,meal);
    if(!w.menuReady)throw new Error('请先确认主菜单和备用菜');
    if(!w.live.length)throw new Error('请先添加本餐用餐人');
    if(w.conflicts.length)throw new Error('请先处理忌口冲突或补全相关菜品食材');
    if(w.missingAddress.length)throw new Error('请补全配送地址，或设置为自提');
    planOf(state,date,meal).rosterConfirmed=rosterSignature(state,date,meal);
  }
  function captureOverrides(state,box) {
    if(box.overrides)return;
    box.overrides={};
    const base=state.menus[keyOf(box.date,box.meal)]||[];
    if(box.custom)base.forEach((i,index)=>{const actual=box.items[index];if(actual&&(actual.dishId!==i.dishId||actual.grams!==i.grams))box.overrides[i.dishId]=copy(actual);});
  }
  function setMenu(state,date,meal,items) {
    state.boxes.filter(b=>b.date===date&&b.meal===meal&&b.status!=='completed').forEach(b=>captureOverrides(state,b));
    state.menus[keyOf(date,meal)]=copy(items);sync(state,date,meal);
  }
  function setBoxItems(state,box,items) {
    const base=state.menus[keyOf(box.date,box.meal)]||[];
    box.overrides={};base.forEach((i,index)=>{const actual=items[index];if(actual&&(actual.dishId!==i.dishId||actual.grams!==i.grams))box.overrides[i.dishId]=copy(actual);});
    box.items=copy(items);box.custom=Object.keys(box.overrides).length>0;touch(box);
  }
  function replaceWithBackup(state,boxId,index,dishId) {
    const box=state.boxes.find(b=>b.id===boxId);
    if(!box||box.status==='completed'||!box.items[index])throw new Error('这份餐已完成或菜品已变化，请刷新后重试');
    const candidate=planOf(state,box.date,box.meal).backups.find(i=>i.dishId===dishId);
    if(!candidate)throw new Error('请选择本餐备用菜');
    if(box.items.some((i,n)=>n!==index&&i.dishId===dishId))throw new Error('这份餐已经包含这道备用菜');
    if(itemCheck(state,box,candidate).blocked)throw new Error('这道备用菜仍有忌口冲突或食材未完整');
    const items=copy(box.items);items[index]=copy(candidate);setBoxItems(state,box,items);
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
    for (const box of state.boxes.filter(b => b.date === date && b.meal === meal && b.status !== 'completed')) {
      if(box.custom&&!box.overrides)continue;
      const effective=menu.map(i=>copy(box.overrides?.[i.dishId]||i));
      if (JSON.stringify(box.items) !== JSON.stringify(effective)) { box.items = effective; touch(box); }
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
    for(const plan of Object.values(state.plans||{}))if(!Array.isArray(plan.backups)||plan.backups.length>2||new Set(plan.backups.map(i=>i.dishId)).size!==plan.backups.length)throw new Error('每餐最多设置 2 道不重复的备用菜');
    const lists = [...Object.values(state.menus), ...Object.values(state.plans||{}).map(p=>p.backups), ...state.boxes.map(b => b.items)];
    for (const items of lists) for (const i of items) if (!dishOf(state, i.dishId) || !Number.isFinite(Number(i.grams)) || Number(i.grams) <= 0 || Number(i.grams) > 10000) throw new Error('请填写有效的菜品克重（1–10000 g）');
    return state;
  }
  return { copy, today, nextDate, initial, hydrate, dishOf, remaining, validNutrition, nutrition, checks, itemCheck, sync, touch, finish, validate, planOf, workflow, confirmMenu, confirmRoster, setMenu, setBoxItems, replaceWithBackup };
});
