// ─────────────────────────────────────────────
// Financial Hub — Application Entry Point
// ─────────────────────────────────────────────

import { exposeLegacyFunctions } from './utils/legacy.js';
import { initAppEnv } from './config.js';
import { api } from './api.js';
import { state } from './state.js';
import { getVal } from './utils/calculations.js';
import { showPage } from './features/navigation.js';
import { showMobileRptInsights } from './settings.js'

// Components
import './components/modal.js';
import './components/date-picker.js';
import './components/select-picker.js';

// Features
import './features/navigation.js';
import './features/overview.js';
import './data/holdings.js';
import './features/cashflow.js';
import './features/investments.js';
import './features/insights.js';
import './features/export.js';

// Settings
import './settings.js';

// ─────────────────────────────────────────────
// Data loading
// ─────────────────────────────────────────────

export async function loadAll(deferRender = false) {
  [
    state.holdings,
    state.transactions,
    state.snapshots
  ] = await Promise.all([
    api('holdings?order=sort_order.asc,created_at.asc')
      .catch(() =>
        api('holdings?order=created_at.asc')
      ),

    api('transactions?order=created_at.desc'),

    api('net_worth_snapshots?order=snapshot_date.asc')
  ]);

  await maybeTakeSnapshot();

  if (!deferRender) {
    window.refreshHoldingsViews?.();
    window.renderTx?.();
    window.renderOverview?.();
  }

  const txDate = document.getElementById('tx-date');

  if (txDate) {
    txDate.value = new Date()
      .toISOString()
      .split('T')[0];
  }
}


// ─────────────────────────────────────────────
// Net worth snapshots
// ─────────────────────────────────────────────

export async function maybeTakeSnapshot() {
  const today = new Date()
    .toISOString()
    .split('T')[0];

  const alreadyToday = state.snapshots.some(
    snapshot => snapshot.snapshot_date === today
  );

  if (alreadyToday || !state.holdings.length) {
    return;
  }

  const totalVal = state.holdings.reduce(
    (sum, holding) => sum + getVal(holding),
    0
  );

  if (totalVal === 0) {
    return;
  }

  const row = await api(
    'net_worth_snapshots',
    {
      method: 'POST',
      body: JSON.stringify({
        snapshot_date: today,
        total_value: totalVal
      })
    }
  );

  if (Array.isArray(row) && row[0]) {
    state.snapshots.push(row[0]);
  }
}


// ─────────────────────────────────────────────
// Application initialization
// ─────────────────────────────────────────────

async function initApp() {
  console.log('Financial Hub initializing...');

  // Environment / DEV badge
  initAppEnv();

  // Overlay click-to-close
  document
    .querySelectorAll('.overlay')
    .forEach(overlay => {
      overlay.addEventListener('click', event => {
        if (event.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });

  // Load application data
  try {
    await loadAll();
  } catch (error) {
    console.error(
      'Failed to initialize Financial Hub:',
      error
    );
  }
}


// ─────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    initApp,
    { once: true }
  );
} else {
  initApp();
}

// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions({
  loadAll,
  maybeTakeSnapshot
});