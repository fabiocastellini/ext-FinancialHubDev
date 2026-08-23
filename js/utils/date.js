export function fmt(n) {
  const num = Number(n);
  const decimals = Math.abs(num) > 0 && Math.abs(num) < 1 ? 4 : 2;
  return '€\u00a0' + num.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtN(n, d = 6) {
  return Number(n).toLocaleString('it-IT', { maximumFractionDigits: d });
}

export function fmtPct(n) {
  return (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';
}

export function fmtShort(n){
  if(Math.abs(n)>=1000) return '€'+(n/1000).toFixed(1)+'k';
  return '€'+Math.round(n);
}

export function fmtDateDDMMYYYY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtDateTimeDDMMYYYY(v) {
  if (!v) return '';
  const [datePart, timePart] = v.split('T');
  return fmtDateDDMMYYYY(datePart) + (timePart ? ' ' + timePart : '');
}

export function isoToday() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}