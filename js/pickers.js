function openModal(id){
  document.getElementById(id).classList.add('open');
  if(id==='modal-holding'){
    // reset fields
    ['h-ticker','h-search','h-name','h-qty','h-cost'].forEach(i=>{ const el=document.getElementById(i); if(el) el.value=''; });
    document.getElementById('h-selected-ticker').style.display='none';
    document.getElementById('h-search-results').style.display='none';
    document.getElementById('h-type').value='bank';
    onHoldingTypeChange('bank');
  }
}

function openAddHoldingModal(presetType){
  openModal('modal-holding');
  const typeSelect = document.getElementById('h-type');
  const typeWrap = typeSelect?.closest('.form-group');
  const titleEl = document.querySelector('#modal-holding .modal-title');
  if(presetType){
    typeSelect.value = presetType;
    onHoldingTypeChange(presetType);
    const opt = H_TYPE_OPTIONS.find(o=>o.value===presetType);
    document.getElementById('h-type-label').textContent = opt ? opt.label : 'Select asset type';
    document.getElementById('h-type-trigger').classList.toggle('placeholder', !opt);
    setTriggerIcon('h-type-icon', opt?.icon, opt?.color);
    typeSelect.disabled = true;
    if(typeWrap) typeWrap.style.display='none';
    if(titleEl) titleEl.textContent = `Add ${TYPE_LABELS[presetType]||presetType}`;
  } else {
    typeSelect.value = 'bank';
    const opt = H_TYPE_OPTIONS.find(o=>o.value==='bank');
    document.getElementById('h-type-label').textContent = opt.label;
    document.getElementById('h-type-trigger').classList.remove('placeholder');
    setTriggerIcon('h-type-icon', opt.icon, opt.color);
    typeSelect.disabled = false;
    if(typeWrap) typeWrap.style.display='';
    if(titleEl) titleEl.textContent = 'Add holding';
  }
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{ if(e.target===o) o.classList.remove('open'); }));
document.getElementById('modal-select')?.addEventListener('click', e=>{
  if(e.target.id==='modal-select'){
    const listEl = document.getElementById('select-modal-list');
    if(listEl) listEl.scrollTop = 0;
  }
});

// ── Custom themed date-picker (replaces native <input type=date>) ──
const dpState = { field:null, onChange:null, viewYear:null, viewMonth:null, value:'', withTime:false }; // value is ISO 'YYYY-MM-DD' or ''

