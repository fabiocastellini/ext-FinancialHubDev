// REPORTS
// ─────────────────────────────────────────

// Extra categories from Excel that might be missing
const EXTRA_CATS = [
  {name:'Fixed',           icon:'ti-file-invoice',    color:'#6366f1'},
  {name:'Food & Drinks',   icon:'ti-tools-kitchen-2', color:'#f59e0b'},
  {name:'Groceries',       icon:'ti-shopping-cart',   color:'#84cc16'},
  {name:'House',           icon:'ti-home-2',          color:'#0ea5e9'},
  {name:'Events',          icon:'ti-confetti',        color:'#ec4899'},
  {name:'Hobby',           icon:'ti-device-gamepad-2',color:'#8b5cf6'},
  {name:'Other',           icon:'ti-dots',            color:'#9ca3af'},
  {name:'Sport',           icon:'ti-ball-football',   color:'#10b981'},
  {name:'Tech',            icon:'ti-device-laptop',   color:'#3b82f6'},
  {name:'Trips',           icon:'ti-plane',           color:'#f97316'},
];

async function ensureExtraCategories(){
  const existing = cfCategories.map(c=>c.name.toLowerCase());
  let added = false;
  for(const cat of EXTRA_CATS){
    if(!existing.includes(cat.name.toLowerCase())){
      try{
        const r = await api('cashflow_categories',{method:'POST',body:JSON.stringify(cat)});
        if(Array.isArray(r)&&r[0]){ cfCategories.push(r[0]); added=true; }
      }catch(e){ console.warn('Could not add category:', cat.name, e); }
    }
  }
  if(added){
    // Re-fetch to ensure correct order
    cfCategories = await api('cashflow_categories?order=name.asc');
    renderSettings();
  }
}

