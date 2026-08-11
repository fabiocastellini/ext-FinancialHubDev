function fmt(n){
  const num = Number(n);
  const decimals = Math.abs(num) > 0 && Math.abs(num) < 1 ? 4 : 2;
  return '€\u00a0'+num.toLocaleString('it-IT',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
}
function fmtN(n,d=6){ return Number(n).toLocaleString('it-IT',{maximumFractionDigits:d}); }

// ── Custom dialog (replaces browser confirm/alert) ──
function showDialog(message, {title='', confirmText='OK', cancelText=null, danger=false}={}){
  return new Promise(resolve=>{
    document.getElementById('dialog-title').textContent = title||'';
    document.getElementById('dialog-title').style.display = title ? '' : 'none';
    document.getElementById('dialog-message').innerHTML = message.replace(/\n/g,'<br>');
    const footer = document.getElementById('dialog-footer');
    footer.innerHTML = '';
    if(cancelText!==null){
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn';
      cancelBtn.textContent = cancelText;
      cancelBtn.onclick = ()=>{ closeModal('modal-dialog'); resolve(false); };
      footer.appendChild(cancelBtn);
    }
    const okBtn = document.createElement('button');
    okBtn.className = 'btn' + (danger?' btn-danger-filled':'  btn-primary');
    okBtn.style.cssText = '';
    okBtn.textContent = confirmText;
    okBtn.onclick = ()=>{ closeModal('modal-dialog'); resolve(true); };
    footer.appendChild(okBtn);
    openModal('modal-dialog');
  });
}
function showAlert(msg, title=''){
  return showDialog(msg,{title, confirmText:'OK', cancelText:null});
}
function showConfirm(msg, title='', danger=false){
  return showDialog(msg,{title, confirmText:'OK', cancelText:'Cancel', danger});
}
function fmtPct(n){ return (n>=0?'+':'')+Number(n).toFixed(2)+'%'; }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }

// Scroll to top
function scrollToTop(){
  if(document.scrollingElement) document.scrollingElement.scrollTop=0;
  window.scrollTo(0,0);
  document.documentElement.scrollTop=0;
  document.body.scrollTop=0;
}

function showPage(name,btn){
  localStorage.setItem('fh_page', name);
  // Sync bottom tab bar active state
  document.querySelectorAll('.bottom-tab').forEach(t=>t.classList.remove('active'));
  const mobilePageMap={overview:'overview',holdings:'holdings',cashflow:'cashflow',insights:'rpt-insights',reports:'rpt-insights',settings:'settings'};
  const mobileTarget=mobilePageMap[name]||name;
  const mobileBtn=document.querySelector(`.bottom-tab[data-page="${mobileTarget}"]`);
  if(mobileBtn) mobileBtn.classList.add('active');
  // Update mobile analytics sub-nav active state (both pages have sub-nav)
  ['mobile-subnav-insights','mobile-subnav-insights2'].forEach(id=>{const el=document.getElementById(id);if(el) el.classList.toggle('active',name==='insights');});
  ['mobile-subnav-reports','mobile-subnav-reports2'].forEach(id=>{const el=document.getElementById(id);if(el) el.classList.toggle('active',name==='reports');});

  // Collapse all accordions when leaving holdings
  document.querySelectorAll('.cat-header.open').forEach(h=>{
    h.classList.remove('open');
    h.nextElementSibling.classList.remove('open');
    h.setAttribute('aria-expanded','false');
  });
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  // Scroll after page is shown (works for most pages; insights/reports scroll after render)
  if(name!=='insights'&&name!=='reports') requestAnimationFrame(scrollToTop);
  if(btn){
    btn.classList.add('active');
  } else {
    document.querySelectorAll('.nav-item').forEach(b=>{
      if(b.getAttribute('onclick') && b.getAttribute('onclick').includes("'"+name+"'")) b.classList.add('active');
    });
  }
  if(name==='overview') renderOverview();
  // Show live price indicator only on holdings page
  document.body.className = document.body.className.replace(/page-\w+/g,'').trim();
  document.body.classList.add('page-'+name);
  if(name==='insights'){
    requestAnimationFrame(()=>{
      renderAllocation(); renderInsights();
      scrollToTop();
      setTimeout(()=>{ scrollToTop(); }, 120);
    });
  }
  // prices only refresh manually via the Refresh button
  if(name==='cashflow'){
    // Reset cashflow to main view if form was open
    const cfForm=document.getElementById('cf-form');
    const cfMain=document.getElementById('cf-main');
    const cfFab=document.getElementById('cf-fab');
    if(cfForm&&cfForm.style.display!=='none'){ showCfMain(); }
    else { renderCashflow(); if(cfFab) cfFab.style.display=''; }
  }
  if(name!=='cashflow' && bulkSelectMode){
    bulkSelectMode=false; selectedTxIds.clear();
    const bt=document.getElementById('cf-bulk-toggle');
    if(bt){ bt.style.background=''; bt.innerHTML='<i class="ti ti-checkbox"></i> Select'; }
    document.getElementById('bulk-toolbar')?.classList.remove('open');
  }
  if(name!=='cashflow'){ cfOpenTypes.clear(); }
  if(name!=='holdings'){
    // Always return to the category grid when leaving the Holdings page
    closeCategoryDetail();
  }
  if(name==='settings'){ showSettingsMain(); }
  if(name==='reports'){ renderReports(); requestAnimationFrame(()=>{ scrollToTop(); setTimeout(scrollToTop,80); }); }
  // Hide FAB when not on cashflow
  if(name!=='cashflow'){ const fab=document.getElementById('cf-fab'); if(fab) fab.style.display='none'; }
}

