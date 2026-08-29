async function loadLocalEnv() {
  try {
    const res = await fetch('/env.json', { cache: 'no-store' }); 

    if (!res.ok) {
      console.warn(`[env.json] Failed to load: Status ${res.status}`);
      return {};
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[env.json] Could not parse JSON file:', err);
    return {};
  }
}

const localEnv = await loadLocalEnv();


// Cloudflare Worker URL
export const CF_WORKER_PROXY = localEnv.CF_WORKER_PROXY;

export const SUPABASE_URL = 
  localEnv.VITE_SUPABASE_URL ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://lwkkuoauvvfrwboasxbi.supabase.co';

export const SUPABASE_KEY = 
  localEnv.VITE_SUPABASE_KEY ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3a2t1b2F1dnZmcndib2FzeGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTQ3MzksImV4cCI6MjEwMDg5MDczOX0.Lg_pCz7gG3Qa5pfZgDmhzjn2fiHz7EUuT85O5SFXb54';

// Was missing entirely — insights.js (restoreSnapshot) imports APP_SECRET
// from this file, and a missing named export is a hard SyntaxError in
// native ES modules, which breaks the whole import chain, not just this file.
export const APP_SECRET =
  localEnv.VITE_APP_SECRET ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_SECRET) ||
  'zW32WdZ6sjemsWkQqXUc4Fvfa6TxtvIq6H63FsKYdzc';

export const APP_ENV = localEnv.VITE_APP_ENV || 'dev';

export const TYPE_LABELS = { bank: 'Bank', bond: 'Bond', cash: 'Cash', crypto: 'Crypto', dividend: 'Dividends', etf: 'ETF', fund: 'Fund', stock: 'Stock' };
export const TYPE_ICONS  = { bank: 'ti-building-bank', bond: 'ti-certificate', cash: 'ti-cash', crypto: 'ti-currency-bitcoin', dividend: 'ti-coin', etf: 'ti-trending-up', fund: 'ti-chart-pie', stock: 'ti-chart-candle' };
export const TYPE_COLORS = { bank: '#0ea5e9', bond: '#ec4899', cash: '#84cc16', crypto: '#f59e0b', dividend: '#60a8f5', etf: '#10b981', fund: '#8b5cf6', stock: '#6366f1' };
export const PALETTE     = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#f97316', '#8b5cf6', '#06b6d4', '#a3e635'];

export const H_TYPE_OPTIONS = [
  { value: 'bank',     label: 'Bank account',       icon: TYPE_ICONS.bank,     color: TYPE_COLORS.bank },
  { value: 'bond',     label: 'Bond / Fixed income',icon: TYPE_ICONS.bond,     color: TYPE_COLORS.bond },
  { value: 'cash',     label: 'Cash',               icon: TYPE_ICONS.cash,     color: TYPE_COLORS.cash },
  { value: 'crypto',   label: 'Crypto',             icon: TYPE_ICONS.crypto,   color: TYPE_COLORS.crypto },
  { value: 'dividend', label: 'Dividends',          icon: TYPE_ICONS.dividend, color: TYPE_COLORS.dividend },
  { value: 'etf',      label: 'ETF',                icon: TYPE_ICONS.etf,      color: TYPE_COLORS.etf },
  { value: 'fund',     label: 'Investment Fund',    icon: TYPE_ICONS.fund,     color: TYPE_COLORS.fund },
  { value: 'stock',    label: 'Stock',              icon: TYPE_ICONS.stock,    color: TYPE_COLORS.stock }
];

export const DEFAULT_CASHFLOW_CATEGORIES=[
  {name:'Food & Dining',icon:'ti-tools-kitchen-2',color:'#f59e0b'},
  {name:'Transport',icon:'ti-car',color:'#3b82f6'},
  {name:'Bills & Utilities',icon:'ti-file-invoice',color:'#6366f1'},
  {name:'Health',icon:'ti-heart-rate-monitor',color:'#ec4899'},
  {name:'Entertainment',icon:'ti-device-tv',color:'#8b5cf6'},
  {name:'Shopping',icon:'ti-shopping-bag',color:'#f97316'},
  {name:'Salary',icon:'ti-briefcase',color:'#10b981'},
  {name:'Investment',icon:'ti-trending-up',color:'#0ea5e9'},
];

export const EXTRA_CASHFLOW_CATEGORIES = [
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

export const CF_FREQ_OPTIONS = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly' }
];

export function initAppEnv() {
  if (APP_ENV === 'dev') {
    console.log('Development version...');

    const envBadge = document.getElementById('env-badge');
    if (envBadge) envBadge.style.display = 'inline-block';
    document.title = 'Financial Hub · DEV';
  }
  else if (APP_ENV === 'prod')
  {
    console.log('Production version...');
  }

  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif";
    Chart.defaults.font.size = 11;
  }
}