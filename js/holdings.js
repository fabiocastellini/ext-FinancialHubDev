function renderHoldings(){
  const emptyState = document.getElementById('h-empty-state');
  const container  = document.getElementById('h-categories');
  const subtitle   = document.getElementById('h-subtitle');
  if(!holdings.length){ emptyState.style.display=''; container.innerHTML=''; subtitle.textContent='No holdings yet'; closeCategoryDetail(); return; }
  emptyState.style.display='none';

  // Update subtitle with price freshness
  const investmentHoldings = holdings.filter(h=>!['bank','cash','dividend'].includes(h.type));
  const priceCount = investmentHoldings.filter(h=>prices[h.ticker]).length;
  const lastUpdated = document.getElementById('refresh-info').textContent;
  if(investmentHoldings.length===0){
    subtitle.textContent = 'Balances up to date';
  } else if(priceCount===0){
    subtitle.innerHTML = '<span style="color:var(--red)"><i class="ti ti-alert-circle" style="font-size:12px;vertical-align:middle"></i> Live prices not loaded — hit Refresh</span>';
  } else if(priceCount < investmentHoldings.length){
    subtitle.innerHTML = `<span style="color:var(--text2)"><i class="ti ti-refresh" style="font-size:12px;vertical-align:middle"></i> Partial prices — ${lastUpdated.replace('Updated','')}</span>`;
  } else {
    subtitle.innerHTML = `<span style="color:var(--green)"><i class="ti ti-circle-check" style="font-size:12px;vertical-align:middle"></i> Live prices — ${lastUpdated.replace('Updated','')}</span>`;
  }

  // Group by type
  const byType = {};
  holdings.forEach(h=>{ if(!byType[h.type]) byType[h.type]=[]; byType[h.type].push(h); });
  const totalPortfolio = holdings.reduce((s,h)=>s+getVal(h),0)||1;
  const typeColorMap = {bank:'#0ea5e9',bond:'#ec4899',cash:'#84cc16',crypto:'#f59e0b',dividend:'#60a8f5',etf:'#10b981',stock:'#6366f1'};

  // Sort categories alphabetically
  const sortedTypes = Object.keys(byType).sort((a,b)=>(TYPE_LABELS[a]||a).localeCompare(TYPE_LABELS[b]||b));

  container.className = 'holding-grid';
  container.innerHTML = sortedTypes.map(type => {
    const items = byType[type];
    const catTotal = items.reduce((s,h)=>s+getVal(h),0);
    const catPct   = (catTotal/totalPortfolio*100).toFixed(1);
    const color    = typeColorMap[type]||'#888';
    const icon     = TYPE_ICONS[type]||'ti-wallet';
    const isSimple = type==='bank'||type==='cash'||type==='dividend';

    // Category-level gain/loss (only for investment types)
    const catCost = isSimple ? 0 : items.reduce((s,h)=>s+getCost(h),0);
    const catGain = isSimple ? 0 : catTotal - catCost;
    const catGainPct = catCost > 0 ? catGain/catCost*100 : 0;
    const catHasPrices = isSimple ? false : items.some(h=>{
      const t = h.type==='crypto' ? cleanCryptoTicker(h.ticker) : h.ticker;
      return prices[t] != null || prices[h.ticker] != null;
    });

    return `<div class="cat-block holding-box holding-box-clickable type-${type}" data-type="${type}"
        draggable="true"
        ondragstart="onHoldingDragStart(event,'${type}')"
        ondragover="onHoldingDragOver(event)"
        ondragleave="onHoldingDragLeave(event)"
        ondrop="onHoldingDrop(event,'${type}')"
        ondragend="document.querySelectorAll('.cat-block').forEach(b=>{b.classList.remove('drag-source');b.style.opacity=''})"
        onclick="openCategoryDetail('${type}')"
        role="button" tabindex="0">
      <div class="holding-box-ghost"><i class="ti ${icon}" style="color:${color}"></i></div>
      <div style="display:flex;align-items:center;gap:6px;position:relative;z-index:1">
        <i class="ti ti-grip-vertical drag-handle" onclick="event.stopPropagation()" title="Drag to reorder" style="padding:0;margin-left:-4px"></i>
        <div class="holding-box-label" style="margin-bottom:0">${TYPE_LABELS[type]||type}</div>
      </div>
      <div class="holding-box-value">${fmt(catTotal)}</div>
      <div class="holding-box-pct">${catPct}% of portfolio</div>
      ${!isSimple && catHasPrices ? `<div class="holding-box-pct" style="margin-top:2px;font-weight:600;color:${catGain>=0?'var(--green)':'var(--red)'}">${fmt(catGain)} (${fmtPct(catGainPct)})</div>` : ''}
      <div class="holding-box-link"><i class="ti ti-chevron-right"></i> ${items.length} holding${items.length>1?'s':''}</div>
    </div>`;
  }).join('');
  initTouchDnD();
}

let currentCategoryType = null;

function openCategoryDetail(type){
  currentCategoryType = type;
  document.getElementById('h-categories').style.display = 'none';
  document.getElementById('h-empty-state').style.display = 'none';
  const mainActions = document.getElementById('h-main-actions');
  if(mainActions) mainActions.style.display = 'none';
  const detail = document.getElementById('h-category-detail');
  detail.style.display = '';
  renderCategoryDetail(type);
}

