import { state } from '../state.js';
import { exposeLegacyFunctions } from '../utils/legacy.js';
import { TYPE_LABELS, TYPE_ICONS } from '../config.js';
import { cleanCryptoName } from '../utils/calculations.js';
import { openModal, closeModal } from '../components/modal.js';

export function openSelectPicker(title, options, currentValue, onChoose) {
  state.selectModalOnChoose = onChoose;
  document.getElementById('select-modal-title').textContent = title;
  document.getElementById('select-modal-list').innerHTML = options.map(o => {
    const isActive = String(o.value) === String(currentValue);
    const iconHtml = o.icon ? `<i class="ti ${o.icon}" style="font-size:15px;color:${o.color || 'var(--text2)'};width:20px;text-align:center;flex-shrink:0"></i>` : '';
    const indent = o.isChild ? 'padding-left:22px' : '';
    const labelStyle = o.isChild ? 'font-size:12.5px;color:var(--text2)' : '';
    return `<div class="select-modal-row${isActive ? ' active' : ''}" onclick="chooseSelectOption(this)" data-value="${String(o.value).replace(/"/g, '&quot;')}" style="${indent}">
      <span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;${labelStyle}">${iconHtml}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.label}</span></span>
      ${isActive ? '<i class="ti ti-check" style="flex-shrink:0"></i>' : ''}
    </div>`;
  }).join('');

  openModal('modal-select');
  const listEl = document.getElementById('select-modal-list');
  if (listEl) listEl.scrollTop = 0;
}

export function chooseSelectOption(el) {
  const value = el.dataset.value;
  if (typeof state.selectModalOnChoose === 'function') state.selectModalOnChoose(value);
  closeModal('modal-select');
  const listEl = document.getElementById('select-modal-list');
  if (listEl) listEl.scrollTop = 0;
}

export function setTriggerIcon(iconId, icon, color) {
  const el = document.getElementById(iconId);
  if (!el) return;
  if (icon) {
    el.className = 'ti ' + icon;
    el.style.color = color || 'var(--text3)';
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

export function accountOptionsList() {
  const typeColorMap = { bank: '#0ea5e9', bond: '#ec4899', cash: '#84cc16', crypto: '#f59e0b', dividend: '#60a8f5', etf: '#10b981', stock: '#6366f1' };
  return state.holdings.map(h => {
    const n = h.type === 'crypto' ? cleanCryptoName(h.name || h.ticker) : (h.name || h.ticker);
    return { value: h.id, label: `${n} (${TYPE_LABELS[h.type] || h.type})`, icon: TYPE_ICONS[h.type], color: typeColorMap[h.type] };
  });
}

export function buildCategoryPickerOptions() {
  const topCats = (state.cfCategories || []).filter(c => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name));
  const options = [];
  topCats.forEach(top => {
    options.push({ value: top.id, label: top.name, icon: top.icon, color: top.color });
    (state.cfCategories || []).filter(c => c.parent_id === top.id).sort((a, b) => a.name.localeCompare(b.name)).forEach(sub => {
      options.push({ value: sub.id, label: sub.name, icon: top.icon, color: top.color, isChild: true });
    });
  });
  return options;
}

export function getTopCategoryId(categoryId) {
  const cat = (state.cfCategories || []).find(c => c.id === categoryId);
  if (!cat) return categoryId;
  return cat.parent_id || cat.id;
}

export function catDisplayLabel(cat) {
  if (!cat) return '';
  if (cat.parent_id) {
    const parent = (state.cfCategories || []).find(c => c.id === cat.parent_id);
    return parent ? `${parent.name} > ${cat.name}` : cat.name;
  }
  return cat.name;
}

// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions({
  openSelectPicker,
  chooseSelectOption,
  setTriggerIcon,
  accountOptionsList,
  buildCategoryPickerOptions,
  getTopCategoryId,
  catDisplayLabel,
});