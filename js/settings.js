import { exposeLegacyFunctions } from './utils/legacy.js';

import { state } from './state.js';
import { api } from './api.js';
import { TYPE_ICONS } from './config.js';

import {fmt, fmtN, fmtPct} from './utils/date.js';

import { cleanCryptoName } from './utils/calculations.js';
import { catDisplayLabel, setTriggerIcon, openSelectPicker } from './components/select-picker.js';
import { openModal, closeModal, showAlert, showConfirm, toast } from './components/modal.js';
import { renderAllTxBody, applyBalanceChange, renderCashflow, cfTxRow } from './features/cashflow.js';

import { showPage } from './features/navigation.js';

import { renderOverview } from './features/overview.js'

// ── Settings ──
let recurCalYear = new Date().getFullYear();
let recurCalMonth = new Date().getMonth();
let categoryDetailId;

export function showSettingsMain(){
  document.getElementById('settings-main').style.display='';
  ['calendar','categories','backup'].forEach(s=>document.getElementById('settings-'+s).style.display='none');
}

export function showSettingsSection(section){
  document.getElementById('settings-main').style.display='none';
  ['calendar','categories','backup'].forEach(s=>document.getElementById('settings-'+s).style.display=s===section?'':'none');
  if(section==='calendar'){ renderRecurCalendar(); }
  if(section==='categories'){ renderSettings(); }
  if(section==='backup'){ loadSnapshots(); }
}

export function recurCalPrev(){ recurCalMonth--; if(recurCalMonth<0){recurCalMonth=11;recurCalYear--;} renderRecurCalendar(); }
export function recurCalNext(){ recurCalMonth++; if(recurCalMonth>11){recurCalMonth=0;recurCalYear++;} renderRecurCalendar(); }

export function getRecurrenceDaysInMonth(year, month){
  // For each active recurrence, find all occurrences within this month
  const results = []; // {day, recurrence}
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month+1, 0, 23, 59, 59);
  state.cfRecurrences.forEach(r=>{
    if(!r.active) return;
    // Walk from recurrence start (or next_due going backwards) through the month
    // Simulate occurrences: start from next_due and walk backwards/forwards
    let d = new Date(r.next_due);
    // Walk back to find first occurrence in or before this month
    while(d > monthStart){
      const prev = new Date(d);
      if(r.frequency==='daily')   prev.setDate(prev.getDate()-1);
      else if(r.frequency==='weekly')  prev.setDate(prev.getDate()-7);
      else if(r.frequency==='monthly') prev.setMonth(prev.getMonth()-1);
      else if(r.frequency==='yearly')  prev.setFullYear(prev.getFullYear()-1);
      if(prev < monthStart) break;
      d = prev;
    }
    // Now walk forward collecting occurrences in this month
    let cur = new Date(d);
    let safety = 0;
    while(cur <= monthEnd && safety++ < 400){
      if(cur >= monthStart && cur <= monthEnd){
        results.push({day: cur.getDate(), recurrence: r});
      }
      // Advance
      if(r.frequency==='daily')        cur.setDate(cur.getDate()+1);
      else if(r.frequency==='weekly')  cur.setDate(cur.getDate()+7);
      else if(r.frequency==='monthly') cur.setMonth(cur.getMonth()+1);
      else if(r.frequency==='yearly')  { cur.setFullYear(cur.getFullYear()+1); break; }
    }
  });
  return results;
}