function rptFmt(n){ return n==null?'—':'€ '+Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function rptPct(n){ if(n==null) return '—'; return (n>=0?'+':'')+Number(n).toFixed(1)+'%'; }

function mkStat(label, val, cls=''){
  return `<div class="rpt-stat"><div class="rpt-stat-label">${label}</div><div class="rpt-stat-val ${cls}">${val}</div></div>`;
}

let rptFilterYear = String(new Date().getFullYear());

function populateRptYearSel(){
  const trigger = document.getElementById('rpt-year-trigger'); if(!trigger) return;
  const years = [...new Set(cfTransactions.map(t=>new Date(t.date).getFullYear()))].sort((a,b)=>b-a);
  // Ensure current year default is valid (fall back to 'all' if no transactions this year)
  if(years.length && rptFilterYear !== 'all' && !years.includes(Number(rptFilterYear))) rptFilterYear = 'all';
  rptYearOptionsCache = [{value:'all', label:'All time'}, ...years.map(y=>({value:String(y), label:String(y)}))];
  document.getElementById('rpt-year-sel').value = rptFilterYear;
  document.getElementById('rpt-year-label').textContent = rptFilterYear==='all' ? 'All time' : String(rptFilterYear);
}

function onRptYearChange(){
  const sel = document.getElementById('rpt-year-sel'); if(!sel) return;
  rptFilterYear = sel.value;

  renderReports();
}

function getRptTransactions(){
  if(rptFilterYear==='all') return cfTransactions;
  return cfTransactions.filter(t=>new Date(t.date).getFullYear()===Number(rptFilterYear));
}

function renderReports(){
  populateRptYearSel();
  renderCashflowReport();
  renderIncomesReport();
  renderOutcomesReport();
  renderInvestmentsReport();
  renderAssetReport('crypto');
  renderAssetReport('etf');
  renderAssetReport('stock');
}

// ── Cashflow table ──
function renderCashflowReport(){
  const allTx = getRptTransactions();
  const periods = buildSalaryPeriods().filter(p=>{
    if(rptFilterYear==='all') return true;
    const y=Number(rptFilterYear); return p.start.getFullYear()===y||p.end.getFullYear()===y;
  });
  const liqHoldings = holdings.filter(h=>h.type==='bank'||h.type==='cash');
  const liqIds = new Set(liqHoldings.map(h=>h.id));

  // Reconstruct liquidity per period (same logic as liquidity chart)
  const sortedTxDesc = [...allTx]
    .filter(t=>liqIds.has(t.holding_id)||liqIds.has(t.holding_to_id))
    .sort((a,b)=>new Date(b.date)-new Date(a.date));
  let bal = liqHoldings.reduce((s,h)=>s+h.avg_cost,0);
  const liqByPeriod = {};
  liqByPeriod[periods.length-1] = bal;
  for(let i=periods.length-2;i>=0;i--){
    const p=periods[i+1];
    sortedTxDesc.forEach(t=>{
      const td=new Date(t.date);
      if(td>=p.start&&td<=p.end){
        if(t.type==='income'&&liqIds.has(t.holding_id)) bal-=t.amount;
        else if(t.type==='expense'&&liqIds.has(t.holding_id)) bal+=t.amount;
        else if(t.type==='transfer'){ if(liqIds.has(t.holding_to_id)) bal-=t.amount; if(liqIds.has(t.holding_id)) bal+=t.amount; }
        else if(t.type==='purchase'&&liqIds.has(t.holding_to_id)) bal+=t.amount;
        else if(t.type==='sale'&&liqIds.has(t.holding_to_id)) bal-=t.amount;
      }
    });
    liqByPeriod[i]=Math.max(0,bal);
  }

  // Build rows
  const salCatIds = new Set(cfCategories.filter(c=>{ const n=c.name.toLowerCase(); return n.includes('salary')||n.includes('salario')||n.includes('stipendio')||n.includes('wage')||n==='salary'; }).map(c=>c.id));
  const rows = periods.map((p,i)=>{
    const pTxs = allTx.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end;});
    const salary = pTxs.filter(t=>isIncomeTx(t)&&salCatIds.has(t.category_id)).reduce((s,t)=>s+t.amount,0);
    const variables = pTxs.filter(t=>isIncomeTx(t)&&!salCatIds.has(t.category_id)).reduce((s,t)=>s+t.amount,0);
    const totalInc = pTxs.filter(t=>isIncomeTx(t)).reduce((s,t)=>s+t.amount,0);
    const totalOut = pTxs.filter(t=>isOutcomeTx(t)).reduce((s,t)=>s+t.amount,0);
    const invested = pTxs.filter(t=>t.type==='purchase').reduce((s,t)=>s+t.amount,0);
    const savings = totalInc - totalOut;
    return {period:p.label, liquidity:liqByPeriod[i]??0, salary, variables, totalInc, totalOut, savings, invested};
  });

  const totalInc = rows.reduce((s,r)=>s+r.totalInc,0);
  const totalOut = rows.reduce((s,r)=>s+r.totalOut,0);
  const totalSav = totalInc - totalOut;
  const totalInv = rows.reduce((s,r)=>s+r.invested,0);

  document.getElementById('rpt-cf-summary').innerHTML =
    mkStat('Total income', rptFmt(totalInc), 'pos') +
    mkStat('Total outcomes', rptFmt(totalOut), 'neg') +
    mkStat('Net savings', rptFmt(totalSav), totalSav>=0?'pos':'neg') +
    mkStat('Invested capital', rptFmt(totalInv)) +
    mkStat('Periods', rows.length);

  const thead = `<thead><tr><th>Period</th><th>Liquidity</th><th>Salary</th><th>Variables</th><th>Total income</th><th>Outcomes</th><th>Savings</th><th>Invested</th></tr></thead>`;
  const tbody = rows.map(r=>`<tr>
    <td>${r.period}</td>
    <td>${rptFmt(r.liquidity)}</td>
    <td>${rptFmt(r.salary)}</td>
    <td>${rptFmt(r.variables)||'—'}</td>
    <td style="color:var(--green);font-weight:600">${rptFmt(r.totalInc)}</td>
    <td style="color:var(--red)">${rptFmt(r.totalOut)}</td>
    <td style="color:${r.savings>=0?'var(--green)':'var(--red)'};font-weight:600">${rptFmt(r.savings)}</td>
    <td>${r.invested>0?rptFmt(r.invested):'—'}</td>
  </tr>`).join('');
  const tfoot = `<tfoot><tr class="total-row"><td>TOTAL</td><td>—</td><td>—</td><td>—</td><td>${rptFmt(totalInc)}</td><td>${rptFmt(totalOut)}</td><td>${rptFmt(totalSav)}</td><td>${rptFmt(totalInv)}</td></tr></tfoot>`;
  document.getElementById('rpt-cf-table').innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

