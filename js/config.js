export const SUPABASE_URL = 'https://lwkkuoauvvfrwboasxbi.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3a2t1b2F1dnZmcndib2FzeGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTQ3MzksImV4cCI6MjEwMDg5MDczOX0.Lg_pCz7gG3Qa5pfZgDmhzjn2fiHz7EUuT85O5SFXb54';
export const APP_ENV = 'dev';
export const APP_SECRET = 'zW32WdZ6sjemsWkQqXUc4Fvfa6TxtvIq6H63FsKYdzc';

export const TYPE_LABELS = { bank: 'Bank', bond: 'Bond', cash: 'Cash', crypto: 'Crypto', dividend: 'Dividends', etf: 'ETF', stock: 'Stock' };
export const TYPE_ICONS  = { bank: 'ti-building-bank', bond: 'ti-certificate', cash: 'ti-cash', crypto: 'ti-currency-bitcoin', dividend: 'ti-coin', etf: 'ti-trending-up', stock: 'ti-chart-candle' };
export const PALETTE     = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#f97316', '#8b5cf6', '#06b6d4', '#a3e635'];

export const H_TYPE_OPTIONS = [
  { value: 'bank',     label: 'Bank account',       icon: 'ti-building-bank',   color: '#0ea5e9' },
  { value: 'bond',     label: 'Bond / Fixed income',icon: 'ti-certificate',     color: '#ec4899' },
  { value: 'cash',     label: 'Cash',               icon: 'ti-cash',            color: '#84cc16' },
  { value: 'crypto',   label: 'Crypto',             icon: 'ti-currency-bitcoin',color: '#f59e0b' },
  { value: 'dividend', label: 'Dividends',          icon: 'ti-coin',            color: '#60a8f5' },
  { value: 'etf',      label: 'ETF',                icon: 'ti-trending-up',     color: '#10b981' },
  { value: 'stock',    label: 'Stock',              icon: 'ti-chart-candle',    color: '#6366f1' }
];

export const CF_FREQ_OPTIONS = [
  { value: 'daily',   label: 'Daily' },
  { value: 'weekly',  label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly' }
];

export function initAppEnv() {
  if (APP_ENV === 'dev') {
    const envBadge = document.getElementById('env-badge');
    if (envBadge) envBadge.style.display = 'inline-block';
    document.title = 'Financial Hub · DEV';
  }
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif";
    Chart.defaults.font.size = 11;
  }
}