export function renderRecurCalendar(){
  const label = document.getElementById('recur-cal-label');
  const calEl = document.getElementById('recur-calendar');
  if(!label||!calEl) return;
  label.textContent = new Date(recurCalYear, recurCalMonth, 1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});

  const today = new Date();
  const firstDay = new Date(recurCalYear, recurCalMonth, 1).getDay(); // 0=Sun
  const startOffset = (firstDay+6)%7; // Monday-first
  const daysInMonth = new Date(recurCalYear, recurCalMonth+1, 0).getDate();
  const daysInPrev  = new Date(recurCalYear, recurCalMonth, 0).getDate();

  const events = getRecurrenceDaysInMonth(recurCalYear, recurCalMonth);
  // Group by day
  const byDay = {};
  events.forEach(e=>{ if(!byDay[e.day]) byDay[e.day]=[]; byDay[e.day].push(e.recurrence); });

  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  let html = `<table class="recur-cal"><thead><tr>${DAYS.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody><tr>`;

  let cellCount = 0;
  // Leading days from prev month
  for(let i=startOffset-1;i>=0;i--){
    html+=`<td class="other-month"><div class="cal-day-num">${daysInPrev-i}</div></td>`;
    cellCount++;
  }
  // Days of current month
  for(let d=1;d<=daysInMonth;d++){
    if(cellCount>0 && cellCount%7===0) html+='</tr><tr>';
    const isToday = today.getFullYear()===recurCalYear && today.getMonth()===recurCalMonth && today.getDate()===d;
    const dayEvents = byDay[d]||[];
    const evHtml = dayEvents.slice(0,3).map(r=>{
      const cat = state.cfCategories.find(c=>c.id===r.category_id);
      const color = cat?.color||'var(--accent)';
      const icon  = cat?.icon||'ti-repeat';
      const label = r.description||cat?.name||'Recurring';
      return `<div class="recur-event" style="background:${color}22;color:${color}" title="${label} — ${fmt(r.amount)}">
        <i class="ti ${icon}" style="font-size:9px;flex-shrink:0"></i>
        <span style="overflow:hidden;text-overflow:ellipsis;flex:1">${label}</span>
        <span style="font-size:9px;opacity:0.85;flex-shrink:0;margin-left:2px">${fmt(r.amount)}</span>
      </div>`;
    }).join('');
    const moreHtml = dayEvents.length>3 ? `<div style="font-size:9px;color:var(--text3);padding:1px 4px">+${dayEvents.length-3} more</div>` : '';
    const tdAttrs=dayEvents.length?` ${isToday?'class="today" ':''}onclick="showCalDayDetail(${d},${recurCalMonth},${recurCalYear})" style="cursor:pointer"`:isToday?' class="today"':'';
    html+=`<td${tdAttrs}><div class="cal-day-num">${d}</div>${evHtml}${moreHtml}</td>`;
    cellCount++;
  }
  // Trailing days
  let trail = 1;
  while(cellCount%7!==0){ html+=`<td class="other-month"><div class="cal-day-num">${trail++}</div></td>`; cellCount++; }
  html+='</tr></tbody></table>';
  // Mobile: Google Calendar-style grid — fixed cell size, no overflow
  if(window.innerWidth <= 768){
    const CELL_H = 74; // px — fixed for all cells, fits up to 3 event pills
    const DNAMES=['M','T','W','T','F','S','S'];
    // Cell style helpers
    const cellBase = `box-sizing:border-box;height:${CELL_H}px;overflow:hidden;padding:3px 3px 2px;border:1px solid rgba(38,45,61,0.22);`;
    let gcHtml=`<div style="display:grid;grid-template-columns:repeat(7,1fr);width:100%;overflow:hidden;box-sizing:border-box">`;
    // Day headers
    DNAMES.forEach(d=>{
      gcHtml+=`<div style="box-sizing:border-box;text-align:center;font-size:9px;font-weight:700;color:var(--text3);padding:5px 0 4px;text-transform:uppercase">${d}</div>`;
    });
    // Leading grey days
    for(let i=startOffset-1;i>=0;i--){
      gcHtml+=`<div style="${cellBase}background:rgba(255,255,255,0.01)"><span style="font-size:11px;color:var(--text3);opacity:0.3">${daysInPrev-i}</span></div>`;
    }
    // Current month
    for(let d=1;d<=daysInMonth;d++){
      const isToday=today.getFullYear()===recurCalYear&&today.getMonth()===recurCalMonth&&today.getDate()===d;
      const dayEvents=byDay[d]||[];
      const todayBg=isToday?'background:rgba(16,212,176,0.06);border-color:rgba(16,212,176,0.35);':'';
      const numEl=isToday
        ?`<div style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:var(--accent);color:#0e1117;border-radius:50%;font-size:9px;font-weight:800;margin-bottom:2px;flex-shrink:0">${d}</div>`
        :`<div style="font-size:11px;color:${dayEvents.length?'var(--text)':'var(--text3)'};font-weight:${dayEvents.length?'600':'400'};margin-bottom:2px;line-height:1">${d}</div>`;
      let pills='';
      const MAX_PILLS=3;
      dayEvents.slice(0,MAX_PILLS).forEach(r=>{
        const cat=state.cfCategories.find(c=>c.id===r.category_id);
        const color=cat?.color||'var(--accent)';
        const label=r.description||cat?.name||'';
        pills+=`<div style="background:${color};color:#fff;font-size:8px;font-weight:700;padding:1px 3px;border-radius:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:1px;line-height:1.4">${label}</div>`;
      });
      const more=dayEvents.length>MAX_PILLS?`<div style="font-size:9px;color:var(--text2);line-height:1;letter-spacing:1px;padding-left:2px">···</div>`:'';
      const cellClick=dayEvents.length?`onclick="showCalDayDetail(${d},${recurCalMonth},${recurCalYear})" style="${cellBase}${todayBg}cursor:pointer"`:`style="${cellBase}${todayBg}"`;
      gcHtml+=`<div ${cellClick}>${numEl}${pills}${more}</div>`;
    }
    // Trailing grey days
    const usedCells=startOffset+daysInMonth;
    const trailCount=(7-usedCells%7)%7;
    for(let i=1;i<=trailCount;i++){
      gcHtml+=`<div style="${cellBase}background:rgba(255,255,255,0.01)"><span style="font-size:11px;color:var(--text3);opacity:0.3">${i}</span></div>`;
    }
    gcHtml+='</div>';
    calEl.innerHTML=gcHtml;
    return;
  }
  calEl.innerHTML = '<div class="recur-cal-wrapper">' + html + '</div>';
}

