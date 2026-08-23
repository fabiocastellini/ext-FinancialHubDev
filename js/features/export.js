import { exposeLegacyFunctions } from '../utils/legacy.js';

// ─────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────
export function exportCSV(tableId, filename){
  const table = document.getElementById(tableId);
  if(!table){ toast('No data to export'); return; }
  const rows = [...table.querySelectorAll('tr')];
  const csv = rows.map(row=>{
    const cells = [...row.querySelectorAll('th,td')];
    return cells.map(c=>{
      const txt = c.innerText.replace(/€/g,'').replace(/\s+/g,' ').trim();
      return '"'+txt.replace(/"/g,'""')+'"';
    }).join(',');
  }).join('\n');
  const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  toast(`${filename}.csv downloaded`);
}

// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions({
  exportCSV,
});