// ── Incomes table ──
function renderIncomesReport(){
  const allTx = getRptTransactions();
  const periods = buildSalaryPeriods().filter(p=>{
    if(rptFilterYear==='all') return true;
    const y=Number(rptFilterYear); return p.start.getFullYear()===y||p.end.getFullYear()===y;
  });
  const salCatIds = new Set(cfCategories.filter(c=>{ const n=c.name.toLowerCase(); return n.includes('salary')||n.includes('salario')||n.includes('stipendio')||n.includes('wage')||n==='salary'; }).map(c=>c.id));
  const rows = periods.map(p=>{
    const pTxs = allTx.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end&&isIncomeTx(t);});
    const salary = pTxs.filter(t=>salCatIds.has(t.category_id)).reduce((s,t)=>s+t.amount,0);
    const variables = pTxs.filter(t=>!salCatIds.has(t.category_id)).reduce((s,t)=>s+t.amount,0);
    const total = salary+variables;
    return {period:p.label, salary, variables, total};
  }).filter(r=>r.total>0);

  const totSal = rows.reduce((s,r)=>s+r.salary,0);
  const totVar = rows.reduce((s,r)=>s+r.variables,0);
  const totAll = totSal+totVar;
  const avgMon = rows.length ? totAll/rows.length : 0;

  document.getElementById('rpt-inc-summary').innerHTML =
    mkStat('Total salary', rptFmt(totSal), 'pos') +
    mkStat('Total variables', rptFmt(totVar)) +
    mkStat('Grand total', rptFmt(totAll), 'pos') +
    mkStat('Monthly avg', rptFmt(avgMon));

  const thead = `<thead><tr><th>Period</th><th>Salary</th><th>Variable income</th><th>Total</th></tr></thead>`;
  const tbody = rows.map(r=>`<tr>
    <td>${r.period}</td>
    <td>${rptFmt(r.salary)}</td>
    <td>${r.variables>0?rptFmt(r.variables):'—'}</td>
    <td style="color:var(--green);font-weight:600">${rptFmt(r.total)}</td>
  </tr>`).join('');
  const tfoot = `<tfoot><tr class="total-row"><td>TOTAL</td><td>${rptFmt(totSal)}</td><td>${rptFmt(totVar)}</td><td>${rptFmt(totAll)}</td></tr></tfoot>`;
  document.getElementById('rpt-inc-table').innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

