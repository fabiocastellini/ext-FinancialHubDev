import { state } from '../state.js';
import { exposeLegacyFunctions } from '../utils/legacy.js';


export function cleanCryptoTicker(ticker) { return ticker.replace(/[-/](EUR|USD|USDT|USDC|GBP)$/i, '').toUpperCase(); }
export function cleanCryptoName(name) { return name.replace(/\s+(EUR|USD|USDT|USDC|GBP)$/i, '').trim(); }

export function getVal(h) {
  const cleanT = h.type === 'crypto' ? cleanCryptoTicker(h.ticker) : h.ticker;
  const price = state.prices[cleanT] ?? state.prices[h.ticker];
  return (price != null ? price : h.avg_cost) * h.qty;
}

export function getCost(h) { return h.avg_cost * h.qty; }
export function getGain(h) { return getVal(h) - getCost(h); }
export function getGainPct(h) { const c = getCost(h); return c > 0 ? (getGain(h) / c) * 100 : 0; }


// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions({
  cleanCryptoTicker,
  cleanCryptoName,
  getVal,
  getCost,
  getGain,
  getGainPct,
});