function closeCategoryDetail(){
  currentCategoryType = null;
  const detail = document.getElementById('h-category-detail');
  if(detail){ detail.style.display='none'; detail.innerHTML=''; }
  const grid = document.getElementById('h-categories');
  if(grid) grid.style.display='';
  const mainActions = document.getElementById('h-main-actions');
  if(mainActions) mainActions.style.display = '';
}

function refreshHoldingsViews(){
  renderHoldings();
  if(currentCategoryType){
    const stillHasHoldings = holdings.some(h=>h.type===currentCategoryType);
    if(stillHasHoldings) renderCategoryDetail(currentCategoryType);
    else closeCategoryDetail();
  }
}

function renderCategoryDetail(type){
  const container = document.getElementById('h-category-detail');
  if(!container) return;
  const items = holdings.filter(h=>h.type===type);
  if(!items.length){ closeCategoryDetail(); return; }
  const typeColorMap = {bank:'#0ea5e9',bond:'#ec4899',cash:'#84cc16',crypto:'#f59e0b',dividend:'#60a8f5',etf:'#10b981',stock:'#6366f1'};
  const color = typeColorMap[type]||'#888';
  const icon = TYPE_ICONS[type]||'ti-wallet';
  const isSimple = type==='bank'||type==='cash'||type==='dividend';
  const totalPortfolio = holdings.reduce((s,h)=>s+getVal(h),0)||1;
  const catTotal = items.reduce((s,h)=>s+getVal(h),0);
  const catPct = (catTotal/totalPortfolio*100).toFixed(1);
  const catCost = isSimple ? 0 : items.reduce((s,h)=>s+getCost(h),0);
  const catGain = isSimple ? 0 : catTotal - catCost;
  const catGainPct = catCost > 0 ? catGain/catCost*100 : 0;
  const catHasPrices = isSimple ? false : items.some(h=>{
    const t = h.type==='crypto' ? cleanCryptoTicker(h.ticker) : h.ticker;
    return prices[t] != null || prices[h.ticker] != null;
  });

  const rows = items.map(h => {
    const isCrypto  = h.type==='crypto';
    const dispTicker = isCrypto ? cleanCryptoTicker(h.ticker) : h.ticker;
    const dispName   = isCrypto ? cleanCryptoName(h.name||h.ticker) : (h.name||h.ticker);
    if(isCrypto && COINGECKO_IDS[cleanCryptoTicker(h.ticker)] && !COINGECKO_IDS[dispTicker])
      COINGECKO_IDS[dispTicker] = COINGECKO_IDS[cleanCryptoTicker(h.ticker)];
    const price    = prices[dispTicker] ?? prices[h.ticker];
    const gain     = getGain(h), gainPct = getGainPct(h);
    const gainClass = gain>=0?'pos-bg':'neg-bg';
    const hasPrice  = price != null;
    const priceCell = isSimple ? '' : hasPrice
      ? `<td><span style="display:inline-flex;align-items:center;gap:5px;font-weight:500">${fmt(price)}<span style="font-size:10px;background:var(--green-bg);color:var(--green);border-radius:3px;padding:1px 5px;font-weight:600">LIVE</span></span></td>`
      : `<td><span style="color:var(--text3);font-size:12px">— no price</span></td>`;
    const valCell = `<td style="font-weight:700">${fmt(getVal(h))}${!isSimple && !hasPrice ? '<br><span style="font-size:10px;color:var(--text3)">est. cost basis</span>' : ''}</td>`;
    const gainCell = isSimple ? '' : hasPrice
      ? `<td><span class="${gainClass}">${fmt(gain)}</span><br><span style="font-size:11px;color:${gain>=0?'var(--green)':'var(--red)'}">${fmtPct(gainPct)}</span></td>`
      : `<td><span style="color:var(--text3);font-size:12px">—</span></td>`;

    return `<tr data-hid="${h.id}">
        <td><strong style="font-weight:600">${dispName}</strong>${!isSimple?`<br><span style="color:var(--text2);font-size:12px">${dispTicker}</span>`:''}</td>
        ${!isSimple?`<td>${fmtN(h.qty)}</td>`:''}
        ${!isSimple?`<td style="color:var(--text2)">${fmt(h.avg_cost)}</td>`:''}
        ${priceCell}
        ${valCell}
        ${gainCell}
        <td class="holding-actions" style="display:flex;gap:4px">
          ${isSimple?`<button class="btn btn-sm" onclick="editBalance('${h.id}','${dispName}',${h.avg_cost})" title="Edit balance"><i class="ti ti-pencil"></i></button>`:`<button class="btn btn-sm" onclick="renameHolding('${h.id}','${dispName}')" title="Rename"><i class="ti ti-pencil"></i></button>`}
          <button class="btn btn-sm btn-danger" onclick="deleteHolding('${h.id}')"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`;
  }).join('');

  // Total row for investment categories
  const totalRow = (!isSimple && catHasPrices) ? `
    <tr style="background:var(--surface2);font-weight:600;border-top:2px solid var(--border2)">
      <td colspan="${4}" style="color:var(--text2);font-size:12px;text-transform:uppercase;letter-spacing:0.04em">Total</td>
      <td style="font-weight:700">${fmt(catTotal)}</td>
      <td><span class="${catGain>=0?'pos-bg':'neg-bg'}">${fmt(catGain)}</span><br>
        <span style="font-size:11px;color:${catGain>=0?'var(--green)':'var(--red)'}">${fmtPct(catGainPct)}</span></td>
      <td></td>
    </tr>` : '';

  const thead = isSimple
    ? `<tr><th>Account</th><th>Balance</th><th></th></tr>`
    : `<tr><th>Asset</th><th>Qty</th><th>Avg cost</th><th>Live price</th><th>Current value</th><th>Gain / loss</th><th></th></tr>`;

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap">
      <button class="btn" onclick="closeCategoryDetail()"><i class="ti ti-arrow-left"></i> Back</button>
      <div class="cat-icon" style="background:${color}1a;color:${color}"><i class="ti ${icon}"></i></div>
      <div style="font-size:18px;font-weight:700;flex:1;min-width:0">${TYPE_LABELS[type]||type}</div>
      <button class="btn btn-sm btn-danger" onclick="deleteCategoryHoldings('${type}')" title="Delete all ${TYPE_LABELS[type]||type} holdings">
        <i class="ti ti-trash"></i> Delete all
      </button>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:1.25rem">
      <button class="btn btn-primary" onclick="openAddHoldingModal('${type}')"><i class="ti ti-plus"></i> Add ${TYPE_LABELS[type]||type}</button>
      <button class="btn" onclick="refreshPrices(true)"><i class="ti ti-refresh"></i> Refresh prices</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--surface2);border:1px solid rgba(38,45,61,0.5);border-bottom:none;border-radius:var(--radius) var(--radius) 0 0;font-size:12px;color:var(--text2)">
      <div>${items.length} holding${items.length>1?'s':''}</div>
      <div style="text-align:right">
        <span>${catPct}% of portfolio</span>${!isSimple && catHasPrices ? `<span style="margin-left:10px;font-weight:600;color:${catGain>=0?'var(--green)':'var(--red)'}">${fmt(catGain)} (${fmtPct(catGainPct)})</span>` : ''}
      </div>
    </div>
    <div class="cat-body open">
      <table><thead>${thead}</thead><tbody>${rows}${totalRow}</tbody></table>
    </div>`;
}

// ── Ticker search ──
let tickerSearchTimeout = null;

let hCostMode = 'unit'; // 'unit' = average cost per unit, 'total' = total amount paid

function onHoldingTypeChange(type){
  const isSimple = type==='bank' || type==='cash' || type==='dividend';
  document.getElementById('h-name-wrap').style.display  = (type==='bank'||type==='cash') ? '' : 'none';
  document.getElementById('h-div-stock-wrap').style.display = type==='dividend' ? '' : 'none';
  document.getElementById('h-ticker-wrap').style.display = isSimple ? 'none' : '';
  document.getElementById('h-qty-wrap').style.display    = isSimple ? 'none' : '';
  document.getElementById('h-name-label').textContent    = type==='bank' ? 'Account name' : 'Label';
  document.getElementById('h-name').placeholder          = type==='bank' ? 'e.g. Intesa Sanpaolo' : type==='dividend' ? 'e.g. AAPL Dividends' : 'e.g. Wallet cash';
  if(type==='dividend'){
    document.getElementById('h-div-stock').value = '';
    document.getElementById('h-div-stock-label').textContent = 'Select stock';
    document.getElementById('h-div-stock-trigger').classList.add('placeholder');
  }
  hCostMode = 'unit';
  document.getElementById('h-cost-mode-toggle').style.display = isSimple ? 'none' : '';
  updateCostModeUI();
  clearTickerSelection();
}

function openHDivStockPicker(){
  const current = document.getElementById('h-div-stock').value;
  const stockHoldings = holdings.filter(h=>h.type==='stock');
  const options = stockHoldings.map(h=>({value:h.id, label:h.name||h.ticker, icon:'ti-chart-candle', color:'#6366f1'}));
  if(!options.length){
    showAlert("You don't have any stock holdings yet — add one first, then you can log dividends for it.");
    return;
  }
  openSelectPicker('Select stock', options, current, (val)=>{
    document.getElementById('h-div-stock').value = val;
    const opt = options.find(o=>o.value===val);
    document.getElementById('h-div-stock-label').textContent = opt ? opt.label : 'Select stock';
    document.getElementById('h-div-stock-trigger').classList.toggle('placeholder', !opt);
  });
}

function toggleCostMode(){
  hCostMode = hCostMode==='unit' ? 'total' : 'unit';
  updateCostModeUI();
}

function updateCostModeUI(){
  const label  = document.getElementById('h-cost-label');
  const toggle = document.getElementById('h-cost-mode-toggle');
  const hint   = document.getElementById('h-cost-hint');
  const type   = document.getElementById('h-type').value;
  const isSimple = type==='bank' || type==='cash' || type==='dividend';
  if(type==='dividend'){
    label.textContent  = 'Dividend amount received (€)';
    hint.textContent   = "Each time you add a dividend for this stock, it's added to that stock's running total.";
    hint.style.display = '';
    return;
  }
  if(isSimple){
    label.textContent  = 'Current balance (€)';
    hint.style.display = 'none';
    return;
  }
  if(hCostMode==='unit'){
    label.textContent  = 'Avg cost per unit (€)';
    toggle.textContent = 'Use total cost';
    hint.style.display = 'none';
  } else {
    label.textContent  = 'Total cost paid (€)';
    toggle.textContent = 'Use per-unit cost';
    hint.textContent   = "We'll work out the per-unit cost from the quantity you entered above.";
    hint.style.display = '';
  }
}

function clearTickerSelection(){
  document.getElementById('h-ticker').value = '';
  document.getElementById('h-search').value = '';
  document.getElementById('h-selected-ticker').style.display = 'none';
  document.getElementById('h-search-results').style.display  = 'none';
}

function selectTicker(symbol, name, exchDisp){
  document.getElementById('h-ticker').value = symbol;
  document.getElementById('h-search').value = '';
  document.getElementById('h-selected-label').textContent = `${symbol} — ${name}${exchDisp ? ' ('+exchDisp+')' : ''}`;
  document.getElementById('h-selected-ticker').style.display = 'flex';
  document.getElementById('h-search-results').style.display  = 'none';
}

async function searchCoinGecko(q){
  // Search CoinGecko coins list
  try{
    const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,{signal:AbortSignal.timeout(6000)});
    if(!r.ok) return null;
    const d = await r.json();
    return (d?.coins||[]).slice(0,8).map(c=>({
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      cgId: c.id,
      exch: 'CoinGecko'
    }));
  }catch{ return null; }
}

async function searchYahoo(q){
  // On prod (Cloudflare Workers) we have our own same-origin API route — no CORS proxy needed at all.
  if(APP_ENV==='prod'){
    try{
      const r = await fetch(`/api/yh-search?q=${encodeURIComponent(q)}`, {signal: AbortSignal.timeout(6000)});
      if(!r.ok) return null;
      const d = await r.json();
      return (d?.quotes||[]).filter(x=>x.symbol && x.quoteType!=='CURRENCY').map(r=>({
        symbol: r.symbol,
        name: r.longname||r.shortname||r.symbol,
        exch: r.exchDisp||r.exchange||''
      }));
    }catch{
      return null;
    }
  }

  // Dev / non-Worker environments: fall back to public CORS proxies (best-effort, may be flaky)
  const yhSearch = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=US&quotesCount=8&newsCount=0&enableFuzzyQuery=false&enableCb=false`;
  const proxyFns = [
    u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u=>`https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    u=>`https://thingproxy.freeboard.io/fetch/${u}`,
    u=>`https://cors.eu.org/${u}`,
  ];
  // Race every proxy simultaneously — use whichever responds first with valid data,
  // instead of trying them one-by-one (which wastes time on dead/rate-limited proxies).
  const tryProxy = async (proxyFn) => {
    const r = await fetch(proxyFn(yhSearch), {signal: AbortSignal.timeout(6000)});
    if(!r.ok) throw new Error('not ok');
    const text = await r.text();
    if(!text.startsWith('{')) throw new Error('not json');
    const d = JSON.parse(text);
    const results = (d?.quotes||[]).filter(q=>q.symbol && q.quoteType!=='CURRENCY').map(r=>({
      symbol: r.symbol,
      name: r.longname||r.shortname||r.symbol,
      exch: r.exchDisp||r.exchange||''
    }));
    if(!results.length) throw new Error('no results');
    return results;
  };
  try{
    return await Promise.any(proxyFns.map(fn => tryProxy(fn)));
  }catch{
    return null;
  }
}

