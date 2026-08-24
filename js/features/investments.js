import { state } from '../state.js';
import { exposeLegacyFunctions } from '../utils/legacy.js';
import { TYPE_LABELS, TYPE_ICONS, TYPE_COLORS } from '../config.js';
import { cleanCryptoName } from '../utils/calculations.js';
import { openSelectPicker, setTriggerIcon, accountOptionsList, buildCategoryPickerOptions, catDisplayLabel } from '../components/select-picker.js';
import { closeModal } from '../components/modal.js';

export function invAssetOptionsList() {
  const investHoldings = state.holdings.filter(h => ['stock', 'etf', 'crypto', 'bond', 'fund'].includes(h.type));
  return investHoldings.map(h => {
    const n = h.type === 'crypto' ? cleanCryptoName(h.name || h.ticker) : (h.name || h.ticker);
    return { value: h.id, label: `${n} (${h.ticker})`, icon: TYPE_ICONS[h.type], color: TYPE_COLORS[h.type] };
  });
}

export function openInvAssetPicker() {
  const current = document.getElementById('inv-asset').value;
  const options = invAssetOptionsList();
  openSelectPicker('Select asset', options, current, (val) => {
    document.getElementById('inv-asset').value = val;
    const opt = options.find(o => o.value === val);
    document.getElementById('inv-asset-label').textContent = opt ? opt.label : 'Select asset';
    document.getElementById('inv-asset-trigger').classList.toggle('placeholder', !opt);
    window.updateInvCounterparts?.();
  });
}

export function invCounterpartOptionsList() {
  const selectedId = document.getElementById('inv-asset').value;
  return state.holdings.filter(h => h.id !== selectedId).map(h => {
    const n = h.type === 'crypto' ? cleanCryptoName(h.name || h.ticker) : (h.name || h.ticker);
    return { value: h.id, label: `${n} (${TYPE_LABELS[h.type] || h.type})`, icon: TYPE_ICONS[h.type], color: TYPE_COLORS[h.type] };
  });
}

export function openInvPaidFromPicker() {
  const current = document.getElementById('inv-paid-from').value;
  const options = invCounterpartOptionsList();
  openSelectPicker('Purchased with', options, current, (val) => {
    document.getElementById('inv-paid-from').value = val;
    const opt = options.find(o => o.value === val);
    document.getElementById('inv-paid-from-label').textContent = opt ? opt.label : 'Select account';
    document.getElementById('inv-paid-from-trigger').classList.toggle('placeholder', !opt);
  });
}

export function openInvSaleToPicker() {
  const current = document.getElementById('inv-sale-to').value;
  const options = invCounterpartOptionsList();
  openSelectPicker('Proceeds credited to', options, current, (val) => {
    document.getElementById('inv-sale-to').value = val;
    const opt = options.find(o => o.value === val);
    document.getElementById('inv-sale-to-label').textContent = opt ? opt.label : 'Select account';
    document.getElementById('inv-sale-to-trigger').classList.toggle('placeholder', !opt);
  });
}

export function openInvExpIncAcctPicker() {
  const current = document.getElementById('inv-expinc-acct').value;
  const options = accountOptionsList();
  const title = document.getElementById('inv-expinc-acct-label').textContent || 'Select account';
  openSelectPicker(title, options, current, (val) => {
    document.getElementById('inv-expinc-acct').value = val;
    const opt = options.find(o => o.value === val);
    document.getElementById('inv-expinc-acct-span').textContent = opt ? opt.label : 'Select account';
    document.getElementById('inv-expinc-acct-trigger').classList.toggle('placeholder', !opt);
  });
}

export function openInvCatPicker() {
  const current = document.getElementById('inv-cat').value;
  const options = buildCategoryPickerOptions();
  options.push({ value: '__new_cat__', label: 'New category…', icon: 'ti-plus', color: 'var(--accent)' });
  openSelectPicker('Select category', options, current, (val) => {
    if (val === '__new_cat__') {
      state.catCreateTargetField = 'inv-cat';
      closeModal('modal-select');
      window.openCategoryModal?.();
      return;
    }
    document.getElementById('inv-cat').value = val;
    const cat = (state.cfCategories || []).find(c => c.id === val);
    document.getElementById('inv-cat-label').textContent = cat ? catDisplayLabel(cat) : 'Select category';
    document.getElementById('inv-cat-trigger').classList.toggle('placeholder', !cat);
    setTriggerIcon('inv-cat-icon', cat?.icon, cat?.color);
  });
}

// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions(
{
  invAssetOptionsList,
  openInvAssetPicker,
  invCounterpartOptionsList,
  openInvPaidFromPicker,
  openInvSaleToPicker,
  openInvExpIncAcctPicker,
  openInvCatPicker,
});