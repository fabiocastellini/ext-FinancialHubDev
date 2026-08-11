// ─────────────────────────────────────────
// SNAPSHOTS & RESTORE
// ─────────────────────────────────────────
async function loadSnapshots(){
  const el = document.getElementById('snapshots-list'); if(!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:0.5rem 0"><span class="spin" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:6px"></span>Loading…</div>';
  try{
    const snaps = await api('data_snapshots?order=created_at.desc&limit=30&select=id,snapshot_date,net_worth,created_at');
    if(!snaps||!snaps.length){
      el.innerHTML='<div style="color:var(--text3);font-size:13px;padding:0.5rem 0">No snapshots yet — the Edge Function will create one tonight at 23:59.</div>';
      return;
    }
    el.innerHTML = snaps.map(s=>{
      const date = new Date(s.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'});
      return `<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">
        <i class="ti ti-database" style="color:var(--accent);font-size:16px;flex-shrink:0"></i>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${s.snapshot_date}</div>
          <div style="font-size:11px;color:var(--text2);">${date} · Net worth: ${fmt(s.net_worth)}</div>
        </div>
        <button class="btn btn-sm" onclick="restoreSnapshot('${s.id}','${s.snapshot_date}')">
          <i class="ti ti-history"></i> Restore
        </button>
      </div>`;
    }).join('');
  }catch(e){
    el.innerHTML=`<div style="color:var(--red);font-size:13px">Failed to load snapshots: ${e.message}</div>`;
  }
}

async function restoreSnapshot(id, date){
  if(!await showConfirm(`Restore to snapshot from ${date}?\n\nThis will REPLACE all current data. This cannot be undone.\n\nProceed?`)) return;
  showSnapshotStatus('<span class="spin" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Restoring from '+date+'…', 'info');
  try{
    // Step 1: Fetch snapshot JSON FIRST — before touching any data
    const rows = await api(`data_snapshots?id=eq.${id}&select=snapshot_json`);
    if(!rows||!rows[0]) throw new Error('Snapshot not found in database');
    const snap = JSON.parse(rows[0].snapshot_json);
    if(!snap.data) throw new Error('Invalid snapshot format');

    // Helper: delete all rows from a table using id filter
    const deleteAll = async (table) => {
      // Use a filter that matches all rows — PostgREST won't delete without a filter
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=not.is.null`, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'X-App-Secret': APP_SECRET,
          'Prefer': 'return=minimal'
        }
      });
      if(!r.ok){
        const txt = await r.text();
        throw new Error(`Delete ${table} failed: ${txt}`);
      }
    };

    // Helper: net_worth_snapshots uses snapshot_date not id as identifier
    const deleteAllSnapshots = async () => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/net_worth_snapshots?snapshot_date=not.is.null`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'X-App-Secret': APP_SECRET, 'Prefer': 'return=minimal' }
      });
      if(!r.ok){ const txt=await r.text(); throw new Error(`Delete net_worth_snapshots failed: ${txt}`); }
    };

    // Step 2: Delete in FK order — children first, then parents
    // cashflow_transactions references: holdings, cashflow_categories, recurrences
    // recurrences references: holdings, cashflow_categories
    // So order: transactions → recurrences → net_worth_snapshots → holdings → categories
    showSnapshotStatus('<span class="spin" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Clearing current data…', 'info');
    await deleteAll('cashflow_transactions');
    await deleteAll('recurrences');
    await deleteAllSnapshots();
    await deleteAll('holdings');
    await deleteAll('cashflow_categories');
    // Note: do NOT delete data_snapshots — we still need it

    // Step 3: Re-insert in reverse FK order — parents first, then children
    // categories → holdings → recurrences → transactions → net_worth_snapshots
    showSnapshotStatus('<span class="spin" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:6px"></span> Restoring data…', 'info');
    const insertOrder = [
      {table:'cashflow_categories',  data: snap.data.cashflow_categories   || []},
      {table:'holdings',             data: (snap.data.holdings || []).map(h=>{
        // Older snapshots may carry fields removed from the schema since they were taken
        // (e.g. dividends_received, folded into its own category type). Strip anything
        // the current table wouldn't recognize rather than let the whole restore fail.
        const {dividends_received, ...rest} = h;
        return rest;
      })},
      {table:'recurrences',          data: snap.data.recurrences            || []},
      {table:'cashflow_transactions',data: snap.data.cashflow_transactions  || []},
      {table:'net_worth_snapshots',  data: snap.data.net_worth_snapshots    || []},
    ];

    for(const {table, data} of insertOrder){
      if(!data.length) continue;
      // Insert in batches of 50
      for(let i=0; i<data.length; i+=50){
        const batch = data.slice(i, i+50);
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'X-App-Secret': APP_SECRET,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(batch)
        });
        if(!r.ok){
          const txt = await r.text();
          throw new Error(`Insert into ${table} failed: ${txt}`);
        }
      }
    }

    showSnapshotStatus(`✓ Restored to ${date} — reloading…`, 'success');
    setTimeout(()=>location.reload(), 1500);
  }catch(e){
    console.error('Restore error:', e);
    showSnapshotStatus('✗ Restore failed: '+e.message+' — check console for details', 'error');
  }
}

function showSnapshotStatus(msg, type){
  const el=document.getElementById('snapshot-status'); if(!el) return;
  el.style.display='';
  el.style.background = type==='success'?'var(--green-bg)':type==='error'?'var(--red-bg)':'var(--surface2)';
  el.style.color = type==='success'?'var(--green)':type==='error'?'var(--red)':'var(--text2)';
  el.innerHTML = msg;
  if(type!=='info') setTimeout(()=>{el.style.display='none';},6000);
}