async function onTickerSearch(q){
  const box  = document.getElementById('h-search-results');
  const type = document.getElementById('h-type').value;
  clearTimeout(tickerSearchTimeout);
  if(q.trim().length < 2){ box.style.display='none'; return; }
  box.style.display = '';
  box.innerHTML = '<div class="sr-loading">Searching…</div>';
  tickerSearchTimeout = setTimeout(async ()=>{
    try{
      let results = null;
      if(type === 'crypto'){
        // Use CoinGecko for crypto search
        results = await searchCoinGecko(q);
        if(!results||!results.length){ box.innerHTML='<div class="sr-loading">No crypto found — try full name (e.g. "Kaspa")</div>'; return; }
        // Store cgId on the element so selectTicker can register it
        box.innerHTML = results.map(r=>{
          const safeSymbol = r.symbol.replace(/'/g,'\\\'');
          const safeName   = r.name.replace(/'/g,'\\\'');
          const safeCgId   = r.cgId.replace(/'/g,'\\\'');
          return `<div onclick="selectCryptoTicker('${safeSymbol}','${safeName}','${safeCgId}')">
            <span class="sr-ticker">${r.symbol}</span>
            <span class="sr-name">${r.name}</span>
            <span class="sr-exch">CoinGecko</span>
          </div>`;
        }).join('');
      } else {
        // Use Yahoo for stocks/ETFs/bonds
        results = await searchYahoo(q);
        const manualLink = manualTickerLink(q);
        if(!results || !results.length){
          box.innerHTML = `<div class="sr-loading">${results ? 'No results found' : 'Search failed — try again'}</div>` + manualLink;
          return;
        }
        box.innerHTML = results.map(r=>{
          const safeSymbol = r.symbol.replace(/'/g,'\\\'');
          const safeName   = r.name.replace(/'/g,'\\\'');
          const safeExch   = r.exch.replace(/'/g,'\\\'');
          return `<div onclick="selectTicker('${safeSymbol}','${safeName}','${safeExch}')">
            <span class="sr-ticker">${r.symbol}</span>
            <span class="sr-name">${r.name}</span>
            <span class="sr-exch">${r.exch}</span>
          </div>`;
        }).join('') + manualLink;
      }
    }catch(e){
      box.innerHTML = '<div class="sr-loading">Search error</div>' + (type!=='crypto' ? manualTickerLink(q) : '');
    }
  }, 350);
}

