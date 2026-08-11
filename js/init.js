// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
// New session (new tab) → always start on Overview
// Page reload (F5) → stay on current page
const isReload = sessionStorage.getItem('fh_loaded');
sessionStorage.setItem('fh_loaded', '1');
const lastPage = isReload ? (localStorage.getItem('fh_page')||'overview') : 'overview';
const matchingBtn=[...document.querySelectorAll('.nav-item')].find(b=>b.getAttribute('onclick')&&b.getAttribute('onclick').includes("'"+lastPage+"'"));
showPage(lastPage,matchingBtn);
// Disable browser scroll restoration — we manage it ourselves
if('scrollRestoration' in history) history.scrollRestoration='manual';

(async ()=>{
  await loadAll(true);        // fetch data, don't render yet
  await refreshPrices(true, true); // fetch fresh prices silently
  refreshHoldingsViews(); renderTx(); renderOverview(); // single render, once prices are ready — avoids the net-worth flicker
  loadCashflow();
})();
// Register PWA service worker
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(e=>console.log('SW:',e));
}
// Lock to portrait on PWA/mobile
if(screen.orientation&&screen.orientation.lock){
  screen.orientation.lock('portrait').catch(()=>{});
}
// Footer timestamp
function updateFooterTime(){
  const el=document.getElementById('footer-time');
  if(el) el.textContent='Last updated: '+new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' — '+new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'})+' CET';
  const dt=document.getElementById('topbar-date');
  if(dt){
    const now=new Date();
    const day=now.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',timeZone:'Europe/Rome'});
    const time=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'});
    dt.textContent=day+' · '+time;
  }
}
updateFooterTime();
setInterval(updateFooterTime,60000);
