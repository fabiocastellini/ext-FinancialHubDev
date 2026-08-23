import { state } from '../state.js';
import { api } from '../api.js';
import { exposeLegacyFunctions } from '../utils/legacy.js';
import {fmt, fmtN, fmtPct, fmtShort, fmtDateTimeDDMMYYYY, fmtDateDDMMYYYY, isoToday} from '../utils/date.js';
import { getVal, cleanCryptoName, cleanCryptoTicker } from '../utils/calculations.js';

import { invAssetOptionsList } from '../features/investments.js';
import { ensureExtraCategories } from '../features/insights.js';

import { initTouchDnD }  from '../settings.js';
import { CF_FREQ_OPTIONS, TYPE_LABELS, TYPE_ICONS } from '../config.js';
import { openSelectPicker, setTriggerIcon, buildCategoryPickerOptions, accountOptionsList, catDisplayLabel } from '../components/select-picker.js';
import { closeModal } from '../components/modal.js';
import { refreshPrices } from '../data/holdings.js';

// ─────────────────────────────────────────
// CASHFLOW
// ─────────────────────────────────────────
const DEFAULT_CATEGORIES=[
  {name:'Food & Dining',icon:'ti-tools-kitchen-2',color:'#f59e0b'},
  {name:'Transport',icon:'ti-car',color:'#3b82f6'},
  {name:'Bills & Utilities',icon:'ti-file-invoice',color:'#6366f1'},
  {name:'Health',icon:'ti-heart-rate-monitor',color:'#ec4899'},
  {name:'Entertainment',icon:'ti-device-tv',color:'#8b5cf6'},
  {name:'Shopping',icon:'ti-shopping-bag',color:'#f97316'},
  {name:'Salary',icon:'ti-briefcase',color:'#10b981'},
  {name:'Investment',icon:'ti-trending-up',color:'#0ea5e9'},
];

export async function loadCashflow(){
  [state.cfCategories, state.cfTransactions, state.cfRecurrences]=await Promise.all([
    api('cashflow_categories?order=name.asc'),
    api('cashflow_transactions?order=date.desc'),
    api('recurrences?order=next_due.asc'),
  ]);
  if(!state.cfCategories.length){
    for(const c of DEFAULT_CATEGORIES){
      const r=await api('cashflow_categories',{method:'POST',body:JSON.stringify(c)});
      if(Array.isArray(r)&&r[0]) state.cfCategories.push(r[0]);
    }
  }
  // Ensure extra categories from Excel exist
  await ensureExtraCategories();
  await processRecurrences();
  renderCashflow();
  renderSettings();
  renderInsights();
  // Refresh reports page if currently visible
  if(document.getElementById('page-reports')?.classList.contains('active')) renderReports();
}

async function processRecurrences(){
  const now=new Date(); let anyCreated=false;
  for(const r of state.cfRecurrences){
    if(!r.active) continue;
    let due=new Date(r.next_due);
    while(due<=now){
      await api('cashflow_transactions',{method:'POST',body:JSON.stringify({type:r.type,amount:r.amount,description:r.description,category_id:r.category_id,holding_id:r.holding_id,holding_to_id:r.holding_to_id,date:due.toISOString(),recurring_id:r.id})});
      await applyBalanceChange(r.type,r.amount,r.holding_id,r.holding_to_id);
      due=advanceDue(due,r.frequency); anyCreated=true;
    }
    await api(`recurrences?id=eq.${r.id}`,{method:'PATCH',body:JSON.stringify({next_due:due.toISOString(),last_run:now.toISOString()})});
  }
  if(anyCreated){state.cfTransactions=await api('cashflow_transactions?order=date.desc');state.holdings=await api('holdings?order=created_at.asc');}
}

function advanceDue(date,freq){
  const d=new Date(date);
  if(freq==='daily') d.setDate(d.getDate()+1);
  if(freq==='weekly') d.setDate(d.getDate()+7);
  if(freq==='monthly') d.setMonth(d.getMonth()+1);
  if(freq==='yearly') d.setFullYear(d.getFullYear()+1);
  return d;
}

export async function applyBalanceChange(type,amount,fromId,toId){
  state.holdings=await api('holdings?order=created_at.asc');
  if(type==='expense'&&fromId){const h=state.holdings.find(x=>x.id===fromId);if(h)await api(`holdings?id=eq.${fromId}`,{method:'PATCH',body:JSON.stringify({avg_cost:Math.max(0,(h.avg_cost||0)-amount)})});}
  else if(type==='income'&&fromId){const h=state.holdings.find(x=>x.id===fromId);if(h)await api(`holdings?id=eq.${fromId}`,{method:'PATCH',body:JSON.stringify({avg_cost:(h.avg_cost||0)+amount})});}
  else if(type==='transfer'&&fromId&&toId){
    const hf=state.holdings.find(x=>x.id===fromId),ht=state.holdings.find(x=>x.id===toId);
    if(hf)await api(`holdings?id=eq.${fromId}`,{method:'PATCH',body:JSON.stringify({avg_cost:Math.max(0,(hf.avg_cost||0)-amount)})});
    if(ht)await api(`holdings?id=eq.${toId}`,{method:'PATCH',body:JSON.stringify({avg_cost:(ht.avg_cost||0)+amount})});
  }
}

// Reverses whatever a transaction did to its holding(s) — used when editing or deleting.
// Not just the opposite type: a transfer must swap fromId/toId to correctly walk the
// money back, not repeat the same movement again.
export async function reverseBalanceChange(type,amount,fromId,toId){
  if(type==='expense') await applyBalanceChange('income',amount,fromId,null);
  else if(type==='income') await applyBalanceChange('expense',amount,fromId,null);
  else if(type==='transfer') await applyBalanceChange('transfer',amount,toId,fromId);
}

function isIncomeSide(t,hId){
  if(t.type==='income') return t.holding_id===hId;
  if(t.type==='sale') return t.holding_to_id===hId;
  if(t.type==='transfer') return t.holding_to_id===hId;
  return false;
}
function isOutcomeSide(t,hId){
  if(t.type==='expense') return t.holding_id===hId;
  if(t.type==='purchase') return t.holding_to_id===hId;
  return false;
}
function isTransferSide(t){ return t.type==='transfer'; }