export function renderSettings(){
  const catEl=document.getElementById('settings-cats');
  if(catEl){
    const topCats = state.cfCategories.filter(c=>!c.parent_id);
    catEl.innerHTML = topCats.length ? topCats.map(c=>{
      const subCount = state.cfCategories.filter(s=>s.parent_id===c.id).length;
      return `<div class="settings-cat-row" style="cursor:pointer" onclick="openCatDetailModal('${c.id}')">
          <i class="ti ${c.icon}" style="color:${c.color};font-size:18px;width:24px;text-align:center"></i>
          <span style="flex:1;font-size:13px">${c.name}${subCount?` <span style="color:var(--text3);font-size:11px">(${subCount})</span>`:''}</span>
          <button class="btn btn-sm" onclick="event.stopPropagation();openCategoryModal('${c.id}')" style="margin-right:4px"><i class="ti ti-pencil"></i></button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteCat('${c.id}')"><i class="ti ti-trash"></i></button>
        </div>`;
    }).join('') : '<div style="color:var(--text3);font-size:13px;padding:0.5rem 0">No categories yet</div>';
  }

  const recEl=document.getElementById('settings-recurrences');
  if(recEl) recEl.innerHTML=state.cfRecurrences.length
    ?state.cfRecurrences.map(r=>{
        const cat=state.cfCategories.find(c=>c.id===r.category_id);
        const h=state.holdings.find(x=>x.id===r.holding_id);
        const hName=h?(h.type==='crypto'?cleanCryptoName(h.name||h.ticker):(h.name||h.ticker)):'—';
        const due=new Date(r.next_due).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Europe/Rome'});
        const color=cat?.color||'var(--accent)';
        return `<div class="settings-recur-row">
          <i class="ti ${cat?.icon||'ti-repeat'}" style="color:${color};font-size:18px;flex-shrink:0;margin-top:2px"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500">${r.description||'—'}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px">${fmt(r.amount)} · <span style="text-transform:capitalize">${r.frequency}</span> · ${hName} · Next: ${due}${cat?` · <span style="color:${color}">${cat.name}</span>`:''}${!r.active?' · <span style="color:var(--text3)">Paused</span>':''}</div>
          </div>
          <button class="btn btn-sm" onclick="toggleRecurActive('${r.id}',${!r.active})" title="${r.active?'Pause':'Resume'}"><i class="ti ti-${r.active?'player-pause':'player-play'}"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteRecur('${r.id}')"><i class="ti ti-trash"></i></button>
        </div>`;
      }).join('')
    :'<div style="color:var(--text3);font-size:13px;padding:0.5rem 0">No recurring transactions set up</div>';

  renderRecurCalendar();
}

