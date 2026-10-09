(() => {
  'use strict';
  const D = window.MealDomain, $ = selector => document.querySelector(selector);
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const uid = prefix => `${prefix}_${crypto.randomUUID()}`;
  const list = value => String(value || '').split(/[,，、\n]/).map(s => s.trim()).filter(Boolean);
  const mealName = m => m === 'lunch' ? '午餐' : '晚餐';
  const icon = d => ({ '主食':'🍚', '素':'🥬', '海鲜':'🐟', '荤':'🍲' }[d?.category] || '🍽');
  const sourceTag = d => D.validNutrition(d) ? `<span class="tag">${d.nutrition.source === 'boohee' ? '薄荷健康' : '商家录入'}</span>` : '<span class="tag warn">热量待确认</span>';
  const btn = (label, action, extra = '', cls = '') => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
  const input = (label, name, value = '', type = 'text', attrs = '') => `<label class="field">${label}<input name="${name}" type="${type}" value="${h(value)}" ${attrs}></label>`;
  const options = (values, selected) => values.map(([v,l]) => `<option value="${h(v)}" ${v === selected ? 'selected' : ''}>${h(l)}</option>`).join('');
  let state, revision, saving = false, page = 'today', date = D.nextDate(D.today()), step = 1, meal = 'lunch', query = '', onlyAttention = false, selected = new Set(), previewId = '', timer;
  const currentMenu = () => state.menus[`${date}:${meal}`] || [];
  const boxes = () => state.boxes.filter(b => b.date === date && b.meal === meal);
  const customer = id => state.customers.find(c => c.id === id);
  async function load() {
    const response = await fetch('/api/merchant', { cache:'no-store' });
    if (!response.ok) throw new Error('系统暂时无法读取数据，请稍后重试');
    const result = await response.json(); state = D.hydrate(result.state); revision = result.revision;
    D.refreshPending(state); D.sync(state,date,meal); step=D.workflow(state,date,meal).stage; render();
  }
  async function save(mutator, message = '已保存') {
    if (saving) throw new Error('正在保存，请稍候');
    const next = D.copy(state); mutator(next); D.refreshPending(next); D.validate(next);
    saving = true;
    try {
      const response = await fetch('/api/merchant', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ revision, state:next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '保存失败，请重试');
      state = next; revision = result.revision; render(); if (message) toast(message);
    } finally { saving = false; }
  }
  function toast(message) { clearTimeout(timer); $('#toast').textContent = message; $('#toast').className = 'visible'; timer = setTimeout(() => $('#toast').className = '', 4200); }
  const navs = [['today','◷','备餐工作台','前晚定好，次日贴好标签，照着克重分装。'],['customers','♧','客户与订餐','记一次订餐，以后自动出现在出餐名单。'],['dishes','▦','我的菜品','常用菜记一次，以后直接选。'],['settings','⚙','店铺设置','设置一次，每天少做一点。']];
  function render() {
    const current = navs.find(n => n[0] === page);
    $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">禾</span><div>小饭桌<small>每一餐 · 有数</small></div></div><nav aria-label="主导航">${navs.map(n => btn(`<span>${n[1]}</span>${n[2]}`,'nav',`data-page="${n[0]}"`,page===n[0]?'active':'')).join('')}</nav><div class="sidebar-bottom"><span class="dot"></span>数据已连接<br><span>把时间留给好好做饭。</span></div></aside><main class="main"><header class="topbar"><div><div class="eyebrow">YOUR EVERYDAY KITCHEN</div><h1>${current[2]}</h1><div class="subtitle">${current[3]}</div></div><span class="shop-pill">◉ ${h(state.settings.name)}</span></header>${page === 'today' ? todayPage() : page === 'customers' ? customersPage() : page === 'dishes' ? dishesPage() : settingsPage()}</main></div>`;
  }
  function labelHtml(box) {
    const items=box?.items||currentMenu(), n=D.nutrition(state,items);
    const c=box?.customerSnapshot||(box?customer(box.customerId):null), shop=box?.settingsSnapshot||state.settings;
    const number=box?String(boxes().findIndex(b=>b.id===box.id)+1).padStart(3,'0'):'预览';
    const destination=c?.fulfillment==='pickup'?'自提':c?.address||'配送地址待填写';
    return `<div class="label-paper"><div class="label-brand">${h(shop.name)} <span>#${number}</span></div><div class="label-recipient">${h(c?.nickname||c?.name||'客户昵称')}<small>${(box?.date||date).slice(5)} · ${mealName(box?.meal||meal)}</small></div><div class="label-foods">${items.length?items.map(i=>`<div class="label-line"><span>${h((i.snapshot||D.dishOf(state,i.dishId))?.name)}</span><b>${h(i.grams)}<small> g</small></b></div>`).join(''):'<p class="muted">选择菜单后生成称重清单</p>'}</div><div class="label-kcal"><span>本餐估算热量</span><strong>${n.complete?n.kcal:'待补充'}${n.complete?'<small> kcal</small>':''}</strong></div><div class="label-destination"><b>${c?.fulfillment==='pickup'?'领取':'送至'}</b><span>${h(destination)}</span></div>${c?.phone?`<div class="label-contact">联系电话：${h(c.phone)}</div>`:''}<div class="label-foot">按标示熟重 / 可食重量估算${n.complete?` · ${n.source}`:' · 热量信息未完整'}</div></div>`;
  }
  function menuCounts(items) {
    const counts={荤:0,素:0,主食:0,其他:0};
    items.forEach(i=>{const c=D.dishOf(state,i.dishId)?.category;counts[c==='海鲜'?'荤':c in counts?c:'其他']++;});
    return Object.entries(counts).filter(([,n])=>n).map(([c,n])=>`${n} ${c}`).join(' · ')||'自由搭配';
  }
  function targetSummary(c) {
    const t=D.mealTarget(c,state.settings);
    return t.kcal ? `本餐目标 ${t.kcal} kcal · ${t.message}` : t.message;
  }
  function portionSummary(box) {
    const a=box.allocation, n=D.nutrition(state,box.items);
    if(!a)return '';
    return `<div class="portion-summary"><b>${a.target.kcal?`目标 ${a.target.kcal} kcal`:'目标待确认'}</b><span>实际 ${n.complete?`${n.kcal} kcal`:'热量待补充'}</span><span class="tag ${a.status==='auto'?'':a.status==='manual'?'gray':'warn'}">${a.status==='auto'?'自动配餐':a.status==='manual'?'手动克重':'暂用基准克重'}</span></div><div class="customer-note">${h(a.status==='auto'?a.target.message:a.message)}</div>`;
  }
  function bodyFields(c={}) {
    return `<div class="form-grid"><label class="field">性别（用于配餐）<select name="gender">${options([['','未提供'],['女','女'],['男','男']],c.gender||'')}</select></label>${input('年龄 · 周岁（选填）','age',c.age||'','number','min="1" max="100" step="1"')}${input('身高 · cm（选填）','height',c.height||'','number','min="100" max="250" step="0.1"')}${input('当前体重 · kg（选填）','currentWeight',c.currentWeight||'','number','min="25" max="350" step="0.1"')}</div><div class="hint" id="targetPreview">${h(targetSummary(c))}</div>`;
  }
  function readBody(f) { return {gender:f.get('gender')||'',age:f.get('age')?Number(f.get('age')):null,height:f.get('height')?Number(f.get('height')):null,currentWeight:f.get('currentWeight')?Number(f.get('currentWeight')):null}; }
  function bindBodyPreview() {
    $('#dialog').querySelectorAll('[name=gender],[name=age],[name=height],[name=currentWeight]').forEach(el=>el.addEventListener('input',()=>{$('#targetPreview').textContent=targetSummary(readBody(new FormData($('#modalForm'))));}));
  }
  function menuRows(items,reserve=false) {
    return items.map((i,index)=>{const d=D.dishOf(state,i.dishId);return `<div class="menu-row"><span class="food-icon">${icon(d)}</span><div class="grow"><h3>${h(d?.name)}</h3>${D.validNutrition(d)?`<span class="muted">${Math.round(d.nutrition.kcal100*i.grams/100)} kcal / 基准份</span>`:btn('补充热量','dish',`data-id="${h(d.id)}"`,'text small amber')}${!(d.ingredients||[]).length?btn('补全食材','dish',`data-id="${h(d.id)}"`,'text small amber'):''}</div><input aria-label="${h(d?.name)}${reserve?'备用基准':'基准'}克重" type="number" min="1" max="10000" value="${i.grams}" ${reserve?'data-backup-index':'data-menu-index'}="${index}"><span class="muted">g 基准</span>${btn('×',reserve?'remove-backup':'remove-dish',`data-index="${index}" aria-label="移除${h(d?.name)}"`,'text')}</div>`;}).join('');
  }
  function todayPage() {
    const w=D.workflow(state,date,meal), plan=D.planOf(state,date,meal), t=D.today(), tomorrow=D.nextDate(t);
    return `<div class="toolbar"><div class="actions"><div class="segment">${btn('准备明天','tomorrow','',date===tomorrow?'active':'')}${btn('今天分装','today','',date===t?'active':'')}</div><input aria-label="用餐日期" id="workDate" type="date" value="${date}"><div class="segment">${btn('午餐','meal','data-meal="lunch"',meal==='lunch'?'active':'')}${btn('晚餐','meal','data-meal="dinner"',meal==='dinner'?'active':'')}</div></div><span class="muted">${date===tomorrow?'为明天做好准备':date===t?'按标签称重，完成后扣餐次':'正在安排所选日期的餐食'}</span></div>
    <div class="workflow-steps" aria-label="备餐步骤">${[['定菜单','主菜＋1–2道备用菜'],['确认用餐人','核对忌口，直接换备用菜'],['打印标签','先贴餐盒，再按克重分装']].map(([title,sub],i)=>`<button type="button" data-action="step" data-step="${i+1}" class="workflow-step ${step===i+1?'active':''} ${(i===0&&w.menuReady)||(i===1&&w.rosterReady)?'done':''}" ${i===1&&!w.menuReady||i===2&&!w.rosterReady?'disabled':''}><span>${(i===0&&w.menuReady)||(i===1&&w.rosterReady)?'✓':i+1}</span><div><b>${title}</b><small>${sub}</small></div></button>`).join('')}</div>
    ${step===1?menuStage(w,plan):step===2?rosterStage(w):labelsStage(w)}`;
  }
  function menuStage(w,plan) {
    return `<div class="plan-layout"><div class="stack"><section class="card"><div class="section-head"><div><h2>本餐主菜单</h2><span class="muted">${menuCounts(currentMenu())}，先选菜，再按客户目标自动算克重</span></div><div class="actions">${btn('沿用上次','reuse','','text')}${btn('选择主菜','pick','','primary')}</div></div><div class="body"><div class="hint">这里是基准份量，决定同组菜品的搭配比例。每盒克重会按客户目标自动换算，主食占本餐热量 1/3。${btn("查看计算规则","portion-rules","","text small")}</div>${currentMenu().length?menuRows(currentMenu()):'<div class="empty"><strong>明天做哪些菜？</strong>主食、荤菜、素菜自由组合，不限制固定搭配。</div>'}</div></section><section class="card reserve-card"><div class="section-head"><div><h2>备用菜 <span class="tag">${plan.backups.length} / 2 道</span></h2><span class="muted">准备 1–2 道，用于替换忌口冲突的主菜</span></div>${btn('选择备用菜','pick-backups')}</div><div class="body">${plan.backups.length?menuRows(plan.backups,true):'<div class="empty compact">还没有备用菜。选好后，下一步可直接点击替换。</div>'}<div class="hint">备用菜不会默认装进每盒；实际换入后，才计入那份餐的热量和分装总量。</div></div></section><div class="stage-footer"><span class="muted">${w.menuValid?'菜单已准备好，下一步核对谁来吃。':'请选择主菜和 1–2 道备用菜。'}</span>${btn('菜单定好了，确认用餐人 →','confirm-menu',w.menuValid?'':'disabled','primary')}</div></div><aside class="card planning-note"><div class="body"><div class="eyebrow">提前一晚，安排清楚</div><h2 style="margin:10px 0 20px">${date.slice(5)} · ${mealName(meal)}</h2><div class="prep-row"><span>主菜单</span><b>${currentMenu().length} 道</b></div><div class="prep-row"><span>备用菜</span><b>${plan.backups.length} 道</b></div><div class="prep-row"><span>订餐已排入</span><b>${w.live.length} 份</b></div><p class="muted">先把每道菜的分装克重定好。个别客户需要不同分量，下一步单独调整。</p><div class="workflow-tip">主菜和备用菜可以随时改。已经打印的餐盒受影响时，会提醒重打。</div></div></aside></div>`;
  }
  function rosterStage(w) {
    const rows=boxes(), active=rows.filter(b=>b.status!=='paused');
    const shown=onlyAttention?rows.filter(b=>b.status!=='paused'&&(D.checks(state,b).blocked||w.missingAddress.some(x=>x.id===b.id))):rows;
    return `<section class="card"><div class="section-head"><div><h2>确认这餐谁来吃</h2><span class="muted">已安排 ${active.length} 份 · 暂停 ${rows.length-active.length} 份 · 忌口待处理 ${w.conflicts.length} 份</span></div><div class="actions">${btn('＋ 添加用餐人','add-diners')}${btn('＋ 新客户 / 记单','order','','primary')}</div></div><div class="roster-filter"><label class="flex muted"><input type="checkbox" id="attention" ${onlyAttention?'checked':''}>只看忌口或地址待处理</label><span class="muted">取消“吃这餐”即暂停本餐，不扣餐次</span></div>${shown.length?`<div class="table-wrap"><table class="roster-table"><thead><tr><th>吃这餐</th><th>客户 / 配送</th><th>实际装盒内容</th><th>核对与调整</th></tr></thead><tbody>${shown.map(boxRow).join('')}</tbody></table></div>`:`<div class="empty"><strong>${onlyAttention?'没有待处理的用餐人':'还没有人安排这餐'}</strong>${onlyAttention?'可以继续生成标签。':'从已有客户中添加，或记一笔新订单。'}</div>`}<div class="footer-actions"><div>${btn('← 改菜单','step','data-step="1"','text')}<span class="muted">${w.conflicts.length?'先用备用菜解决冲突':w.missingAddress.length?'请补齐配送地址或选自提':active.length?'名单已就绪':'先添加用餐人'}</span></div>${btn('名单确认，生成标签 →','confirm-roster',!active.length||w.conflicts.length||w.missingAddress.length||!w.menuReady?'disabled':'','primary')}</div></section>`;
  }
  function boxRow(b) {
    const c=b.customerSnapshot||customer(b.customerId),check=D.checks(state,b),paused=b.status==='paused';
    const recipient=c?.nickname||c?.name||'未关联客户';
    return `<tr class="${paused?'paused-row':''}"><td><input type="checkbox" data-diner="${h(b.id)}" aria-label="${h(recipient)}吃这餐" ${!paused?'checked':''} ${b.status==='completed'?'disabled':''}></td><td><b>${h(recipient)}</b>${c?.nickname&&c.nickname!==c.name?`<div class="customer-note">${h(c.name)}</div>`:''}<div class="customer-note">${h(c?.fulfillment==='pickup'?'自提':c?.address||'配送地址待填写')}</div>${!paused&&c?.fulfillment!=='pickup'&&!c?.address?btn('补地址 / 选自提','customer',`data-id="${h(c.id)}"`,'text small amber'):''}</td><td><div class="meal-chips">${b.items.map(i=>`<span class="meal-chip ${!paused&&D.itemCheck(state,b,i).blocked?'conflict':''}">${h((i.snapshot||D.dishOf(state,i.dishId))?.name)} <b>${i.grams}g</b></span>`).join('')}</div>${portionSummary(b)}</td><td>${paused?'<span class="tag gray">本餐暂停</span>':check.blocked?`<div class="conflict-copy">${h(check.conflicts.join('；')||(check.unknown?'食材未完整，需核对忌口':''))}</div>${btn('换备用菜','replace',`data-id="${h(b.id)}"`,'conflict-button')}`:`<span class="tag">${b.status==='completed'?'已完成':'已记录忌口未发现冲突'}</span>`}${!paused&&b.status!=='completed'?btn('改克重 / 菜品','box',`data-id="${h(b.id)}"`,'text small')+btn('身体资料','customer',`data-id="${h(c.id)}"`,'text small'):''}${b.exportedVersion&&b.exportedVersion!==b.version?'<div class="customer-note inline-error">旧标签作废，需重打</div>':''}</td></tr>`;
  }
  function labelsStage(w) {
    const reprints=w.live.filter(b=>b.exportedVersion&&b.exportedVersion!==b.version), missing=[...new Set(w.live.flatMap(b=>b.items.filter(i=>!D.validNutrition(i.snapshot||D.dishOf(state,i.dishId))).map(i=>i.dishId)))];
    return `<div class="print-banner"><div><h2>先贴标签，再照着克重分装</h2><p>今晚可打印好 ${w.live.length} 张，明天贴在对应餐盒盖上。打印不会扣餐次。</p></div><div class="actions">${btn('查看分装总量','prep')}${btn(selected.size?`打印选中 ${selected.size} 张`:`打印全部 ${w.live.length} 张`,'print',!w.rosterReady?'disabled':'','primary')}</div></div>${!w.rosterReady?`<div class="notice">菜单或名单已发生变化，请重新核对。${btn('返回核对','step',`data-step="${w.menuReady?2:1}"`,'text')}</div>`:''}${missing.length?`<div class="notice"><b>${missing.length} 道菜热量待补充</b> · 补齐后标签会自动显示总热量。<div class="actions" style="margin-top:8px">${missing.map(id=>btn(h(D.dishOf(state,id)?.name),'dish',`data-id="${h(id)}"`,'small')).join('')}</div></div>`:''}${reprints.length?`<div class="notice">${reprints.length} 份餐盒已更改，原标签需替换。${btn('只重打这些标签','reprint','','small')}</div>`:''}<div class="label-toolbar"><span class="muted">按盒号依次贴标 · 昵称、菜品克重与地址一眼看清</span><label class="flex muted"><input type="checkbox" id="selectAll" aria-label="选择全部标签" ${w.live.length&&w.live.every(b=>selected.has(b.id))?'checked':''}>选择全部</label></div><div class="labels-grid">${w.live.map(b=>`<div class="label-tile"><div class="label-tile-head"><label class="flex"><input type="checkbox" data-select="${h(b.id)}" aria-label="选择${h(customer(b.customerId)?.nickname||customer(b.customerId)?.name)}标签" ${selected.has(b.id)?'checked':''}>${b.status==='completed'?'已出餐':b.exportedVersion===b.version?'已打印':'待打印'}</label>${b.exportedVersion&&b.exportedVersion!==b.version?'<span class="tag red">需重打</span>':''}${b.status!=='completed'?btn('改这份餐','box',`data-id="${h(b.id)}"`,'text small'):''}</div>${labelHtml(b)}</div>`).join('')}</div><div class="stage-footer"><div>${btn('← 改用餐名单','step','data-step="2"','text')}<span class="muted">次日按标签分装完成后，再确认出餐。</span></div>${btn('本餐分装完成','complete',date>D.today()?'disabled title="到用餐当天再确认完成"':'','primary')}</div>`;
  }

  function customersPage() {
    const matches=state.customers.filter(c=>`${c.name} ${c.phone}`.includes(query));
    return `<div class="toolbar"><input class="search" id="query" value="${h(query)}" placeholder="搜索客户称呼或电话" aria-label="搜索客户"><div class="actions">${btn('新增客户','customer')}${btn('＋ 记一单','order','','primary')}</div></div><section class="card"><div class="table-wrap"><table><thead><tr><th>客户</th><th>本餐热量目标</th><th>忌口 / 备注</th><th>剩余餐次</th><th>操作</th></tr></thead><tbody>${matches.map(c=>{const os=state.orders.filter(o=>o.customerId===c.id&&o.status!=='已取消');return `<tr><td><b>${h(c.name)}</b><div class="customer-note">${h(c.phone||'未填写联系方式')}</div></td><td><div class="customer-note">${h(targetSummary(c))}</div></td><td>${h([...(c.restrictions||[]),...(c.allergies||[])].join('、')||'未记录')}<div class="customer-note">${h(c.address||'地址未填写 / 自提')}</div></td><td><span class="credit">${os.reduce((n,o)=>n+D.remaining(state,o),0)}</span><span class="muted"> 餐</span></td><td>${btn('编辑','customer',`data-id="${h(c.id)}"`,'text')}${btn('订餐 / 续餐','order',`data-customer="${h(c.id)}"`,'text')}${btn('记录','history',`data-id="${h(c.id)}"`,'text')}</td></tr>`;}).join('')}</tbody></table></div>${!matches.length?'<div class="empty">还没有匹配的客户，先记一单就能自动建立档案。</div>':''}</section>`;
  }
  function dishesPage() {
    const matches=state.dishes.filter(d=>`${d.name} ${d.category}`.includes(query));
    return `<div class="toolbar"><input class="search" id="query" value="${h(query)}" placeholder="搜索我的菜品" aria-label="搜索菜品"><div class="actions">${btn('搜索薄荷健康','boohee')}${btn('＋ 手动添加','dish','','primary')}</div></div><div class="notice">薄荷健康接口待接入。现有旧数据需要确认；手动填写的数值会明确标为“商家录入”。</div><div class="dish-grid">${matches.slice(0,90).map(d=>`<section class="card dish-card"><div class="dish-title"><span class="food-icon">${icon(d)}</span><div><h3>${h(d.name)}</h3>${sourceTag(d)}</div></div><div class="dish-meta"><span>${D.validNutrition(d)?`${d.nutrition.kcal100} kcal / 100 g`:'热量未确认'}</span><span>基准 ${d.defaultGrams||150} g</span></div>${btn('编辑菜品与热量','dish',`data-id="${h(d.id)}"`)}</section>`).join('')}</div>${matches.length>90?'<div class="hint">当前显示前 90 道菜，请输入名称进一步查找。</div>':''}${!matches.length?'<div class="empty">没有找到菜品，可以直接手动添加。</div>':''}`;
  }
  function settingsPage() {
    return `<div class="settings-grid"><section class="card"><div class="section-head"><h2>店铺与标签</h2></div><form id="settingsForm"><div class="body">${input('店铺名称','name',state.settings.name,'text','required maxlength="60"')}${input('标签上的联系电话（选填）','phone',state.settings.phone)}<div class="form-grid">${input('标签宽度 · mm','labelWidth',state.settings.labelWidth,'number','required min="30" max="150"')}${input('标签高度 · mm','labelHeight',state.settings.labelHeight,'number','required min="30" max="150"')}</div><p class="muted">默认 50 × 70 mm。打印时选择对应纸张尺寸，并关闭浏览器页眉页脚。</p><h3>自动配餐规则</h3><p class="muted">资料齐全：静息代谢估算 × 36%。主食占本餐热量 1/3，其余菜占 2/3。</p><label class="field">身体资料不全时的 1400 / 1600 kcal<select name="fallbackCalorieBasis">${options([["meal","作为单餐热量：女生 1400 / 男生 1600"],["daily-base","作为每日基础值 × 36%：女生 504 / 男生 576"]],state.settings.fallbackCalorieBasis||"meal")}</select></label><p class="muted">这是店铺配餐规则，不是全天饮食处方。${btn("查看计算规则","portion-rules","","text small")}</p><div class="form-error" id="settingsError"></div><button class="primary" type="submit">保存设置</button></div></form></section><section class="card"><div class="section-head"><h2>热量数据</h2><span class="tag warn">待接入</span></div><div class="body"><h3>薄荷健康</h3><p class="muted">唯一外部食物数据来源。接入完成后，可直接搜索和关联菜品。</p><p class="muted">暂未取得接口配置与字段文档，目前可以手动录入。所有旧菜品的数值需要重新确认。</p><a href="https://ai.boohee.com/docs/" target="_blank" rel="noopener">查看薄荷官方接入说明 ↗</a><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>先把信息说清楚</h3><p class="muted">无热量数据时照常出餐，标签显示“热量信息未完整”。不会把缺失值当作零。</p></div></section></div>`;
  }
  function portionRules() {
    modal('热量和克重怎么算',`<div class="rule-steps"><h3>1. 确定这一餐的目标</h3><p>身体资料齐全的成年人，使用 Mifflin–St Jeor 公式估算静息代谢，再乘 36%。午餐、晚餐各自计算同一目标。</p><div class="hint">女：10 × 体重 kg ＋ 6.25 × 身高 cm − 5 × 年龄 − 161<br>男：10 × 体重 kg ＋ 6.25 × 身高 cm − 5 × 年龄 ＋ 5</div><p>例如：女，30 岁，160 cm，60 kg → 估算 1289 kcal/日 → 本餐目标 464 kcal。</p><p>身体资料不全时，按店铺设置使用女生 1400、男生 1600 的默认值。未提供性别时保留基准份量，提示补资料。</p><h3>2. 主食分到 1/3 的热量</h3><p>464 kcal 的一餐：主食约 155 kcal，其余菜约 309 kcal。这里的 1/3 是热量比例，不是重量或餐盒体积。</p><h3>3. 用成品热量反推克重</h3><p>克重 ＝ 分配到的热量 ÷ 每 100 g 成品热量 × 100，取整到 1 g。多个主食在主食组内分配，其余菜在菜组内分配。</p><p>同组按菜单基准份量同比缩放：例如两道菜基准 150 g 和 100 g，自动配餐后仍保持约 3:2 的克重比例。每种食谱与热量密度不同，最终克重也会不同。</p><h3>菜单里的基准克重</h3><p>由商家设定，只用于确定搭配比例。历史导入初值：主食 120 g、其他菜 150 g；新菜初值 150 g。这些不是根据客户计算的数字。可在菜品资料或本餐菜单修改。</p><div class="notice">标签上的热量按最终克重重新求和，取整可能与目标略有差异。缺少菜品成品热量或主食时，暂用基准克重并提示原因；手动改克重后不会被自动覆盖。</div><p class="muted">公式是静息代谢估算；36% 和 1/3 是本店配餐规则，不等于个人全天营养需求。菜品热量只使用薄荷健康或商家录入，烹调用油需计入成品数据。</p><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener">查看公式原始研究 ↗</a></div>`,null);
  }
  function modal(title, body, submitLabel, handler) {
    const dialog=$('#dialog'); if(dialog.open)dialog.close();
    dialog.innerHTML=`<form id="modalForm"><div class="modal-head"><h2>${title}</h2>${btn('×','close','aria-label="关闭"','text')}</div><div class="modal-body">${body}<div id="formError" class="form-error" role="alert"></div></div><div class="modal-foot">${btn('关闭','close')}${submitLabel?`<button type="submit" class="primary">${submitLabel}</button>`:''}</div></form>`;
    dialog.showModal();
    $('#modalForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const close=await handler(new FormData(event.currentTarget));if(close!==false)dialog.close();}catch(error){$('#formError').textContent=error.message;}finally{button.disabled=false;}};
  }
  function dishModal(id) {
    const d=state.dishes.find(d=>d.id===id), known=D.validNutrition(d);
    modal(d?'编辑菜品':'手动添加菜品',`${!known&&d?'<div class="notice">旧版数值没有自动带入。请核对依据后填写，保存为商家录入。</div>':''}<div class="form-grid">${input('菜品名称','name',d?.name||'','text','required maxlength="120"')}<label class="field">分类<select name="category">${options(['主食','荤','素','海鲜'].map(x=>[x,x]),d?.category||'荤')}</select></label>${input('每 100 g 热量 · kcal','kcal',known?d.nutrition.kcal100:'','number','required min="0" max="900" step="0.01"')}${input('基准份量 · g（决定搭配比例）','grams',d?.defaultGrams||150,'number','required min="1" max="10000"')}<label class="field wide">重量口径<select name="basis">${options([['cooked','烹调后的成品熟重'],['ready','包装即食 / 可食部分重量']],d?.nutrition?.basis||'cooked')}</select></label><div class="wide">${input('热量数值依据','reference',known?d.nutrition.reference:'','text','required placeholder="如：产品包装营养标签、配方核算记录"')}${input('实际食材（逗号分隔，用于忌口核对）','ingredients',(d?.ingredients||[]).join('，'),'text','placeholder="如：鸡肉，番茄，食用油"')}</div></div><div class="muted">基准份量由商家设定，不是客户最终克重；新菜初始填 150 g，可自行调整。这里保存的数值来源是“商家录入”，不会标记成薄荷数据。缺少食材时不能自动判断忌口。</div>`,'保存菜品',async f=>save(s=>{
      const item={...(d||{}),id:d?.id||uid('dish'),name:f.get('name').trim(),category:f.get('category'),ingredients:list(f.get('ingredients')),defaultGrams:Number(f.get('grams')),nutrition:{source:'manual',kcal100:Number(f.get('kcal')),basis:f.get('basis'),reference:f.get('reference').trim(),updatedAt:new Date().toISOString()}};
      const at=s.dishes.findIndex(x=>x.id===item.id);if(at<0)s.dishes.push(item);else s.dishes[at]=item;
      s.boxes.filter(b=>b.status!=='completed'&&b.items.some(i=>i.dishId===item.id)).forEach(D.touch);
    },'菜品已保存，可直接用于出餐'));
  }
  function customerModal(id) {
    const c=customer(id);
    modal(c?'编辑客户 / 配送':'新增客户',`<div class="form-grid">${input('客户称呼','name',c?.name||'','text','required maxlength="80"')}${input('标签昵称（选填）','nickname',c?.nickname||'','text','placeholder="不填则使用客户称呼"')}${input('忌口食材（选填）','restrictions',(c?.restrictions||[]).join('，'))}${input('过敏食材（选填）','allergies',(c?.allergies||[]).join('，'))}<label class="field">领取方式<select name="fulfillment">${options([['delivery','配送到地址'],['pickup','顾客自提']],c?.fulfillment||'delivery')}</select></label>${input('联系电话（选填）','phone',c?.phone||'')}<div class="wide">${input('配送地址','address',c?.address||'','text',c?.fulfillment==='pickup'?'':'required')}${input('其他备注（选填）','notes',c?.notes||'')}</div></div><h3>自动配餐资料</h3>${bodyFields(c||{})}`,'保存客户',async f=>save(s=>{
      const item={...(c||{}),...readBody(f),id:c?.id||uid('customer'),name:f.get('name').trim(),nickname:f.get('nickname').trim(),fulfillment:f.get('fulfillment'),phone:f.get('phone'),address:f.get('address').trim(),notes:f.get('notes'),restrictions:list(f.get('restrictions')),allergies:list(f.get('allergies'))};
      if(item.fulfillment==='delivery'&&!item.address)throw new Error('请填写配送地址或选择自提');
      const at=s.customers.findIndex(x=>x.id===item.id);if(at<0)s.customers.push(item);else s.customers[at]=item;
      s.boxes.filter(b=>b.customerId===item.id&&b.status!=='completed').forEach(D.touch);
    }));
    bindDelivery();bindBodyPreview();
  }
  function bindDelivery() {
    const select=$('#dialog select[name=fulfillment]'), address=$('#dialog input[name=address]');
    if(select&&address){select.onchange=()=>{address.required=select.value==='delivery';address.placeholder=select.value==='pickup'?'自提无需填写地址':'小区 / 楼栋 / 门牌号';};select.onchange();}
  }

  function orderModal(customerId='') {
    modal('记一单',`<label class="field">客户<select name="customerId" id="orderCustomer">${options([['','＋ 新客户'],...state.customers.map(c=>[c.id,c.name])],customerId)}</select></label><div id="newCustomerFields" ${customerId?'hidden':''}>${input('新客户称呼','name','','text',customerId?'':'required')}${input('标签昵称（选填）','nickname')}<label class="field">领取方式<select name="fulfillment" ${customerId?'disabled':''}><option value="delivery">配送到地址</option><option value="pickup">顾客自提</option></select></label>${input('配送地址','address','','text',customerId?'disabled':'required')}${input('忌口 / 过敏提醒（选填）','restrictions','','text','placeholder="填写需要避开的食材"')}<details><summary>自动配餐资料（可稍后补充）</summary>${bodyFields()}</details></div><div class="form-grid"><label class="field">订餐方式<select name="kind" id="orderKind"><option value="single">单次订餐</option><option value="plan">连续包餐</option></select></label><label class="field">餐次<select name="meal">${options([['lunch','午餐'],['dinner','晚餐'],['both','午餐＋晚餐']],meal)}</select></label>${input('开始日期','startDate',date,'date','required')}${input('每餐份数','portions',1,'number','required min="1" max="99"')}</div><div id="planFields" hidden><div class="form-grid">${input('结束日期','endDate',date,'date')}${input('购买餐次数（每盒计 1 餐）','credits',10,'number','min="1" max="99999"')}</div><div class="pill-row">${['日','一','二','三','四','五','六'].map((n,i)=>`<label><input type="checkbox" name="weekday" value="${i}" ${i>0&&i<6?'checked':''}>周${n}</label>`).join('')}</div></div><details><summary>付款与备注</summary><label class="field">付款状态<select name="paidStatus"><option>未记录</option><option>已付款</option><option>未付款</option></select></label>${input('订单备注','notes')}</details>`,'保存并安排出餐',async f=>save(s=>{
      let cid=f.get('customerId');if(!cid){const name=f.get('name').trim();if(!name)throw new Error('请填写客户称呼');cid=uid('customer');s.customers.push({id:cid,name,...readBody(f),restrictions:list(f.get('restrictions')),allergies:[],phone:'',nickname:f.get('nickname')||'',address:(f.get('address')||'').trim(),fulfillment:f.get('fulfillment')||'delivery'});if(f.get('fulfillment')==='delivery'&&!f.get('address')?.trim())throw new Error('请填写配送地址或选择自提');}
      const meals=f.get('meal')==='both'?['lunch','dinner']:[f.get('meal')], plan=f.get('kind')==='plan';
      s.orders.push({id:uid('order'),customerId:cid,serviceType:plan?'包餐':'单次',startDate:f.get('startDate'),endDate:plan?f.get('endDate'):f.get('startDate'),meals,weekdays:plan?f.getAll('weekday').map(Number):[0,1,2,3,4,5,6],portions:Number(f.get('portions')),credits:plan?Number(f.get('credits')):Number(f.get('portions'))*meals.length,status:'服务中',paidStatus:f.get('paidStatus'),notes:f.get('notes')});
      D.sync(s,date,meal);
    },'订餐已保存，符合日期的餐盒已排入'));
    $('#orderCustomer').onchange=e=>{const isNew=!e.target.value;$('#newCustomerFields').hidden=!isNew;$('#newCustomerFields input[name=name]').required=isNew;$('#newCustomerFields').querySelectorAll('input,select').forEach(el=>el.disabled=!isNew);bindDelivery();};
    $('#orderKind').onchange=e=>{$('#planFields').hidden=e.target.value!=='plan';};bindDelivery();bindBodyPreview();
  }
  function pickModal(reserve=false) {
    const chosen=reserve?D.planOf(state,date,meal).backups:currentMenu();
    const other=reserve?currentMenu():D.planOf(state,date,meal).backups;
    modal(reserve?'选择 1–2 道备用菜':'选择本餐主菜',`<input class="search" id="pickSearch" placeholder="搜索常用菜" aria-label="搜索常用菜"><div class="pill-row" style="margin-top:12px"><select id="pickCategory" aria-label="筛选菜品分类">${options([['','全部分类'],['荤','荤菜'],['素','素菜'],['主食','主食'],['海鲜','海鲜']], '')}</select><span class="muted">${reserve?'备用菜只在需要时替换，不默认出餐':'荤素数量自由搭配，勾选需要的菜'}</span></div><div class="pick-list">${state.dishes.map(d=>`<label class="pick-row" data-name="${h(d.name)}" data-category="${h(d.category)}"><input name="dish" type="checkbox" value="${h(d.id)}" ${chosen.some(i=>i.dishId===d.id)?'checked':''} ${other.some(i=>i.dishId===d.id)?'disabled':''}><span class="grow">${h(d.name)} ${other.some(i=>i.dishId===d.id)?`<small class="muted">已选为${reserve?'主菜':'备用菜'}</small>`:''}</span>${sourceTag(d)}</label>`).join('')}</div>`,'使用这些菜',async f=>{
      const ids=f.getAll('dish');if(reserve&&(ids.length<1||ids.length>2))throw new Error('请选择 1–2 道备用菜');
      await save(s=>{const items=ids.map(id=>chosen.find(i=>i.dishId===id)||{dishId:id,grams:D.dishOf(s,id).defaultGrams||150});if(reserve)D.planOf(s,date,meal).backups=items;else D.setMenu(s,date,meal,items);},reserve?'备用菜已保存':'主菜单已更新');
    });
    const filter=()=>document.querySelectorAll('.pick-row').forEach(row=>row.hidden=!row.dataset.name.includes($('#pickSearch').value)||!!$('#pickCategory').value&&row.dataset.category!==$('#pickCategory').value);
    $('#pickSearch').oninput=filter;$('#pickCategory').onchange=filter;
  }
  function replacementModal(id) {
    const box=state.boxes.find(b=>b.id===id);if(!box||box.status==='completed')return;
    const backups=D.planOf(state,date,meal).backups;
    const affected=box.items.map((item,index)=>({item,index,check:D.itemCheck(state,box,item)})).filter(x=>x.check.blocked);
    modal(`为 ${h(customer(box.customerId)?.nickname||customer(box.customerId)?.name)} 换备用菜`,affected.map(({item,index,check})=>`<div class="replacement-block"><h3>${h(D.dishOf(state,item.dishId)?.name)} <span class="tag red">需要替换</span></h3><p class="muted">${h(check.conflicts.join('、')||'该菜食材未完整，无法核对忌口')}</p><div class="backup-options">${backups.map(candidate=>{const c=D.itemCheck(state,box,candidate),duplicate=box.items.some((i,n)=>n!==index&&i.dishId===candidate.dishId);return btn(`${h(D.dishOf(state,candidate.dishId)?.name)} <b>基准 ${candidate.grams}g</b><small>${duplicate?'本盒已有这道菜':c.blocked?h(c.conflicts.join('、')||'食材未完整，需核对'):'点击替换本盒这道菜'}</small>`,'use-backup',`data-id="${h(id)}" data-index="${index}" data-dish="${h(candidate.dishId)}" ${c.blocked||duplicate?'disabled':''}`,'backup-option');}).join('')}</div></div>`).join('')+`<div class="hint">只影响这一份餐。自动配餐会重新换算所有菜的克重；手动餐盒使用备用基准克重，可继续调整。</div>${btn('备用菜不合适，返回调整','edit-backups','','text')}`,null);
  }
  function addDinersModal() {
    const existing=new Set(boxes().map(b=>b.customerId));
    modal('添加本餐用餐人',`<p class="muted">已包餐客户会自动排入。这里添加未排入的客户，按本餐单次订餐记录，付款状态为“未记录”。</p><div class="pick-list">${state.customers.filter(c=>!existing.has(c.id)).map(c=>`<label class="pick-row"><input name="customer" type="checkbox" value="${h(c.id)}"><span class="grow">${h(c.nickname||c.name)}</span><small class="muted">${h(c.fulfillment==='pickup'?'自提':c.address||'待补地址')}</small></label>`).join('')||'<p class="muted">现有客户都已排入；可返回恢复暂停，或新增客户。</p>'}</div>`,'添加到本餐',async f=>{
      const ids=f.getAll('customer');if(!ids.length)throw new Error('请选择至少一位客户');
      await save(s=>{ids.forEach(cid=>s.orders.push({id:uid('order'),customerId:cid,serviceType:'单次',startDate:date,endDate:date,meals:[meal],weekdays:[0,1,2,3,4,5,6],portions:1,credits:1,status:'服务中',paidStatus:'未记录',notes:''}));D.sync(s,date,meal);},'已添加到本餐，下一步核对忌口');
    });
  }

  function boxModal(id) {
    const box=state.boxes.find(b=>b.id===id);if(!box||box.status==='completed')return;
    modal(`调整 ${h(customer(box.customerId)?.name)} 的这份餐`,`${portionSummary(box)}<div class="hint">保存后改为手动克重，后续资料变化不会覆盖本盒。${btn('恢复自动配餐','restore-auto',`data-id="${h(id)}"`,'text small')}</div>${!box.items.length?'<div class="notice">请先在今日出餐中选择菜单。</div>':''}${box.items.map((i,index)=>`<div class="form-grid"><label class="field">菜品 ${index+1}<select name="dish${index}">${options(state.dishes.map(d=>[d.id,d.name]),i.dishId)}</select></label>${input('本次分量 · g',`grams${index}`,i.grams,'number','required min="1" max="10000"')}</div>`).join('')}<div class="muted">只修改这一盒，不影响其他客户或下一次出餐。</div>`,'保存本餐调整',async f=>save(s=>{
      const b=s.boxes.find(b=>b.id===id);D.setBoxItems(s,b,b.items.map((i,index)=>({dishId:f.get(`dish${index}`),grams:Number(f.get(`grams${index}`))})));
    },'这份餐已调整，标签同步更新'));
  }
  function prepModal() {
    const rows=boxes().filter(b=>b.status!=='paused'), totals=new Map();
    rows.forEach(b=>b.items.forEach(i=>totals.set(i.dishId,(totals.get(i.dishId)||0)+Number(i.grams))));
    modal('称重分装清单',`<div class="notice">以下为成品菜分装需求量，不是采购生重。</div><h3>按菜汇总</h3>${[...totals].map(([id,g])=>`<div class="prep-row"><span>${h(D.dishOf(state,id)?.name)}</span><b>${g} g</b></div>`).join('')||'<p class="muted">暂无需要分装的菜品。</p>'}<h3 style="margin-top:24px">按餐盒分装</h3>${rows.map((b,index)=>`<div class="prep-row"><div><b>${String(index+1).padStart(3,'0')} · ${h(customer(b.customerId)?.name)}</b><div class="muted">${b.items.map(i=>`${h(D.dishOf(state,i.dishId)?.name)} ${i.grams}g`).join(' / ')}</div></div></div>`).join('')}`,null);
  }
  function historyModal(id) {
    const os=state.orders.filter(o=>o.customerId===id);
    modal(`${h(customer(id)?.name)} 的订餐记录`,os.map(o=>`<div class="card body" style="margin-bottom:12px"><h3>${h(o.serviceType)} · ${o.startDate} 至 ${o.endDate}</h3><p class="muted">${o.meals.map(mealName).join('、')} · 每餐 ${o.portions} 份 · ${h(o.paidStatus||'未记录')}</p><b>剩余 ${D.remaining(state,o)} / ${o.credits} 餐</b><div class="muted">${h(o.notes||'')}</div></div>`).join('')||'<div class="empty">还没有订餐记录。</div>',null);
  }
  async function printLabels(reprintOnly=false,allowIncomplete=false) {
    if(!D.workflow(state,date,meal).rosterReady)return toast('请先确认菜单和用餐名单');
    const rows=boxes().filter(b=>b.status!=='paused'&&(!selected.size||selected.has(b.id))&&(!reprintOnly||(b.exportedVersion&&b.exportedVersion!==b.version)));
    if(!rows.length)return toast('没有可打印的餐盒');
    if(rows.some(b=>!b.items.length))return toast('请先选择今天的菜单');
    if(rows.some(b=>D.checks(state,b).blocked))return toast('请先处理所选餐盒的忌口，或补全菜品食材后再打印');
    const missing=rows.filter(b=>!D.nutrition(state,b.items).complete);
    if(missing.length&&!allowIncomplete){
      modal('还有热量未补齐',`<p>${missing.length} 份餐盒的热量信息未完整。可先关闭，点击菜名补充数据。</p><p class="muted">若先打印，缺失热量的餐盒只标菜品、克重、昵称和地址，不显示完整总热量。</p>`,'仍打印，标明热量待补充',async()=>{await printLabels(reprintOnly,true);return false;});return;
    }
    const {labelWidth:w,labelHeight:height}=state.settings;
    $('#printArea').innerHTML=`<style>@page{size:${w}mm ${height}mm;margin:0}</style>${rows.map(b=>`<article class="print-label" style="--label-width:${w}mm;--label-height:${height}mm">${labelHtml(b)}</article>`).join('')}`;
    const area=$('#printArea');area.style.cssText='display:block;position:absolute;left:-20000px;top:0';
    const oversized=[...area.querySelectorAll('.print-label')].filter(el=>el.scrollHeight>el.clientHeight||el.scrollWidth>el.clientWidth);
    area.style.cssText='';
    if(oversized.length){modal('标签内容超出纸张',`<p>${oversized.length} 张标签放不下完整的菜品或地址。</p><p class="muted">请在店铺设置中调大标签尺寸（例如 50 × 100 mm），以免裁掉克重或配送信息。</p>`,null);return;}
    window.print();
    modal('标签打印完成了吗？',`<p>本次共 ${rows.length} 张标签。若取消了打印，直接关闭即可。</p><p class="muted">确认打印只记录标签版本，不会扣除餐次。</p>`,'确认已打印 / 已保存 PDF',async()=>save(s=>{
      rows.forEach(row=>{const b=s.boxes.find(b=>b.id===row.id);if(b&&b.version===row.version)b.exportedVersion=b.version;});
    },'已记录本次标签版本'));
  }
  document.addEventListener('click',async event=>{
    const b=event.target.closest('[data-action]');if(!b)return;
    const {action,id}=b.dataset;
    try {
      if(action==='nav'){page=b.dataset.page;query='';render();}
      else if(action==='close')$('#dialog').close();
      else if(action==='meal'){meal=b.dataset.meal;selected.clear();D.sync(state,date,meal);step=D.workflow(state,date,meal).stage;render();}
      else if(action==='today'||action==='tomorrow'){date=action==='today'?D.today():D.nextDate(D.today());selected.clear();D.sync(state,date,meal);step=D.workflow(state,date,meal).stage;render();}
      else if(action==='dish')dishModal(id);
      else if(action==='customer')customerModal(id);
      else if(action==='order')orderModal(b.dataset.customer||'');
      else if(action==='pick'||action==='pick-backups')pickModal(action==='pick-backups');
      else if(action==='add-diners')addDinersModal();
      else if(action==='step'){const next=Number(b.dataset.step),w=D.workflow(state,date,meal);if(next===2&&!w.menuReady||next===3&&!w.rosterReady)return toast('请先完成前一步确认');step=next;render();}
      else if(action==='confirm-menu'){await save(s=>D.confirmMenu(s,date,meal),'菜单已确认，接下来核对用餐名单');step=2;render();}
      else if(action==='confirm-roster'){await save(s=>D.confirmRoster(s,date,meal),'名单已确认，标签已自动生成');step=3;selected.clear();render();}
      else if(action==='replace')replacementModal(id);
      else if(action==='edit-backups'){$('#dialog').close();step=1;render();pickModal(true);}
      else if(action==='use-backup'){await save(s=>D.replaceWithBackup(s,id,Number(b.dataset.index),b.dataset.dish),'已换为备用菜，克重和热量已更新');if(D.checks(state,state.boxes.find(x=>x.id===id)).blocked)replacementModal(id);else $('#dialog').close();}
      else if(action==='portion-rules')portionRules();
      else if(action==='restore-auto'){await save(s=>D.restoreAutomatic(s,s.boxes.find(x=>x.id===id)),'已恢复自动配餐，请核对新克重');$('#dialog').close();}
      else if(action==='box')boxModal(id);
      else if(action==='prep')prepModal();
      else if(action==='history')historyModal(id);
      else if(action==='preview'){previewId=id;render();}
      else if(action==='boohee')modal('搜索薄荷健康','<div class="notice">薄荷健康接口尚未接入，目前无法进行真实查询。</div><p>可以先用“手动添加”保存自己的菜品和热量，接入后再关联薄荷条目。</p>',null);
      else if(action==='reuse'){
        const keys=Object.keys(state.menus).filter(k=>k<`${date}:${meal}`&&k.endsWith(`:${meal}`)&&state.menus[k].length).sort();
        if(!keys.length)return toast('还没有可沿用的菜单，请先选择菜品');
        await save(s=>{const previous=keys.at(-1);D.setMenu(s,date,meal,s.menus[previous]);D.planOf(s,date,meal).backups=D.copy(s.plans?.[previous]?.backups||[]);},'已沿用上次菜单');
      } else if(action==='remove-dish')await save(s=>{const items=D.copy(currentMenu());items.splice(Number(b.dataset.index),1);D.setMenu(s,date,meal,items);});
      else if(action==='remove-backup')await save(s=>D.planOf(s,date,meal).backups.splice(Number(b.dataset.index),1));
      else if(action==='pause')await save(s=>{const box=s.boxes.find(x=>x.id===id);if(box.status==='completed')throw new Error('已完成餐盒不能直接暂停');box.status=box.status==='paused'?'pending':'paused';D.touch(box);},'已更新，本餐暂停不扣餐次');
      else if(action==='complete'){
        if(date>D.today())return toast('到用餐当天再确认分装完成');
        const rows=boxes().filter(x=>x.status==='pending'&&(!selected.size||selected.has(x.id)));
        if(!rows.length)return toast('没有待完成的餐盒');
        modal('确认本餐出餐完成',`<p>将完成 ${rows.length} 份餐盒，并分别扣除对应的餐次。</p><p class="muted">已完成的餐盒会保留当时的菜品、克重和热量依据。</p>`,'确认完成',async()=>save(s=>D.finish(s,rows.map(x=>x.id)),'本餐已完成，餐次已更新'));
      } else if(action==='print'||action==='reprint')await printLabels(action==='reprint');
      else if(action==='retry')await load();
    } catch(error){toast(error.message);}
  });
  document.addEventListener('change',async event=>{
    const t=event.target;
    try {
      if(t.id==='workDate'){if(!t.value)return;date=t.value;selected.clear();D.sync(state,date,meal);step=D.workflow(state,date,meal).stage;render();}
      else if(t.id==='attention'){onlyAttention=t.checked;render();}
      else if(t.id==='selectAll'){selected=new Set(t.checked?boxes().filter(b=>b.status!=='paused').map(b=>b.id):[]);render();}
      else if(t.dataset.diner)await save(s=>{const box=s.boxes.find(b=>b.id===t.dataset.diner);if(box.status==='completed')throw new Error('已完成餐盒不能修改用餐状态');box.status=t.checked?'pending':'paused';D.touch(box);},t.checked?'已恢复本餐':'本餐已暂停，不扣餐次');
      else if(t.dataset.select){t.checked?selected.add(t.dataset.select):selected.delete(t.dataset.select);render();}
      else if(t.dataset.menuIndex!==undefined)await save(s=>{const items=D.copy(currentMenu());items[Number(t.dataset.menuIndex)].grams=Number(t.value);D.setMenu(s,date,meal,items);});
      else if(t.dataset.backupIndex!==undefined)await save(s=>{D.planOf(s,date,meal).backups[Number(t.dataset.backupIndex)].grams=Number(t.value);});
    }catch(error){toast(error.message);render();}
  });
  document.addEventListener('input',event=>{if(event.target.id==='query'){query=event.target.value;const pos=event.target.selectionStart;render();$('#query').focus();$('#query').setSelectionRange(pos,pos);}});
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='settingsForm')return;event.preventDefault();const f=new FormData(event.target);
    try{await save(s=>{s.settings={...s.settings,name:f.get('name').trim(),phone:f.get('phone'),labelWidth:Number(f.get('labelWidth')),labelHeight:Number(f.get('labelHeight')),fallbackCalorieBasis:f.get('fallbackCalorieBasis')};s.boxes.filter(b=>b.status!=='completed').forEach(D.touch);},'店铺设置已保存');}catch(error){$('#settingsError').textContent=error.message;}
  });
  load().catch(error=>{$('#app').innerHTML=`<div class="loading"><h2>暂时没有连上系统</h2><p>${h(error.message)}</p>${btn('重新连接','retry','','primary')}</div>`;});
})();