// Fallback for when the search API is unavailable/flaky: let the user type a ticker directly.
function manualTickerLink(q){
  const safeQ = (q||'').replace(/'/g,"\\'");
  return `<div onclick="selectManualTicker('${safeQ}')" style="justify-content:center;color:var(--accent);font-weight:600">
    <i class="ti ti-edit" style="font-size:12px;margin-right:4px"></i> Can't find it? Enter ticker manually
  </div>`;
}

async function selectManualTicker(prefill){
  const ticker = await showInputDialog('Enter ticker symbol', 'Type the exact ticker (e.g. AAPL, VWCE.MI):', prefill||'');
  if(ticker===null || !ticker.trim()) return;
  const clean = ticker.trim().toUpperCase();
  selectTicker(clean, clean, 'Manual entry');
}

// For crypto: store cgId so CoinGecko price fetch knows which coin to call
function selectCryptoTicker(symbol, name, cgId){
  // Strip fiat suffix from symbol (BTC-EUR → BTC) and name (Bitcoin EUR → Bitcoin)
  const cleanSymbol = symbol.replace(/[-/](EUR|USD|USDT|USDC|GBP)$/i, '').toUpperCase();
  const cleanName   = name.replace(/\s+(EUR|USD|USDT|USDC|GBP)$/i, '').trim();
  COINGECKO_IDS[cleanSymbol] = cgId;
  selectTicker(cleanSymbol, cleanName, 'Crypto');
}

async function saveHolding(){
  const type=document.getElementById('h-type').value;
  const isSimple = type==='bank' || type==='cash' || type==='dividend';
  const costInput=parseFloat(document.getElementById('h-cost').value)||0;

  if(isSimple){
    if(type==='dividend'){
      const stockId = document.getElementById('h-div-stock').value;
      if(!stockId){ await showAlert('Please select a stock.'); return; }
      const stock = holdings.find(h=>h.id===stockId);
      if(!stock){ await showAlert('Selected stock not found — please pick it again.'); return; }
      if(costInput<=0){ await showAlert('Please enter the dividend amount received.'); return; }
      const stockName = stock.name || stock.ticker;
      const name   = `${stockName} - Dividends`;
      const ticker = `${stock.ticker}_DIV`.toUpperCase();
      const existing = holdings.find(h=>h.ticker===ticker && h.type==='dividend');
      if(existing){
        // Accumulate: each dividend logged adds to the running total for this stock, never overwrites it.
        const newBalance = (existing.avg_cost||0) + costInput;
        await api(`holdings?id=eq.${existing.id}`,{method:'PATCH',body:JSON.stringify({avg_cost:newBalance, name})});
      } else {
        await api('holdings',{method:'POST',body:JSON.stringify({ticker, name, type, qty:1, avg_cost:costInput})});
      }
      closeModal('modal-holding'); await loadAll(); toast('Dividend recorded ✓'); refreshPrices(true, true);
      return;
    }
    const name=document.getElementById('h-name').value.trim();
    if(!name){ await showAlert('Please enter an account name.'); return; }
    if(costInput<=0){ await showAlert('Please enter the current balance.'); return; }
    const avg_cost = costInput;
    const ticker = name.toUpperCase().replace(/\s+/g,'_').slice(0,30);
    const existing = holdings.find(h=>h.ticker===ticker);
    if(existing){
      await api(`holdings?id=eq.${existing.id}`,{method:'PATCH',body:JSON.stringify({avg_cost, qty:1, name})});
    } else {
      await api('holdings',{method:'POST',body:JSON.stringify({ticker, name, type, qty:1, avg_cost})});
    }
  } else {
    const ticker=document.getElementById('h-ticker').value.trim().toUpperCase();
    const qty=parseFloat(document.getElementById('h-qty').value)||0;
    const selectedLabel=document.getElementById('h-selected-label').textContent;
    // extract name from selected label (format: "TICKER — Name (Exch)")
    const namePart = selectedLabel.includes(' — ') ? selectedLabel.split(' — ')[1].replace(/\s*\(.*\)$/,'').trim() : ticker;
    if(!ticker){ await showAlert('Please search and select an asset first.'); return; }
    if(qty<=0){ await showAlert('Please enter a quantity.'); return; }
    if(costInput<=0){ await showAlert(hCostMode==='total' ? 'Please enter the total cost paid.' : 'Please enter the average cost per unit.'); return; }
    // If the person entered a TOTAL cost, convert it to a per-unit cost before storing —
    // avg_cost is always stored per-unit in the database.
    const avg_cost = hCostMode==='total' ? costInput/qty : costInput;
    const existing=holdings.find(h=>h.ticker===ticker);
    // Duplicate check: warn if ticker already exists as a different type
    const existingDiff=holdings.find(h=>h.ticker===ticker&&h.type!==type);
    if(existingDiff&&!existing){ if(!await showConfirm(`Ticker ${ticker} already exists as ${TYPE_LABELS[existingDiff.type]}. Add anyway?`)) return; }
    if(existing){
      const totalCost=existing.qty*existing.avg_cost+qty*avg_cost;
      const newQty=existing.qty+qty;
      await api(`holdings?id=eq.${existing.id}`,{method:'PATCH',body:JSON.stringify({qty:newQty,avg_cost:totalCost/newQty})});
    } else {
      await api('holdings',{method:'POST',body:JSON.stringify({ticker,name:namePart||ticker,type,qty,avg_cost})});
    }
  }
  closeModal('modal-holding'); await loadAll(); toast('Holding saved ✓'); refreshPrices(true, true);
}

async function renameHolding(id, currentName){
  // Use a custom inline modal for text input
  const newName = await showInputDialog('Rename holding', 'Enter new name:', currentName);
  if(newName===null||!newName.trim()) return;
  await api(`holdings?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({name:newName.trim()})});
  await loadAll(); toast('Holding renamed ✓');
}

function showInputDialog(title, label, defaultVal=''){
  return new Promise(resolve=>{
    // Temporarily add input to dialog
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-title').style.display = '';
    document.getElementById('dialog-message').innerHTML =
      `<div style="margin-bottom:8px;font-size:13px;color:var(--text2)">${label}</div>
       <input type="text" id="dialog-input" value="${defaultVal.replace(/"/g,'&quot;')}" inputmode="decimal"
         style="width:100%;padding:9px 11px;border:1px solid var(--border2);border-radius:var(--radius-sm);background:var(--surface2);color:var(--text);font-family:inherit;font-size:14px;box-sizing:border-box">`;
    const footer = document.getElementById('dialog-footer');
    footer.innerHTML = '';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn'; cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = ()=>{ closeModal('modal-dialog'); resolve(null); };
    const okBtn = document.createElement('button');
    okBtn.className = 'btn btn-primary'; okBtn.textContent = 'Save';
    okBtn.onclick = ()=>{ const v=document.getElementById('dialog-input')?.value; closeModal('modal-dialog'); resolve(v||null); };
    footer.appendChild(cancelBtn); footer.appendChild(okBtn);
    openModal('modal-dialog');
    setTimeout(()=>document.getElementById('dialog-input')?.select(), 50);
  });
}

async function editBalance(id, name, currentBalance){
  const input = await showInputDialog('Edit balance', name, currentBalance.toFixed(2));
  if(input===null||input.trim()==='') return;
  const newBalance = parseFloat(input.replace(',','.'));
  if(isNaN(newBalance)||newBalance<0){ await showAlert('Please enter a valid positive amount.'); return; }
  await api(`holdings?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({avg_cost:newBalance})});
  await loadAll(); toast('Balance updated ✓');
}


