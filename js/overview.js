function setPeriod(days,btn){
  activePeriod=days;
  document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderTrendChart();
}

function renderOverview(){
  const totalVal=holdings.reduce((s,h)=>s+getVal(h),0);
  const valEl=document.getElementById('ov-value');
  if(valEl) valEl.textContent=fmt(totalVal);
  const totEl=document.getElementById('ov-total');
  if(totEl) totEl.textContent=fmt(totalVal);

  // Portfolio + liquidity stat cards
  const invHoldings=holdings.filter(h=>['stock','etf','crypto','bond'].includes(h.type));
  const liqHoldings=holdings.filter(h=>['bank','cash'].includes(h.type));
  const invTotal=invHoldings.reduce((s,h)=>s+getVal(h),0);
  const liqTotal=liqHoldings.reduce((s,h)=>s+h.avg_cost,0);
  const invCost=invHoldings.reduce((s,h)=>s+getCost(h),0);
  const invGain=invTotal-invCost;
  const invGainPct=invCost>0?invGain/invCost*100:0;
  const pvEl=document.getElementById('ov-portfolio-val');
  const pcEl=document.getElementById('ov-portfolio-change');
  const lvEl=document.getElementById('ov-liquidity-val');
  if(pvEl) pvEl.textContent=fmt(invTotal);
  if(pcEl){ pcEl.className='ov-hero-change'+(invGain<0?' neg':''); pcEl.innerHTML=(invGain>=0?'<i class="ti ti-trending-up"></i>':'<i class="ti ti-trending-down"></i>')+fmtPct(invGainPct)+' return'; }
  if(lvEl) lvEl.textContent=fmt(liqTotal);

  // Change badge is updated by renderTrendChart() based on selected period

  renderTrendChart();
  renderHoldingBoxes();
}

function renderTrendChart(){
  const today=new Date();
  const cutoff=new Date(today); cutoff.setDate(cutoff.getDate()-activePeriod);
  const filtered=snapshots.filter(s=>new Date(s.snapshot_date)>=cutoff);

  // Always include today's value
  const todayStr=today.toISOString().split('T')[0];
  const todayVal=holdings.reduce((s,h)=>s+getVal(h),0);
  let points=[...filtered];
  if(!points.find(p=>p.snapshot_date===todayStr) && todayVal>0) points.push({snapshot_date:todayStr,total_value:todayVal});
  points.sort((a,b)=>a.snapshot_date.localeCompare(b.snapshot_date));

  // ── Update net worth change badge based on selected period ──
  const periodLabels={7:'vs last week',30:'vs last month',90:'vs 3 months ago',180:'vs 6 months ago',365:'vs last year'};
  const changeEl=document.getElementById('ov-change');
  if(changeEl){
    if(points.length>=2){
      const first=points[0].total_value;
      const last=points[points.length-1].total_value;
      const diff=last-first;
      const pct=first>0?diff/first*100:0;
      const up=diff>=0;
      const label=periodLabels[activePeriod]||'vs period start';
      changeEl.className='ov-hero-change'+(up?'':' neg');
      changeEl.innerHTML=(up?'<i class="ti ti-trending-up"></i>':'<i class="ti ti-trending-down"></i>')+fmt(Math.abs(diff))+' ('+fmtPct(Math.abs(pct))+') '+label;
    } else {
      changeEl.className='ov-hero-change';
      changeEl.innerHTML='<i class="ti ti-minus"></i> No history yet';
    }
  }

  const labels=points.map(p=>new Date(p.snapshot_date).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
  const data=points.map(p=>p.total_value);

  const isDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
  const lineColor='#818cf8';
  const gridColor=isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)';
  const textColor=isDark?'#94a3b8':'#6b7280';

  if(trendChart) trendChart.destroy();
  trendChart=new Chart(document.getElementById('trend-chart'),{
    type:'line',
    data:{labels,datasets:[{
      data,
      borderColor:lineColor,
      backgroundColor:(ctx)=>{
        const g=ctx.chart.ctx.createLinearGradient(0,0,0,220);
        g.addColorStop(0,'rgba(129,140,248,0.22)');
        g.addColorStop(1,'rgba(129,140,248,0)');
        return g;
      },
      borderWidth:2.5,
      pointRadius:0,
      pointHoverRadius:4,
      pointBackgroundColor:lineColor,
      tension:0.4,
      cubicInterpolationMode:'monotone',
      fill:true
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:isDark?'#1a1d27':'#fff',
          titleColor:textColor, bodyColor:isDark?'#f1f5f9':'#111',
          borderColor:isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)',
          borderWidth:1,
          callbacks:{label:ctx=>fmt(ctx.raw)}
        }
      },
      layout:{padding:{bottom:4}},
      scales:{
        x:{grid:{display:false},ticks:{color:textColor,font:{size:11},maxTicksLimit:8,maxRotation:0,minRotation:0}},
        y:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11},callback:v=>'€'+Number(v).toLocaleString('it-IT')}}
      }
    }
  });

  const labelEl=document.getElementById('chart-range-label');
  if(points.length>0){
    const fmtD=d=>{const x=new Date(d);return x.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit'})};
    const first=fmtD(points[0].snapshot_date);
    const last=fmtD(points[points.length-1].snapshot_date);
    labelEl.textContent=`${first} – ${last}`;
  } else {
    labelEl.textContent='No historical data yet — data builds up daily';
  }
}

function renderHoldingBoxes(){
  // Group by type, sum values, sort alphabetically by type label
  const byType={};
  holdings.forEach(h=>{ byType[h.type]=(byType[h.type]||0)+getVal(h); });
  const total=Object.values(byType).reduce((a,b)=>a+b,0)||1;
  const sorted=Object.keys(byType).sort((a,b)=>(TYPE_LABELS[a]||a).localeCompare(TYPE_LABELS[b]||b));

  const grid=document.getElementById('holding-grid');
  if(!sorted.length){
    grid.innerHTML='<div class="empty" style="grid-column:1/-1;padding:2rem"><i class="ti ti-wallet" style="font-size:28px;display:block;margin-bottom:8px;color:var(--text3)"></i><p>No holdings yet</p></div>';
    return;
  }
  // On mobile use horizontal scroll, on desktop use equal-width grid columns
  const isMobile = window.innerWidth <= 768;
  if(isMobile){
    grid.classList.remove('mobile-scroll');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = sorted.length <= 2 ? `repeat(${sorted.length}, 1fr)` : 'repeat(2, 1fr)';
  } else {
    grid.classList.remove('mobile-scroll');
    grid.style.gridTemplateColumns = `repeat(${sorted.length}, 1fr)`;
  }
  grid.innerHTML=sorted.map(type=>{
    const val=byType[type];
    const pct=(val/total*100).toFixed(1);
    const icon=TYPE_ICONS[type]||'ti-wallet';
    const label=TYPE_LABELS[type]||type;
    return `<div class="holding-box type-${type}">
      <div class="holding-box-ghost"><i class="ti ${icon}" style="color:var(--tc)"></i></div>
      <div class="holding-box-label">${label}</div>
      <div class="holding-box-value">${fmt(val)}</div>
      <div class="holding-box-pct">${pct}% of portfolio</div>
    </div>`;
  }).join('');
  initTouchDnD();
}

// ── INSIGHTS ──


const IT_HOLIDAYS = ['01-01','01-06','04-25','05-01','06-02','08-15','11-01','12-08','12-25','12-26'];
