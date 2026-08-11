async function loadAll(deferRender=false){
  [holdings, transactions, snapshots] = await Promise.all([
    api('holdings?order=sort_order.asc,created_at.asc').catch(()=>api('holdings?order=created_at.asc')).catch(()=>api('holdings?order=created_at.asc')),
    api('transactions?order=created_at.desc'),
    api('net_worth_snapshots?order=snapshot_date.asc')
  ]);
  await maybeTakeSnapshot();
  if(!deferRender){ refreshHoldingsViews(); renderTx(); renderOverview(); }
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
}

// ── SNAPSHOT ──
async function maybeTakeSnapshot(){
  const today = new Date().toISOString().split('T')[0];
  const alreadyToday = snapshots.some(s=>s.snapshot_date===today);
  if(alreadyToday || !holdings.length) return;
  const totalVal = holdings.reduce((s,h)=>s+getVal(h),0);
  if(totalVal===0) return;
  const row = await api('net_worth_snapshots',{method:'POST',body:JSON.stringify({snapshot_date:today,total_value:totalVal})});
  if(Array.isArray(row) && row[0]) snapshots.push(row[0]);
}

// ── HOLDINGS ──
function getVal(h){
  const cleanT = h.type==='crypto' ? cleanCryptoTicker(h.ticker) : h.ticker;
  const price = prices[cleanT] ?? prices[h.ticker];
  return (price != null ? price : h.avg_cost) * h.qty;
}

function cleanCryptoTicker(ticker){ return ticker.replace(/[-/](EUR|USD|USDT|USDC|GBP)$/i,'').toUpperCase(); }
function cleanCryptoName(name){ return name.replace(/\s+(EUR|USD|USDT|USDC|GBP)$/i,'').trim(); }
function getCost(h){ return h.avg_cost * h.qty; }
function getGain(h){ return getVal(h)-getCost(h); }
function getGainPct(h){ const c=getCost(h); return c>0?getGain(h)/c*100:0; }