// ── Icon library ──
const ICON_LIBRARY = [
  'ti-tag','ti-home-2','ti-briefcase','ti-car','ti-plane','ti-shopping-bag','ti-shopping-cart',
  'ti-tools-kitchen-2','ti-device-tv','ti-device-laptop','ti-device-gamepad-2','ti-ball-football',
  'ti-heart-rate-monitor','ti-pill','ti-file-invoice','ti-receipt','ti-cash','ti-coin',
  'ti-trending-up','ti-chart-bar','ti-building-bank','ti-credit-card','ti-wallet',
  'ti-confetti','ti-music','ti-camera','ti-book','ti-bus','ti-train','ti-bike',
  'ti-droplet','ti-star','ti-gift','ti-coffee','ti-bread','ti-shirt','ti-scissors',
  'ti-heart-handshake','ti-wind','ti-school','ti-hammer','ti-tool','ti-plug','ti-wifi',
  'ti-phone','ti-mail','ti-package','ti-truck','ti-gas-station','ti-map-pin','ti-globe',
  'ti-trees','ti-sailboat','ti-mountain','ti-building','ti-paw','ti-plant','ti-bottle',
  'ti-stethoscope','ti-microscope','ti-flask','ti-brush','ti-hanger',
  'ti-heart','ti-mood-smile','ti-walk','ti-run','ti-needle','ti-first-aid-kit',
];

export function buildIconGrid(){
  const grid=document.getElementById('cat-icon-grid'); if(!grid) return;
  const selectedIcon=document.getElementById('cat-icon')?.value||'ti-tag';
  grid.innerHTML=ICON_LIBRARY.map(icon=>{
    const isSelected=icon===selectedIcon;
    return `<button type="button" onclick="selectIcon('${icon}')" title="${icon}"
      id="icongrid-${icon.replace(/[^a-z0-9]/g,'_')}"
      style="width:100%;aspect-ratio:1;border:1px solid ${isSelected?'var(--accent)':'var(--border)'};border-radius:6px;background:${isSelected?'rgba(99,102,241,0.15)':'none'};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;color:${isSelected?'var(--accent)':'var(--text3)'};transition:all 0.1s"
      onmouseover="this.style.background='rgba(99,102,241,0.1)';this.style.color='var(--accent)';this.style.borderColor='var(--accent)'"
      onmouseout="const s='${icon}'===document.getElementById('cat-icon').value;this.style.background=s?'rgba(99,102,241,0.15)':'none';this.style.color=s?'var(--accent)':'var(--text3)';this.style.borderColor=s?'var(--accent)':'var(--border)'">
      <i class="ti ${icon}"></i>
    </button>`;
  }).join('');
}

export function selectIcon(icon){
  document.getElementById('cat-icon').value=icon;
  updateIconPreview(icon);
  buildIconGrid(); // rebuild so only selected icon is highlighted
}

export function updateIconPreview(icon){
  const prev=document.getElementById('cat-icon-preview'); if(!prev) return;
  const color=document.getElementById('cat-color')?.value||'#6366f1';
  prev.style.color=color;
  prev.style.background=color+'26'; // 15% opacity
  prev.innerHTML=`<i class="ti ${icon||'ti-tag'}"></i>`;
  // Sync swatch
  const swatch=document.getElementById('cat-color-swatch');
  const hexEl=document.getElementById('cat-color-hex');
  if(swatch) swatch.style.background=color;
  if(hexEl) hexEl.textContent=color;
}

export function openCatDetailModal(id){
  categoryDetailId = id;
  const cat = state.cfCategories.find(c=>c.id===id);
  if(!cat) return;
  document.getElementById('catdetail-icon').innerHTML = `<i class="ti ${cat.icon}"></i>`;
  document.getElementById('catdetail-icon').style.background = cat.color+'26';
  document.getElementById('catdetail-icon').style.color = cat.color;
  document.getElementById('catdetail-name').textContent = cat.name;
  const subs = state.cfCategories.filter(c=>c.parent_id===id).sort((a,b)=>a.name.localeCompare(b.name));
  document.getElementById('catdetail-count').textContent = `${subs.length} sub-categor${subs.length===1?'y':'ies'}`;
  document.getElementById('catdetail-sublist').innerHTML = subs.length ? subs.map(s=>`
    <div class="settings-cat-row">
      <i class="ti ${cat.icon}" style="color:${cat.color};font-size:16px;width:22px;text-align:center"></i>
      <span style="flex:1;font-size:13px">${s.name}</span>
      <button class="btn btn-sm" onclick="closeModal('modal-cat-detail');openCategoryModal('${s.id}')" style="margin-right:4px"><i class="ti ti-pencil"></i></button>
      <button class="btn btn-sm btn-danger" onclick="deleteCatFromDetail('${s.id}')"><i class="ti ti-trash"></i></button>
    </div>`).join('') : '<div style="color:var(--text3);font-size:13px;padding:0.5rem 0">No sub-categories yet</div>';
  openModal('modal-cat-detail');
}

