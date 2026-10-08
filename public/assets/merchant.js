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
  let state, revision, saving = false, page = 'today', date = D.today(), meal = 'lunch', query = '', onlyAttention = false, selected = new Set(), previewId = '', timer;
  const currentMenu = () => state.menus[`${date}:${meal}`] || [];
  const boxes = () => state.boxes.filter(b => b.date === date && b.meal === meal);
  const customer = id => state.customers.find(c => c.id === id);
  async function load() {
    const response = await fetch('/api/merchant', { cache:'no-store' });
    if (!response.ok) throw new Error('系统暂时无法读取数据，请稍后重试');
    const result = await response.json(); state = D.hydrate(result.state); revision = result.revision;
    D.sync(state,date,meal); render();
  }
  async function save(mutator, message = '已保存') {
    if (saving) throw new Error('正在保存，请稍候');
    const next = D.copy(state); mutator(next); D.validate(next);
    saving = true;
    try {
      const response = await fetch('/api/merchant', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ revision, state:next }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '保存失败，请重试');
      state = next; revision = result.revision; render(); if (message) toast(message);
    } finally { saving = false; }
  }
  function toast(message) { clearTimeout(timer); $('#toast').textContent = message; $('#toast').className = 'visible'; timer = setTimeout(() => $('#toast').className = '', 4200); }
  const navs = [['today','◷','今日出餐','确认菜单，照着称重，贴好标签。'],['customers','♧','客户与订餐','记一次订餐，以后自动出现在出餐名单。'],['dishes','▦','我的菜品','常用菜记一次，以后直接选。'],['settings','⚙','店铺设置','设置一次，每天少做一点。']];
  function render() {
    const current = navs.find(n => n[0] === page);
    $('#app').innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><span class="brand-mark">禾</span><div>小饭桌<small>每一餐 · 有数</small></div></div><nav aria-label="主导航">${navs.map(n => btn(`<span>${n[1]}</span>${n[2]}`,'nav',`data-page="${n[0]}"`,page===n[0]?'active':'')).join('')}</nav><div class="sidebar-bottom"><span class="dot"></span>数据已连接<br><span>把时间留给好好做饭。</span></div></aside><main class="main"><header class="topbar"><div><div class="eyebrow">YOUR EVERYDAY KITCHEN</div><h1>${current[2]}</h1><div class="subtitle">${current[3]}</div></div><span class="shop-pill">◉ ${h(state.settings.name)}</span></header>${page === 'today' ? todayPage() : page === 'customers' ? customersPage() : page === 'dishes' ? dishesPage() : settingsPage()}</main></div>`;
  }
  function labelHtml(box) {
    const items = box?.items || currentMenu(); const n = D.nutrition(state,items);
    const c = box?.customerSnapshot || (box ? customer(box.customerId) : null);
    const shop = box?.settingsSnapshot || state.settings;
    const number = box ? String(boxes().findIndex(b=>b.id===box.id)+1).padStart(3,'0') : '预览';
    return `<div class="label-paper"><h3>${h(shop.name)}</h3><div class="label-meta">${h(c?.name || '客户称呼')} · ${mealName(box?.meal || meal)} · ${(box?.date || date).slice(5)} · ${number}</div>${items.length ? items.map(i=>`<div class="label-line"><span>${h((i.snapshot || D.dishOf(state,i.dishId))?.name)}</span><b>${h(i.grams)} g</b></div>`).join('') : '<div class="muted">选好菜单后，这里自动生成标签</div>'}<div class="label-kcal"><span>${n.complete ? '本餐估算热量' : '热量信息未完整'}</span>${n.complete ? `<strong>${n.kcal}<small style="font-size:10px"> kcal</small></strong>` : '<span>—</span>'}</div><div class="label-foot">按计划分量估算${n.complete ? `<br>热量依据：${n.source}` : ''}${shop.phone ? `<br>联系店铺：${h(shop.phone)}` : ''}</div></div>`;
  }
  function todayPage() {
    const rows = boxes(), live = rows.filter(b=>b.status!=='paused');
    const attention = live.filter(b=>D.checks(state,b).blocked || !D.nutrition(state,b.items).complete);
    const reprints = live.filter(b=>b.exportedVersion && b.exportedVersion !== b.version);
    const shown = onlyAttention ? attention : rows;
    const preview = live.find(b=>b.id===previewId) || live[0];
    return `<div class="toolbar"><div class="actions"><input aria-label="出餐日期" id="workDate" type="date" value="${date}"><div class="segment">${btn('午餐','meal','data-meal="lunch"',meal==='lunch'?'active':'')}${btn('晚餐','meal','data-meal="dinner"',meal==='dinner'?'active':'')}</div>${date!==D.today()?btn('回到今天','today','','text'):''}</div>${btn('＋ 记一单','order','','primary')}</div>
    <div class="stats">${[['◷',live.filter(b=>b.status==='pending').length,'待出餐'],['⌁',attention.length,'需要留意'],['✓',live.filter(b=>b.status==='completed').length,'已完成']].map(s=>`<div class="stat"><div class="icon">${s[0]}</div><div><strong>${s[1]}</strong><span>${s[2]}</span></div></div>`).join('')}</div>
    <div class="workspace"><div class="stack"><section class="card"><div class="section-head"><h2><span class="step">1</span>今天做什么</h2><div class="actions">${btn('沿用上次','reuse','','text')}${btn('＋ 加道菜','pick','','small')}</div></div><div class="body">${currentMenu().length ? currentMenu().map((i,index)=>{const d=D.dishOf(state,i.dishId);return `<div class="menu-row"><span class="food-icon">${icon(d)}</span><div class="grow"><h3>${h(d?.name)}</h3>${sourceTag(d)} ${btn('设置热量','dish',`data-id="${h(d.id)}"`,'text small')}</div><input aria-label="${h(d?.name)}默认克重" type="number" min="1" max="10000" value="${i.grams}" data-menu-index="${index}"><span class="muted">g / 份</span>${btn('×','remove-dish',`data-index="${index}" aria-label="移除${h(d?.name)}"`,'text')}</div>`;}).join('') : `<div class="empty"><strong>先选好今天的菜单</strong>沿用上次的搭配，或从常用菜里选几道。<br>${btn('选择菜品','pick','','primary')}</div>`}<div class="hint">默认克重用于新餐盒；客户单独调整过的分量会保留。</div></div></section>
    <section class="card"><div class="section-head"><h2><span class="step">2</span>今天给谁做 <span class="muted">${live.length} 份</span></h2><label class="flex muted"><input type="checkbox" id="attention" ${onlyAttention?'checked':''}>只看需处理</label></div>${shown.length ? `<div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="selectAll" aria-label="选择全部餐盒" ${live.length && live.every(b=>selected.has(b.id))?'checked':''}></th><th>客户 / 餐盒</th><th>本餐</th><th>状态</th><th>操作</th></tr></thead><tbody>${shown.map(boxRow).join('')}</tbody></table></div>` : `<div class="empty"><strong>${onlyAttention?'没有需要处理的餐盒':'这餐还没有订餐'}</strong>${onlyAttention?'可以安心准备出餐。':'记一笔单次订餐，或添加客户的包餐安排。'}<br>${onlyAttention?'':btn('＋ 记一单','order','','primary')}</div>`}<div class="footer-actions"><span class="muted">${selected.size ? `已选择 ${selected.size} 份` : '暂停的餐盒不会打印，也不会扣餐次'}</span>${btn('本餐完成','complete','','primary')}</div></section></div>
    <aside class="stack preview-column"><section class="card"><div class="section-head"><h2><span class="step">3</span>称重 · 贴标</h2></div><div class="label-preview">${labelHtml(preview)}</div><div class="aside-note">${selected.size ? '将打印选中的餐盒。' : '按餐盒顺序打印，照着标签分装。'}${reprints.length ? `<br><span class="inline-error">${reprints.length} 份已修改，需要重打标签</span>` : ''}</div><div class="aside-actions">${btn('打印标签 / 存为 PDF','print','','primary')}${reprints.length?btn('仅打印需重打的标签','reprint'):''}${btn('查看称重分装清单','prep')}</div></section><section class="card"><div class="body"><h3>把常用的记住</h3><p class="muted">菜单可以沿用，包餐客户自动排入。每天只处理换菜、暂停和新订单。</p><span class="tag">少填一次，多一点从容</span></div></section></aside></div>`;
  }
  function boxRow(b) {
    const c=customer(b.customerId), n=D.nutrition(state,b.items), check=D.checks(state,b);
    const status=b.status==='paused'?'<span class="tag gray">已暂停</span>':b.status==='completed'?'<span class="tag">已完成</span>':check.blocked?'<span class="tag red">核对忌口</span>':'<span class="tag gray">待出餐</span>';
    return `<tr><td><input type="checkbox" aria-label="选择${h(c?.name)}" data-select="${h(b.id)}" ${selected.has(b.id)?'checked':''} ${b.status==='paused'?'disabled':''}></td><td><div class="name-cell"><span class="avatar">${h(c?.name?.slice(-1)||'客')}</span><div><b>${h(c?.name||'未关联客户')}</b><div class="customer-note">${h(check.conflicts.join('、') || (check.unknown?'食材不完整，需核对':c?.restrictions?.join('、')||'默认份量'))}</div></div></div></td><td>${n.complete?`${n.kcal} kcal`:'<span class="tag warn">热量待补充</span>'}<div class="customer-note">${b.items.reduce((sum,i)=>sum+Number(i.grams),0)} g · ${b.items.length} 道</div></td><td>${status}${b.exportedVersion && b.exportedVersion!==b.version?'<div class="customer-note inline-error">需重打标签</div>':''}</td><td>${btn('看标签','preview',`data-id="${h(b.id)}"`,'text small')}${b.status!=='completed'?btn('改餐','box',`data-id="${h(b.id)}"`,'text small')+btn(b.status==='paused'?'恢复':'暂停','pause',`data-id="${h(b.id)}"`,'text small'):''}</td></tr>`;
  }
  function customersPage() {
    const matches=state.customers.filter(c=>`${c.name} ${c.phone}`.includes(query));
    return `<div class="toolbar"><input class="search" id="query" value="${h(query)}" placeholder="搜索客户称呼或电话" aria-label="搜索客户"><div class="actions">${btn('新增客户','customer')}${btn('＋ 记一单','order','','primary')}</div></div><section class="card"><div class="table-wrap"><table><thead><tr><th>客户</th><th>忌口 / 备注</th><th>剩余餐次</th><th>操作</th></tr></thead><tbody>${matches.map(c=>{const os=state.orders.filter(o=>o.customerId===c.id&&o.status!=='已取消');return `<tr><td><b>${h(c.name)}</b><div class="customer-note">${h(c.phone||'未填写联系方式')}</div></td><td>${h([...(c.restrictions||[]),...(c.allergies||[])].join('、')||'未记录')}<div class="customer-note">${h(c.address||'地址未填写 / 自提')}</div></td><td><span class="credit">${os.reduce((n,o)=>n+D.remaining(state,o),0)}</span><span class="muted"> 餐</span></td><td>${btn('编辑','customer',`data-id="${h(c.id)}"`,'text')}${btn('订餐 / 续餐','order',`data-customer="${h(c.id)}"`,'text')}${btn('记录','history',`data-id="${h(c.id)}"`,'text')}</td></tr>`;}).join('')}</tbody></table></div>${!matches.length?'<div class="empty">还没有匹配的客户，先记一单就能自动建立档案。</div>':''}</section>`;
  }
  function dishesPage() {
    const matches=state.dishes.filter(d=>`${d.name} ${d.category}`.includes(query));
    return `<div class="toolbar"><input class="search" id="query" value="${h(query)}" placeholder="搜索我的菜品" aria-label="搜索菜品"><div class="actions">${btn('搜索薄荷健康','boohee')}${btn('＋ 手动添加','dish','','primary')}</div></div><div class="notice">薄荷健康接口待接入。现有旧数据需要确认；手动填写的数值会明确标为“商家录入”。</div><div class="dish-grid">${matches.slice(0,90).map(d=>`<section class="card dish-card"><div class="dish-title"><span class="food-icon">${icon(d)}</span><div><h3>${h(d.name)}</h3>${sourceTag(d)}</div></div><div class="dish-meta"><span>${D.validNutrition(d)?`${d.nutrition.kcal100} kcal / 100 g`:'热量未确认'}</span><span>默认 ${d.defaultGrams||150} g</span></div>${btn('编辑菜品与热量','dish',`data-id="${h(d.id)}"`)}</section>`).join('')}</div>${matches.length>90?'<div class="hint">当前显示前 90 道菜，请输入名称进一步查找。</div>':''}${!matches.length?'<div class="empty">没有找到菜品，可以直接手动添加。</div>':''}`;
  }
  function settingsPage() {
    return `<div class="settings-grid"><section class="card"><div class="section-head"><h2>店铺与标签</h2></div><form id="settingsForm"><div class="body">${input('店铺名称','name',state.settings.name,'text','required maxlength="60"')}${input('标签上的联系电话（选填）','phone',state.settings.phone)}<div class="form-grid">${input('标签宽度 · mm','labelWidth',state.settings.labelWidth,'number','required min="30" max="150"')}${input('标签高度 · mm','labelHeight',state.settings.labelHeight,'number','required min="30" max="150"')}</div><p class="muted">默认 50 × 70 mm。打印时选择对应纸张尺寸，并关闭浏览器页眉页脚。</p><div class="form-error" id="settingsError"></div><button class="primary" type="submit">保存设置</button></div></form></section><section class="card"><div class="section-head"><h2>热量数据</h2><span class="tag warn">待接入</span></div><div class="body"><h3>薄荷健康</h3><p class="muted">唯一外部食物数据来源。接入完成后，可直接搜索和关联菜品。</p><p class="muted">暂未取得接口配置与字段文档，目前可以手动录入。所有旧菜品的数值需要重新确认。</p><a href="https://ai.boohee.com/docs/" target="_blank" rel="noopener">查看薄荷官方接入说明 ↗</a><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>先把信息说清楚</h3><p class="muted">无热量数据时照常出餐，标签显示“热量信息未完整”。不会把缺失值当作零。</p></div></section></div>`;
  }
  function modal(title, body, submitLabel, handler) {
    const dialog=$('#dialog'); if(dialog.open)dialog.close();
    dialog.innerHTML=`<form id="modalForm"><div class="modal-head"><h2>${title}</h2>${btn('×','close','aria-label="关闭"','text')}</div><div class="modal-body">${body}<div id="formError" class="form-error" role="alert"></div></div><div class="modal-foot">${btn('关闭','close')}${submitLabel?`<button type="submit" class="primary">${submitLabel}</button>`:''}</div></form>`;
    dialog.showModal();
    $('#modalForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await handler(new FormData(event.currentTarget));dialog.close();}catch(error){$('#formError').textContent=error.message;}finally{button.disabled=false;}};
  }
  function dishModal(id) {
    const d=state.dishes.find(d=>d.id===id), known=D.validNutrition(d);
    modal(d?'编辑菜品':'手动添加菜品',`${!known&&d?'<div class="notice">旧版数值没有自动带入。请核对依据后填写，保存为商家录入。</div>':''}<div class="form-grid">${input('菜品名称','name',d?.name||'','text','required maxlength="120"')}<label class="field">分类<select name="category">${options(['主食','荤','素','海鲜'].map(x=>[x,x]),d?.category||'荤')}</select></label>${input('每 100 g 热量 · kcal','kcal',known?d.nutrition.kcal100:'','number','required min="0" max="900" step="0.01"')}${input('每份默认克重 · g','grams',d?.defaultGrams||150,'number','required min="1" max="10000"')}<label class="field wide">重量口径<select name="basis">${options([['cooked','烹调后的成品熟重'],['ready','包装即食 / 可食部分重量']],d?.nutrition?.basis||'cooked')}</select></label><div class="wide">${input('热量数值依据','reference',known?d.nutrition.reference:'','text','required placeholder="如：产品包装营养标签、配方核算记录"')}${input('实际食材（逗号分隔，用于忌口核对）','ingredients',(d?.ingredients||[]).join('，'),'text','placeholder="如：鸡肉，番茄，食用油"')}</div></div><div class="muted">这里保存的数值来源是“商家录入”，不会标记成薄荷数据。缺少食材时不能自动判断忌口。</div>`,'保存菜品',async f=>save(s=>{
      const item={...(d||{}),id:d?.id||uid('dish'),name:f.get('name').trim(),category:f.get('category'),ingredients:list(f.get('ingredients')),defaultGrams:Number(f.get('grams')),nutrition:{source:'manual',kcal100:Number(f.get('kcal')),basis:f.get('basis'),reference:f.get('reference').trim(),updatedAt:new Date().toISOString()}};
      const at=s.dishes.findIndex(x=>x.id===item.id);if(at<0)s.dishes.push(item);else s.dishes[at]=item;
      s.boxes.filter(b=>b.status!=='completed'&&b.items.some(i=>i.dishId===item.id)).forEach(D.touch);
    },'菜品已保存，可直接用于出餐'));
  }
  function customerModal(id) {
    const c=customer(id);
    modal(c?'编辑客户':'新增客户',`${input('客户称呼','name',c?.name||'','text','required maxlength="80"')}<div class="form-grid">${input('忌口（选填）','restrictions',(c?.restrictions||[]).join('，'))}${input('过敏食材（选填）','allergies',(c?.allergies||[]).join('，'))}</div><details><summary>联系方式与更多资料</summary>${input('电话','phone',c?.phone||'')}${input('配送地址 / 自提备注','address',c?.address||'')}${input('其他备注','notes',c?.notes||'')}</details><div class="muted">不需要身高、体重，也能开始记单和出餐。</div>`,'保存客户',async f=>save(s=>{
      const item={...(c||{}),id:c?.id||uid('customer'),name:f.get('name').trim(),phone:f.get('phone'),address:f.get('address'),notes:f.get('notes'),restrictions:list(f.get('restrictions')),allergies:list(f.get('allergies'))};
      const at=s.customers.findIndex(x=>x.id===item.id);if(at<0)s.customers.push(item);else s.customers[at]=item;
      s.boxes.filter(b=>b.customerId===item.id&&b.status!=='completed').forEach(D.touch);
    }));
  }
  function orderModal(customerId='') {
    modal('记一单',`<label class="field">客户<select name="customerId" id="orderCustomer">${options([['','＋ 新客户'],...state.customers.map(c=>[c.id,c.name])],customerId)}</select></label><div id="newCustomerFields" ${customerId?'hidden':''}>${input('新客户称呼','name','','text',customerId?'':'required')}${input('忌口 / 过敏提醒（选填）','restrictions','','text','placeholder="填写需要避开的食材"')}</div><div class="form-grid"><label class="field">订餐方式<select name="kind" id="orderKind"><option value="single">单次订餐</option><option value="plan">连续包餐</option></select></label><label class="field">餐次<select name="meal">${options([['lunch','午餐'],['dinner','晚餐'],['both','午餐＋晚餐']],meal)}</select></label>${input('开始日期','startDate',date,'date','required')}${input('每餐份数','portions',1,'number','required min="1" max="99"')}</div><div id="planFields" hidden><div class="form-grid">${input('结束日期','endDate',date,'date')}${input('购买餐次数（每盒计 1 餐）','credits',10,'number','min="1" max="99999"')}</div><div class="pill-row">${['日','一','二','三','四','五','六'].map((n,i)=>`<label><input type="checkbox" name="weekday" value="${i}" ${i>0&&i<6?'checked':''}>周${n}</label>`).join('')}</div></div><details><summary>付款与备注</summary><label class="field">付款状态<select name="paidStatus"><option>未记录</option><option>已付款</option><option>未付款</option></select></label>${input('订单备注','notes')}</details>`,'保存并安排出餐',async f=>save(s=>{
      let cid=f.get('customerId');if(!cid){const name=f.get('name').trim();if(!name)throw new Error('请填写客户称呼');cid=uid('customer');s.customers.push({id:cid,name,restrictions:list(f.get('restrictions')),allergies:[],phone:'',address:''});}
      const meals=f.get('meal')==='both'?['lunch','dinner']:[f.get('meal')], plan=f.get('kind')==='plan';
      s.orders.push({id:uid('order'),customerId:cid,serviceType:plan?'包餐':'单次',startDate:f.get('startDate'),endDate:plan?f.get('endDate'):f.get('startDate'),meals,weekdays:plan?f.getAll('weekday').map(Number):[0,1,2,3,4,5,6],portions:Number(f.get('portions')),credits:plan?Number(f.get('credits')):Number(f.get('portions'))*meals.length,status:'服务中',paidStatus:f.get('paidStatus'),notes:f.get('notes')});
      D.sync(s,date,meal);
    },'订餐已保存，符合日期的餐盒已排入'));
    $('#orderCustomer').onchange=e=>{const isNew=!e.target.value;$('#newCustomerFields').hidden=!isNew;$('#newCustomerFields input[name=name]').required=isNew;};
    $('#orderKind').onchange=e=>{$('#planFields').hidden=e.target.value!=='plan';};
  }
  function pickModal() {
    modal('选择今天的菜',`<input class="search" id="pickSearch" placeholder="搜索常用菜" aria-label="搜索常用菜"><div class="hint">勾选需要的菜品，确认后自动进入出餐表。</div><div class="pick-list" style="margin-top:15px">${state.dishes.map(d=>`<label class="pick-row" data-name="${h(d.name)}"><input name="dish" type="checkbox" value="${h(d.id)}" ${currentMenu().some(i=>i.dishId===d.id)?'checked':''}><span class="grow">${h(d.name)}</span>${sourceTag(d)}</label>`).join('')}</div>`,'使用这些菜',async f=>save(s=>{
      const old=currentMenu();s.menus[`${date}:${meal}`]=f.getAll('dish').map(id=>old.find(i=>i.dishId===id)||{dishId:id,grams:D.dishOf(s,id).defaultGrams||150});D.sync(s,date,meal);
    },'菜单已更新，出餐表已同步'));
    $('#pickSearch').oninput=e=>document.querySelectorAll('.pick-row').forEach(row=>row.hidden=!row.dataset.name.includes(e.target.value));
  }
  function boxModal(id) {
    const box=state.boxes.find(b=>b.id===id);if(!box||box.status==='completed')return;
    modal(`调整 ${h(customer(box.customerId)?.name)} 的这份餐`,`${!box.items.length?'<div class="notice">请先在今日出餐中选择菜单。</div>':''}${box.items.map((i,index)=>`<div class="form-grid"><label class="field">菜品 ${index+1}<select name="dish${index}">${options(state.dishes.map(d=>[d.id,d.name]),i.dishId)}</select></label>${input('本次分量 · g',`grams${index}`,i.grams,'number','required min="1" max="10000"')}</div>`).join('')}<div class="muted">只修改这一盒，不影响其他客户或下一次出餐。</div>`,'保存本餐调整',async f=>save(s=>{
      const b=s.boxes.find(b=>b.id===id);b.items=b.items.map((i,index)=>({dishId:f.get(`dish${index}`),grams:Number(f.get(`grams${index}`))}));b.custom=true;D.touch(b);
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
  async function printLabels(reprintOnly=false) {
    const rows=boxes().filter(b=>b.status!=='paused'&&(!selected.size||selected.has(b.id))&&(!reprintOnly||(b.exportedVersion&&b.exportedVersion!==b.version)));
    if(!rows.length)return toast('没有可打印的餐盒');
    if(rows.some(b=>!b.items.length))return toast('请先选择今天的菜单');
    if(rows.some(b=>D.checks(state,b).blocked))return toast('请先处理所选餐盒的忌口，或补全菜品食材后再打印');
    const {labelWidth:w,labelHeight:height}=state.settings;
    $('#printArea').innerHTML=`<style>@page{size:${w}mm ${height}mm;margin:0}</style>${rows.map(b=>`<article class="print-label" style="--label-width:${w}mm;--label-height:${height}mm">${labelHtml(b)}</article>`).join('')}`;
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
      else if(action==='meal'){meal=b.dataset.meal;selected.clear();D.sync(state,date,meal);render();}
      else if(action==='today'){date=D.today();selected.clear();D.sync(state,date,meal);render();}
      else if(action==='dish')dishModal(id);
      else if(action==='customer')customerModal(id);
      else if(action==='order')orderModal(b.dataset.customer||'');
      else if(action==='pick')pickModal();
      else if(action==='box')boxModal(id);
      else if(action==='prep')prepModal();
      else if(action==='history')historyModal(id);
      else if(action==='preview'){previewId=id;render();}
      else if(action==='boohee')modal('搜索薄荷健康','<div class="notice">薄荷健康接口尚未接入，目前无法进行真实查询。</div><p>可以先用“手动添加”保存自己的菜品和热量，接入后再关联薄荷条目。</p>',null);
      else if(action==='reuse'){
        const keys=Object.keys(state.menus).filter(k=>k<`${date}:${meal}`&&k.endsWith(`:${meal}`)&&state.menus[k].length).sort();
        if(!keys.length)return toast('还没有可沿用的菜单，请先选择菜品');
        await save(s=>{s.menus[`${date}:${meal}`]=D.copy(s.menus[keys.at(-1)]);D.sync(s,date,meal);},'已沿用上次菜单');
      } else if(action==='remove-dish')await save(s=>{s.menus[`${date}:${meal}`].splice(Number(b.dataset.index),1);D.sync(s,date,meal);});
      else if(action==='pause')await save(s=>{const box=s.boxes.find(x=>x.id===id);if(box.status==='completed')throw new Error('已完成餐盒不能直接暂停');box.status=box.status==='paused'?'pending':'paused';D.touch(box);},'已更新，本餐暂停不扣餐次');
      else if(action==='complete'){
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
      if(t.id==='workDate'){if(!t.value)return;date=t.value;selected.clear();D.sync(state,date,meal);render();}
      else if(t.id==='attention'){onlyAttention=t.checked;render();}
      else if(t.id==='selectAll'){selected=new Set(t.checked?boxes().filter(b=>b.status!=='paused').map(b=>b.id):[]);render();}
      else if(t.dataset.select){t.checked?selected.add(t.dataset.select):selected.delete(t.dataset.select);render();}
      else if(t.dataset.menuIndex!==undefined)await save(s=>{s.menus[`${date}:${meal}`][Number(t.dataset.menuIndex)].grams=Number(t.value);D.sync(s,date,meal);});
    }catch(error){toast(error.message);render();}
  });
  document.addEventListener('input',event=>{if(event.target.id==='query'){query=event.target.value;const pos=event.target.selectionStart;render();$('#query').focus();$('#query').setSelectionRange(pos,pos);}});
  document.addEventListener('submit',async event=>{
    if(event.target.id!=='settingsForm')return;event.preventDefault();const f=new FormData(event.target);
    try{await save(s=>{s.settings={...s.settings,name:f.get('name').trim(),phone:f.get('phone'),labelWidth:Number(f.get('labelWidth')),labelHeight:Number(f.get('labelHeight'))};s.boxes.filter(b=>b.status!=='completed').forEach(D.touch);},'店铺设置已保存');}catch(error){$('#settingsError').textContent=error.message;}
  });
  load().catch(error=>{$('#app').innerHTML=`<div class="loading"><h2>暂时没有连上系统</h2><p>${h(error.message)}</p>${btn('重新连接','retry','','primary')}</div>`;});
})();