async function deleteHolding(id){
  const linkedTxCount = cfTransactions.filter(t=>t.holding_id===id||t.holding_to_id===id).length;
  const msg = linkedTxCount>0
    ? `This holding has ${linkedTxCount} linked transaction${linkedTxCount>1?'s':''}.\n\nDeleting it will also delete all those transactions and reverse their balance changes.\n\nProceed?`
    : 'Remove this holding?';
  if(!await showConfirm(msg,'Delete holding', true)) return;
  // Cascade: reverse balance + delete all linked transactions first
  const linkedTxs = cfTransactions.filter(t=>t.holding_id===id||t.holding_to_id===id);
  for(const t of linkedTxs){
    const reverseType = t.type==='expense'?'income':t.type==='income'?'expense':t.type;
    await applyBalanceChange(reverseType, Number(t.amount), t.holding_id||null, t.holding_to_id||null);
    await api(`cashflow_transactions?id=eq.${t.id}`,{method:'DELETE'});
  }
  await api(`holdings?id=eq.${id}`,{method:'DELETE'});
  await loadAll();
  cfTransactions = await api('cashflow_transactions?order=date.desc');
  renderCashflow();
  toast('Holding and transactions deleted');
}

async function deleteCategoryHoldings(type){
  const catHoldings = holdings.filter(h=>h.type===type);
  if(!catHoldings.length) return;
  const totalTxCount = cfTransactions.filter(t=>catHoldings.some(h=>h.id===t.holding_id||h.id===t.holding_to_id)).length;
  const msg = `Delete all ${TYPE_LABELS[type]||type} holdings (${catHoldings.length})?`
    + (totalTxCount>0 ? `\n\nThis will also delete ${totalTxCount} linked transaction${totalTxCount>1?'s':''} and reverse their balance changes.` : '')
    + '\n\nThis cannot be undone.';
  if(!await showConfirm(msg, 'Delete category', true)) return;
  // Cascade delete: transactions first, then holdings
  for(const h of catHoldings){
    const linkedTxs = cfTransactions.filter(t=>t.holding_id===h.id||t.holding_to_id===h.id);
    for(const t of linkedTxs){
      const reverseType = t.type==='expense'?'income':t.type==='income'?'expense':t.type;
      await applyBalanceChange(reverseType, Number(t.amount), t.holding_id||null, t.holding_to_id||null);
      await api(`cashflow_transactions?id=eq.${t.id}`,{method:'DELETE'});
    }
    await api(`holdings?id=eq.${h.id}`,{method:'DELETE'});
  }
  await loadAll();
  cfTransactions = await api('cashflow_transactions?order=date.desc');
  renderCashflow();
  toast(`${TYPE_LABELS[type]||type} holdings deleted`);
}

