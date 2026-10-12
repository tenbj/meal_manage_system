(() => {
  'use strict';
  const D = window.MealDomain, $ = selector => document.querySelector(selector);
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const uid = prefix => `${prefix}_${crypto.randomUUID()}`;
  const list = value => String(value || '').split(/[,，、\n]/).map(s => s.trim()).filter(Boolean);
  const localTime = value => value ? new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) : '历史导入';
  const mealName = m => m === 'lunch' ? '午餐' : '晚餐';
  const icon = d => ({ '主食':'🍚', '素':'🥬', '海鲜':'🐟', '荤':'🍲' }[d?.category] || '🍽');
  const sourceTag = d => D.validNutrition(d) ? `<span class="tag">${d.nutrition.source === 'boohee' ? '薄荷健康' : '商家录入'}</span>` : '<span class="tag warn">热量待确认</span>';
  const btn = (label, action, extra = '', cls = '') => `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
  const input = (label, name, value = '', type = 'text', attrs = '') => `<label class="field">${label}<input name="${name}" type="${type}" value="${h(value)}" ${attrs}></label>`;
  const options = (values, selected) => values.map(([v,l]) => `<option value="${h(v)}" ${v === selected ? 'selected' : ''}>${h(l)}</option>`).join('');
  let state, revision, saving = false, page = 'today', date = D.nextDate(D.today()), step = 1, meal = 'lunch', query = '', onlyAttention = false, selected = new Set(), previewId = '', timer, viewMode='planning', customerFilter='all', foodResults=[], foodSource='', foodSearchPage=1, foodHasMore=false, dialogReturn=null, pickerDraft=null, foodContext=null, foodRequestId=0;
  const currentMenu = () => state.menus[`${date}:${meal}`] || [];
  const boxes = () => state.boxes.filter(b => b.date === date && b.meal === meal);
  const customer = id => state.customers.find(c => c.id === id);
  async function load() {
    const response = await fetch('/api/merchant', { cache:'no-store' });
    if (!response.ok) throw new Error('系统暂时无法读取数据，请稍后重试');
    const result = await response.json(); state = D.hydrate(result.state);state.rosterMode='manual'; revision = result.revision;
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
  const navs = [['today','◷','备餐工作台','前晚定好，次日贴好标签，照着克重分装。'],['customers','♧','客户与订单','看清客户、每次续订和每一餐的去向。'],['dishes','▦','我的菜品','常用菜记一次，以后直接选。'],['settings','⚙','店铺设置','设置一次，每天少做一点。']];
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
    return `<div class="portion-summary"><b>${a.target.kcal?`目标 ${a.target.kcal} kcal`:'目标待确认'}</b><span>实际 ${n.complete?`${n.kcal} kcal`:'热量待补充'}</span><span class="tag ${a.status==='auto'?'':a.status==='manual'?'gray':'warn'}">${a.status==='auto'?'自动配餐':a.status==='manual'?'手动克重':'暂用基准克重'}</span></div><div class="customer-note">${h(a.status==='auto'?a.target.message+(a.target.source==='default'&&n.complete?(n.kcal>=400&&n.kcal<=600?' · 在可接受范围内':' · 超出 400–600 范围，请调整'):''):a.message)}</div>`;
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
    return `<div class="toolbar"><div class="actions"><div class="segment">${btn('准备明天','tomorrow','',viewMode==='planning'&&date===tomorrow?'active':'')}${btn('今天分装','today','',viewMode==='packing'?'active':'')}</div><input aria-label="用餐日期" id="workDate" type="date" value="${date}"><div class="segment">${btn('午餐','meal','data-meal="lunch"',meal==='lunch'?'active':'')}${btn('晚餐','meal','data-meal="dinner"',meal==='dinner'?'active':'')}</div></div><span class="muted">${date===tomorrow?'为明天做好准备':date===t?'按标签称重，完成后扣餐次':'正在安排所选日期的餐食'}</span></div>
    ${viewMode==='packing'?packingPage(w):`<div class="workflow-steps" aria-label="备餐步骤">${[['定菜单','主菜单＋一荤一素备用菜'],['确认用餐人','核对忌口，直接换备用菜'],['打印标签','先贴餐盒，再按克重分装']].map(([title,sub],i)=>`<button type="button" data-action="step" data-step="${i+1}" class="workflow-step ${step===i+1?'active':''} ${(i===0&&w.menuReady)||(i===1&&w.rosterReady)?'done':''}" ${i===1&&!w.menuReady||i===2&&!w.rosterReady?'disabled':''}><span>${(i===0&&w.menuReady)||(i===1&&w.rosterReady)?'✓':i+1}</span><div><b>${title}</b><small>${sub}</small></div></button>`).join('')}</div>
    ${step===1?menuStage(w,plan):step===2?rosterStage(w):labelsStage(w)}`}`;
  }
  function menuStage(w,plan) {
    const repeats=D.menuRepeats(state,date,meal);
    return `${repeats.length?`<div class="notice"><b>请换掉重复菜</b> · ${repeats.map(r=>`${h(D.dishOf(state,r.dishId)?.name)}（${r.date} ${mealName(r.meal)}）`).join('、')}</div>`:''}<div class="plan-layout"><div class="stack"><section class="card"><div class="section-head"><div><h2>本餐主菜单</h2><span class="muted">${menuCounts(currentMenu())}，先选菜，再按客户目标自动算克重</span></div><div class="actions">${btn('选择主菜','pick','','primary')}</div></div><div class="body"><div class="hint">这里是基准份量，决定同组菜品的搭配比例。每盒克重会按客户目标自动换算，主食占本餐热量 1/3。${btn("查看计算规则","portion-rules","","text small")}</div>${currentMenu().length?menuRows(currentMenu()):'<div class="empty"><strong>明天做哪些菜？</strong>主食、荤菜、素菜自由组合，不限制固定搭配。</div>'}</div></section><section class="card reserve-card"><div class="section-head"><div><h2>备用菜 <span class="tag">${plan.backups.length} / 2 道</span></h2><span class="muted">准备 2 道（一荤一素），用于替换忌口冲突的主菜</span></div>${btn('选择备用菜','pick-backups')}</div><div class="body">${plan.backups.length?menuRows(plan.backups,true):'<div class="empty compact">还没有备用菜。选好后，下一步可直接点击替换。</div>'}<div class="hint">备用菜不会默认装进每盒；实际换入后，才计入那份餐的热量和分装总量。</div></div></section><div class="stage-footer"><span class="muted">${w.menuValid?'菜单已准备好，下一步核对谁来吃。':'主菜与一荤一素备用菜均需有完整热量。'}</span>${btn('菜单定好了，确认用餐人 →','confirm-menu',w.menuValid&&!repeats.length?'':'disabled','primary')}</div></div><aside class="card planning-note"><div class="body"><div class="eyebrow">提前一晚，安排清楚</div><h2 style="margin:10px 0 20px">${date.slice(5)} · ${mealName(meal)}</h2><div class="prep-row"><span>主菜单</span><b>${currentMenu().length} 道</b></div><div class="prep-row"><span>备用菜</span><b>${plan.backups.length} 道</b></div><div class="prep-row"><span>订餐已排入</span><b>${w.live.length} 份</b></div><p class="muted">先把每道菜的分装克重定好。个别客户需要不同分量，下一步单独调整。</p><div class="workflow-tip">主菜和备用菜可以随时改。已经打印的餐盒受影响时，会提醒重打。</div></div></aside></div>`;
  }
  function rosterStage(w) {
    const rows=boxes(), active=rows.filter(b=>!['paused','cancelled'].includes(b.status));
    const shown=onlyAttention?rows.filter(b=>!['paused','cancelled'].includes(b.status)&&(D.checks(state,b).blocked||w.missingAddress.some(x=>x.id===b.id))):rows;
    return `<section class="card"><div class="section-head"><div><h2>确认这餐谁来吃</h2><span class="muted">已安排 ${active.length} 份 · 取消 / 暂停 ${rows.length-active.length} 份 · 忌口待处理 ${w.conflicts.length} 份</span></div><div class="actions">${btn('＋ 添加用餐人','add-diners')}${btn('登记新客户','customer','','primary')}</div></div><div class="roster-filter"><label class="flex muted"><input type="checkbox" id="attention" ${onlyAttention?'checked':''}>只看忌口或地址待处理</label><span class="muted">取消时由你决定是否扣餐次，并记录原因</span></div>${shown.length?`<div class="table-wrap"><table class="roster-table"><thead><tr><th>吃这餐</th><th>客户 / 配送</th><th>实际装盒内容</th><th>核对与调整</th></tr></thead><tbody>${shown.map(boxRow).join('')}</tbody></table></div>`:`<div class="empty"><strong>${onlyAttention?'没有待处理的用餐人':'还没有人安排这餐'}</strong>${onlyAttention?'可以继续生成标签。':'先登记客户，再通过“添加用餐人”统一安排本餐。'}</div>`}<div class="footer-actions"><div>${btn('← 改菜单','step','data-step="1"','text')}<span class="muted">${w.conflicts.length?'先用备用菜解决冲突':w.missingAddress.length?'请补齐配送地址或选自提':active.length?'名单已就绪':'先添加用餐人'}</span></div>${btn('名单确认，生成标签 →','confirm-roster',!active.length||w.conflicts.length||w.missingAddress.length||w.missingNutrition.length||!w.menuReady?'disabled':'','primary')}</div></section>`;
  }
  function boxRow(b) {
    const c=b.customerSnapshot||customer(b.customerId),check=D.checks(state,b),paused=['paused','cancelled'].includes(b.status);
    const recipient=c?.nickname||c?.name||'未关联客户';
    return `<tr class="${paused?'paused-row':''}"><td>${b.status==='completed'?'<span class="tag">已完成</span>':btn(paused?'恢复':'取消','diner-toggle',`data-id="${h(b.id)}"`,'small')}</td><td><b>${h(recipient)}</b>${c?.nickname&&c.nickname!==c.name?`<div class="customer-note">${h(c.name)}</div>`:''}<div class="customer-note">${h(c?.fulfillment==='pickup'?'自提':c?.address||'配送地址待填写')}</div>${!paused&&c?.fulfillment!=='pickup'&&!c?.address?btn('补地址 / 选自提','customer',`data-id="${h(c.id)}"`,'text small amber'):''}</td><td><div class="meal-chips">${b.items.map(i=>`<span class="meal-chip ${!paused&&D.itemCheck(state,b,i).blocked?'conflict':''}">${h((i.snapshot||D.dishOf(state,i.dishId))?.name)} <b>${i.grams}g</b></span>`).join('')}</div>${portionSummary(b)}</td><td>${paused?`<span class="tag gray">${b.status==='cancelled'?(b.chargeCancelled?'已取消 · 扣餐次':'已取消 · 不扣餐次'):'本餐暂停'}</span>`:check.blocked?`<div class="conflict-copy">${h(check.conflicts.join('；')||(check.unknown?'食材未完整，需核对忌口':''))}</div>${btn('换备用菜','replace',`data-id="${h(b.id)}"`,'conflict-button')}`:`<span class="tag">${b.status==='completed'?'已完成':'已记录忌口未发现冲突'}</span>`}${!paused&&!['completed','cancelled'].includes(b.status)?btn('改克重 / 菜品','box',`data-id="${h(b.id)}"`,'text small')+btn('身体资料','customer',`data-id="${h(c.id)}"`,'text small'):''}${b.exportedVersion&&b.exportedVersion!==b.version?'<div class="customer-note inline-error">旧标签作废，需重打</div>':''}</td></tr>`;
  }
  function labelsStage(w) {
    const reprints=w.live.filter(b=>b.exportedVersion&&b.exportedVersion!==b.version), missing=[...new Set(w.live.flatMap(b=>b.items.filter(i=>!D.validNutrition(i.snapshot||D.dishOf(state,i.dishId))).map(i=>i.dishId)))];
    return `<div class="print-banner"><div><h2>先贴标签，再照着克重分装</h2><p>今晚可打印好 ${w.live.length} 张，明天贴在对应餐盒盖上。打印不会扣餐次。</p></div><div class="actions">${btn('查看分装总量','prep')}${btn(selected.size?`打印选中 ${selected.size} 张`:`打印全部 ${w.live.length} 张`,'print',!w.rosterReady?'disabled':'','primary')}</div></div>${!w.rosterReady?`<div class="notice">菜单或名单已发生变化，请重新核对。${btn('返回核对','step',`data-step="${w.menuReady?2:1}"`,'text')}</div>`:''}${missing.length?`<div class="notice"><b>${missing.length} 道菜热量待补充</b> · 补齐后标签会自动显示总热量。<div class="actions" style="margin-top:8px">${missing.map(id=>btn(h(D.dishOf(state,id)?.name),'dish',`data-id="${h(id)}"`,'small')).join('')}</div></div>`:''}${reprints.length?`<div class="notice">${reprints.length} 份餐盒已更改，原标签需替换。${btn('只重打这些标签','reprint','','small')}</div>`:''}<div class="label-toolbar"><span class="muted">按盒号依次贴标 · 昵称、菜品克重与地址一眼看清</span><label class="flex muted"><input type="checkbox" id="selectAll" aria-label="选择全部标签" ${w.live.length&&w.live.every(b=>selected.has(b.id))?'checked':''}>选择全部</label></div><div class="labels-grid">${w.live.map(b=>`<div class="label-tile"><div class="label-tile-head"><label class="flex"><input type="checkbox" data-select="${h(b.id)}" aria-label="选择${h(customer(b.customerId)?.nickname||customer(b.customerId)?.name)}标签" ${selected.has(b.id)?'checked':''}>${b.status==='completed'?'已出餐':b.exportedVersion===b.version?'已打印':'待打印'}</label>${b.exportedVersion&&b.exportedVersion!==b.version?'<span class="tag red">需重打</span>':''}${!['completed','cancelled'].includes(b.status)?btn('改这份餐','box',`data-id="${h(b.id)}"`,'text small'):''}</div>${labelHtml(b)}</div>`).join('')}</div><div class="stage-footer"><div>${btn('← 改用餐名单','step','data-step="2"','text')}<span class="muted">次日按标签分装完成后，再确认出餐。</span></div>${btn('本餐分装完成','complete',date>D.today()?'disabled title="到用餐当天再确认完成"':'','primary')}</div>`;
  }

  function customersPage() {
    const ordersFor=c=>state.orders.filter(o=>o.customerId===c.id), plansFor=c=>ordersFor(c).filter(o=>D.orderKind(o)==='plan');
    const buyers=state.customers.filter(c=>ordersFor(c).length),planBuyers=buyers.filter(c=>plansFor(c).length),singleBuyers=buyers.filter(c=>!plansFor(c).length);
    const matches=state.customers.filter(c=>`${c.name} ${c.nickname||''} ${c.phone||''}`.includes(query)).filter(c=>customerFilter==='all'||customerFilter==='plan'&&plansFor(c).length||customerFilter==='single'&&ordersFor(c).length&&!plansFor(c).length||customerFilter==='new'&&!ordersFor(c).length);
    return `<div class="stat-grid">${[['累计订餐人数',buyers.length],['包餐客户',planBuyers.length],['仅单次客户',singleBuyers.length],['包餐待用餐次',state.orders.filter(o=>D.orderKind(o)==='plan').reduce((n,o)=>n+D.remaining(state,o),0)]].map(([label,n])=>`<section class="card stat-card"><span>${label}</span><strong>${n}</strong></section>`).join('')}</div><div class="toolbar"><div class="actions"><input class="search" id="query" value="${h(query)}" placeholder="搜索昵称、姓名或电话" aria-label="搜索客户"><select id="customerFilter" aria-label="客户类型">${options([['all','全部客户'],['plan','包餐客户'],['single','仅单次客户'],['new','已登记未订餐']],customerFilter)}</select></div>${btn('登记新客户','customer')}</div><section class="card"><div class="table-wrap"><table><thead><tr><th>序号</th><th>客户</th><th>订餐类型</th><th>累计购买</th><th>包餐剩余</th><th>管理</th></tr></thead><tbody>${matches.map(c=>{const os=ordersFor(c),ps=plansFor(c),left=ps.reduce((n,o)=>n+D.remaining(state,o),0),reserved=ps.reduce((n,o)=>n+D.reserved(state,o),0);return `<tr><td>${String(state.customers.indexOf(c)+1).padStart(3,'0')}</td><td><b>${h(c.nickname||c.name)}</b><div class="customer-note">${h(c.nickname?c.name:'')}${c.phone?' · '+h(c.phone):''}</div></td><td><span class="tag ${ps.length?'':'gray'}">${ps.length?'包餐客户':os.length?'单次客户':'已登记未订餐'}</span>${ps.length&&os.some(o=>D.orderKind(o)==='single')?'<div class="customer-note">也有单次订餐</div>':''}</td><td>${ps.length} 期包餐 / ${os.length-ps.length} 单单次</td><td><b class="credit">${left}</b> 餐<div class="customer-note">其中已安排 ${reserved} 餐，尚未扣除</div></td><td><div class="actions">${btn('包餐账本 / 记录','history',`data-id="${h(c.id)}"`,'small')}${btn('购买 / 续订包餐','order',`data-customer="${h(c.id)}"`,'small')}${btn('客户资料','customer',`data-id="${h(c.id)}"`,'text small')}</div></td></tr>`;}).join('')}</tbody></table></div>${!matches.length?'<div class="empty">暂无匹配客户。登记不会自动安排出餐。</div>':''}</section><p class="hint">人数按客户去重；每次续订独立成一期。剩余 = 购买 + 手动补扣 − 已出餐 − 取消仍扣次数；已安排但未出餐的餐次单列显示。</p>`;
  }
  function dishesPage() {
    const matches=state.dishes.filter(d=>`${d.name} ${d.category}`.includes(query));
    return `<div class="toolbar"><input class="search" id="query" value="${h(query)}" placeholder="搜索我的菜品" aria-label="搜索菜品"><div class="actions">${btn('搜索并添加','boohee','','primary')}${btn('＋ 手动添加','dish','','primary')}</div></div><div class="hint">优先使用已保存菜品。点击“搜索并添加”时，先查询本库，没有结果再查询薄荷；确认添加后会保留在这里。</div><div class="dish-grid">${matches.slice(0,90).map(d=>`<section class="card dish-card"><div class="dish-title"><span class="food-icon">${icon(d)}</span><div><h3>${h(d.name)}</h3>${sourceTag(d)}</div></div><div class="dish-meta"><span>${D.validNutrition(d)?`${d.nutrition.kcal100} kcal / 100 g`:'热量未确认'}</span><span>基准 ${d.defaultGrams||150} g</span></div>${btn('编辑菜品与热量','dish',`data-id="${h(d.id)}"`)}</section>`).join('')}</div>${matches.length>90?'<div class="hint">当前显示前 90 道菜，请输入名称进一步查找。</div>':''}${!matches.length?'<div class="empty">没有找到菜品，可以直接手动添加。</div>':''}`;
  }
  function settingsPage() {
    return `<div class="settings-grid"><section class="card"><div class="section-head"><h2>店铺与标签</h2></div><form id="settingsForm"><div class="body">${input('店铺名称','name',state.settings.name,'text','required maxlength="60"')}${input('联系电话','phone',state.settings.phone)}<div class="form-grid">${input('标签宽度 · mm','labelWidth',state.settings.labelWidth,'number','required min="30" max="150"')}${input('标签高度 · mm','labelHeight',state.settings.labelHeight,'number','required min="30" max="150"')}</div><div id="settingsError" class="form-error"></div><button class="primary" type="submit">保存设置</button></div></form></section><section class="card"><div class="section-head"><h2>自动配餐原则</h2></div><div class="body"><div class="calorie-feature"><strong>500 <small>kcal / 餐</small></strong><p>资料不全时统一使用 · 400–600 kcal 均在可接受范围</p></div><p>身体资料齐全的成年人：静息代谢估算 × 36%。</p><p>主食分配 1/3 热量，其余菜分配 2/3；按成品热量换算每道菜的克重。</p>${btn('查看计算规则','portion-rules','','text')}<hr><h3>薄荷健康连接</h3><p class="muted">搜索先查我的数据库，没有结果再查薄荷。确认添加后存入自己的菜品库。</p>${btn('连接 / 检查薄荷健康','connect-boohee','','primary')}</div></section></div>`;
  }
  function portionRules() {
    modal('热量和克重怎么算',`<div class="rule-steps"><h3>1. 确定这一餐的目标</h3><p>身体资料齐全的成年人，使用 Mifflin–St Jeor 公式估算静息代谢，再乘 36%。午餐、晚餐各自计算同一目标。</p><div class="hint">女：10 × 体重 kg ＋ 6.25 × 身高 cm − 5 × 年龄 − 161<br>男：10 × 体重 kg ＋ 6.25 × 身高 cm − 5 × 年龄 ＋ 5</div><p>例如：女，30 岁，160 cm，60 kg → 估算 1289 kcal/日 → 本餐目标 464 kcal。</p><p>身体资料不全时，不分性别统一以 500 kcal 为目标；实际装盒热量在 400–600 kcal 范围内即可。</p><h3>2. 主食分到 1/3 的热量</h3><p>464 kcal 的一餐：主食约 155 kcal，其余菜约 309 kcal。这里的 1/3 是热量比例，不是重量或餐盒体积。</p><h3>3. 用成品热量反推克重</h3><p>克重 ＝ 分配到的热量 ÷ 每 100 g 成品热量 × 100，取整到 1 g。多个主食在主食组内分配，其余菜在菜组内分配。</p><p>同组按菜单基准份量同比缩放：例如两道菜基准 150 g 和 100 g，自动配餐后仍保持约 3:2 的克重比例。每种食谱与热量密度不同，最终克重也会不同。</p><h3>菜单里的基准克重</h3><p>由商家设定，只用于确定搭配比例。历史导入初值：主食 120 g、其他菜 150 g；新菜初值 150 g。这些不是根据客户计算的数字。可在菜品资料或本餐菜单修改。</p><div class="notice">标签上的热量按最终克重重新求和，取整可能与目标略有差异。缺少菜品成品热量或主食时，暂用基准克重并提示原因；手动改克重后不会被自动覆盖。</div><p class="muted">公式是静息代谢估算；36% 和 1/3 是本店配餐规则，不等于个人全天营养需求。菜品热量只使用薄荷健康或商家录入，烹调用油需计入成品数据。</p><a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noopener">查看公式原始研究 ↗</a></div>`,null);
  }
  function modal(title, body, submitLabel, handler, onClose=null) {
    const dialog=$('#dialog'); if(dialog.open)dialog.close();
    dialog.innerHTML=`<form id="modalForm"><div class="modal-head"><h2>${title}</h2>${btn('×','close','aria-label="关闭"','text')}</div><div class="modal-body">${body}<div id="formError" class="form-error" role="alert"></div></div><div class="modal-foot">${btn('关闭','close')}${submitLabel?`<button type="submit" class="primary">${submitLabel}</button>`:''}</div></form>`;
    dialogReturn=onClose;dialog.oncancel=e=>{e.preventDefault();closeModal();};dialog.showModal();
    $('#modalForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const close=await handler(new FormData(event.currentTarget));if(close!==false)dialog.close();}catch(error){$('#formError').textContent=error.message;}finally{button.disabled=false;}};
  }
  function closeModal() { const back=dialogReturn;dialogReturn=null;$('#dialog').close();if(back)back(); }
  function dishModal(id,onSaved=null,defaults={},onBack=null) {
    const d=state.dishes.find(d=>d.id===id), known=D.validNutrition(d),itemId=d?.id||uid('dish');
    modal(d?'编辑菜品':'手动添加菜品',`${!known&&d?'<div class="notice">旧版数值没有自动带入。请核对依据后填写，保存为商家录入。</div>':''}<div class="form-grid">${input('菜品名称','name',d?.name||defaults.name||'','text','required maxlength="120"')}<label class="field">分类<select name="category">${options(['主食','荤','素','海鲜'].map(x=>[x,x]),d?.category||defaults.category||'荤')}</select></label>${input('每 100 g 热量 · kcal','kcal',known?d.nutrition.kcal100:'','number','required min="0" max="900" step="0.01"'+(d?.nutrition?.source==='boohee'?' readonly':''))}${input('基准份量 · g（决定搭配比例）','grams',d?.defaultGrams||150,'number','required min="1" max="10000"')}<label class="field wide">重量口径<select name="basis">${options([['cooked','烹调后的成品熟重'],['ready','包装即食 / 可食部分重量']],d?.nutrition?.basis||'cooked')}</select></label><div class="wide">${input('热量数值依据','reference',known?d.nutrition.reference:'','text','required placeholder="如：产品包装营养标签、配方核算记录"')}${input('实际食材（逗号分隔，用于忌口核对）','ingredients',(d?.ingredients||[]).join('，'),'text','placeholder="如：鸡肉，番茄，食用油"')}</div></div><div class="muted">基准份量由商家设定，不是客户最终克重；新菜初始填 150 g，可自行调整。${d?.nutrition?.source==='boohee'?'此菜的薄荷热量与来源为只读，保存仅更新商家的分类、基准克重及实际食材。':'手动填写的热量会标记为商家录入。'}缺少食材时不能自动判断忌口。</div>`,onSaved?'保存并选入本餐':'保存菜品',async f=>{await save(s=>{
      const item={...(d||{}),id:itemId,name:f.get('name').trim(),category:f.get('category'),ingredients:list(f.get('ingredients')),defaultGrams:Number(f.get('grams')),nutrition:d?.nutrition?.source==='boohee'?d.nutrition:{source:'manual',kcal100:Number(f.get('kcal')),basis:f.get('basis'),reference:f.get('reference').trim(),updatedAt:new Date().toISOString()}};
      const at=s.dishes.findIndex(x=>x.id===item.id);if(at<0)s.dishes.push(item);else s.dishes[at]=item;
      s.boxes.filter(b=>!['completed','cancelled'].includes(b.status)&&b.items.some(i=>i.dishId===item.id)).forEach(D.touch);
    },'菜品已保存，可直接用于出餐');if(onSaved){onSaved(itemId);return false;}},onBack);
  }
  function customerModal(id) {
    const c=customer(id);
    modal(c?'编辑客户 / 配送':'新增客户',`<div class="form-grid">${input('客户称呼','name',c?.name||'','text','required maxlength="80"')}${input('标签昵称（选填）','nickname',c?.nickname||'','text','placeholder="不填则使用客户称呼"')}${input('忌口食材（选填）','restrictions',(c?.restrictions||[]).join('，'))}${input('过敏食材（选填）','allergies',(c?.allergies||[]).join('，'))}<label class="field">领取方式<select name="fulfillment">${options([['delivery','配送到地址'],['pickup','顾客自提']],c?.fulfillment||'delivery')}</select></label>${input('联系电话（选填）','phone',c?.phone||'')}<div class="wide">${input('配送地址','address',c?.address||'','text',c?.fulfillment==='pickup'?'':'required')}${input('其他备注（选填）','notes',c?.notes||'')}</div></div><h3>自动配餐资料</h3>${bodyFields(c||{})}`,'保存客户',async f=>save(s=>{
      const item={...(c||{}),...readBody(f),id:c?.id||uid('customer'),name:f.get('name').trim(),nickname:f.get('nickname').trim(),fulfillment:f.get('fulfillment'),phone:f.get('phone'),address:f.get('address').trim(),notes:f.get('notes'),restrictions:list(f.get('restrictions')),allergies:list(f.get('allergies'))};
      if(item.fulfillment==='delivery'&&!item.address)throw new Error('请填写配送地址或选择自提');
      const at=s.customers.findIndex(x=>x.id===item.id);if(at<0)s.customers.push(item);else s.customers[at]=item;
      s.boxes.filter(b=>b.customerId===item.id&&!['completed','cancelled'].includes(b.status)).forEach(D.touch);
    }));
    bindDelivery();bindBodyPreview();
  }
  function bindDelivery() {
    const select=$('#dialog select[name=fulfillment]'), address=$('#dialog input[name=address]');
    if(select&&address){select.onchange=()=>{address.required=select.value==='delivery';address.placeholder=select.value==='pickup'?'自提无需填写地址':'小区 / 楼栋 / 门牌号';};select.onchange();}
  }

  function orderModal(customerId='') {
    if(!customerId)return toast('请先登记客户，再从客户与订单中购买或续订包餐');
    modal(`为 ${h(customer(customerId)?.name)} 购买 / 续订包餐`,`<div class="hint">每次购买独立记录为一期餐卡；安排用餐时优先使用有效期内最早购买、尚有可用餐次的餐卡。保存不会自动安排用餐。</div><div class="form-grid">${input('购买次数','credits',10,'number','required min="1" max="99999"')}${input('实收金额 · 元（选填）','price','','number','min="0" step="0.01"')}${input('生效日期','startDate',D.today(),'date','required')}${input('到期日期','endDate',D.nextDate(D.today(),30),'date','required')}<label class="field">适用餐别<select name="meal"><option value="both">午餐和晚餐均可</option><option value="lunch">仅午餐</option><option value="dinner">仅晚餐</option></select></label><label class="field">付款状态<select name="paidStatus"><option>已付款</option><option>未付款</option><option>未记录</option></select></label></div>${input('本期备注','notes')}`,'保存本期包餐',async f=>save(s=>{
      s.orders.push({id:uid('order'),customerId,kind:'plan',serviceType:'包餐',createdAt:new Date().toISOString(),startDate:f.get('startDate'),endDate:f.get('endDate'),meals:f.get('meal')==='both'?['lunch','dinner']:[f.get('meal')],weekdays:[0,1,2,3,4,5,6],portions:1,credits:Number(f.get('credits')),price:f.get('price')===''?null:Number(f.get('price')),status:'服务中',paidStatus:f.get('paidStatus'),notes:f.get('notes')});
    },'已保存新一期包餐，请在备餐工作台添加用餐人'));
  }
  function pickModal(reserve=false,draft=null) {
    const chosen=reserve?D.planOf(state,date,meal).backups:currentMenu(),other=reserve?currentMenu():D.planOf(state,date,meal).backups;
    pickerDraft=draft||{reserve,ids:chosen.map(i=>i.dishId),query:'',category:''};draft=pickerDraft;
    modal(reserve?'选择 2 道（一荤一素）备用菜':'选择本餐主菜',`<input class="search" id="pickSearch" placeholder="先搜我的菜品，没有就直接添加" aria-label="搜索常用菜" maxlength="30" value="${h(draft.query)}"><div class="pill-row" style="margin-top:12px"><select id="pickCategory" aria-label="筛选菜品分类">${options([['','全部分类'],['荤','荤菜'],['素','素菜'],['主食','主食'],['海鲜','海鲜']],draft.category)}</select><span class="muted">热量完整才可勾选 · ${reserve?'固定一荤一素':'荤素数量自由搭配'}</span></div><div id="pickSelected" class="pick-selected"></div><div class="pick-list">${state.dishes.map(d=>{const blocked=other.some(i=>i.dishId===d.id),ready=D.validNutrition(d);return `<div class="pick-row" data-name="${h(d.name)}" data-category="${h(d.category)}"><label class="pick-option grow"><input name="dish" type="checkbox" value="${h(d.id)}" ${draft.ids.includes(d.id)?'checked':''} ${blocked||!ready?'disabled':''}><span>${h(d.name)}<small class="customer-note">${blocked?`已选为${reserve?'主菜':'备用菜'}`:ready?`${d.nutrition.kcal100} kcal / 100g`:'请先补全成品热量'}</small></span></label>${ready?sourceTag(d):btn('补全并选入','pick-edit',`data-id="${h(d.id)}"`,'text small')}</div>`;}).join('')}</div><div id="pickEmpty" class="empty compact" hidden>我的菜品中没有匹配结果。</div><div class="pick-add"><div><b>没找到想要的菜？</b><small>在这里添加，自动存入菜品库，并勾选到本餐。</small></div><div class="actions">${btn('去薄荷搜索','pick-online','','primary')}${btn('手动新建','pick-create')}</div></div>`,'使用这些菜',async()=>{
      capturePicker();const ids=draft.ids;
      if(reserve&&(ids.length!==2||ids.filter(id=>['荤','海鲜'].includes(D.dishOf(state,id).category)).length!==1||ids.filter(id=>D.dishOf(state,id).category==='素').length!==1))throw new Error('备用菜必须正好一荤一素');
      await save(s=>{const items=ids.map(id=>chosen.find(i=>i.dishId===id)||{dishId:id,grams:D.dishOf(s,id).defaultGrams||150});D.requireNutrition(s,items);if(reserve)D.planOf(s,date,meal).backups=items;else D.setMenu(s,date,meal,items);},reserve?'备用菜已保存':'主菜单已更新');pickerDraft=null;
    });
    const filter=()=>{
      capturePicker();let visible=0;document.querySelectorAll('.pick-row').forEach(row=>{row.hidden=!row.dataset.name.toLowerCase().includes(draft.query.toLowerCase())||!!draft.category&&row.dataset.category!==draft.category;if(!row.hidden)visible++;});
      $('#pickEmpty').hidden=visible>0;$('#pickSelected').textContent=`已勾选 ${draft.ids.length} 道${draft.ids.length?'：'+draft.ids.map(id=>D.dishOf(state,id)?.name).join('、'):''}`;
    };
    $('#pickSearch').oninput=filter;$('#pickSearch').onkeydown=e=>{if(e.key==='Enter')e.preventDefault();};$('#pickCategory').onchange=filter;$('#dialog').querySelectorAll('[name=dish]').forEach(el=>el.onchange=filter);filter();
  }
  function capturePicker() {
    if(!pickerDraft||!$('#pickSearch'))return pickerDraft;
    pickerDraft.ids=[...$('#dialog').querySelectorAll('[name=dish]:checked:not(:disabled)')].map(el=>el.value);
    pickerDraft.query=$('#pickSearch').value.trim();pickerDraft.category=$('#pickCategory').value;return pickerDraft;
  }
  function returnToPicker(draft,id) {
    if(id){const other=draft.reserve?currentMenu():D.planOf(state,date,meal).backups;
      if(other.some(i=>i.dishId===id))toast('该菜已在另一组菜单，请先移除后再选');
      else if(!draft.ids.includes(id))draft.ids.push(id);
      draft.query='';draft.category='';
    }
    pickModal(draft.reserve,draft);
  }
  function replacementModal(id) {
    const box=state.boxes.find(b=>b.id===id);if(!box||box.status==='completed')return;
    const backups=D.planOf(state,date,meal).backups;
    const affected=box.items.map((item,index)=>({item,index,check:D.itemCheck(state,box,item)})).filter(x=>x.check.blocked);
    modal(`为 ${h(customer(box.customerId)?.nickname||customer(box.customerId)?.name)} 换备用菜`,affected.map(({item,index,check})=>`<div class="replacement-block"><h3>${h(D.dishOf(state,item.dishId)?.name)} <span class="tag red">需要替换</span></h3><p class="muted">${h(check.conflicts.join('、')||'该菜食材未完整，无法核对忌口')}</p><div class="backup-options">${backups.map(candidate=>{const c=D.itemCheck(state,box,candidate),duplicate=box.items.some((i,n)=>n!==index&&i.dishId===candidate.dishId);return btn(`${h(D.dishOf(state,candidate.dishId)?.name)} <b>基准 ${candidate.grams}g</b><small>${duplicate?'本盒已有这道菜':c.blocked?h(c.conflicts.join('、')||'食材未完整，需核对'):'点击替换本盒这道菜'}</small>`,'use-backup',`data-id="${h(id)}" data-index="${index}" data-dish="${h(candidate.dishId)}" ${c.blocked||duplicate?'disabled':''}`,'backup-option');}).join('')}</div></div>`).join('')+`<div class="hint">只影响这一份餐。自动配餐会重新换算所有菜的克重；手动餐盒使用备用基准克重，可继续调整。</div>${btn('备用菜不合适，返回调整','edit-backups','','text')}`,null);
  }
  function addDinersModal() {
    const existing=new Set(boxes().map(b=>b.customerId));
    modal('添加本餐用餐人',`<p class="muted">仅从已登记客户中选择。有可用餐卡优先扣对应期次；没有可用餐卡则记为单次订单。取消记录请在名单中恢复。</p><div class="pick-list">${state.customers.filter(c=>!existing.has(c.id)).map(c=>{const o=D.usableOrders(state,c.id,date,meal)[0];return `<label class="pick-row"><input name="customer" type="checkbox" value="${h(c.id)}"><span class="grow">${h(c.nickname||c.name)}<small class="customer-note">${h(c.fulfillment==='pickup'?'自提':c.address||'待补地址')}</small></span><small class="muted">${o?`${h(D.orderLabel(state,o))} · 可安排 ${D.remaining(state,o)-D.reserved(state,o)} 餐`:'本次记单次订单'}</small></label>`;}).join('')||'<p class="muted">没有可添加的客户，请先登记新客户。</p>'}</div>`,'添加到本餐',async f=>{const ids=f.getAll('customer');if(!ids.length)throw new Error('请选择至少一位客户');await save(s=>ids.forEach(cid=>D.addDiner(s,cid,date,meal,uid)),'已添加，请核对忌口与克重');});
  }
  function packingPage(w) {
    const pending=w.live.filter(b=>b.status==='pending'),cancelled=boxes().filter(b=>['cancelled','paused'].includes(b.status));
    return `<div class="packing-heading"><div><h2>照着这张清单装盒</h2><p class="muted">${w.live.length} 盒 · 待分装 ${pending.length} 盒 · 已完成 ${w.live.length-pending.length} 盒</p></div><div class="actions">${btn('调整今日菜单 / 名单','edit-plan')}${btn('按菜汇总重量','prep')}${btn('打印本餐标签','print',w.rosterReady?'':'disabled','primary')}</div></div>${!w.rosterReady?`<div class="notice">今日菜单或名单还未确认，请先核对后分装。${btn('去核对','edit-plan','','text')}</div>`:''}<div class="packing-grid">${w.live.map(b=>{const c=b.customerSnapshot||customer(b.customerId);return `<article class="card packing-card ${b.status==='completed'?'packed':''}"><header><div><small>#${String(boxes().indexOf(b)+1).padStart(3,'0')}</small><h2>${h(c?.nickname||c?.name)}</h2><p>${h(c?.fulfillment==='pickup'?'自提':c?.address||'地址待填写')}</p></div><span class="tag">${b.status==='completed'?'已分装':'待分装'}</span></header><div class="packing-foods">${b.items.map(i=>`<div><span>${h((i.snapshot||D.dishOf(state,i.dishId))?.name)}</span><strong>${i.grams}<small> g</small></strong></div>`).join('')||'<p>本餐菜单待设置</p>'}</div><footer>${b.status==='completed'?'<span class="muted">已扣 1 餐次</span>':btn('这盒装好了','finish-box',`data-id="${h(b.id)}" ${w.rosterReady?'':'disabled'}`,'primary')}${btn('取消 / 退餐','cancel-box',`data-id="${h(b.id)}"`,'text small')}</footer></article>`;}).join('')||'<div class="empty">今日还没有安排用餐人。可先调整今日名单。</div>'}</div>${cancelled.length?`<section class="card body"><h3>本餐已取消 / 暂停</h3>${cancelled.map(b=>`<div class="prep-row"><span>${h(customer(b.customerId)?.nickname||customer(b.customerId)?.name)} · ${b.chargeCancelled?'仍扣 1 次':'不扣餐次'}<small> ${h(b.cancelReason||'')}</small></span>${btn('恢复用餐','resume-box',`data-id="${h(b.id)}"`,'small')}</div>`).join('')}</section>`:''}`;
  }
  function cancelModal(id) {
    const b=state.boxes.find(b=>b.id===id);if(!b)return;
    modal(`取消 ${h(customer(b.customerId)?.nickname||customer(b.customerId)?.name)} · ${b.date} ${mealName(b.meal)}`,`<p>取消后从分装清单移除，原记录保留。</p><label class="field">餐次怎么处理<select name="charge"><option value="no">不扣餐次（已扣则返还）</option><option value="yes">仍扣 1 次（按本店取消规则）</option></select></label>${input('取消原因','reason','','text','required placeholder="如：顾客早上临时有事，商定返还餐次"')}`,'确认取消',async f=>save(s=>D.cancelBox(s,id,f.get('charge')==='yes',f.get('reason')),'已取消，餐次已更新；请弃用这盒旧标签'));
  }
  function adjustmentModal(id) {
    const o=state.orders.find(o=>o.id===id);
    modal(`调整 ${h(D.orderLabel(state,o))} 的剩余次数`,`<p>当前剩余 <b>${D.remaining(state,o)}</b> 次，其中已安排 ${D.reserved(state,o)} 次。修改会生成补扣流水，原购买次数不变。</p>${input('调整后的剩余次数','balance',D.remaining(state,o),'number','required min="0" step="1"')}${input('调整原因','reason','','text','required')}`,'保存调整流水',async f=>save(s=>D.adjustBalance(s,id,Number(f.get('balance')),f.get('reason'),uid('adjustment')),'已记录餐次调整'));
  }
  async function providerRequest(path,body) {
    let response;try{response=await fetch('/api/merchant/nutrition/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});}catch{throw new Error('无法连接本机系统服务，请确认系统已启动后重试');}
    let data;try{data=await response.json();}catch{throw new Error(`本机服务响应异常（HTTP ${response.status}），请刷新系统后重试`);}
    if(!response.ok)throw new Error(data.message||`连接失败（HTTP ${response.status}）`);return data;
  }
  async function connectBoohee(onBack=null) {
    const status=await providerRequest('status');
    modal('连接薄荷健康',`<div class="notice">${status.configured?'已有保存的 Key。可直接检测；更换时才需要重新粘贴。':'尚未保存有效连接。请粘贴薄荷开放平台的完整 API Key。'}</div>${status.configured?`<div class="actions">${btn('检测已保存的连接','check-boohee')}</div><div id="connectionResult" role="status"></div>`:''}<p><a href="https://ai.boohee.com/console/" target="_blank" rel="noopener">打开薄荷控制台 ↗</a></p>${input(status.configured?'更换 API Key':'API Key','apiKey','','password','required autocomplete="off" placeholder="完整 Key，不是带星号的脱敏值"')}<p class="muted">实际调用“食物搜索”验证。失败时显示薄荷返回原因及错误码；连接成功后仅在本机服务端保存密钥。</p>`,'验证并连接',async f=>{await providerRequest('connect',{apiKey:f.get('apiKey')});toast('已通过真实查询验证，薄荷健康已连接');if(onBack){onBack();return false;}},onBack);
  }
  function foodSearchModal(context=null,startQuery=query) {
    foodResults=[];foodSearchPage=1;foodContext=context;++foodRequestId;
    modal(context?'从薄荷添加到本餐':'搜索并添加菜品',`<div class="search-line"><input id="foodQuery" placeholder="输入菜名，先查我的菜品库" maxlength="30" aria-label="搜索菜名">${btn('搜索','search-food','','primary')}</div><div id="foodResults"><p class="muted">本地没有结果时自动搜索薄荷健康。${btn('连接薄荷健康','connect-boohee','','text')}</p></div><div class="pick-add"><span class="muted">也可以填写自己的成品热量。</span>${btn('手动新建','food-manual')}</div>`,null,null,context?()=>returnToPicker(context):null);
    $('#foodQuery').value=startQuery;if(startQuery)searchFood();
    $('#foodQuery').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchFood();}});
  }
  async function searchFood(remote=false,next=false) {
    const q=$('#foodQuery')?.value.trim();if(!q)return toast('请输入菜名');
    foodSearchPage=next?foodSearchPage+1:1;const region=$('#foodResults'),requestId=++foodRequestId;region.innerHTML='<p class="muted">正在查询…</p>';
    try {
      const result=await providerRequest(`search?q=${encodeURIComponent(q)}&page=${foodSearchPage}${remote?'&remote=1':''}`);
      if(requestId!==foodRequestId||!region.isConnected)return;
      foodResults=result.foods;foodSource=result.source;foodHasMore=result.hasMore;
      region.innerHTML=`<p class="muted">${result.source==='local'?'来自我的数据库 · 无需重复添加':'来自薄荷健康 · 确认后存入我的菜品库'}</p>${foodResults.map((f,index)=>`<div class="food-result"><div><b>${h(f.name)}</b><small>${result.source==='local'?(D.validNutrition(f)?`${f.nutrition.kcal100} kcal / 100g`:'热量待补全'):`${h(f.kcal100??'待查询')} kcal / ${f.isLiquid?'100ml（暂不支持称重）':'100g'}`}</small></div>${result.source==='local'?(foodContext?btn(D.validNutrition(f)?'选入本餐':'补全并选入','food-local',`data-id="${h(f.id)}"`,'small'):'<span class="tag">已在我的菜品</span>'):btn('确认添加','import-food',`data-index="${index}" ${f.isLiquid?'disabled':''}`,'small')}</div>`).join('')||'<div class="empty">没有找到匹配菜品，可换一个名称或手动添加。</div>'}${result.source==='local'?btn('没找到想要的，继续查薄荷','search-remote','','text'):foodHasMore?btn('下一页','next-food','','text'):''}`;
    }catch(e){if(requestId===foodRequestId&&region.isConnected)region.innerHTML=`<div class="notice">${h(e.message)} ${btn('连接薄荷健康','connect-boohee','','text')}</div>`;}
  }
  function importFoodModal(index) {
    const f=foodResults[index];if(!f||foodSource!=='boohee')return;
    const context=foodContext,searchQuery=$('#foodQuery').value;
    modal(`确认添加：${h(f.name)}`,`<p>薄荷编码：${h(f.code)} · 预览热量 ${h(f.kcal100??'待核对')} kcal / 100g</p><div class="form-grid"><label class="field">用于菜单的分类<select name="category">${options(['主食','荤','素','海鲜'].map(c=>[c,c]),context?.category||'荤')}</select></label><label class="field">称重口径<select name="basis"><option value="cooked">烹调后的成品熟重</option><option value="ready">即食 / 可食重量</option></select></label></div>${input('实际使用的食材（选填，用于忌口检查）','ingredients','','text','placeholder="没有填写时，优先采用薄荷菜肴配料；缺失会提示核对"')}<label class="flex"><input type="checkbox" name="confirmed" required>我已核对名称：这个条目对应上述成品，不是待烹调生食材。</label><p class="muted">保存时重新读取薄荷详情。热量缺失或重量口径不适用的条目不能添加。</p>`,context?'保存并选入本餐':'添加到我的菜品',async form=>{
      const r=await providerRequest('import',{code:f.code,category:form.get('category'),basis:form.get('basis'),ingredients:list(form.get('ingredients')),confirmed:form.get('confirmed')==='on',revision});
      state=D.hydrate(r.state);revision=r.revision;render();toast(r.existing?'已在我的菜品中，无需重复添加':'已从薄荷健康添加并保存');
      if(context){returnToPicker(context,r.dish?.id||state.dishes.find(d=>d.nutrition.providerCode===f.code)?.id);return false;}
    },()=>foodSearchModal(context,searchQuery));
  }

  function boxModal(id) {
    const box=state.boxes.find(b=>b.id===id);if(!box||box.status==='completed')return;
    modal(`调整 ${h(customer(box.customerId)?.name)} 的这份餐`,`${portionSummary(box)}<div class="hint">保存后改为手动克重，后续资料变化不会覆盖本盒。${btn('恢复自动配餐','restore-auto',`data-id="${h(id)}"`,'text small')}</div>${!box.items.length?'<div class="notice">请先在今日出餐中选择菜单。</div>':''}${box.items.map((i,index)=>`<div class="form-grid"><label class="field">菜品 ${index+1}<select name="dish${index}">${options(state.dishes.filter(D.validNutrition).map(d=>[d.id,d.name]),i.dishId)}</select></label>${input('本次分量 · g',`grams${index}`,i.grams,'number','required min="1" max="10000"')}</div>`).join('')}<div class="muted">只修改这一盒，不影响其他客户或下一次出餐。</div>`,'保存本餐调整',async f=>save(s=>{
      const b=s.boxes.find(b=>b.id===id);D.setBoxItems(s,b,b.items.map((i,index)=>({dishId:f.get(`dish${index}`),grams:Number(f.get(`grams${index}`))})));
    },'这份餐已调整，标签同步更新'));
  }
  function prepModal() {
    const rows=boxes().filter(b=>!['paused','cancelled'].includes(b.status)), totals=new Map();
    rows.forEach(b=>b.items.forEach(i=>totals.set(i.dishId,(totals.get(i.dishId)||0)+Number(i.grams))));
    modal('称重分装清单',`<div class="notice">以下为成品菜分装需求量，不是采购生重。</div><h3>按菜汇总</h3>${[...totals].map(([id,g])=>`<div class="prep-row"><span>${h(D.dishOf(state,id)?.name)}</span><b>${g} g</b></div>`).join('')||'<p class="muted">暂无需要分装的菜品。</p>'}<h3 style="margin-top:24px">按餐盒分装</h3>${rows.map((b,index)=>`<div class="prep-row"><div><b>${String(index+1).padStart(3,'0')} · ${h(customer(b.customerId)?.name)}</b><div class="muted">${b.items.map(i=>`${h(D.dishOf(state,i.dishId)?.name)} ${i.grams}g`).join(' / ')}</div></div></div>`).join('')}`,null);
  }
  function historyModal(id) {
    const os=state.orders.filter(o=>o.customerId===id);
    modal(`${h(customer(id)?.name)} · 订餐账本`,os.slice().reverse().map(o=>{const rows=state.boxes.filter(b=>b.orderId===o.id).sort((a,b)=>a.date.localeCompare(b.date)||a.meal.localeCompare(b.meal)),adjustments=(state.creditAdjustments||[]).filter(a=>a.orderId===o.id);return `<section class="ledger-card"><div class="section-head"><div><h3>${h(D.orderLabel(state,o))}</h3><div class="customer-note">购买：${h(localTime(o.createdAt))}</div><small>${h(o.startDate)} 至 ${h(o.endDate)} · ${h(o.paidStatus||'未记录')}${o.price!=null?' · ¥'+h(o.price):''}</small></div>${btn('调整剩余次数','adjust-credit',`data-id="${h(o.id)}"`,'small')}</div><div class="body"><div class="balance-line"><span>购买 <b>${o.credits}</b></span><span>已用 <b>${rows.filter(b=>b.status==='completed'||b.status==='cancelled'&&b.chargeCancelled).length}</b></span><span>补扣 <b>${adjustments.reduce((n,a)=>n+a.delta,0)}</b></span><span>剩余 <b>${D.remaining(state,o)}</b></span><span>已安排 <b>${D.reserved(state,o)}</b></span></div>${o.notes?`<p class="muted">${h(o.notes)}</p>`:''}<div class="ledger-rows">${rows.map(b=>`<div class="ledger-row"><div><b>${b.date} · ${mealName(b.meal)}</b><div class="customer-note">${b.status==='completed'?'已出餐 · 扣 1 次':b.status==='cancelled'?(b.chargeCancelled?'已取消 · 扣 1 次':'已取消 · 不扣次'):b.status==='paused'?'暂停 · 不扣次':'已安排 · 待出餐，不扣次'}</div>${(b.events||[]).map(e=>`<div class="customer-note">${h(localTime(e.at))} ${e.type==='cancel'?'取消'+(e.charge?'（仍扣次）':'（不扣次）'):e.type==='complete'?'出餐扣次':'恢复用餐'}：${h(e.reason)}${e.items?.length?`<details><summary>当次菜品</summary>${e.items.map(i=>`${h((i.snapshot||D.dishOf(state,i.dishId))?.name)} ${i.grams}g`).join('、')}</details>`:''}</div>`).join('')}<details><summary>菜品与克重</summary>${b.items.map(i=>`${h((i.snapshot||D.dishOf(state,i.dishId))?.name)} ${i.grams}g`).join('、')}</details></div>${b.status!=='cancelled'?btn('取消 / 退餐','cancel-box',`data-id="${h(b.id)}"`,'text small'):''}</div>`).join('')||'<p class="muted">本期尚无用餐记录</p>'}${adjustments.map(a=>`<div class="ledger-row"><span>${h(localTime(a.at))} 手动${a.delta>0?'补':'扣'} ${Math.abs(a.delta)} 次<br><small>${h(a.reason)}</small></span></div>`).join('')}</div></div></section>`;}).join('')||'<div class="empty">已登记，尚未订餐。</div>',null);
  }
  async function printLabels(reprintOnly=false) {
    if(!D.workflow(state,date,meal).rosterReady)return toast('请先确认菜单和用餐名单');
    const rows=boxes().filter(b=>!['paused','cancelled'].includes(b.status)&&(!selected.size||selected.has(b.id))&&(!reprintOnly||(b.exportedVersion&&b.exportedVersion!==b.version)));
    if(!rows.length)return toast('没有可打印的餐盒');
    if(rows.some(b=>!b.items.length))return toast('请先选择今天的菜单');
    if(rows.some(b=>D.checks(state,b).blocked))return toast('请先处理所选餐盒的忌口，或补全菜品食材后再打印');
    const missing=rows.filter(b=>!D.nutrition(state,b.items).complete);
    if(missing.length)return toast('请先补齐每道菜的成品热量，再打印标签');
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
      else if(action==='close')closeModal();
      else if(action==='meal'){meal=b.dataset.meal;selected.clear();D.sync(state,date,meal);step=D.workflow(state,date,meal).stage;render();}
      else if(action==='today'||action==='tomorrow'){viewMode=action==='today'?'packing':'planning';date=action==='today'?D.today():D.nextDate(D.today());selected.clear();D.sync(state,date,meal);step=D.workflow(state,date,meal).stage;render();}
      else if(action==='connect-boohee'){const q=$('#foodQuery')?.value,context=foodContext;await connectBoohee(q!==undefined?()=>foodSearchModal(context,q):null);}
      else if(action==='check-boohee'){b.disabled=true;const region=$('#connectionResult');region.textContent='正在检测…';try{const r=await providerRequest('check',{});region.textContent=r.message;}catch(e){region.textContent=e.message;}finally{b.disabled=false;}}
      else if(action==='pick-online'){const draft=capturePicker();foodSearchModal(draft,draft.query);}
      else if(action==='pick-create'||action==='pick-edit'){const draft=capturePicker();dishModal(id,x=>returnToPicker(draft,x),{name:draft.query,category:draft.category},()=>returnToPicker(draft));}
      else if(action==='food-local'){const context=foodContext,q=$('#foodQuery').value;if(D.validNutrition(D.dishOf(state,id)))returnToPicker(context,id);else dishModal(id,x=>returnToPicker(context,x),{},()=>foodSearchModal(context,q));}
      else if(action==='food-manual'){const context=foodContext,q=$('#foodQuery').value;dishModal(null,context?x=>returnToPicker(context,x):null,{name:q,category:context?.category},()=>foodSearchModal(context,q));}
      else if(action==='search-food')await searchFood();
      else if(action==='search-remote')await searchFood(true);
      else if(action==='next-food')await searchFood(true,true);
      else if(action==='import-food')importFoodModal(Number(b.dataset.index));
      else if(action==='edit-plan'){viewMode='planning';step=D.workflow(state,date,meal).stage;render();}
      else if(action==='finish-box'){if(date>D.today())throw new Error('到用餐当天才能完成');if(!D.workflow(state,date,meal).rosterReady)throw new Error('请先核对本餐菜单和名单');await save(s=>D.finish(s,[id]),'这盒已完成，扣除 1 次');}
      else if(action==='cancel-box')cancelModal(id);
      else if(action==='resume-box')await save(s=>D.resumeBox(s,id),'已恢复，请重新核对名单和标签');
      else if(action==='diner-toggle'){const box=state.boxes.find(b=>b.id===id);if(['paused','cancelled'].includes(box.status))await save(s=>D.resumeBox(s,id),'已恢复用餐');else cancelModal(id);}
      else if(action==='adjust-credit')adjustmentModal(id);
      else if(action==='dish')dishModal(id);
      else if(action==='customer')customerModal(id);
      else if(action==='order')orderModal(b.dataset.customer||'');
      else if(action==='pick'||action==='pick-backups')pickModal(action==='pick-backups');
      else if(action==='add-diners')addDinersModal();
      else if(action==='step'){const next=Number(b.dataset.step),w=D.workflow(state,date,meal);if(next===2&&!w.menuReady||next===3&&!w.rosterReady)return toast('请先完成前一步确认');viewMode='planning';step=next;render();}
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
      else if(action==='boohee')foodSearchModal();
      else if(action==='remove-dish')await save(s=>{const items=D.copy(currentMenu());items.splice(Number(b.dataset.index),1);D.setMenu(s,date,meal,items);});
      else if(action==='remove-backup')await save(s=>D.planOf(s,date,meal).backups.splice(Number(b.dataset.index),1));
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
      if(t.id==='customerFilter'){customerFilter=t.value;render();}
      else if(t.id==='workDate'){if(!t.value)return;date=t.value;selected.clear();D.sync(state,date,meal);step=D.workflow(state,date,meal).stage;render();}
      else if(t.id==='attention'){onlyAttention=t.checked;render();}
      else if(t.id==='selectAll'){selected=new Set(t.checked?boxes().filter(b=>!['paused','cancelled'].includes(b.status)).map(b=>b.id):[]);render();}
      else if(t.dataset.select){t.checked?selected.add(t.dataset.select):selected.delete(t.dataset.select);render();}
      else if(t.dataset.menuIndex!==undefined)await save(s=>{const items=D.copy(currentMenu());items[Number(t.dataset.menuIndex)].grams=Number(t.value);D.setMenu(s,date,meal,items);});
      else if(t.dataset.backupIndex!==undefined)await save(s=>{D.planOf(s,date,meal).backups[Number(t.dataset.backupIndex)].grams=Number(t.value);});
    }catch(error){toast(error.message);render();}
  });
  document.addEventListener('input',event=>{if(event.target.id==='query'){query=event.target.value;const pos=event.target.selectionStart;render();$('#query').focus();$('#query').setSelectionRange(pos,pos);}});
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='settingsForm')return;event.preventDefault();const f=new FormData(event.target);
    try{await save(s=>{s.settings={...s.settings,name:f.get('name').trim(),phone:f.get('phone'),labelWidth:Number(f.get('labelWidth')),labelHeight:Number(f.get('labelHeight')),fallbackCalorieBasis:'fixed-500'};s.boxes.filter(b=>!['completed','cancelled'].includes(b.status)).forEach(D.touch);},'店铺设置已保存');}catch(error){$('#settingsError').textContent=error.message;}
  });
  load().catch(error=>{$('#app').innerHTML=`<div class="loading"><h2>暂时没有连上系统</h2><p>${h(error.message)}</p>${btn('重新连接','retry','','primary')}</div>`;});
})();