export async function deleteCatFromDetail(id){
  await deleteCat(id);
  // Keep the detail window open and refreshed, unless the parent itself no longer exists
  if(state.cfCategories.find(c=>c.id===categoryDetailId)) openCatDetailModal(categoryDetailId);
  else closeModal('modal-cat-detail');
}

export function openCategoryModal(id=null, presetParentId=null){
  document.getElementById('cat-edit-id').value=id||'';
  const editingCat = id ? state.cfCategories.find(c=>c.id===id) : null;
  const isSubContext = presetParentId || (editingCat && editingCat.parent_id);
  document.getElementById('cat-modal-title').textContent = id
    ? (isSubContext ? 'Edit subcategory' : 'Edit category')
    : (isSubContext ? 'Add subcategory' : 'Add category');
  if(!id){
    document.getElementById('cat-name').value='';
    document.getElementById('cat-icon').value='ti-tag';
    document.getElementById('cat-color').value='#6366f1';
    document.getElementById('cat-parent').value=presetParentId||'';
    updateIconPreview('ti-tag');
  } else {
    const cat=state.cfCategories.find(c=>c.id===id);
    if(cat){
      document.getElementById('cat-name').value=cat.name;
      document.getElementById('cat-icon').value=cat.icon||'ti-tag';
      document.getElementById('cat-color').value=cat.color||'#6366f1';
      document.getElementById('cat-parent').value=cat.parent_id||'';
      updateIconPreview(cat.icon||'ti-tag');
    }
  }
  updateCatParentUI();
  buildIconGrid();
  openModal('modal-cat');
}

export function updateCatParentUI(){
  const parentId = document.getElementById('cat-parent').value;
  const parent = state.cfCategories.find(c=>c.id===parentId);
  document.getElementById('cat-parent-label').textContent = parent ? parent.name : 'None — top-level category';
  const isSub = !!parent;
  document.getElementById('cat-icon-section').style.display = isSub ? 'none' : '';
  document.getElementById('cat-color-row').style.display = isSub ? 'none' : '';
  document.getElementById('cat-parent-hint').style.display = isSub ? '' : 'none';
  if(isSub){
    document.getElementById('cat-icon').value = parent.icon||'ti-tag';
    document.getElementById('cat-color').value = parent.color||'#6366f1';
    updateIconPreview(parent.icon||'ti-tag');
  }
}

export function openCatParentPicker(){
  const editId = document.getElementById('cat-edit-id').value;
  const current = document.getElementById('cat-parent').value;
  // Only top-level categories can be a parent — this keeps sub-categories to a single level
  // and excluding the category itself prevents it becoming its own parent.
  const topCats = state.cfCategories.filter(c=>!c.parent_id && c.id!==editId);
  const options = [{value:'', label:'None — top-level category', icon:'ti-x', color:'var(--text3)'}]
    .concat(topCats.map(c=>({value:c.id, label:c.name, icon:c.icon, color:c.color})));
  openSelectPicker('Parent category', options, current, (val)=>{
    document.getElementById('cat-parent').value = val;
    updateCatParentUI();
  });
}

export async function saveCat(){
  const name=document.getElementById('cat-name').value.trim();
  const icon=document.getElementById('cat-icon').value.trim()||'ti-tag';
  const color=document.getElementById('cat-color').value||'#6366f1';
  const editId=document.getElementById('cat-edit-id').value;
  const parentId=document.getElementById('cat-parent').value||null;
  if(!name){await showAlert('Please enter a name.');return;}
  if(parentId===editId){await showAlert('A category cannot be its own parent.');return;}
  // Duplicate name check — scoped to siblings (same parent), case-insensitive, excluding current if editing
  const duplicate = state.cfCategories.find(c=>c.name.toLowerCase()===name.toLowerCase()&&c.id!==editId&&(c.parent_id||null)===parentId);
  if(duplicate){await showAlert(`A category named "${duplicate.name}" already exists ${parentId?'under this parent':'at the top level'}. Please choose a different name.`);return;}
  let newCatId=null;
  if(editId){
    await api(`cashflow_categories?id=eq.${editId}`,{method:'PATCH',body:JSON.stringify({name,icon,color,parent_id:parentId})});
  } else {
    const created=await api('cashflow_categories',{method:'POST',body:JSON.stringify({name,icon,color,parent_id:parentId})});
    if(Array.isArray(created)&&created[0]) newCatId=created[0].id;
  }
  state.cfCategories=await api('cashflow_categories?order=name.asc');
  closeModal('modal-cat'); renderSettings();
  toast(editId?'Category updated ✓':'Category saved ✓');

  // If this category was created from the Add Transaction category picker, select it right away
  if(newCatId && catCreateTargetField){
    const field = catCreateTargetField;
    catCreateTargetField = null;
    const cat = state.cfCategories.find(c=>c.id===newCatId);
    const labelId = field+'-label', triggerId = field+'-trigger', iconId = field+'-icon';
    document.getElementById(field).value = newCatId;
    document.getElementById(labelId).textContent = catDisplayLabel(cat);
    document.getElementById(triggerId).classList.remove('placeholder');
    setTriggerIcon(iconId, cat?.icon, cat?.color);
  }
}