function fmtDateDDMMYYYY(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtDateTimeDDMMYYYY(v){
  if(!v) return '';
  const [datePart, timePart] = v.split('T');
  return fmtDateDDMMYYYY(datePart) + (timePart ? ' '+timePart : '');
}
function isoToday(){
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

// field: a unique key; currentValue: ISO 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' (if withTime) or ''
// onChange: fn(newValue). opts: {withTime:true} to also show a time selector and require a Done tap to confirm.
function openDatePicker(field, currentValue, onChange, opts={}){
  dpState.field = field;
  dpState.onChange = onChange;
  dpState.withTime = !!opts.withTime;
  let datePart = currentValue || '', timePart = '';
  if(currentValue && currentValue.includes('T')){
    [datePart, timePart] = currentValue.split('T');
  }
  dpState.value = datePart;
  const base = datePart ? new Date(datePart+'T00:00:00') : new Date();
  dpState.viewYear = base.getFullYear();
  dpState.viewMonth = base.getMonth();

  document.getElementById('dp-time-row').style.display  = dpState.withTime ? '' : 'none';
  document.getElementById('dp-clear-btn').style.display = dpState.withTime ? 'none' : '';
  document.getElementById('dp-done-btn').style.display  = dpState.withTime ? '' : 'none';
  if(dpState.withTime){
    if(!timePart){
      const now = new Date();
      timePart = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    }
    document.getElementById('dp-time-input').value = timePart;
  }

  renderDatePicker();
  openModal('modal-datepicker');
}
function dpConfirmDateTime(){
  if(!dpState.value) return; // a date must be selected
  const time = document.getElementById('dp-time-input').value || '00:00';
  const combined = dpState.value + 'T' + time;
  if(typeof dpState.onChange==='function') dpState.onChange(combined);
  closeModal('modal-datepicker');
}
function dpChangeMonth(delta){
  dpState.viewMonth += delta;
  if(dpState.viewMonth<0){ dpState.viewMonth=11; dpState.viewYear--; }
  if(dpState.viewMonth>11){ dpState.viewMonth=0; dpState.viewYear++; }
  renderDatePicker();
}
function renderDatePicker(){
  const y=dpState.viewYear, m=dpState.viewMonth;
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('dp-title').textContent = `${monthNames[m]} ${y}`;
  const firstDow = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const daysInPrevMonth = new Date(y,m,0).getDate();
  const todayIso = isoToday();
  let cells = [];
  for(let i=0;i<firstDow;i++){
    const d = daysInPrevMonth - firstDow + 1 + i;
    cells.push({d, muted:true, iso:null});
  }
  for(let d=1;d<=daysInMonth;d++){
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({d, muted:false, iso});
  }
  while(cells.length%7!==0 || cells.length<42){
    const d = cells.length - (firstDow+daysInMonth) + 1;
    cells.push({d, muted:true, iso:null});
    if(cells.length>=42) break;
  }
  document.getElementById('dp-days').innerHTML = cells.map(c=>{
    const classes=['dp-day'];
    if(c.muted) classes.push('muted');
    if(c.iso===todayIso) classes.push('today');
    if(c.iso && c.iso===dpState.value) classes.push('selected');
    const clickAttr = c.iso ? `onclick="dpSelectDay('${c.iso}')"` : `onclick="dpChangeMonth(${c.muted&&c.d>20?-1:1})"`;
    return `<button type="button" class="${classes.join(' ')}" ${clickAttr}>${c.d}</button>`;
  }).join('');
}
function dpSelectDay(iso){
  dpState.value = iso;
  if(dpState.withTime){
    renderDatePicker(); // just refresh the selection highlight, keep the picker open for time entry
    return;
  }
  if(typeof dpState.onChange==='function') dpState.onChange(iso);
  closeModal('modal-datepicker');
}
function dpClear(){
  dpState.value = '';
  if(typeof dpState.onChange==='function') dpState.onChange('');
  closeModal('modal-datepicker');
}
function dpToday(){
  dpSelectDay(isoToday());
}

// ── Custom themed list picker (replaces native <select> for category/account) ──
let selectModalOnChoose = null;
function openSelectPicker(title, options, currentValue, onChoose){
  // options: [{value, label, icon?, color?, isChild?}]
  selectModalOnChoose = onChoose;
  document.getElementById('select-modal-title').textContent = title;
  document.getElementById('select-modal-list').innerHTML = options.map(o=>{
    const isActive = String(o.value)===String(currentValue);
    const iconHtml = o.icon ? `<i class="ti ${o.icon}" style="font-size:15px;color:${o.color||'var(--text2)'};width:20px;text-align:center;flex-shrink:0"></i>` : '';
    const indent = o.isChild ? 'padding-left:22px' : '';
    const labelStyle = o.isChild ? 'font-size:12.5px;color:var(--text2)' : '';
    return `<div class="select-modal-row${isActive?' active':''}" onclick="chooseSelectOption(this)" data-value="${String(o.value).replace(/"/g,'&quot;')}" style="${indent}">
      <span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;${labelStyle}">${iconHtml}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.label}</span></span>
      ${isActive?'<i class="ti ti-check" style="flex-shrink:0"></i>':''}
    </div>`;
  }).join('');
  const listEl = document.getElementById('select-modal-list');
  openModal('modal-select');
  listEl.scrollTop = 0;
}
function chooseSelectOption(el){
  const value = el.dataset.value;
  if(typeof selectModalOnChoose==='function') selectModalOnChoose(value);
  closeModal('modal-select');
  const listEl = document.getElementById('select-modal-list');
  if(listEl) listEl.scrollTop = 0;
}

function accountOptionsList(){
  const typeColorMap = {bank:'#0ea5e9',bond:'#ec4899',cash:'#84cc16',crypto:'#f59e0b',dividend:'#60a8f5',etf:'#10b981',stock:'#6366f1'};
  return holdings.map(h=>{
    const n=h.type==='crypto'?cleanCryptoName(h.name||h.ticker):(h.name||h.ticker);
    return {value:h.id, label:`${n} (${TYPE_LABELS[h.type]||h.type})`, icon:TYPE_ICONS[h.type], color:typeColorMap[h.type]};
  });
}

function buildCategoryPickerOptions(){
  const topCats = cfCategories.filter(c=>!c.parent_id).sort((a,b)=>a.name.localeCompare(b.name));
  const options = [];
  topCats.forEach(top=>{
    options.push({value:top.id, label:top.name, icon:top.icon, color:top.color});
    cfCategories.filter(c=>c.parent_id===top.id).sort((a,b)=>a.name.localeCompare(b.name)).forEach(sub=>{
      options.push({value:sub.id, label:sub.name, icon:top.icon, color:top.color, isChild:true});
    });
  });
  return options;
}
function getTopCategoryId(categoryId){
  const cat = cfCategories.find(c=>c.id===categoryId);
  if(!cat) return categoryId;
  return cat.parent_id || cat.id;
}

let catCreateTargetField = null; // tracks which trigger (cf-cat / inv-cat) to auto-select into after creating a category inline

function catDisplayLabel(cat){
  if(!cat) return '';
  if(cat.parent_id){
    const parent = cfCategories.find(c=>c.id===cat.parent_id);
    return parent ? `${parent.name} > ${cat.name}` : cat.name;
  }
  return cat.name;
}

function openCfCategoryPicker(){
  const current = document.getElementById('cf-cat').value;
  const options = buildCategoryPickerOptions();
  options.push({value:'__new_cat__', label:'New category…', icon:'ti-plus', color:'var(--accent)'});
  openSelectPicker('Select category', options, current, (val)=>{
    if(val==='__new_cat__'){
      catCreateTargetField = 'cf-cat';
      closeModal('modal-select');
      openCatModal();
      return;
    }
    document.getElementById('cf-cat').value = val;
    const cat = cfCategories.find(c=>c.id===val);
    document.getElementById('cf-cat-label').textContent = cat ? catDisplayLabel(cat) : 'Select category';
    document.getElementById('cf-cat-trigger').classList.toggle('placeholder', !cat);
    setTriggerIcon('cf-cat-icon', cat?.icon, cat?.color);
  });
}

function openCfAccountPicker(which){
  const fieldId   = which==='from' ? 'cf-from' : 'cf-to';
  const labelId   = which==='from' ? 'cf-from-label-text' : 'cf-to-label-text';
  const triggerId = which==='from' ? 'cf-from-trigger' : 'cf-to-trigger';
  const iconId    = which==='from' ? 'cf-from-icon' : 'cf-to-icon';
  const current = document.getElementById(fieldId).value;
  const options = accountOptionsList();
  openSelectPicker('Select account', options, current, (val)=>{
    document.getElementById(fieldId).value = val;
    const opt = options.find(o=>o.value===val);
    document.getElementById(labelId).textContent = opt ? opt.label : 'Select account';
    document.getElementById(triggerId).classList.toggle('placeholder', !opt);
    setTriggerIcon(iconId, opt?.icon, opt?.color);
  });
}

function setTriggerIcon(iconId, icon, color){
  const el = document.getElementById(iconId);
  if(!el) return;
  if(icon){ el.className = 'ti ' + icon; el.style.color = color || 'var(--text3)'; el.style.display = ''; }
  else { el.style.display = 'none'; }
}

// ── Add Holding: asset type picker ──
const H_TYPE_OPTIONS = [
  {value:'bank',     label:'Bank account',        icon:'ti-building-bank',      color:'#0ea5e9'},
  {value:'bond',     label:'Bond / Fixed income', icon:'ti-certificate',        color:'#ec4899'},
  {value:'cash',     label:'Cash',                icon:'ti-cash',               color:'#84cc16'},
  {value:'crypto',   label:'Crypto',               icon:'ti-currency-bitcoin',  color:'#f59e0b'},
  {value:'dividend', label:'Dividends',            icon:'ti-coin',              color:'#60a8f5'},
  {value:'etf',      label:'ETF',                  icon:'ti-trending-up',       color:'#10b981'},
  {value:'stock',    label:'Stock',                icon:'ti-chart-candle',      color:'#6366f1'},
];
function openHTypePicker(){
  const current = document.getElementById('h-type').value;
  openSelectPicker('Select asset type', H_TYPE_OPTIONS, current, (val)=>{
    document.getElementById('h-type').value = val;
    const opt = H_TYPE_OPTIONS.find(o=>o.value===val);
    document.getElementById('h-type-label').textContent = opt ? opt.label : 'Select asset type';
    document.getElementById('h-type-trigger').classList.toggle('placeholder', !opt);
    setTriggerIcon('h-type-icon', opt?.icon, opt?.color);
    onHoldingTypeChange(val);
  });
}

// ── Recurring: frequency picker ──
const CF_FREQ_OPTIONS = [
  {value:'daily',   label:'Daily'},
  {value:'weekly',  label:'Weekly'},
  {value:'monthly', label:'Monthly'},
  {value:'yearly',  label:'Yearly'},
];
function openCfFreqPicker(){
  const current = document.getElementById('cf-freq').value || 'monthly';
  openSelectPicker('Select frequency', CF_FREQ_OPTIONS, current, (val)=>{
    document.getElementById('cf-freq').value = val;
    const opt = CF_FREQ_OPTIONS.find(o=>o.value===val);
    document.getElementById('cf-freq-label').textContent = opt ? opt.label : 'Monthly';
  });
}

// ── Reports: year filter picker ──
let rptYearOptionsCache = [{value:'all', label:'All time'}];
function openRptYearPicker(){
  const current = document.getElementById('rpt-year-sel').value;
  openSelectPicker('Filter by year', rptYearOptionsCache, current, (val)=>{
    document.getElementById('rpt-year-sel').value = val;
    rptFilterYear = val;
    document.getElementById('rpt-year-label').textContent = val==='all' ? 'All time' : val;
    renderReports();
  });
}

// ── Investment form pickers ──
function invAssetOptionsList(){
  const investHoldings = holdings.filter(h=>['stock','etf','crypto','bond'].includes(h.type));
  const typeColorMap = {bond:'#ec4899',crypto:'#f59e0b',etf:'#10b981',stock:'#6366f1'};
  return investHoldings.map(h=>{
    const n=h.type==='crypto'?cleanCryptoName(h.name||h.ticker):(h.name||h.ticker);
    return {value:h.id, label:`${n} (${h.ticker})`, icon:TYPE_ICONS[h.type], color:typeColorMap[h.type]};
  });
}
function openInvAssetPicker(){
  const current = document.getElementById('inv-asset').value;
  const options = invAssetOptionsList();
  openSelectPicker('Select asset', options, current, (val)=>{
    document.getElementById('inv-asset').value = val;
    const opt = options.find(o=>o.value===val);
    document.getElementById('inv-asset-label').textContent = opt ? opt.label : 'Select asset';
    document.getElementById('inv-asset-trigger').classList.toggle('placeholder', !opt);
    updateInvCounterparts();
  });
}

function invCounterpartOptionsList(){
  const selectedId = document.getElementById('inv-asset').value;
  const typeColorMap = {bank:'#0ea5e9',bond:'#ec4899',cash:'#84cc16',crypto:'#f59e0b',dividend:'#60a8f5',etf:'#10b981',stock:'#6366f1'};
  return holdings.filter(h=>h.id!==selectedId).map(h=>{
    const n=h.type==='crypto'?cleanCryptoName(h.name||h.ticker):(h.name||h.ticker);
    return {value:h.id, label:`${n} (${TYPE_LABELS[h.type]||h.type})`, icon:TYPE_ICONS[h.type], color:typeColorMap[h.type]};
  });
}
function openInvPaidFromPicker(){
  const current = document.getElementById('inv-paid-from').value;
  const options = invCounterpartOptionsList();
  openSelectPicker('Purchased with', options, current, (val)=>{
    document.getElementById('inv-paid-from').value = val;
    const opt = options.find(o=>o.value===val);
    document.getElementById('inv-paid-from-label').textContent = opt ? opt.label : 'Select account';
    document.getElementById('inv-paid-from-trigger').classList.toggle('placeholder', !opt);
  });
}
function openInvSaleToPicker(){
  const current = document.getElementById('inv-sale-to').value;
  const options = invCounterpartOptionsList();
  openSelectPicker('Proceeds credited to', options, current, (val)=>{
    document.getElementById('inv-sale-to').value = val;
    const opt = options.find(o=>o.value===val);
    document.getElementById('inv-sale-to-label').textContent = opt ? opt.label : 'Select account';
    document.getElementById('inv-sale-to-trigger').classList.toggle('placeholder', !opt);
  });
}
function openInvExpIncAcctPicker(){
  const current = document.getElementById('inv-expinc-acct').value;
  const options = accountOptionsList();
  const title = document.getElementById('inv-expinc-acct-label').textContent || 'Select account';
  openSelectPicker(title, options, current, (val)=>{
    document.getElementById('inv-expinc-acct').value = val;
    const opt = options.find(o=>o.value===val);
    document.getElementById('inv-expinc-acct-span').textContent = opt ? opt.label : 'Select account';
    document.getElementById('inv-expinc-acct-trigger').classList.toggle('placeholder', !opt);
  });
}
function openInvCatPicker(){
  const current = document.getElementById('inv-cat').value;
  const options = buildCategoryPickerOptions();
  options.push({value:'__new_cat__', label:'New category…', icon:'ti-plus', color:'var(--accent)'});
  openSelectPicker('Select category', options, current, (val)=>{
    if(val==='__new_cat__'){
      catCreateTargetField = 'inv-cat';
      closeModal('modal-select');
      openCatModal();
      return;
    }
    document.getElementById('inv-cat').value = val;
    const cat = cfCategories.find(c=>c.id===val);
    document.getElementById('inv-cat-label').textContent = cat ? catDisplayLabel(cat) : 'Select category';
    document.getElementById('inv-cat-trigger').classList.toggle('placeholder', !cat);
    setTriggerIcon('inv-cat-icon', cat?.icon, cat?.color);
  });
}

// ── LOAD ──
