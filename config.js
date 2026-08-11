const SUPABASE_URL = 'https://lwkkuoauvvfrwboasxbi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3a2t1b2F1dnZmcndib2FzeGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTQ3MzksImV4cCI6MjEwMDg5MDczOX0.Lg_pCz7gG3Qa5pfZgDmhzjn2fiHz7EUuT85O5SFXb54';
const APP_ENV = 'dev'; // 'dev' shows a DEV badge in the header · set to 'prod' for the production copy
if(APP_ENV==='dev'){
  const envBadge=document.getElementById('env-badge');
  if(envBadge) envBadge.style.display='inline-block';
  document.title = 'Financial Hub · DEV';
}

const APP_SECRET = 'zW32WdZ6sjemsWkQqXUc4Fvfa6TxtvIq6H63FsKYdzc'; // sent on every Supabase call; RLS policies require this header to match

const api = (path, opts={}) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
  headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`, 'Content-Type':'application/json', Prefer:'return=representation', 'X-App-Secret':APP_SECRET, ...opts.headers },
  ...opts
}).then(r=>r.json());

let holdings=[], transactions=[], prices={}, snapshots=[], txFilter='all', activePeriod=30;
let trendChart, liquidityChart, monthlyChart, yearlyIncomeChart, yearlyOutcomeChart, savingsChart, investedChart;
// Use app font in all Chart.js charts
if(typeof Chart!=='undefined'){
  Chart.defaults.font.family="'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif";
  Chart.defaults.font.size=11;
}

const TYPE_LABELS = {bank:'Bank',bond:'Bond',cash:'Cash',crypto:'Crypto',dividend:'Dividends',etf:'ETF',stock:'Stock'};
const TYPE_ICONS  = {bank:'ti-building-bank',bond:'ti-certificate',cash:'ti-cash',crypto:'ti-currency-bitcoin',dividend:'ti-coin',etf:'ti-trending-up',stock:'ti-chart-candle'};
const PALETTE = ['#6366f1','#10b981','#f59e0b','#ec4899','#0ea5e9','#84cc16','#f97316','#8b5cf6','#06b6d4','#a3e635'];