export function renderCashflow(){
  const cfHeader=document.getElementById('cf-page-header'); if(cfHeader) cfHeader.style.display='';
  const cfSearchbar=document.getElementById('cf-searchbar'); if(cfSearchbar) cfSearchbar.style.display='';
  if(!state.cfSearchQuery) closeCfSearch();
  const container=document.getElementById('cf-accounts'); if(!container) return;
  if(!state.holdings.length){container.innerHTML='<div class="card"><div class="empty"><i class="ti ti-wallet"></i><p>No holdings yet.</p></div></div>';return;}
  const typeColorMap={bank:'#0ea5e9',bond:'#ec4899',cash:'#84cc16',crypto:'#f59e0b',dividend:'#60a8f5',etf:'#10b981',stock:'#6366f1'};
  // Group by type
  const byType={};
  state.holdings.forEach(h=>{if(!byType[h.type])byType[h.type]=[];byType[h.type].push(h);});
  const sortedTypes=Object.keys(byType).sort((a,b)=>(TYPE_LABELS[a]||a).localeCompare(TYPE_LABELS[b]||b));
  container.innerHTML=sortedTypes.map(type=>{
    const typeHoldings=byType[type];
    const color=typeColorMap[type]||'#888';
    const icon=TYPE_ICONS[type]||'ti-wallet';
    const typeLabel=TYPE_LABELS[type]||type;
    const typeTxCount=state.cfTransactions.filter(t=>typeHoldings.some(h=>t.holding_id===h.id||t.holding_to_id===h.id)).length;
    const typeTotal=typeHoldings.reduce((s,h)=>s+getVal(h),0);
    const subGroups=typeHoldings.map(h=>{
      const dispName=h.type==='crypto'?cleanCryptoName(h.name||h.ticker):(h.name||h.ticker);
      const hTxs=state.cfTransactions.filter(t=>t.holding_id===h.id||t.holding_to_id===h.id);
      const recent=hTxs.slice(0,5);
      return `<div style="border-top:1px solid var(--border)">
        <div style="padding:8px 1.25rem;background:var(--surface2);display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;font-weight:600">${dispName}</span>
          <span style="font-size:13px;font-weight:600">${fmt(getVal(h))}</span>
        </div>
        ${recent.length?recent.map(t=>cfTxRow(t,h)).join(''):'<div style="padding:10px 1.25rem;color:var(--text3);font-size:13px">No transactions yet</div>'}
        <button class="cf-see-all" onclick="showAllTransactions('${h.id}')" style="border-top:1px solid var(--border)">See all transactions <i class="ti ti-chevron-right" style="font-size:11px;vertical-align:middle"></i></button>
      </div>`;
    }).join('');
    const totalNW=state.holdings.reduce((s,h)=>s+getVal(h),0);
    const typePct=totalNW>0?(typeTotal/totalNW*100).toFixed(1):'0';
    const isOpen = state.cfOpenTypes.has(type);
    return `<div class="cf-account-block" data-type="${type}">
      <div class="cat-header${isOpen?' open':''}" onclick="toggleCfAccount(this)">
        <div class="cat-icon" style="background:${color}1a;color:${color}"><i class="ti ${icon}"></i></div>
        <div class="cat-info">
          <div class="cat-name">${typeLabel}</div>
          <div class="cat-count">${typeHoldings.length} holding${typeHoldings.length>1?'s':''}</div>
        </div>
        <div class="cat-total">
          <div class="cat-total-val">${fmt(typeTotal)}</div>
          <div class="cat-total-pct">${typePct}% of portfolio</div>
        </div>
        <i class="ti ti-chevron-down cat-chevron"></i>
      </div>
      <div class="cf-account-body${isOpen?' open':''}">${subGroups}</div>
    </div>`;
  }).join('');
  initTouchDnD();
}