export async function deleteCat(id){
  const usedCount = state.cfTransactions.filter(t=>t.category_id===id).length;
  const recurCount = state.cfRecurrences.filter(r=>r.category_id===id).length;
  const subCount = state.cfCategories.filter(c=>c.parent_id===id).length;
  if(subCount>0||usedCount>0||recurCount>0){
    const parts=[];
    if(usedCount>0) parts.push(`${usedCount} transaction${usedCount!==1?'s':''}`);
    if(recurCount>0) parts.push(`${recurCount} recurrence${recurCount!==1?'s':''}`);
    let msg = parts.length ? `This category is used in ${parts.join(' and ')}. Deleting it will remove the category from those.` : '';
    if(subCount>0) msg += `${msg?'\n\n':''}It has ${subCount} sub-categor${subCount!==1?'ies':'y'}, which will become top-level categories instead of being deleted.`;
    if(!await showConfirm(`${msg}\n\nProceed?`)) return;
  } else {
    if(!await showConfirm('Delete this category?')) return;
  }
  // Sub-categories become top-level rather than being deleted along with their parent
  if(subCount>0){
    await api(`cashflow_categories?parent_id=eq.${id}`,{method:'PATCH',body:JSON.stringify({parent_id:null})});
  }
  // Uncategorize all linked transactions and recurrences first
  if(usedCount>0){
    await api(`cashflow_transactions?category_id=eq.${id}`,{method:'PATCH',body:JSON.stringify({category_id:null})});
  }
  if(recurCount>0){
    await api(`recurrences?category_id=eq.${id}`,{method:'PATCH',body:JSON.stringify({category_id:null})});
  }
  await api(`cashflow_categories?id=eq.${id}`,{method:'DELETE'});
  // Reload everything so UI reflects changes
  [state.cfCategories, state.cfTransactions, state.cfRecurrences] = await Promise.all([
    api('cashflow_categories?order=name.asc'),
    api('cashflow_transactions?order=date.desc'),
    api('recurrences?order=next_due.asc'),
  ]);
  renderSettings(); renderCashflow(); toast('Category removed');
}