// ── Outcomes by category ──
function renderOutcomesReport(){
  const allTx = getRptTransactions();
  const periods = buildSalaryPeriods().filter(p=>{
    if(rptFilterYear==='all') return true;
    const y=Number(rptFilterYear); return p.start.getFullYear()===y||p.end.getFullYear()===y;
  });
  // Get all expense categories that have been used (sub-categories roll up into their parent)
  const usedCatIds = new Set(allTx.filter(t=>isOutcomeTx(t)&&t.category_id).map(t=>getTopCategoryId(t.category_id)));
  const cats = cfCategories.filter(c=>usedCatIds.has(c.id)&&!c.parent_id).sort((a,b)=>a.name.localeCompare(b.name));

  const rows = periods.map(p=>{
    const pTxs = allTx.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end&&isOutcomeTx(t);});
    const total = pTxs.reduce((s,t)=>s+t.amount,0);
    if(!total) return null;
    const byCat = {};
    cats.forEach(c=>{ byCat[c.id]=pTxs.filter(t=>getTopCategoryId(t.category_id)===c.id).reduce((s,t)=>s+t.amount,0); });
    const fixed = pTxs.filter(t=>t.recurring_id).reduce((s,t)=>s+t.amount,0);
    return {period:p.label, byCat, total, fixed};
  }).filter(Boolean);

  const grandTotal = rows.reduce((s,r)=>s+r.total,0);
  const catTotals = {};
  cats.forEach(c=>{ catTotals[c.id]=rows.reduce((s,r)=>s+(r.byCat[c.id]||0),0); });
  const biggestCat = cats.sort((a,b)=>(catTotals[b.id]||0)-(catTotals[a.id]||0))[0];
  const avgMon = rows.length ? grandTotal/rows.length : 0;

  document.getElementById('rpt-out-summary').innerHTML =
    mkStat('Grand total', rptFmt(grandTotal), 'neg') +
    mkStat('Monthly avg', rptFmt(avgMon)) +
    mkStat('Periods', rows.length) +
    (biggestCat ? mkStat('Biggest category', biggestCat.name) : '');

  const catHeaders = cats.map(c=>`<th>${c.name}</th>`).join('');
  const thead = `<thead><tr><th>Period</th><th>🔁 Fixed</th>${catHeaders}<th>Total</th></tr></thead>`;
  const totalFixed = rows.reduce((s,r)=>s+(r.fixed||0),0);
  const tbody = rows.map(r=>`<tr>
    <td>${r.period}</td>
    <td style="color:var(--accent)">${r.fixed>0?rptFmt(r.fixed):'—'}</td>
    ${cats.map(c=>`<td>${r.byCat[c.id]>0?rptFmt(r.byCat[c.id]):'—'}</td>`).join('')}
    <td style="color:var(--red);font-weight:600">${rptFmt(r.total)}</td>
  </tr>`).join('');
  const catTotalCells = cats.map(c=>`<td>${catTotals[c.id]>0?rptFmt(catTotals[c.id]):'—'}</td>`).join('');
  const tfoot = `<tfoot><tr class="total-row"><td>TOTAL</td><td style="color:var(--accent)">${rptFmt(totalFixed)}</td>${catTotalCells}<td>${rptFmt(grandTotal)}</td></tr></tfoot>`;
  document.getElementById('rpt-out-table').innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

// ── Investments over time ──
function renderInvestmentsReport(){
  const allTx = getRptTransactions();
  const periods = buildSalaryPeriods().filter(p=>{
    if(rptFilterYear==='all') return true;
    const y=Number(rptFilterYear); return p.start.getFullYear()===y||p.end.getFullYear()===y;
  });
  const invTypes = ['crypto','etf','stock','bond'];
  const rows = periods.map(p=>{
    const pTxs = allTx.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end&&t.type==='purchase';});
    if(!pTxs.length) return null;
    const byType = {};
    invTypes.forEach(type=>{
      const typeHoldings = holdings.filter(h=>h.type===type);
      const typeIds = new Set(typeHoldings.map(h=>h.id));
      byType[type] = pTxs.filter(t=>typeIds.has(t.holding_id)).reduce((s,t)=>s+t.amount,0);
    });
    const total = pTxs.reduce((s,t)=>s+t.amount,0);
    return {period:p.label, byType, total};
  }).filter(Boolean);

  const grandTotal = rows.reduce((s,r)=>s+r.total,0);
  const byTypeTotal = {};
  invTypes.forEach(type=>{ byTypeTotal[type]=rows.reduce((s,r)=>s+(r.byType[type]||0),0); });
  const currentVal = holdings.filter(h=>invTypes.includes(h.type)).reduce((s,h)=>s+getVal(h),0);
  const pnl = currentVal - grandTotal;
  const pnlPct = grandTotal>0 ? pnl/grandTotal*100 : 0;

  document.getElementById('rpt-inv-summary').innerHTML =
    mkStat('Total invested', rptFmt(grandTotal)) +
    mkStat('Current value', rptFmt(currentVal)) +
    mkStat('Gain / Loss', rptFmt(pnl)+(pnl!==0?' ('+rptPct(pnlPct)+')':''), pnl>=0?'pos':'neg') +
    mkStat('Periods active', rows.length);

  const thead = `<thead><tr><th>Period</th><th>Crypto</th><th>ETF</th><th>Stocks</th><th>Bonds</th><th>Total</th></tr></thead>`;
  const tbody = rows.map(r=>`<tr>
    <td>${r.period}</td>
    ${invTypes.map(type=>`<td>${r.byType[type]>0?rptFmt(r.byType[type]):'—'}</td>`).join('')}
    <td style="font-weight:600">${rptFmt(r.total)}</td>
  </tr>`).join('');
  const tfoot = `<tfoot><tr class="total-row"><td>TOTAL</td>${invTypes.map(t=>`<td>${byTypeTotal[t]>0?rptFmt(byTypeTotal[t]):'—'}</td>`).join('')}<td>${rptFmt(grandTotal)}</td></tr></tfoot>`;
  document.getElementById('rpt-inv-table').innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

