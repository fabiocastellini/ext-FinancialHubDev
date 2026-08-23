import { state } from '../state.js';
import { isoToday } from '../utils/date.js';
import { exposeLegacyFunctions } from '../utils/legacy.js';
import { openModal, closeModal } from './modal.js';


export function openDatePicker(field, currentValue, onChange, opts = {}) {
  state.dpState.field = field;
  state.dpState.onChange = onChange;
  state.dpState.withTime = !!opts.withTime;

  let datePart = currentValue || '';
  let timePart = '';

  if (currentValue && currentValue.includes('T')) {
    [datePart, timePart] = currentValue.split('T');
  }

  state.dpState.value = datePart;

  const base = datePart
    ? new Date(datePart + 'T00:00:00')
    : new Date();

  state.dpState.viewYear = base.getFullYear();
  state.dpState.viewMonth = base.getMonth();

  document.getElementById('dp-time-row').style.display =
    state.dpState.withTime ? '' : 'none';

  document.getElementById('dp-clear-btn').style.display =
    state.dpState.withTime ? 'none' : '';

  document.getElementById('dp-done-btn').style.display =
    state.dpState.withTime ? '' : 'none';

  if (state.dpState.withTime) {
    if (!timePart) {
      const now = new Date();

      timePart =
        String(now.getHours()).padStart(2, '0') +
        ':' +
        String(now.getMinutes()).padStart(2, '0');
    }

    document.getElementById('dp-time-input').value = timePart;
  }

  renderDatePicker();
  openModal('modal-datepicker');
}


export function dpConfirmDateTime() {
  if (!state.dpState.value) return;

  const time =
    document.getElementById('dp-time-input').value || '00:00';

  const combined =
    state.dpState.value + 'T' + time;

  if (typeof state.dpState.onChange === 'function') {
    state.dpState.onChange(combined);
  }

  closeModal('modal-datepicker');
}


export function dpChangeMonth(delta) {
  state.dpState.viewMonth += delta;

  if (state.dpState.viewMonth < 0) {
    state.dpState.viewMonth = 11;
    state.dpState.viewYear--;
  }

  if (state.dpState.viewMonth > 11) {
    state.dpState.viewMonth = 0;
    state.dpState.viewYear++;
  }

  renderDatePicker();
}


export function renderDatePicker() {
  const y = state.dpState.viewYear;
  const m = state.dpState.viewMonth;

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  document.getElementById('dp-title').textContent =
    `${monthNames[m]} ${y}`;

  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrevMonth = new Date(y, m, 0).getDate();
  const todayIso = isoToday();

  const cells = [];

  for (let i = 0; i < firstDow; i++) {
    cells.push({
      d: daysInPrevMonth - firstDow + 1 + i,
      muted: true,
      iso: null
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso =
      `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    cells.push({
      d,
      muted: false,
      iso
    });
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    const d =
      cells.length - (firstDow + daysInMonth) + 1;

    cells.push({
      d,
      muted: true,
      iso: null
    });

    if (cells.length >= 42) break;
  }

  document.getElementById('dp-days').innerHTML =
    cells.map(c => {
      const classes = ['dp-day'];

      if (c.muted) {
        classes.push('muted');
      }

      if (c.iso === todayIso) {
        classes.push('today');
      }

      if (c.iso && c.iso === state.dpState.value) {
        classes.push('selected');
      }

      const clickAttr = c.iso
        ? `onclick="dpSelectDay('${c.iso}')"`
        : `onclick="dpChangeMonth(${c.muted && c.d > 20 ? -1 : 1})"`;

      return `
        <button
          type="button"
          class="${classes.join(' ')}"
          ${clickAttr}>
          ${c.d}
        </button>
      `;
    }).join('');
}


export function dpSelectDay(iso) {
  state.dpState.value = iso;

  if (state.dpState.withTime) {
    renderDatePicker();
    return;
  }

  if (typeof state.dpState.onChange === 'function') {
    state.dpState.onChange(iso);
  }

  closeModal('modal-datepicker');
}


export function dpClear() {
  state.dpState.value = '';

  if (typeof state.dpState.onChange === 'function') {
    state.dpState.onChange('');
  }

  closeModal('modal-datepicker');
}


export function dpToday() {
  dpSelectDay(isoToday());
}


// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions({
  openDatePicker,
  dpConfirmDateTime,
  dpChangeMonth,
  renderDatePicker,
  dpSelectDay,
  dpClear,
  dpToday
});