export async function toggleRecurActive(id,active){
  await api(`recurrences?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({active})});
  state.cfRecurrences=await api('recurrences?order=next_due.asc');
  renderSettings(); toast(active?'Recurrence resumed':'Recurrence paused');
}

export async function deleteRecur(id){
  if(!await showConfirm('Delete this recurrence?')) return;
  await api(`recurrences?id=eq.${id}`,{method:'DELETE'});
  state.cfRecurrences=await api('recurrences?order=next_due.asc');
  renderSettings(); toast('Recurrence removed');
}

// ─────────────────────────────────────────
// ─────────────────────────────────────────
// MOBILE ANALYTICS (combined Insights + Reports)
// ─────────────────────────────────────────
let mobileAnalyticsPage = 'insights';

export function showMobileRptInsights(){
  showPage(mobileAnalyticsPage, null);
}

export function switchMobileAnalytics(page){
  mobileAnalyticsPage = page;
  showPage(page, null);
}

// ─────────────────────────────────────────
// CALENDAR DAY DETAIL
// ─────────────────────────────────────────
export function showCalDayDetail(day, month, year){
  const events = getRecurrenceDaysInMonth(year, month).filter(e=>e.day===day).map(e=>e.recurrence);
  if(!events.length) return;
  const date = new Date(year,month,day).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  let rows = events.map(r=>{
    const cat = state.cfCategories.find(c=>c.id===r.category_id);
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
export function toggleCfSearch(){
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
export function closeCfSearch(){
  const wrap=document.getElementById('cf-search-wrap');
  const toggle=document.getElementById('cf-search-toggle');
  const input=document.getElementById('cf-search');
  if(input) input.value='';
  onCfSearch('');
  if(wrap) wrap.style.display='none';
  if(toggle) toggle.style.display='';
}
export function onCfSearch(q){
  let cfSearchQuery = q.trim().toLowerCase();
  const accountsEl = document.getElementById('cf-accounts');
  const searchEl   = document.getElementById('cf-search-results');
  if(cfSearchQuery.length < 2){
    if(searchEl) searchEl.style.display = 'none';
    if(accountsEl) accountsEl.style.display = '';
    return;
  }
  const results = state.cfTransactions.filter(t=>{
    const desc    = (t.description||'').toLowerCase();
    const cat     = state.cfCategories.find(c=>c.id===t.category_id);
    const catName = (cat?.name||'').toLowerCase();
    const h       = state.holdings.find(x=>x.id===t.holding_id);
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
    const h = state.holdings.find(x=>x.id===hId);
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

export function setBulkSelectMode(on){
  state.bulkSelectMode = on;
  state.selectedTxIds.clear();
  updateBulkDeleteBtn();

  ['cf-bulk-toggle','alltx-bulk-toggle'].forEach(id=>{
    const btn = document.getElementById(id);
    if(!btn) return;
    btn.style.background = state.bulkSelectMode ? 'var(--surface2)' : '';
    btn.innerHTML = state.bulkSelectMode
      ? '<i class="ti ti-x"></i> Cancel'
      : '<i class="ti ti-checkbox"></i> Select';
  });
  document.getElementById('bulk-toolbar')?.classList.toggle('open', state.bulkSelectMode);

  // Check if we are in the "all transactions" sub-view or the main cashflow view
  const allTxBody = document.getElementById('alltx-body');
  const isAllTxView = allTxBody && allTxBody.innerHTML.trim() !== '';

  if(isAllTxView){
    // Re-render the all-transactions body with/without checkboxes
    renderAllTxBody();
  } else {
    // Entering bulk mode: expand every account type so transactions are selectable.
    // Cancelling does NOT collapse them back — whatever was open stays open.
    if(state.bulkSelectMode){
      state.holdings.forEach(h=>state.cfOpenTypes.add(h.type));
    }
    renderCashflow();
  }
}
export function toggleBulkSelect(){ setBulkSelectMode(!state.bulkSelectMode); }

// ── Long-press to enter bulk-select (mobile: no persistent "Select" button) ──
let _txPressTimer=null, _txPressMoved=false;
export function txTouchStart(id){
  _txPressMoved=false;
  clearTimeout(_txPressTimer);
  _txPressTimer=setTimeout(()=>{
    if(_txPressMoved || state.bulkSelectMode) return;
    setBulkSelectMode(true);
    toggleTxSelect(id);
    if(navigator.vibrate) navigator.vibrate(15);
  },550);
}
export function txTouchMove(){ _txPressMoved=true; clearTimeout(_txPressTimer); }
export function txTouchEnd(){ clearTimeout(_txPressTimer); }

export function toggleTxSelect(id){
  if(state.selectedTxIds.has(id)) state.selectedTxIds.delete(id);
  else state.selectedTxIds.add(id);
  const row = document.getElementById('cf-row-'+id);
  const chk = document.getElementById('chk-'+id);
  if(row) row.classList.toggle('selected', state.selectedTxIds.has(id));
  if(chk) chk.checked = state.selectedTxIds.has(id);
  updateBulkDeleteBtn();
}

export function updateBulkDeleteBtn(){
  const n = state.selectedTxIds.size;
  const delBtn = document.getElementById('bulk-toolbar-delete');
  const cnt = document.getElementById('bulk-toolbar-count');
  if(delBtn) delBtn.disabled = n===0;
  if(cnt) cnt.textContent = n+' selected';
}

export async function bulkDeleteTx(){
  if(!state.selectedTxIds.size) return;
  if(!await showConfirm('Delete '+state.selectedTxIds.size+' selected transaction'+(state.selectedTxIds.size!==1?'s':'')+' with balance reversal? This cannot be undone.')) return;
  for(const id of state.selectedTxIds){
    const t = state.cfTransactions.find(x=>x.id===id);
    if(t){
      const reverseType = t.type==='expense'?'income':t.type==='income'?'expense':t.type;
      await applyBalanceChange(reverseType, Number(t.amount), t.holding_id||null, t.holding_to_id||null);
      await api('cashflow_transactions?id=eq.'+id,{method:'DELETE'});
    }
  }
  state.selectedTxIds.clear();
  state.bulkSelectMode = false;
  [state.cfTransactions, state.holdings] = await Promise.all([
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

export function initTouchDnD(){
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
    state.dragSrcType=_tdSrcType;
    await onHoldingDrop(null,targetType);
  }
  _tdSrcType=null; _tdOrigEl=null;
}

// ─────────────────────────────────────────
// DRAG & DROP (HOLDINGS REORDER)
// ─────────────────────────────────────────
export function onHoldingDragStart(e, type){
  state.dragSrcType = type;
  e.dataTransfer.effectAllowed = 'move';
  const block = e.currentTarget.closest('.cat-block');
  setTimeout(()=>{ if(block) block.classList.add('drag-source'); }, 0);
}

export function onHoldingDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

export function onHoldingDragLeave(e){
  e.currentTarget.classList.remove('drag-over');
}

export async function onHoldingDrop(e, targetType){
  if(e&&e.preventDefault) e.preventDefault();
  // Remove all drag state (works for both mouse and touch)
  document.querySelectorAll('.cat-block').forEach(b=>{b.classList.remove('drag-over');b.classList.remove('drag-source');b.style.opacity='';});
  if(!state.dragSrcType || state.dragSrcType === targetType){ state.dragSrcType=null; return; }
  const container = document.getElementById('h-categories');
  if(!container){ state.dragSrcType=null; return; }
  const blocks = [...container.querySelectorAll('.cat-block')];
  const srcBlock = blocks.find(b=>b.dataset.type===state.dragSrcType);
  const tgtBlock = blocks.find(b=>b.dataset.type===targetType);
  if(!srcBlock||!tgtBlock){ state.dragSrcType=null; return; }
  const srcIdx = blocks.indexOf(srcBlock);
  const tgtIdx = blocks.indexOf(tgtBlock);
  if(srcIdx < tgtIdx) tgtBlock.after(srcBlock);
  else tgtBlock.before(srcBlock);
  const newOrder = [...container.querySelectorAll('.cat-block')].map(b=>b.dataset.type);
  const updates = state.holdings.map(h=>{
    const typeIdx = newOrder.indexOf(h.type);
    const withinType = state.holdings.filter(x=>x.type===h.type).indexOf(h);
    return {id:h.id, sort_order: typeIdx*1000 + withinType};
  });
  await Promise.all(updates.map(u=>api('holdings?id=eq.'+u.id,{method:'PATCH',body:JSON.stringify({sort_order:u.sort_order})})));
  state.holdings = await api('holdings?order=sort_order.asc,created_at.asc').catch(()=>api('holdings?order=created_at.asc'));
  state.dragSrcType = null;
  toast('Order saved');
}

document.addEventListener('dragend', ()=>{
  document.querySelectorAll('.cat-block').forEach(b=>{b.classList.remove('drag-source');b.style.opacity='';});
  state.dragSrcType=null;
});

// ─────────────────────────────────────────

// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions({
  showSettingsMain,
  showSettingsSection,
  recurCalPrev,
  recurCalNext,
  getRecurrenceDaysInMonth,
  renderRecurCalendar,
  renderSettings,

  buildIconGrid,
  selectIcon,
  updateIconPreview,

  openCatDetailModal,
  deleteCatFromDetail,
  openCategoryModal,
  updateCatParentUI,
  openCatParentPicker,
  saveCat,
  deleteCat,

  toggleRecurActive,
  deleteRecur,

  showMobileRptInsights,
  switchMobileAnalytics,
  showCalDayDetail,

  toggleCfSearch,
  closeCfSearch,
  onCfSearch,

  setBulkSelectMode,
  toggleBulkSelect,
  txTouchStart,
  txTouchMove,
  txTouchEnd,
  toggleTxSelect,
  updateBulkDeleteBtn,
  bulkDeleteTx,

  initTouchDnD,

  onHoldingDragStart,
  onHoldingDragOver,
  onHoldingDragLeave,
  onHoldingDrop
});