export function cfTxRow(t,h){
  const cat=state.cfCategories.find(c=>c.id===t.category_id);
  const txType=t.type||'expense';
  const hId=h?.id;
  let amtSign,amtColor,bgColor,icon;
  if(txType==='purchase'){
    const isAcquired=hId===t.holding_id;
    amtSign=isAcquired?'+':'-'; amtColor=isAcquired?'var(--green)':'var(--red)';
    bgColor=isAcquired?'var(--green-bg)':'var(--red-bg)'; icon=isAcquired?'ti-arrow-down-left':'ti-arrow-up-right';
  } else if(txType==='sale'){
    const isSold=hId===t.holding_id;
    amtSign=isSold?'-':'+'; amtColor=isSold?'var(--red)':'var(--green)';
    bgColor=isSold?'var(--red-bg)':'var(--green-bg)'; icon=isSold?'ti-arrow-up-right':'ti-arrow-down-left';
  } else if(txType==='transfer'){
    const isSource=hId===t.holding_id;
    amtSign=isSource?'-':'+'; amtColor=isSource?'var(--red)':'var(--green)';
    bgColor='rgba(99,102,241,0.12)'; icon='ti-arrows-exchange';
  } else if(txType==='income'){
    amtSign='+'; amtColor='var(--green)'; bgColor='var(--green-bg)'; icon='ti-arrow-down-left';
  } else {
    amtSign='-'; amtColor='var(--red)'; bgColor='var(--red-bg)'; icon='ti-arrow-up-right';
  }
  const date=new Date(t.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'});
  const catLabel=cat?`<span style="color:${cat.color}">${cat.name}</span>`:'';
  const typeLabel=txType==='purchase'?'Purchase':txType==='sale'?'Sale':'';
  const recurLabel=t.recurring_id?`<span style="color:var(--accent);display:inline-flex;align-items:center;gap:3px"><i class="ti ti-repeat" style="font-size:10px"></i>Recurring</span>`:'';
  const subLabel=[catLabel,typeLabel,recurLabel].filter(x=>x&&x.trim()).join(' · ');
  // Build row HTML without nested template literals
  const txId = t.id;
  let rowHtml = '<div class="cf-tx-row' + (state.bulkSelectMode ? ' selectable' : '') + '" id="cf-row-' + txId + '"'
    + ' ontouchstart="txTouchStart(\'' + txId + '\')" ontouchend="txTouchEnd()" ontouchmove="txTouchMove()" ontouchcancel="txTouchEnd()"'
    + (state.bulkSelectMode ? ' onclick="toggleTxSelect(\'' + txId + '\')" style="cursor:pointer"' : '') + '>';
  if(state.bulkSelectMode){
    rowHtml += '<input type="checkbox" class="cf-tx-checkbox" id="chk-' + txId + '" onclick="event.stopPropagation();toggleTxSelect(\'' + txId + '\')">';
  }
  rowHtml += `<div class="cf-tx-icon" style="background:${bgColor};color:${amtColor}"><i class="ti ${icon}"></i></div>
    <div class="cf-tx-desc"><div class="cf-tx-name">${t.description||'—'}</div><div class="cf-tx-cat">${subLabel||''}</div></div>
    <div style="text-align:right">
      <div class="cf-tx-amount" style="color:${amtColor}">${amtSign}${fmt(t.amount)}</div>
      <div class="cf-tx-date">${date}</div>
    </div>
    <div style="display:flex;gap:4px;margin-left:8px">
      <button class="btn btn-sm" onclick="editCfTx('${t.id}')"><i class="ti ti-pencil"></i></button>
      <button class="btn btn-sm btn-danger" onclick="deleteCfTx('${t.id}','${t.holding_id||''}','${t.holding_to_id||''}','${t.type}',${t.amount})"><i class="ti ti-trash"></i></button>
    </div>
  </div>`;
  return rowHtml;
}

export function toggleCfAccount(header){
  const body=header.nextElementSibling;
  const open=body.classList.contains('open');
  body.classList.toggle('open',!open);
  header.classList.toggle('open',!open);
  header.setAttribute('aria-expanded',String(!open));
  const type=header.closest('.cf-account-block')?.dataset.type;
  if(type){ if(!open) state.cfOpenTypes.add(type); else state.cfOpenTypes.delete(type); }
}

export function allTxDateSummary(){
  if(allTxFrom && allTxTo) return `${fmtDateDDMMYYYY(allTxFrom)} → ${fmtDateDDMMYYYY(allTxTo)}`;
  if(allTxFrom) return `From ${fmtDateDDMMYYYY(allTxFrom)}`;
  if(allTxTo) return `Until ${fmtDateDDMMYYYY(allTxTo)}`;
  return 'Date range';
}

export function toggleAllTxDateFilter(open){
  allTxDateFilterOpen = (open!==undefined) ? open : !allTxDateFilterOpen;
  renderAllTxDateFilter();
}

function renderAllTxDateFilter(){
  const wrap=document.getElementById('alltx-date-wrap'); if(!wrap) return;
  const active = !!(allTxFrom||allTxTo);
  if(!allTxDateFilterOpen){
    wrap.innerHTML = `
      <button type="button" class="btn btn-sm${active?' btn-primary':''}" onclick="toggleAllTxDateFilter(true)">
        <i class="ti ti-calendar"></i> ${allTxDateSummary()}
      </button>${active?`<button type="button" class="btn btn-sm" onclick="clearAllTxDate()" title="Clear date filter" style="margin-left:6px"><i class="ti ti-x" style="font-size:11px"></i></button>`:''}`;
  } else {
    wrap.innerHTML = `
      <div class="date-filter-row">
        <i class="ti ti-calendar"></i>
        <button type="button" class="date-field${allTxFrom?'':' placeholder'}" id="alltx-from-field" onclick="openDatePicker('alltx-from', allTxFrom, v=>{ allTxFrom=v; updateAllTxDateField('from'); renderAllTxBody(); })">
          <span id="alltx-from-label">${allTxFrom?fmtDateDDMMYYYY(allTxFrom):'dd/mm/yyyy'}</span>
        </button>
        <span class="date-arrow">→</span>
        <button type="button" class="date-field${allTxTo?'':' placeholder'}" id="alltx-to-field" onclick="openDatePicker('alltx-to', allTxTo, v=>{ allTxTo=v; updateAllTxDateField('to'); renderAllTxBody(); })">
          <span id="alltx-to-label">${allTxTo?fmtDateDDMMYYYY(allTxTo):'dd/mm/yyyy'}</span>
        </button>
        <button type="button" class="btn btn-sm" onclick="clearAllTxDate()" title="Clear date filter"><i class="ti ti-x" style="font-size:11px"></i></button>
        <button type="button" class="btn btn-sm" onclick="toggleAllTxDateFilter(false)" title="Collapse"><i class="ti ti-chevron-up" style="font-size:11px"></i></button>
      </div>`;
  }
}

function updateAllTxDateField(which){
  const field=document.getElementById(`alltx-${which}-field`);
  const label=document.getElementById(`alltx-${which}-label`);
  const val = which==='from' ? allTxFrom : allTxTo;
  if(!field||!label) return;
  label.textContent = val ? fmtDateDDMMYYYY(val) : 'dd/mm/yyyy';
  field.classList.toggle('placeholder', !val);
}

function clearAllTxDate(){
  allTxFrom=''; allTxTo='';
  renderAllTxDateFilter();
  renderAllTxBody();
}

function toggleAllTxSearch(){
  const wrap=document.getElementById('alltx-search-wrap');
  const toggle=document.getElementById('alltx-search-toggle');
  if(!wrap) return;
  if(wrap.style.display==='none'){
    wrap.style.display='block';
    toggle?.classList.add('btn-primary');
    document.getElementById('alltx-search-input')?.focus();
  } else {
    closeAllTxSearch();
  }
}
function closeAllTxSearch(){
  allTxSearchQuery='';
  const wrap=document.getElementById('alltx-search-wrap'); if(wrap) wrap.style.display='none';
  const input=document.getElementById('alltx-search-input'); if(input) input.value='';
  document.getElementById('alltx-search-toggle')?.classList.remove('btn-primary');
  renderAllTxBody();
}
function onAllTxSearch(q){
  allTxSearchQuery=q.trim().toLowerCase();
  renderAllTxBody();
}

export function setAllTxFilter(f,btn){
  allTxFilter=f;
  document.querySelectorAll('.alltx-filter').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderAllTxBody();
}

export function renderAllTxBody(){
  const h=state.holdings.find(x=>x.id===allTxHoldingId);
  const hId=allTxHoldingId;
  let hTxs=state.cfTransactions.filter(t=>t.holding_id===hId||t.holding_to_id===hId);
  if(allTxFilter==='income')   hTxs=hTxs.filter(t=>isIncomeSide(t,hId));
  if(allTxFilter==='outcome')  hTxs=hTxs.filter(t=>isOutcomeSide(t,hId));
  if(allTxFilter==='transfer') hTxs=hTxs.filter(t=>isTransferSide(t));
  if(allTxFrom) hTxs=hTxs.filter(t=>t.date>=allTxFrom);
  if(allTxTo)   hTxs=hTxs.filter(t=>t.date<=allTxTo);
  if(allTxSearchQuery) hTxs=hTxs.filter(t=>{
    const desc=(t.description||'').toLowerCase();
    const cat=state.cfCategories.find(c=>c.id===t.category_id);
    const catName=(cat?.name||'').toLowerCase();
    return desc.includes(allTxSearchQuery)||catName.includes(allTxSearchQuery);
  });
  const body=document.getElementById('alltx-body'); if(!body) return;
  const groups={};
  hTxs.forEach(t=>{
    const key=new Date(t.date).toLocaleDateString('en-GB',{year:'numeric',month:'long',timeZone:'Europe/Rome'});
    if(!groups[key]) groups[key]=[];
    groups[key].push(t);
  });
  body.innerHTML=Object.keys(groups).length
    ?Object.entries(groups).map(([month,txs])=>`
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:8px">
        <div style="padding:8px 1.25rem 4px;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.07em;background:var(--surface2)">${month}</div>
        ${txs.map(t=>cfTxRow(t,h)).join('')}
      </div>`).join('')
    :'<div class="empty"><i class="ti ti-list"></i><p>No transactions</p></div>';
}

export function renderAllTx(){
  const cfHeader=document.getElementById('cf-page-header'); if(cfHeader) cfHeader.style.display='none';
  const cfSearchbar=document.getElementById('cf-searchbar'); if(cfSearchbar) cfSearchbar.style.display='none';
  const h=state.holdings.find(x=>x.id===allTxHoldingId);
  const dispName=h?(h.type==='crypto'?cleanCryptoName(h.name||h.ticker):(h.name||h.ticker)):'Account';
  const container=document.getElementById('cf-accounts');
  const header=document.createElement('div');
  header.style.cssText='display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap';
  header.innerHTML=`<button class="btn" onclick="renderCashflow()"><i class="ti ti-arrow-left"></i> Back</button><div style="font-size:18px;font-weight:700;flex:1">${dispName} — All transactions</div><button class="btn btn-sm" id="alltx-bulk-toggle" onclick="toggleBulkSelect()" title="Select transactions"><i class="ti ti-checkbox"></i> Select</button><button class="btn btn-sm" id="alltx-search-toggle" onclick="toggleAllTxSearch()" title="Search transactions"><i class="ti ti-search"></i></button>`;
  const searchWrap=document.createElement('div');
  searchWrap.id='alltx-search-wrap';
  searchWrap.style.cssText='display:none;position:relative;margin-bottom:1rem';
  searchWrap.innerHTML=`
    <i class="ti ti-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:14px"></i>
    <input type="text" id="alltx-search-input" placeholder="Search transactions"
      oninput="onAllTxSearch(this.value)"
      style="width:100%;padding:8px 34px 8px 32px;border:1px solid var(--border2);border-radius:var(--radius-sm);background:var(--surface2);color:var(--text);font-family:inherit;font-size:13px">
    <button class="btn btn-sm" onclick="closeAllTxSearch()" title="Close search" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);padding:4px 6px">
      <i class="ti ti-x" style="font-size:11px"></i>
    </button>`;
  const filters=document.createElement('div');
  filters.className='filters'; filters.style.marginBottom='1rem';
  filters.innerHTML=`
    <button class="alltx-filter filter-btn active" onclick="setAllTxFilter('all',this)">All</button>
    <button class="alltx-filter filter-btn" onclick="setAllTxFilter('income',this)"><i class="ti ti-arrow-down-left" style="font-size:11px"></i> Income</button>
    <button class="alltx-filter filter-btn" onclick="setAllTxFilter('outcome',this)"><i class="ti ti-arrow-up-right" style="font-size:11px"></i> Outcome</button>
    <button class="alltx-filter filter-btn" onclick="setAllTxFilter('transfer',this)"><i class="ti ti-arrows-exchange" style="font-size:11px"></i> Transfer</button>`;
  const dateWrap=document.createElement('div');
  dateWrap.id='alltx-date-wrap';
  dateWrap.style.marginBottom='1rem';
  const body=document.createElement('div'); body.id='alltx-body';
  container.innerHTML='';
  container.appendChild(header);
  container.appendChild(searchWrap);
  container.appendChild(filters);
  container.appendChild(dateWrap);
  container.appendChild(body);
  renderAllTxDateFilter();
  renderAllTxBody();
}

export function showAllTransactions(holdingId){
  allTxHoldingId=holdingId; allTxFilter='all'; allTxFrom=''; allTxTo=''; allTxDateFilterOpen=false; allTxSearchQuery='';
  renderAllTx();
}

export function showCfForm(){
  if(!state.holdings.length){
    toast('Add at least one holding before logging a transaction');
    return;
  }
  document.getElementById('cf-main').style.display='none';
  const cfForm=document.getElementById('cf-form');
  cfForm.style.display='';
  document.getElementById('cf-fab').style.display='none';
  populateCfForm();
  // Mobile: swipe down to close, but only when already scrolled to the top —
  // otherwise this fires while the user is just trying to scroll up within the form.
  if(window.innerWidth<=768){
    let _sy=0, _startedAtTop=true;
    const _scrollEl = () => document.scrollingElement || document.documentElement;
    cfForm._onTS=(e)=>{ _sy=e.touches[0].clientY; _startedAtTop = _scrollEl().scrollTop<=5; };
    cfForm._onTE=(e)=>{ if(_startedAtTop && e.changedTouches[0].clientY-_sy>70) showCfMain(); };
    cfForm.removeEventListener('touchstart',cfForm._onTS);
    cfForm.removeEventListener('touchend',cfForm._onTE);
    cfForm.addEventListener('touchstart',cfForm._onTS,{passive:true});
    cfForm.addEventListener('touchend',cfForm._onTE,{passive:true});
  }
}

export function showCfMain(){
  editTxId=null;
  document.getElementById('cf-main').style.display='';
  document.getElementById('cf-form').style.display='none';
  document.getElementById('cf-fab').style.display='';
  // Restore form title and recurring option
  const t=document.getElementById('cf-form-title'); if(t) t.textContent='Add Transaction';
  const recurWrap=document.getElementById('cf-recurring')?.closest('.form-group'); if(recurWrap) recurWrap.style.display='';
  document.getElementById('edit-recur-note')?.remove();
}

export function setCfCtx(ctx,btn){
  state.cfCtx=ctx;
  document.querySelectorAll('.cf-type-btn[data-ctx]').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  else {const b=document.querySelector(`.cf-type-btn[data-ctx="${ctx}"]`);if(b)b.classList.add('active');}
  document.getElementById('cf-account-form').style.display=ctx==='account'?'':'none';
  document.getElementById('cf-invest-form').style.display=ctx==='investment'?'':'none';
}

export function setCfType(type,btn){
  state.cfType=type;
  document.querySelectorAll('.cf-type-btn[data-type]').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  else {const b=document.querySelector(`.cf-type-btn[data-type="${type}"]`);if(b)b.classList.add('active');}
  document.getElementById('cf-to-wrap').style.display=type==='transfer'?'':'none';
  document.getElementById('cf-cat-wrap').style.display=type==='transfer'?'none':'';
  document.getElementById('cf-from-label').textContent=type==='income'?'To account':'From account';
  // Reset recurring when switching type
  const recurChk=document.getElementById('cf-recurring');
  if(recurChk){ recurChk.checked=false; toggleRecurring(false); }
}

export function setCfIType(itype,btn){
  state.cfIType=itype;
  document.querySelectorAll('.cf-type-btn[data-itype]').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  else {const b=document.querySelector(`.cf-type-btn[data-itype="${itype}"]`);if(b)b.classList.add('active');}
  document.getElementById('inv-purchase-fields').style.display=itype==='purchase'?'':'none';
  document.getElementById('inv-sale-fields').style.display=itype==='sale'?'':'none';
  document.getElementById('inv-expinc-fields').style.display=(itype==='expense'||itype==='income')?'':'none';
  document.getElementById('inv-expinc-acct-label').textContent=itype==='income'?'To account':'From account';
}

export function toggleRecurring(on){
  document.getElementById('cf-recurring-opts').style.display=on?'':'none';
}

export function updateInvCounterparts(){
  ['inv-paid-from','inv-sale-to'].forEach(id=>{ document.getElementById(id).value = ''; });
  document.getElementById('inv-paid-from-label').textContent = 'Select account';
  document.getElementById('inv-paid-from-trigger').classList.add('placeholder');
  document.getElementById('inv-sale-to-label').textContent = 'Select account';
  document.getElementById('inv-sale-to-trigger').classList.add('placeholder');
}

export function calcPurchaseFromUnit(){
  const qty=parseFloat(document.getElementById('inv-qty').value)||0;
  const price=parseFloat(document.getElementById('inv-price').value)||0;
  const total=parseFloat(document.getElementById('inv-total').value)||0;
  if(qty&&price){
    document.getElementById('inv-total').value=(qty*price).toFixed(2);
  } else if(qty&&total){
    // Total was already filled in before quantity/price — derive price now that quantity is known
    document.getElementById('inv-price').value=(total/qty).toFixed(4);
  }
}

export function calcPurchaseFromTotal(){
  const qty=parseFloat(document.getElementById('inv-qty').value)||0;
  const total=parseFloat(document.getElementById('inv-total').value)||0;
  if(qty&&total) document.getElementById('inv-price').value=(total/qty).toFixed(4);
}

export function calcSaleFromUnit(){
  const qty=parseFloat(document.getElementById('inv-sale-qty').value)||0;
  const price=parseFloat(document.getElementById('inv-sale-price').value)||0;
  const total=parseFloat(document.getElementById('inv-sale-total').value)||0;
  if(qty&&price){
    document.getElementById('inv-sale-total').value=(qty*price).toFixed(2); updatePnl();
  } else if(qty&&total){
    document.getElementById('inv-sale-price').value=(total/qty).toFixed(4); updatePnl();
  }
}

export function calcSaleFromTotal(){
  const qty=parseFloat(document.getElementById('inv-sale-qty').value)||0;
  const total=parseFloat(document.getElementById('inv-sale-total').value)||0;
  if(qty&&total){ document.getElementById('inv-sale-price').value=(total/qty).toFixed(4); updatePnl(); }
}

function updatePnl(){
  const assetId=document.getElementById('inv-asset').value;
  const h=state.holdings.find(x=>x.id===assetId); if(!h) return;
  const qty=parseFloat(document.getElementById('inv-sale-qty').value)||0;
  const total=parseFloat(document.getElementById('inv-sale-total').value)||0;
  if(!qty||!total) return;
  const costBasis=h.avg_cost*qty;
  const pnl=total-costBasis;
  const pct=costBasis>0?pnl/costBasis*100:0;
  const el=document.getElementById('inv-pnl-preview'); if(!el) return;
  el.style.display='';
  el.innerHTML=`<span style="color:${pnl>=0?'var(--green)':'var(--red)'};font-weight:600">${pnl>=0?'+':''}${fmt(pnl)} (${fmtPct(pct)})</span> vs avg cost of ${fmt(h.avg_cost)}/unit`;
}

export function openCfDatePicker(){
  openDatePicker('cf-date', document.getElementById('cf-date').value, v=>{
    document.getElementById('cf-date').value = v;
    updateCfDateLabel();
  }, {withTime:true});
}

function updateCfDateLabel(){
  const el = document.getElementById('cf-date-label');
  const v  = document.getElementById('cf-date').value;
  if(el) el.textContent = v ? fmtDateTimeDDMMYYYY(v) : 'dd/mm/yyyy hh:mm';
}

function populateCfForm(tx=null){
  // tx = optional existing transaction to pre-fill (edit mode)
  const now=new Date(); now.setSeconds(0,0);
  const iso=now.toISOString().slice(0,16);

  // Dates
  document.getElementById('cf-date').value = tx ? new Date(tx.date).toISOString().slice(0,16) : iso;
  updateCfDateLabel();
  document.getElementById('cf-recur-start').value=iso;
  document.getElementById('cf-recurring').checked=false;
  document.getElementById('cf-recurring-opts').style.display='none';

  // Amount & description
  document.getElementById('cf-amount').value = tx ? (tx.amount||'') : '';
  document.getElementById('cf-desc').value   = tx ? (tx.description||'') : '';

  // Category — reset trigger + hidden value
  {
    const catId = tx?.category_id || '';
    document.getElementById('cf-cat').value = catId;
    const cat = state.cfCategories.find(c=>c.id===catId);
    document.getElementById('cf-cat-label').textContent = cat ? catDisplayLabel(cat) : 'Select category';
    document.getElementById('cf-cat-trigger').classList.toggle('placeholder', !cat);
    setTriggerIcon('cf-cat-icon', cat?.icon, cat?.color);
  }

  // Account triggers
  {
    const fromId = tx?.holding_id || '';
    const toId   = tx?.holding_to_id || '';
    document.getElementById('cf-from').value = fromId;
    document.getElementById('cf-to').value   = toId;
    const opts    = accountOptionsList();
    const fromOpt = opts.find(o=>o.value===fromId);
    const toOpt   = opts.find(o=>o.value===toId);
    document.getElementById('cf-from-label-text').textContent = fromOpt ? fromOpt.label : 'Select account';
    document.getElementById('cf-from-trigger').classList.toggle('placeholder', !fromOpt);
    setTriggerIcon('cf-from-icon', fromOpt?.icon, fromOpt?.color);
    document.getElementById('cf-to-label-text').textContent = toOpt ? toOpt.label : 'Select account';
    document.getElementById('cf-to-trigger').classList.toggle('placeholder', !toOpt);
    setTriggerIcon('cf-to-icon', toOpt?.icon, toOpt?.color);
  }

  // Investment asset trigger
  {
    const investOpts = invAssetOptionsList();
    let assetId = '';
    if(tx?.holding_id && ['purchase','sale'].includes(tx?.type)) assetId = tx.holding_id;
    document.getElementById('inv-asset').value = assetId;
    const assetOpt = investOpts.find(o=>o.value===assetId);
    document.getElementById('inv-asset-label').textContent = assetOpt ? assetOpt.label : 'Select asset';
    document.getElementById('inv-asset-trigger').classList.toggle('placeholder', !assetOpt);
    updateInvCounterparts();
  }

  // Investment category trigger
  {
    const catId = tx?.category_id || '';
    document.getElementById('inv-cat').value = catId;
    const cat = state.cfCategories.find(c=>c.id===catId);
    document.getElementById('inv-cat-label').textContent = cat ? catDisplayLabel(cat) : 'Select category';
    document.getElementById('inv-cat-trigger').classList.toggle('placeholder', !cat);
    setTriggerIcon('inv-cat-icon', cat?.icon, cat?.color);
  }

  document.getElementById('inv-date').value=iso;
  if(document.getElementById('inv-pnl-preview')) document.getElementById('inv-pnl-preview').style.display='none';

  // Purchase fields — reset qty/price/total and the "paid with" account trigger
  {
    document.getElementById('inv-qty').value   = '';
    document.getElementById('inv-price').value = '';
    document.getElementById('inv-total').value = '';
    document.getElementById('inv-paid-from').value = '';
    document.getElementById('inv-paid-from-label').textContent = 'Select account';
    document.getElementById('inv-paid-from-trigger').classList.add('placeholder');
  }

  // Sale fields — reset qty/price/total and the "proceeds to" account trigger
  {
    document.getElementById('inv-sale-qty').value   = '';
    document.getElementById('inv-sale-price').value = '';
    document.getElementById('inv-sale-total').value = '';
    document.getElementById('inv-sale-to').value = '';
    document.getElementById('inv-sale-to-label').textContent = 'Select account';
    document.getElementById('inv-sale-to-trigger').classList.add('placeholder');
  }

  // Set context/type — use tx values in edit mode, globals otherwise
  const ctx  = tx ? (['purchase','sale'].includes(tx.type) ? 'investment' : 'account') : state.cfCtx;
  const type = tx?.type || state.cfType;
  setCfCtx(ctx, null);
  if(['purchase','sale'].includes(type)) setCfIType(type, null);
  else setCfType(type, null);
}


export async function saveCfTransaction(){
  // If in edit mode, PATCH instead of POST
  if(editTxId){
    const amount=parseFloat(document.getElementById('cf-amount').value)||0;
    const desc=document.getElementById('cf-desc').value.trim();
    const catId=document.getElementById('cf-cat').value||null;
    const date=document.getElementById('cf-date').value;
    const fromId=document.getElementById('cf-from').value||null;
    const toId=document.getElementById('cf-to').value||null;
    if(amount<=0){await showAlert('Please enter an amount.');return;}
    if(state.cfType==='transfer'&&fromId===toId){await showAlert('Source and destination account must be different.');return;}

    // Undo what the original transaction did to its holding(s) before applying the edit —
    // otherwise the old amount stays baked into the balance forever.
    const oldTx = state.cfTransactions.find(t=>t.id===editTxId);
    if(oldTx) await reverseBalanceChange(oldTx.type, Number(oldTx.amount), oldTx.holding_id, oldTx.holding_to_id);
    await applyBalanceChange(state.cfType, amount, fromId, state.cfType==='transfer'?toId:null);

    await api(`cashflow_transactions?id=eq.${editTxId}`,{method:'PATCH',body:JSON.stringify({
      type:state.cfType, amount, description:desc||null, category_id:state.cfType==='transfer'?null:catId,
      holding_id:fromId, holding_to_id:state.cfType==='transfer'?toId:null,
      date:new Date(date).toISOString()
    })});
    editTxId=null;
    [state.cfTransactions,state.holdings]=await Promise.all([api('cashflow_transactions?order=date.desc'),api('holdings?order=created_at.asc')]);
    renderCashflow(); renderOverview(); showCfMain(); toast('Transaction updated ✓');
    // Restore form title and recurring option
    const recurWrap=document.querySelector('[id="cf-recurring"]')?.closest('.form-group');
    if(recurWrap) recurWrap.style.display='';
    document.getElementById('edit-recur-note')?.remove();
    return;
  }
  const amount=parseFloat(document.getElementById('cf-amount').value)||0;
  const desc=document.getElementById('cf-desc').value.trim();
  const catId=document.getElementById('cf-cat').value||null;
  const date=document.getElementById('cf-date').value;
  const fromId=document.getElementById('cf-from').value||null;
  const toId=document.getElementById('cf-to').value||null;
  const isRecur=document.getElementById('cf-recurring').checked;
  if(amount<=0){await showAlert('Please enter an amount.');return;}
  if(!fromId){await showAlert('Please select an account.');return;}
  if(state.cfType==='transfer'&&fromId===toId){await showAlert('Source and destination account must be different.');return;}
  if(state.cfType==='transfer'||state.cfType==='expense'){
    const fromH=state.holdings.find(h=>h.id===fromId);
    if(fromH&&fromH.avg_cost<amount){
      if(!await showConfirm(`This will bring ${fromH.name||fromH.ticker} to a negative balance (current: ${fmt(fromH.avg_cost)}, amount: ${fmt(amount)}).

Proceed anyway?`)) return;
    }
  }
  const txData={type:state.cfType,amount,description:desc||null,category_id:state.cfType==='transfer'?null:catId,holding_id:fromId,holding_to_id:state.cfType==='transfer'?toId:null,date:new Date(date).toISOString()};
  if(isRecur){
    const freq=document.getElementById('cf-freq').value;
    const start=document.getElementById('cf-recur-start').value;
    // The transaction we're about to create below already covers the "start" occurrence,
    // so next_due must be advanced past it — otherwise processRecurrences() sees this same
    // date as overdue on the next load and creates a duplicate transaction for it.
    const nextDue=advanceDue(new Date(start), freq);
    const recur=await api('recurrences',{method:'POST',body:JSON.stringify({type:state.cfType,amount,description:desc||null,category_id:state.cfType==='transfer'?null:catId,holding_id:fromId,holding_to_id:state.cfType==='transfer'?toId:null,frequency:freq,next_due:nextDue.toISOString(),active:true})});
    if(Array.isArray(recur)&&recur[0]) txData.recurring_id=recur[0].id;
  }
  await api('cashflow_transactions',{method:'POST',body:JSON.stringify(txData)});
  await applyBalanceChange(state.cfType,amount,fromId,state.cfType==='transfer'?toId:null);
  [state.cfTransactions,cfRecurrences,state.holdings]=await Promise.all([api('cashflow_transactions?order=date.desc'),api('recurrences?order=next_due.asc'),api('holdings?order=created_at.asc')]);
  state.holdings = await api('holdings?order=created_at.asc');
  renderCashflow(); renderSettings(); renderHoldings(); renderOverview();
  showCfMain(); toast('Transaction saved ✓');
}

export async function saveInvTransaction(){
  const assetId=document.getElementById('inv-asset').value;
  const h=state.holdings.find(x=>x.id===assetId);
  if(!h){await showAlert('Please select an asset.');return;}
  const desc=document.getElementById('inv-cat').value;
  const dateIso=new Date(document.getElementById('inv-date').value).toISOString();
  if(state.cfIType==='purchase'){
    const qty=parseFloat(document.getElementById('inv-qty').value)||0;
    const price=parseFloat(document.getElementById('inv-price').value)||0;
    const total=parseFloat(document.getElementById('inv-total').value)||(qty*price);
    const paidFromId=document.getElementById('inv-paid-from').value||null;
    if(qty<=0||price<=0){await showAlert('Please enter quantity and price.');return;}
    if(paidFromId&&paidFromId===assetId){await showAlert('The asset purchased and the account used to pay cannot be the same.');return;}
    // Update holding qty and avg cost
    const newAvgCost=(h.qty*h.avg_cost+qty*price)/(h.qty+qty);
    const newQty=h.qty+qty;
    await api(`holdings?id=eq.${assetId}`,{method:'PATCH',body:JSON.stringify({qty:newQty,avg_cost:newAvgCost})});
    await api('cashflow_transactions',{method:'POST',body:JSON.stringify({type:'purchase',amount:total,description:`Purchased ${qty} ${cleanCryptoTicker(h.ticker)||h.ticker}`,holding_id:assetId,holding_to_id:paidFromId,date:dateIso})});
    if(paidFromId){const hf=state.holdings.find(x=>x.id===paidFromId);if(hf)await api(`holdings?id=eq.${paidFromId}`,{method:'PATCH',body:JSON.stringify({avg_cost:Math.max(0,(hf.avg_cost||0)-total)})});}
  } else if(state.cfIType==='sale'){
    const qty=parseFloat(document.getElementById('inv-sale-qty').value)||0;
    const price=parseFloat(document.getElementById('inv-sale-price').value)||0;
    const total=parseFloat(document.getElementById('inv-sale-total').value)||(qty*price);
    const saleToId=document.getElementById('inv-sale-to').value||null;
    if(qty<=0||price<=0){await showAlert('Please enter quantity and price.');return;}
    if(qty>h.qty){await showAlert(`You only have ${h.qty} units of ${h.ticker}.`);return;}
    if(saleToId&&saleToId===assetId){await showAlert('The asset sold and the destination account cannot be the same.');return;}
    const newQty=h.qty-qty;
    await api(`holdings?id=eq.${assetId}`,{method:'PATCH',body:JSON.stringify({qty:newQty})});
    await api('cashflow_transactions',{method:'POST',body:JSON.stringify({type:'sale',amount:total,description:`Sold ${qty} ${cleanCryptoTicker(h.ticker)||h.ticker}`,holding_id:assetId,holding_to_id:saleToId,date:dateIso})});
    if(saleToId){const ht=state.holdings.find(x=>x.id===saleToId);if(ht)await api(`holdings?id=eq.${saleToId}`,{method:'PATCH',body:JSON.stringify({avg_cost:(ht.avg_cost||0)+total})});}
  } else {
    const amount=parseFloat(document.getElementById('inv-amount').value)||0;
    const catId=document.getElementById('inv-cat').value||null;
    const acctId=document.getElementById('inv-expinc-acct').value||null;
    const desc2=document.getElementById('inv-desc').value.trim();
    if(amount<=0){await showAlert('Please enter an amount.');return;}
    await api('cashflow_transactions',{method:'POST',body:JSON.stringify({type:state.cfIType,amount,description:desc2||null,category_id:catId,holding_id:assetId,holding_to_id:null,date:dateIso})});
    await applyBalanceChange(state.cfIType,amount,acctId||assetId,null);
  }
  [state.cfTransactions,state.holdings]=await Promise.all([api('cashflow_transactions?order=date.desc'),api('holdings?order=created_at.asc')]);
  renderCashflow(); renderHoldings(); renderOverview();
  await refreshPrices(true, true);
  showCfMain(); toast('Transaction saved ✓');
}

// ── Edit transaction ──
export function editCfTx(txId){
  const t = state.cfTransactions.find(x=>x.id===txId); if(!t) return;

  if(t.type==='purchase' || t.type==='sale'){
    showAlert(`Editing a ${t.type} isn't supported — changing quantity or price would need to recalculate your average cost history, which can't be done safely from here. Delete this transaction and re-add it with the correct details instead.`);
    return;
  }

  editTxId = txId;

  // Open the form
  document.getElementById('cf-main').style.display='none';
  document.getElementById('cf-form').style.display='';
  document.getElementById('cf-fab').style.display='none';

  // Sync the Expense/Income/Transfer context to match this transaction — otherwise
  // whatever type was last selected stays active and the wrong fields get saved.
  setCfType(t.type, null);

  // Populate form with transaction data pre-filled in one pass
  populateCfForm(t);

  // Update title
  const titleEl = document.getElementById('cf-form-title');
  if(titleEl) titleEl.textContent = 'Edit Transaction';

  // Hide recurring section when editing
  const recurWrap = document.getElementById('cf-recurring')?.closest('.form-group');
  if(recurWrap) recurWrap.style.display = 'none';

  // Note for recurring transactions
  document.getElementById('edit-recur-note')?.remove();
  if(t.recurring_id){
    const note = document.createElement('div');
    note.id = 'edit-recur-note';
    note.style.cssText = 'font-size:12px;color:var(--text2);padding:8px 0;display:flex;align-items:center;gap:6px';
    note.innerHTML = '<i class="ti ti-info-circle" style="color:var(--accent)"></i> Recurring — only this occurrence will be modified.';
    if(recurWrap?.parentElement) recurWrap.parentElement.insertBefore(note, recurWrap);
  }
}

export async function deleteCfTx(id,holdingId,holdingToId,type,amount){
  if(!await showConfirm('Delete this transaction? The holding balance will be reversed.')) return;
  await reverseBalanceChange(type,Number(amount),holdingId||null,holdingToId||null);
  await api(`cashflow_transactions?id=eq.${id}`,{method:'DELETE'});
  [state.cfTransactions,state.holdings]=await Promise.all([api('cashflow_transactions?order=date.desc'),api('holdings?order=created_at.asc')]);
  renderCashflow(); renderOverview(); toast('Transaction deleted');
}

export function openCfCategoryPicker() {
  const current = document.getElementById('cf-cat').value;
  const options = buildCategoryPickerOptions();
  options.push({ value: '__new_cat__', label: 'New category…', icon: 'ti-plus', color: 'var(--accent)' });
  openSelectPicker('Select category', options, current, (val) => {
    if (val === '__new_cat__') {
      state.catCreateTargetField = 'cf-cat';
      closeModal('modal-select');
      window.openCategoryModal?.();
      return;
    }
    document.getElementById('cf-cat').value = val;
    const cat = (state.cfCategories || []).find(c => c.id === val);
    document.getElementById('cf-cat-label').textContent = cat ? catDisplayLabel(cat) : 'Select category';
    document.getElementById('cf-cat-trigger').classList.toggle('placeholder', !cat);
    setTriggerIcon('cf-cat-icon', cat?.icon, cat?.color);
  });
}

export function openCfAccountPicker(which) {
  const fieldId   = which === 'from' ? 'cf-from' : 'cf-to';
  const labelId   = which === 'from' ? 'cf-from-label-text' : 'cf-to-label-text';
  const triggerId = which === 'from' ? 'cf-from-trigger' : 'cf-to-trigger';
  const iconId    = which === 'from' ? 'cf-from-icon' : 'cf-to-icon';
  const current = document.getElementById(fieldId).value;
  const options = accountOptionsList();
  openSelectPicker('Select account', options, current, (val) => {
    document.getElementById(fieldId).value = val;
    const opt = options.find(o => o.value === val);
    document.getElementById(labelId).textContent = opt ? opt.label : 'Select account';
    document.getElementById(triggerId).classList.toggle('placeholder', !opt);
    setTriggerIcon(iconId, opt?.icon, opt?.color);
  });
}

export function openCfFreqPicker() {
  const current = document.getElementById('cf-freq').value || 'monthly';
  openSelectPicker('Select frequency', CF_FREQ_OPTIONS, current, (val) => {
    document.getElementById('cf-freq').value = val;
    const opt = CF_FREQ_OPTIONS.find(o => o.value === val);
    document.getElementById('cf-freq-label').textContent = opt ? opt.label : 'Monthly';
  });
}

// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions({
  loadCashflow,
  renderCashflow,

  openCfAccountPicker,
  openCfFreqPicker,
  openCfCategoryPicker,

  toggleCfAccount,
  allTxDateSummary,
  toggleAllTxDateFilter,
  toggleAllTxSearch,
  closeAllTxSearch,
  onAllTxSearch,
  clearAllTxDate,

  showAllTransactions,
  renderAllTx,
  renderAllTxBody,
  setAllTxFilter,

  showCfForm,
  showCfMain,
  setCfCtx,
  setCfType,
  setCfIType,
  toggleRecurring,

  updateInvCounterparts,
  calcPurchaseFromUnit,
  calcPurchaseFromTotal,
  calcSaleFromUnit,
  calcSaleFromTotal,

  openCfDatePicker,
  saveCfTransaction,
  saveInvTransaction,
  editCfTx,
  deleteCfTx,

  applyBalanceChange,
  reverseBalanceChange,
  cfTxRow
});