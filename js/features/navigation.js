import { state } from '../state.js';
import { exposeLegacyFunctions } from '../utils/legacy.js';

export function scrollToTop() {
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function showPage(name, btn) {
  localStorage.setItem('fh_page', name);
  document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
  const mobilePageMap = { overview: 'overview', holdings: 'holdings', cashflow: 'cashflow', insights: 'rpt-insights', reports: 'rpt-insights', settings: 'settings' };
  const mobileTarget = mobilePageMap[name] || name;
  const mobileBtn = document.querySelector(`.bottom-tab[data-page="${mobileTarget}"]`);
  if (mobileBtn) mobileBtn.classList.add('active');

  ['mobile-subnav-insights', 'mobile-subnav-insights2'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.toggle('active', name === 'insights'); });
  ['mobile-subnav-reports', 'mobile-subnav-reports2'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.toggle('active', name === 'reports'); });

  document.querySelectorAll('.cat-header.open').forEach(h => {
    h.classList.remove('open');
    h.nextElementSibling.classList.remove('open');
    h.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');

  if (name !== 'insights' && name !== 'reports') requestAnimationFrame(scrollToTop);
  if (btn) {
    btn.classList.add('active');
  } else {
    document.querySelectorAll('.nav-item').forEach(b => {
      if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + name + "'")) b.classList.add('active');
    });
  }

  if (name === 'overview') window.renderOverview?.();
  document.body.className = document.body.className.replace(/page-\w+/g, '').trim();
  document.body.classList.add('page-' + name);

  if (name === 'insights') {
    requestAnimationFrame(() => {
      window.renderAllocation?.(); window.renderInsights?.();
      scrollToTop();
      setTimeout(() => { scrollToTop(); }, 120);
    });
  }
  if (name === 'cashflow') {
    const cfForm = document.getElementById('cf-form');
    const cfFab = document.getElementById('cf-fab');
    if (cfForm && cfForm.style.display !== 'none') { window.showCfMain?.(); }
    else { window.renderCashflow?.(); if (cfFab) cfFab.style.display = ''; }
  }
  if (name !== 'cashflow' && state.bulkSelectMode) {
    state.bulkSelectMode = false; state.selectedTxIds.clear();
    const bt = document.getElementById('cf-bulk-toggle');
    if (bt) { bt.style.background = ''; bt.innerHTML = '<i class="ti ti-checkbox"></i> Select'; }
    document.getElementById('bulk-toolbar')?.classList.remove('open');
  }
  if (name !== 'cashflow') { state.cfOpenTypes.clear(); }
  if (name !== 'holdings') { window.closeCategoryDetail?.(); }
  if (name === 'settings') { window.showSettingsMain?.(); }
  if (name === 'reports') { window.renderReports?.(); requestAnimationFrame(() => { scrollToTop(); setTimeout(scrollToTop, 80); }); }
  if (name !== 'cashflow') { const fab = document.getElementById('cf-fab'); if (fab) fab.style.display = 'none'; }
}

// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions({
  scrollToTop,
  showPage
});