// ── TRANSACTIONS ──
const TX_COLORS={buy:'var(--green)',sell:'var(--red)',dividend:'var(--blue)',transfer:'var(--text2)'};

function renderTx(){
  const filtered=txFilter==='all'?transactions:transactions.filter(t=>t.type===txFilter);
  const empty=document.getElementById('tx-empty'), table=document.getElementById('tx-table'), tbody=document.getElementById('tx-tbody');
  if(!empty||!table||!tbody) return; // old tx page removed
  if(!filtered.length){empty.style.display='';table.style.display='none';return;}
  empty.style.display='none'; table.style.display='';
  tbody.innerHTML=filtered.map(t=>`<tr>
    <td style="color:var(--text2)">${t.date||'—'}</td>
    <td><strong style="font-weight:600">${t.ticker}</strong><br><span style="color:var(--text2);font-size:12px">${t.name||''}</span></td>
    <td><span style="color:${TX_COLORS[t.type]||'var(--text2)'};font-weight:600;text-transform:capitalize">${t.type}</span></td>
    <td>${t.qty?fmtN(t.qty):'—'}</td>
    <td>${t.price?fmt(t.price):'—'}</td>
    <td style="font-weight:600">${t.total?fmt(t.total):'—'}</td>
    <td><button class="btn btn-sm btn-danger" onclick="deleteTx('${t.id}')"><i class="ti ti-trash"></i></button></td>
  </tr>`).join('');
}

