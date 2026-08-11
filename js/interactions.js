function showMobileRptInsights(){
  showPage(mobileAnalyticsPage, null);
}

function switchMobileAnalytics(page){
  mobileAnalyticsPage = page;
  showPage(page, null);
}

// ─────────────────────────────────────────
// CALENDAR DAY DETAIL
// ─────────────────────────────────────────
function showCalDayDetail(day, month, year){
  const events = getRecurrenceDaysInMonth(year, month).filter(e=>e.day===day).map(e=>e.recurrence);
  if(!events.length) return;
  const date = new Date(year,month,day).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  let rows = events.map(r=>{
    const cat = cfCategories.find(c=>c.id===r.category_id);
    const color = cat?.color||'var(--accent)';
    const icon  = cat?.icon||'ti-repeat';
    const freq  = r.frequency==='monthly'?'Monthly':r.frequency==='weekly'?'Weekly':r.frequency==='yearly'?'Yearly':r.frequency||'';
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(38,45,61,0.4)">
      <div style="width:36px;height:36px;border-radius:9px;background:${color}18;color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti ${icon}" style="font-size:17px"></i></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.description||cat?.name||'Recurring'}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${cat?.name||''} ${freq?'· '+freq:''}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:${color};font-family:'JetBrains Mono',monospace;flex-shrink:0">${fmt(r.amount)}</div>
    </div>`;
  }).join('');
  document.getElementById('dialog-title').textContent = date;
  document.getElementById('dialog-title').style.display = '';
  document.getElementById('dialog-message').innerHTML = `<div style="margin:0 -0.25rem">${rows}</div>`;
  const footer = document.getElementById('dialog-footer');
  footer.innerHTML = '';
  const okBtn = document.createElement('button');
  okBtn.className = 'btn btn-primary'; okBtn.textContent = 'Close';
  okBtn.onclick = ()=>closeModal('modal-dialog');
  footer.appendChild(okBtn);
  openModal('modal-dialog');
}

// ─────────────────────────────────────────
// CASHFLOW SEARCH & BULK DELETE
// ─────────────────────────────────────────
function toggleCfSearch(){
  const wrap=document.getElementById('cf-search-wrap');
  const toggle=document.getElementById('cf-search-toggle');
  if(!wrap||!toggle) return;
  if(wrap.style.display==='none'){
    wrap.style.display='block';
    toggle.style.display='none';
    document.getElementById('cf-search')?.focus();
  } else {
    closeCfSearch();
  }
}
function closeCfSearch(){
  const wrap=document.getElementById('cf-search-wrap');
  const toggle=document.getElementById('cf-search-toggle');
  const input=document.getElementById('cf-search');
  if(input) input.value='';
  onCfSearch('');
  if(wrap) wrap.style.display='none';
  if(toggle) toggle.style.display='';
}
function onCfSearch(q){
  cfSearchQuery = q.trim().toLowerCase();
  const accountsEl = document.getElementById('cf-accounts');
  const searchEl   = document.getElementById('cf-search-results');
  if(cfSearchQuery.length < 2){
    if(searchEl) searchEl.style.display = 'none';
    if(accountsEl) accountsEl.style.display = '';
    return;
  }
  const results = cfTransactions.filter(t=>{
    const desc    = (t.description||'').toLowerCase();
    const cat     = cfCategories.find(c=>c.id===t.category_id);
    const catName = (cat?.name||'').toLowerCase();
    const h       = holdings.find(x=>x.id===t.holding_id);
    const hName   = (h?.name||h?.ticker||'').toLowerCase();
    return desc.includes(cfSearchQuery)||catName.includes(cfSearchQuery)||hName.includes(cfSearchQuery);
  });
  if(accountsEl) accountsEl.style.display = 'none';
  if(!searchEl) return;
  searchEl.style.display = '';
  if(!results.length){
    searchEl.innerHTML = '<div class="empty" style="padding:2rem"><i class="ti ti-search"></i><p>No transactions match "'+cfSearchQuery+'"</p></div>';
    return;
  }
  // Group by holding
  const typeColorMap = {bank:'#0ea5e9',bond:'#ec4899',cash:'#84cc16',crypto:'#f59e0b',dividend:'#60a8f5',etf:'#10b981',stock:'#6366f1'};
  const grouped = {};
  results.forEach(t=>{
    const hId = t.holding_id || '__none__';
    if(!grouped[hId]) grouped[hId] = [];
    grouped[hId].push(t);
  });
  let html = '<div style="font-size:12px;color:var(--text2);margin-bottom:8px">'+results.length+' result'+(results.length!==1?'s':'')+' for "'+cfSearchQuery+'"</div>';
  Object.entries(grouped).forEach(([hId, txs])=>{
    const h = holdings.find(x=>x.id===hId);
    const dispName = h ? (h.type==='crypto'?cleanCryptoName(h.name||h.ticker):(h.name||h.ticker)) : 'Unknown account';
    const color = h ? (typeColorMap[h.type]||'#888') : 'var(--text3)';
    const icon  = h ? (TYPE_ICONS[h.type]||'ti-wallet') : 'ti-wallet';
    html += '<div class="cf-account-block" style="margin-bottom:8px">'
      + '<div style="display:flex;align-items:center;gap:10px;padding:10px 1.25rem;background:var(--surface2);border-bottom:1px solid var(--border)">'
      + '<div class="cf-account-icon" style="background:'+color+'1a;color:'+color+'"><i class="ti '+icon+'"></i></div>'
      + '<div class="cf-account-text"><div class="cf-account-name">'+dispName+'</div>'
      + '<div class="cf-account-sub">'+txs.length+' matching transaction'+(txs.length!==1?'s':'')+'</div></div>'
      + '</div>'
      + txs.map(t=>cfTxRow(t,h)).join('')
      + '</div>';
  });
  searchEl.innerHTML = html;
}

function setBulkSelectMode(on){
  bulkSelectMode = on;
  selectedTxIds.clear();
  updateBulkDeleteBtn();

  ['cf-bulk-toggle','alltx-bulk-toggle'].forEach(id=>{
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.style.background = bulkSelectMode ? 'var(--surface2)' : '';
    btn.innerHTML = bulkSelectMode
      ? '<i class="ti ti-x"></i> Cancel'
      : '<i class="ti ti-checkbox"></i> Select';
  });
  document.getElementById('bulk-toolbar')?.classList.toggle('open', bulkSelectMode);

  // Check if we are in the "all transactions" sub-view or the main cashflow view
  const allTxBody = document.getElementById('alltx-body');
  const isAllTxView = allTxBody && allTxBody.innerHTML.trim() !== '';

  if(isAllTxView){
    // Re-render the all-transactions body with/without checkboxes
    renderAllTxBody();
  } else {
    // Entering bulk mode: expand every account type so transactions are selectable.
    // Cancelling does NOT collapse them back — whatever was open stays open.
    if(bulkSelectMode){
      holdings.forEach(h=>cfOpenTypes.add(h.type));
    }
    renderCashflow();
  }
}
function toggleBulkSelect(){ setBulkSelectMode(!bulkSelectMode); }

// ── Long-press to enter bulk-select (mobile: no persistent "Select" button) ──
let _txPressTimer=null, _txPressMoved=false;
function txTouchStart(id){
  _txPressMoved=false;
  clearTimeout(_txPressTimer);
  _txPressTimer=setTimeout(()=>{
    if(_txPressMoved || bulkSelectMode) return;
    setBulkSelectMode(true);
    toggleTxSelect(id);
    if(navigator.vibrate) navigator.vibrate(15);
  },550);
}
function txTouchMove(){ _txPressMoved=true; clearTimeout(_txPressTimer); }
function txTouchEnd(){ clearTimeout(_txPressTimer); }

function toggleTxSelect(id){
  if(selectedTxIds.has(id)) selectedTxIds.delete(id);
  else selectedTxIds.add(id);
  const row = document.getElementById('cf-row-'+id);
  const chk = document.getElementById('chk-'+id);
  if(row) row.classList.toggle('selected', selectedTxIds.has(id));
  if(chk) chk.checked = selectedTxIds.has(id);
  updateBulkDeleteBtn();
}

function updateBulkDeleteBtn(){
  const n = selectedTxIds.size;
  const delBtn = document.getElementById('bulk-toolbar-delete');
  const cnt = document.getElementById('bulk-toolbar-count');
  if(delBtn) delBtn.disabled = n===0;
  if(cnt) cnt.textContent = n+' selected';
}

async function bulkDeleteTx(){
  if(!selectedTxIds.size) return;
  if(!await showConfirm('Delete '+selectedTxIds.size+' selected transaction'+(selectedTxIds.size!==1?'s':'')+' with balance reversal? This cannot be undone.')) return;
  for(const id of selectedTxIds){
    const t = cfTransactions.find(x=>x.id===id);
    if(t){
      const reverseType = t.type==='expense'?'income':t.type==='income'?'expense':t.type;
      await applyBalanceChange(reverseType, Number(t.amount), t.holding_id||null, t.holding_to_id||null);
      await api('cashflow_transactions?id=eq.'+id,{method:'DELETE'});
    }
  }
  selectedTxIds.clear();
  bulkSelectMode = false;
  [cfTransactions, holdings] = await Promise.all([
    api('cashflow_transactions?order=date.desc'),
    api('holdings?order=sort_order.asc,created_at.asc').catch(()=>api('holdings?order=created_at.asc'))
  ]);
  ['cf-bulk-toggle','alltx-bulk-toggle'].forEach(id=>{
    const b = document.getElementById(id);
    if(!b) return;
    b.style.background = '';
    b.innerHTML = '<i class="ti ti-checkbox"></i> Select';
  });
  document.getElementById('bulk-toolbar')?.classList.remove('open');
  renderCashflow(); renderOverview();
  toast('Transactions deleted');
}

// ─────────────────────────────────────────
// TOUCH DRAG & DROP (HOLDINGS REORDER — MOBILE)
// ─────────────────────────────────────────
let _tdSrcType=null, _tdClone=null, _tdOrigEl=null, _tdOffY=0, _tdOffX=0;

function initTouchDnD(){
  if(window.innerWidth>768) return;
  document.querySelectorAll('.cat-block[draggable="true"]').forEach(block=>{
    // Attach to the whole block for easier touch target
    if(block._tdBound) return; // avoid duplicate listeners
    block._tdBound=true;
    block.addEventListener('touchstart',_tdStart,{passive:false});
  });
}

function _tdStart(e){
  // Only start drag if touch began on the drag handle or a long press on header
  const block=e.currentTarget.closest('.cat-block');
  if(!block) return;
  // Only initiate drag from the grip handle icon
  if(!e.target.classList.contains('drag-handle')&&!e.target.closest('.drag-handle')) return;
  e.preventDefault();
  _tdSrcType=block.dataset.type;
  _tdOrigEl=block;
  const t=e.touches[0];
  const rect=block.getBoundingClientRect();
  _tdOffY=t.clientY-rect.top;
  _tdOffX=t.clientX-rect.left;

  // Floating clone for visual feedback
  _tdClone=block.cloneNode(true);
  Object.assign(_tdClone.style,{
    position:'fixed',zIndex:'999',
    width:rect.width+'px',
    left:rect.left+'px',
    top:rect.top+'px',
    opacity:'0.9',
    pointerEvents:'none',
    transform:'scale(1.03) translateZ(0)',
    boxShadow:'0 16px 48px rgba(0,0,0,0.6)',
    borderRadius:'var(--radius)',
    willChange:'transform, top',
    transition:'transform 0.1s',
    borderColor:'rgba(16,212,176,0.4)'
  });
  document.body.appendChild(_tdClone);
  block.style.cssText+='opacity:0.2;transition:opacity 0.15s;';

  document.addEventListener('touchmove',_tdMove,{passive:false});
  document.addEventListener('touchend',_tdEnd,{passive:true});
}

function _tdMove(e){
  if(!_tdClone) return;
  e.preventDefault();
  const t=e.touches[0];
  _tdClone.style.top=(t.clientY-_tdOffY)+'px';
  _tdClone.style.left=(t.clientX-_tdOffX)+'px';
  // Highlight drop target
  _tdClone.style.pointerEvents='none';
  const below=document.elementFromPoint(t.clientX,t.clientY);
  document.querySelectorAll('.cat-block').forEach(b=>b.classList.remove('drag-over'));
  const target=below?.closest('.cat-block');
  if(target&&target!==_tdOrigEl) target.classList.add('drag-over');
}

async function _tdEnd(e){
  document.removeEventListener('touchmove',_tdMove);
  document.removeEventListener('touchend',_tdEnd);
  if(!_tdClone) return;
  const t=e.changedTouches[0];
  // Hide clone to allow elementFromPoint to find the real target
  _tdClone.style.display='none';
  const below=document.elementFromPoint(t.clientX,t.clientY);
  const targetBlock=below?.closest('.cat-block');
  const targetType=targetBlock?.dataset.type;
  // Cleanup
  if(_tdClone.parentNode) _tdClone.parentNode.removeChild(_tdClone);
  _tdClone=null;
  if(_tdOrigEl){ _tdOrigEl.style.opacity=''; _tdOrigEl.style.transition=''; }
  document.querySelectorAll('.cat-block').forEach(b=>{
    b.classList.remove('drag-over');
    b.style.opacity=''; b.style.transition='';
  });
  if(targetType&&targetType!==_tdSrcType){
    dragSrcType=_tdSrcType;
    await onHoldingDrop(null,targetType);
  }
  _tdSrcType=null; _tdOrigEl=null;
}

// ─────────────────────────────────────────
// DRAG & DROP (HOLDINGS REORDER)
// ─────────────────────────────────────────
function onHoldingDragStart(e, type){
  dragSrcType = type;
  e.dataTransfer.effectAllowed = 'move';
  const block = e.currentTarget.closest('.cat-block');
  setTimeout(()=>{ if(block) block.classList.add('drag-source'); }, 0);
}

function onHoldingDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onHoldingDragLeave(e){
  e.currentTarget.classList.remove('drag-over');
}

async function onHoldingDrop(e, targetType){
  if(e&&e.preventDefault) e.preventDefault();
  // Remove all drag state (works for both mouse and touch)
  document.querySelectorAll('.cat-block').forEach(b=>{b.classList.remove('drag-over');b.classList.remove('drag-source');b.style.opacity='';});
  if(!dragSrcType || dragSrcType === targetType){ dragSrcType=null; return; }
  const container = document.getElementById('h-categories');
  if(!container){ dragSrcType=null; return; }
  const blocks = [...container.querySelectorAll('.cat-block')];
  const srcBlock = blocks.find(b=>b.dataset.type===dragSrcType);
  const tgtBlock = blocks.find(b=>b.dataset.type===targetType);
  if(!srcBlock||!tgtBlock){ dragSrcType=null; return; }
  const srcIdx = blocks.indexOf(srcBlock);
  const tgtIdx = blocks.indexOf(tgtBlock);
  if(srcIdx < tgtIdx) tgtBlock.after(srcBlock);
  else tgtBlock.before(srcBlock);
  const newOrder = [...container.querySelectorAll('.cat-block')].map(b=>b.dataset.type);
  const updates = holdings.map(h=>{
    const typeIdx = newOrder.indexOf(h.type);
    const withinType = holdings.filter(x=>x.type===h.type).indexOf(h);
    return {id:h.id, sort_order: typeIdx*1000 + withinType};
  });
  await Promise.all(updates.map(u=>api('holdings?id=eq.'+u.id,{method:'PATCH',body:JSON.stringify({sort_order:u.sort_order})})));
  holdings = await api('holdings?order=sort_order.asc,created_at.asc').catch(()=>api('holdings?order=created_at.asc'));
  dragSrcType = null;
  toast('Order saved');
}

document.addEventListener('dragend', ()=>{
  document.querySelectorAll('.cat-block').forEach(b=>{b.classList.remove('drag-source');b.style.opacity='';});
  dragSrcType=null;
});

// ─────────────────────────────────────────
