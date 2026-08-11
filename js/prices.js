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