async function saveTx(){
  const ticker=document.getElementById('tx-ticker').value.trim().toUpperCase();
  if(!ticker){await showAlert('Please enter a ticker.');return;}
  const row={
    date:document.getElementById('tx-date').value,
    type:document.getElementById('tx-type').value,
    ticker, name:document.getElementById('tx-name').value.trim()||ticker,
    qty:parseFloat(document.getElementById('tx-qty').value)||null,
    price:parseFloat(document.getElementById('tx-price').value)||null,
    notes:document.getElementById('tx-notes').value.trim()||null
  };
  row.total=(row.qty&&row.price)?row.qty*row.price:null;
  await api('transactions',{method:'POST',body:JSON.stringify(row)});
  closeModal('modal-tx'); await loadAll(); toast('Transaction saved ✓');
}

async function deleteTx(id){
  if(!await showConfirm('Remove this transaction?')) return;
  await api(`transactions?id=eq.${id}`,{method:'DELETE'}); await loadAll(); toast('Transaction removed');
}

function setFilter(f,btn){
  txFilter=f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderTx();
}

// ── PRICES ──
// CoinGecko symbol/ticker → coin ID map (runtime, extended on search selection)
const COINGECKO_IDS = {
  'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','BNB':'binancecoin',
  'XRP':'ripple','ADA':'cardano','AVAX':'avalanche-2','DOT':'polkadot',
  'DOGE':'dogecoin','SHIB':'shiba-inu','MATIC':'matic-network','LINK':'chainlink',
  'UNI':'uniswap','LTC':'litecoin','BCH':'bitcoin-cash','ATOM':'cosmos',
  'XLM':'stellar','ALGO':'algorand','VET':'vechain','FIL':'filecoin',
  'ICP':'internet-computer','APT':'aptos','ARB':'arbitrum','OP':'optimism',
  'INJ':'injective-protocol','SUI':'sui','TIA':'celestia','SEI':'sei-network',
  'KAS':'kaspa','NEAR':'near','FTM':'fantom','SAND':'the-sandbox',
  'MANA':'decentraland','AXS':'axie-infinity','GRT':'the-graph',
  'AAVE':'aave','MKR':'maker','CRV':'curve-dao-token','SNX':'havven',
  'COMP':'compound-governance-token','YFI':'yearn-finance','SUSHI':'sushi',
  'PEPE':'pepe','WIF':'dogwifcoin','BONK':'bonk','FLOKI':'floki',
  'TON':'the-open-network','NOT':'notcoin','TRUMP':'maga',
};

// Resolve ticker → CoinGecko ID.
// Ticker may be the raw symbol (e.g. KAS) or whatever Yahoo would use.
// selectCryptoTicker() always registers the correct cgId at selection time.
function cgIdForTicker(ticker){
  // Direct match first (set at search-select time or from built-in map)
  if(COINGECKO_IDS[ticker]) return COINGECKO_IDS[ticker];
  // Strip common suffixes: BTC-EUR → BTC, KASUSDT → KAS
  const base = ticker.replace(/[-/](EUR|USD|USDT|USDC|BTC|ETH)$/i,'')
                      .replace(/(EUR|USD|USDT|USDC)$/i,'').toUpperCase();
  return COINGECKO_IDS[base] || null;
}