// ── Asset tables (crypto/etf/stock) ──
function renderAssetReport(type){
  const typeHoldings = holdings.filter(h=>h.type===type);
  const summaryEl = document.getElementById(`rpt-${type}-summary`);
  const tableEl = document.getElementById(`rpt-${type}-table`);
  if(!summaryEl||!tableEl) return;

  if(!typeHoldings.length){
    summaryEl.innerHTML='';
    tableEl.innerHTML=`<tbody><tr><td style="text-align:center;padding:1.5rem;color:var(--text3)">No ${TYPE_LABELS[type]||type} holdings</td></tr></tbody>`;
    return;
  }

  const totalInvested = typeHoldings.reduce((s,h)=>s+getCost(h),0);
  const totalCurrent  = typeHoldings.reduce((s,h)=>s+getVal(h),0);
  const totalPnl      = totalCurrent - totalInvested;
  const totalPnlPct   = totalInvested>0 ? totalPnl/totalInvested*100 : 0;

  summaryEl.innerHTML =
    mkStat('Total invested', rptFmt(totalInvested)) +
    mkStat('Current value', rptFmt(totalCurrent)) +
    mkStat('Gain / Loss', rptFmt(totalPnl), totalPnl>=0?'pos':'neg') +
    mkStat('Return', rptPct(totalPnlPct), totalPnlPct>=0?'pos':'neg') +
    mkStat('Holdings', typeHoldings.length);

  const isCrypto = type==='crypto';
  const thead = `<thead><tr>
    <th>Asset</th><th>Qty</th><th>Avg cost</th><th>Live price</th><th>Invested</th><th>Current value</th><th>Gain / Loss</th><th>Return</th>
  </tr></thead>`;
  const tbody = typeHoldings.map(h=>{
    const dispTicker = isCrypto?cleanCryptoTicker(h.ticker):h.ticker;
    const dispName   = isCrypto?cleanCryptoName(h.name||h.ticker):(h.name||h.ticker);
    const cost   = getCost(h);
    const val    = getVal(h);
    const gain   = val - cost;
    const gainPct= cost>0 ? gain/cost*100 : 0;
    const price  = prices[dispTicker]??prices[h.ticker];
    return `<tr>
      <td><strong>${dispTicker}</strong><br><span style="color:var(--text2);font-size:11px">${dispName}</span></td>
      <td>${fmtN(h.qty,8)}</td>
      <td>${rptFmt(h.avg_cost)}</td>
      <td>${price?rptFmt(price):'—'}</td>
      <td>${rptFmt(cost)}</td>
      <td style="font-weight:600">${rptFmt(val)}</td>
      <td style="color:${gain>=0?'var(--green)':'var(--red)'};font-weight:600">${rptFmt(gain)}</td>
      <td style="color:${gainPct>=0?'var(--green)':'var(--red)'}">${rptPct(gainPct)}</td>
    </tr>`;
  }).join('');
  const tfoot = `<tfoot><tr class="total-row">
    <td>TOTAL</td><td>—</td><td>—</td><td>—</td>
    <td>${rptFmt(totalInvested)}</td>
    <td>${rptFmt(totalCurrent)}</td>
    <td style="color:${totalPnl>=0?'var(--green)':'var(--red)'}">${rptFmt(totalPnl)}</td>
    <td style="color:${totalPnlPct>=0?'var(--green)':'var(--red)'}">${rptPct(totalPnlPct)}</td>
  </tr></tfoot>`;
  tableEl.innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