// Fetch prices for ALL crypto holdings in one CoinGecko batch call
async function fetchAllCryptoPrices(tickers){
  const cgIds = [...new Set(tickers.map(t=>cgIdForTicker(t)).filter(Boolean))];
  if(!cgIds.length) return {};
  try{
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cgIds.join(',')}&vs_currencies=eur`;
    const r = await fetch(url, {signal: AbortSignal.timeout(10000)});
    if(!r.ok) throw new Error('CoinGecko HTTP ' + r.status);
    const data = await r.json();
    // Build ticker → price map
    const result = {};
    tickers.forEach(t=>{
      const id = cgIdForTicker(t);
      if(id && data[id]?.eur != null) result[t] = data[id].eur;
    });
    return result;
  }catch(e){
    console.warn('CoinGecko batch fetch failed:', e.message);
    return {};
  }
}

// Yahoo Finance via CORS proxy for stocks/ETFs/bonds
// Low-level: fetch the raw price + currency for any Yahoo ticker (a stock, or an FX pair like 'EURUSD=X')
async function fetchYahooRaw(ticker){
  if(APP_ENV==='prod'){
    try{
      const r = await fetch(`/api/yh-price?ticker=${encodeURIComponent(ticker)}`, {signal: AbortSignal.timeout(5000)});
      if(!r.ok) throw new Error('not ok');
      const d = await r.json();
      const meta = d?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      if(price == null) throw new Error('no price');
      return { price, currency: meta?.currency || 'USD' };
    }catch{
      return null;
    }
  }

  // Dev / non-Worker environments: fall back to public CORS proxies (best-effort, may be flaky)
  const yhUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const proxyFns = [
    u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u=>`https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    u=>`https://thingproxy.freeboard.io/fetch/${u}`,
    u=>`https://cors.eu.org/${u}`,
  ];
  // Race all proxies simultaneously — use whichever responds first with valid data
  const tryProxy = async (proxyFn) => {
    const r = await fetch(proxyFn(yhUrl), {signal: AbortSignal.timeout(3000)});
    if(!r.ok) throw new Error('not ok');
    const text = await r.text();
    if(!text.startsWith('{')) throw new Error('not json');
    const d = JSON.parse(text);
    const meta = d?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if(price == null) throw new Error('no price');
    return { price, currency: meta?.currency || 'USD' };
  };
  try{
    return await Promise.any(proxyFns.map(fn => tryProxy(fn)));
  }catch{
    return null;
  }
}

// Cache of EUR conversion rates for the current refresh cycle — several holdings often
// share the same currency (e.g. multiple USD stocks), so we only fetch each rate once.
let fxRateCache = {};
async function getEurConversionRate(currency){
  if(!currency || currency==='EUR') return 1;
  if(fxRateCache[currency] != null) return fxRateCache[currency];
  const raw = await fetchYahooRaw(`EUR${currency}=X`);
  fxRateCache[currency] = raw?.price || null;
  return fxRateCache[currency];
}

// Public: fetch a stock/ETF/bond price, converted to EUR if it's quoted in another currency
async function fetchYahooPrice(ticker){
  const raw = await fetchYahooRaw(ticker);
  if(!raw){
    console.warn(`Yahoo: could not fetch price for ${ticker}`);
    return null;
  }
  if(!raw.currency || raw.currency==='EUR') return raw.price;
  const rate = await getEurConversionRate(raw.currency);
  if(!rate){
    console.warn(`Yahoo: could not fetch ${raw.currency}→EUR rate — showing ${ticker} in its native currency`);
    return raw.price;
  }
  return raw.price / rate;
}

const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let lastPriceFetch = 0;

async function refreshPrices(force=false, silent=false){
  const investable = holdings.filter(h=>!['bank','cash','dividend'].includes(h.type));
  if(!investable.length){ renderHoldings(); return; }

  // Use cached prices if fresh enough and not forced
  const now = Date.now();
  if(!force && now - lastPriceFetch < PRICE_CACHE_TTL && Object.keys(prices).length > 0){
    renderHoldings(); renderOverview(); renderAllocation();
    return;
  }

  fxRateCache = {}; // fetch fresh exchange rates this cycle

  const hBtn = document.getElementById('h-refresh-btn');
  const loadHTML = '<span class="spin"></span> Loading…';
  if(hBtn){ hBtn.innerHTML = loadHTML; hBtn.disabled = true; }

  const cryptoTickers    = [...new Set(investable.filter(h=>h.type==='crypto').map(h=>h.ticker))];
  const nonCryptoTickers = [...new Set(investable.filter(h=>h.type!=='crypto').map(h=>h.ticker))];

  // Fire crypto (1 batch) and all Yahoo requests simultaneously
  const [cryptoPrices] = await Promise.all([
    fetchAllCryptoPrices(cryptoTickers),
    Promise.all(nonCryptoTickers.map(async t=>{
      const p = await fetchYahooPrice(t);
      if(p != null) prices[t] = p;
    }))
  ]);
  Object.assign(prices, cryptoPrices);
  lastPriceFetch = Date.now();

  const timeStr = new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  if(hBtn){ hBtn.innerHTML = '<i class="ti ti-refresh"></i> Refresh prices'; hBtn.disabled = false; }
  document.getElementById('refresh-info').textContent = 'Updated ' + timeStr;
  renderHoldings(); renderOverview(); renderAllocation();

  const allTickers = [...cryptoTickers, ...nonCryptoTickers];
  const fetched = allTickers.filter(t=>prices[t]!=null).length;
  const failed  = allTickers.filter(t=>prices[t]==null).length;
  if(!silent){
    if(fetched===0) toast('⚠️ Could not load any prices');
    else if(failed>0) toast(`Prices updated — ${failed} ticker(s) unavailable`);
    else toast(`✓ All ${fetched} price${fetched>1?'s':''} updated`);
  }
}

// ── OVERVIEW ──
