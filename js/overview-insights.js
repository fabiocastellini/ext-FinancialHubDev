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
function isItalianHoliday(date){
  const mm=String(date.getMonth()+1).padStart(2,'0');
  const dd=String(date.getDate()).padStart(2,'0');
  return IT_HOLIDAYS.includes(`${mm}-${dd}`);
}
function isWeekend(date){ return date.getDay()===0||date.getDay()===6; }

function getSalaryDate(year,month){
  let d=new Date(year,month,27);
  while(isWeekend(d)||isItalianHoliday(d)) d.setDate(d.getDate()-1);
  return d;
}

function buildSalaryPeriods(){
  if(!cfTransactions.length) return [];
  const sorted=[...cfTransactions].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const first=new Date(sorted[0].date);
  const now=new Date();
  let year=first.getFullYear(), month=first.getMonth();
  const sd27=getSalaryDate(year,month);
  if(first<sd27){ month--; if(month<0){month=11;year--;} }
  const periods=[];
  while(true){
    const start=getSalaryDate(year,month);
    let em=month+1,ey=year; if(em>11){em=0;ey++;}
    const nextStart=getSalaryDate(ey,em);
    const periodEnd=new Date(nextStart); periodEnd.setDate(periodEnd.getDate()-1); periodEnd.setHours(23,59,59,999);
    periods.push({start,end:periodEnd,label:start.toLocaleDateString('en-GB',{month:'short',year:'2-digit'})});
    month++; if(month>11){month=0;year++;}
    if(start>now) break;
  }
  return periods;
}

function isIncomeTx(t){ return t.type==='income'||t.type==='sale'; }
function isOutcomeTx(t){ return t.type==='expense'; }

// Year filter state for monthly chart
let insightsYear = null; // null = all years
function toggleYearDropdown(){
  const dd=document.getElementById('insights-year-dropdown');
  if(!dd) return;
  const isOpen=dd.style.display!=='none';
  dd.style.display=isOpen?'none':'block';
  if(!isOpen){
    // Close on outside click
    setTimeout(()=>document.addEventListener('click',function close(e){
      if(!e.target.closest('#insights-year-dropdown')&&!e.target.closest('#insights-year-btn')){
        dd.style.display='none'; document.removeEventListener('click',close);
      }
    }),10);
  }
}

function renderInsights(){
  // Populate year selector
  const years=[...new Set(cfTransactions.map(t=>new Date(t.date).getFullYear()))].sort((a,b)=>b-a);
  if(insightsYear===null && years.length) insightsYear=years[0];
  const lbl=document.getElementById('insights-year-label');
  const dd=document.getElementById('insights-year-dropdown');
  if(lbl) lbl.textContent=insightsYear||'—';
  if(dd){
    dd.innerHTML=years.map(y=>`<button onclick="insightsYear=${y};document.getElementById('insights-year-label').textContent=${y};document.getElementById('insights-year-dropdown').style.display='none';renderMonthlyChart()"
      style="display:block;width:100%;padding:8px 12px;border:none;background:${y===insightsYear?'var(--surface2)':'transparent'};color:${y===insightsYear?'var(--accent)':'var(--text)'};font-size:13px;font-weight:${y===insightsYear?'600':'400'};text-align:left;cursor:pointer;font-family:inherit"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='${y===insightsYear?'var(--surface2)':'transparent'}'">${y}</button>`).join('');
  }
  renderLiquidityChart();
  renderMonthlyChart();
  renderYearlyCharts();
  renderSavingsChart();
  renderInvestedChart();
}

function getChartColors(){
  const dark=window.matchMedia('(prefers-color-scheme:dark)').matches;
  return {
    grid:dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)',
    text:dark?'#94a3b8':'#6b7280',
    surface:dark?'#1a1d27':'#fff',
    border:dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)'
  };
}

function fmtShort(n){
  if(Math.abs(n)>=1000) return '€'+(n/1000).toFixed(1)+'k';
  return '€'+Math.round(n);
}

// ── Liquidity over time ──
function renderLiquidityChart(){
  const el=document.getElementById('liquidity-chart'); if(!el) return;
  const emptyEl=document.getElementById('liquidity-empty');
  const wrapEl=document.getElementById('liquidity-wrap');
  const liqHoldings=holdings.filter(h=>h.type==='bank'||h.type==='cash');
  if(!liqHoldings.length){
    if(liquidityChart){liquidityChart.destroy();liquidityChart=null;}
    if(emptyEl) emptyEl.style.display='';
    if(wrapEl) wrapEl.style.display='none';
    return;
  }
  if(emptyEl) emptyEl.style.display='none';
  if(wrapEl) wrapEl.style.display='';

  // buildSalaryPeriods needs cfTransactions — if empty, fall back to a
  // single data point using the current balance
  const liqIds=new Set(liqHoldings.map(h=>h.id));
  const liqTx=[...cfTransactions].filter(t=>liqIds.has(t.holding_id)||liqIds.has(t.holding_to_id));

  if(!liqTx.length || !buildSalaryPeriods().length){
    // No transactions yet — show current balance as single point
    const currentBal=liqHoldings.reduce((s,h)=>s+h.avg_cost,0);
    const c=getChartColors();
    if(liquidityChart) liquidityChart.destroy();
    liquidityChart=new Chart(el,{
      type:'line',
      data:{labels:['Now'],datasets:[{data:[+currentBal.toFixed(2)],borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,0.08)',borderWidth:2,tension:0.3,fill:true,pointRadius:5,pointBackgroundColor:'#0ea5e9',pointHoverRadius:7}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmt(ctx.raw)}}},scales:{x:{grid:{display:false},ticks:{color:c.text}},y:{grid:{color:c.grid},ticks:{color:c.text,callback:v=>fmtShort(v)}}}}
    });
    return;
  }

  const periods=buildSalaryPeriods();
  if(!periods.length) return;

  // Reconstruct balance backwards from current using transactions
  const sortedTxDesc=liqTx.sort((a,b)=>new Date(b.date)-new Date(a.date));
  let bal=liqHoldings.reduce((s,h)=>s+h.avg_cost,0);
  const balByPeriod={};
  balByPeriod[periods.length-1]=bal;

  for(let i=periods.length-2;i>=0;i--){
    const p=periods[i+1]; // period AFTER i — transactions in this period are subtracted (reversed)
    sortedTxDesc.forEach(t=>{
      const td=new Date(t.date);
      if(td>=p.start&&td<=p.end){
        // Reverse each tx to get balance before that period
        if(t.type==='income'&&liqIds.has(t.holding_id)) bal-=t.amount;
        else if(t.type==='expense'&&liqIds.has(t.holding_id)) bal+=t.amount;
        else if(t.type==='transfer'){
          if(liqIds.has(t.holding_to_id)) bal-=t.amount;
          if(liqIds.has(t.holding_id)) bal+=t.amount;
        }
        else if(t.type==='purchase'&&liqIds.has(t.holding_to_id)) bal+=t.amount;
        else if(t.type==='sale'&&liqIds.has(t.holding_to_id)) bal-=t.amount;
      }
    });
    balByPeriod[i]=Math.max(0,bal);
  }

  const labels=periods.map(p=>p.label);
  const data=periods.map((_,i)=>+(balByPeriod[i]??0).toFixed(2));

  // Only keep periods with non-zero data (trim leading zeros)
  let firstNonZero=0;
  while(firstNonZero<data.length-1 && data[firstNonZero]===0) firstNonZero++;
  const trimLabels=labels.slice(firstNonZero);
  const trimData=data.slice(firstNonZero);

  const c=getChartColors();
  if(liquidityChart) liquidityChart.destroy();
  liquidityChart=new Chart(el,{
    type:'line',
    data:{labels:trimLabels,datasets:[{data:trimData,borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,0.08)',borderWidth:2,tension:0.3,cubicInterpolationMode:'monotone',fill:true,pointRadius:0,pointHoverRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:16,bottom:4}},plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmt(ctx.raw)},backgroundColor:c.surface,titleColor:c.text,bodyColor:c.text,borderColor:c.border,borderWidth:1}},layout:{padding:{top:16,right:window.innerWidth<=768?36:20,bottom:8}},scales:{x:{grid:{display:false},ticks:{color:c.text,font:{size:9},maxRotation:0,minRotation:0,maxTicksLimit:8}},y:{grid:{color:c.grid},ticks:{color:c.text,font:{size:10},callback:v=>fmtShort(v)}}}}
  });
}

// ── Monthly income vs outcomes (year-filtered) ──
function renderMonthlyChart(){
  const el=document.getElementById('monthly-chart'); if(!el) return;
  const allPeriods=buildSalaryPeriods();
  const periods=insightsYear ? allPeriods.filter(p=>p.start.getFullYear()===insightsYear||p.end.getFullYear()===insightsYear) : allPeriods;
  if(!periods.length) return;
  const incomes=[],outcomes=[];
  periods.forEach(p=>{
    const pTxs=cfTransactions.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end;});
    incomes.push(+(pTxs.filter(t=>isIncomeTx(t)).reduce((s,t)=>s+t.amount,0)).toFixed(2));
    outcomes.push(+(pTxs.filter(t=>isOutcomeTx(t)).reduce((s,t)=>s+t.amount,0)).toFixed(2));
  });
  const labels=periods.map(p=>p.label);
  const c=getChartColors();
  if(monthlyChart) monthlyChart.destroy();
  monthlyChart=new Chart(el,{
    type:'bar',
    data:{labels,datasets:[
      {label:'Income',data:incomes,backgroundColor:'rgba(16,185,129,0.85)',borderRadius:4,borderSkipped:false},
      {label:'Outcomes',data:outcomes,backgroundColor:'rgba(248,113,113,0.85)',borderRadius:4,borderSkipped:false}
    ]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index'},
      plugins:{
        legend:{labels:{color:c.text,font:{size:12},boxWidth:12}},
        tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${fmt(ctx.raw)}`},backgroundColor:c.surface,titleColor:c.text,bodyColor:c.text,borderColor:c.border,borderWidth:1}
      },
      layout:{padding:{top:30,right:window.innerWidth<=768?24:20,bottom:10}},
      barPercentage:0.55,
      categoryPercentage:0.65,
      scales:{
        x:{grid:{display:false},ticks:{color:c.text,font:{size:window.innerWidth<=768?8:10},maxRotation:0,minRotation:0,maxTicksLimit:window.innerWidth<=768?6:12}},
        y:{grid:{color:c.grid},grace:'20%',ticks:{color:c.text,font:{size:window.innerWidth<=768?8:10},callback:v=>fmtShort(v)}}
      }
    },
    plugins:[{
      id:'barValueLabels',
      afterDatasetsDraw(chart){
        const {ctx}=chart;
        chart.data.datasets.forEach((ds,di)=>{
          const meta=chart.getDatasetMeta(di);
          if(meta.hidden) return;
          meta.data.forEach((bar,bi)=>{
            const val=ds.data[bi];
            if(!val) return;
            ctx.save();
            ctx.fillStyle=c.text;
            ctx.font='bold 9px -apple-system,BlinkMacSystemFont,sans-serif';
            ctx.textAlign='center';
            ctx.textBaseline='bottom';
            ctx.fillText(fmtShort(val),bar.x,Math.max(bar.y-2,chart.chartArea.top+10));
            ctx.restore();
          });
        });
      }
    }]
  });
}

// ── Yearly charts (horizontal bars) ──
function renderYearlyCharts(){
  const yIncome=document.getElementById('yearly-income-chart');
  const yOutcome=document.getElementById('yearly-outcome-chart');
  if(!yIncome||!yOutcome) return;
  const years=[...new Set(cfTransactions.map(t=>new Date(t.date).getFullYear()))].sort();
  const incByYear=years.map(y=>+(cfTransactions.filter(t=>new Date(t.date).getFullYear()===y&&isIncomeTx(t)).reduce((s,t)=>s+t.amount,0)).toFixed(2));
  const outByYear=years.map(y=>+(cfTransactions.filter(t=>new Date(t.date).getFullYear()===y&&isOutcomeTx(t)).reduce((s,t)=>s+t.amount,0)).toFixed(2));
  const c=getChartColors();
  const endLabelPlugin={
    id:'endLabels',
    afterDraw(chart){
      const {ctx}=chart;
      // Use chart.width/height (CSS pixels) not canvas.width/height (physical pixels)
      ctx.save();
      ctx.beginPath();
      ctx.rect(0,0,chart.width,chart.height);
      ctx.clip();
      chart.data.datasets.forEach((ds,di)=>{
        const meta=chart.getDatasetMeta(di);
        meta.data.forEach((bar,bi)=>{
          const val=ds.data[bi]; if(!val) return;
          ctx.fillStyle='rgba(255,255,255,0.9)';
          ctx.font=`bold 10px 'DM Sans',sans-serif`;
          ctx.textAlign=val>=0?'right':'left';
          ctx.textBaseline='middle';
          ctx.fillText(fmtShort(val),bar.x+(val>=0?-12:12),bar.y);
        });
      });
      ctx.restore();
    }
  };
  const isMobNow=window.innerWidth<=768;
  const hOpts=(color)=>({
    responsive:true,maintainAspectRatio:false,
    indexAxis:'y',
    layout:{padding:{right:isMobNow?72:68,top:24,bottom:8}},
    plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmt(ctx.raw)},backgroundColor:c.surface,titleColor:c.text,bodyColor:c.text,borderColor:c.border,borderWidth:1}},
    scales:{
      x:{grid:{color:c.grid},ticks:{color:c.text,font:{size:isMobNow?8:10},callback:v=>fmtShort(v),maxTicksLimit:isMobNow?4:8},grace:'15%'},
      y:{grid:{display:false},ticks:{color:c.text,font:{size:isMobNow?9:11}}}
    }
  });
  // Dynamic height: each year needs ~40px, minimum 130px
  const dynH = Math.max(130, years.length * 42);
  const iWrap = document.getElementById('yearly-income-wrap');
  const oWrap = document.getElementById('yearly-outcome-wrap');
  if(iWrap) iWrap.style.height = dynH + 'px';
  if(oWrap) oWrap.style.height = dynH + 'px';

  if(yearlyIncomeChart) yearlyIncomeChart.destroy();
  yearlyIncomeChart=new Chart(yIncome,{type:'bar',data:{labels:years,datasets:[{data:incByYear,backgroundColor:'rgba(16,185,129,0.85)',borderRadius:4,borderSkipped:false}]},options:hOpts('green'),plugins:[endLabelPlugin]});
  if(yearlyOutcomeChart) yearlyOutcomeChart.destroy();
  yearlyOutcomeChart=new Chart(yOutcome,{type:'bar',data:{labels:years,datasets:[{data:outByYear,backgroundColor:'rgba(248,113,113,0.85)',borderRadius:4,borderSkipped:false}]},options:hOpts('red'),plugins:[endLabelPlugin]});
}

// ── Savings per year (vertical, color-coded) ──
function renderSavingsChart(){
  const el=document.getElementById('savings-chart'); if(!el) return;
  // Dynamic height for savings: taller with more years
  const sWrap=document.getElementById('savings-wrap');
  if(sWrap){
    const savYears=[...new Set(cfTransactions.map(t=>new Date(t.date).getFullYear()))].length;
    sWrap.style.height=Math.max(130,savYears*42)+'px';
  }
  const years=[...new Set(cfTransactions.map(t=>new Date(t.date).getFullYear()))].sort();
  const savings=years.map(y=>{
    const inc=cfTransactions.filter(t=>new Date(t.date).getFullYear()===y&&isIncomeTx(t)).reduce((s,t)=>s+t.amount,0);
    const out=cfTransactions.filter(t=>new Date(t.date).getFullYear()===y&&isOutcomeTx(t)).reduce((s,t)=>s+t.amount,0);
    return +(inc-out).toFixed(2);
  });
  const c=getChartColors();
  if(savingsChart) savingsChart.destroy();
  const isMobSav=window.innerWidth<=768;
  const sEndLabelPlugin={
    id:'savingsEndLabels',
    afterDraw(chart){
      const {ctx}=chart;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0,0,chart.width,chart.height);
      ctx.clip();
      chart.data.datasets.forEach((ds,di)=>{
        const meta=chart.getDatasetMeta(di);
        meta.data.forEach((bar,bi)=>{
          const val=ds.data[bi]; if(!val) return;
          ctx.fillStyle='rgba(255,255,255,0.9)';
          ctx.font=`bold 10px 'DM Sans',sans-serif`;
          ctx.textAlign=val>=0?'right':'left';
          ctx.textBaseline='middle';
          ctx.fillText((val>=0?'+':'')+fmtShort(val),bar.x+(val>=0?-12:12),bar.y);
        });
      });
      ctx.restore();
    }
  };
  savingsChart=new Chart(el,{
    type:'bar',
    data:{labels:years,datasets:[{data:savings,backgroundColor:savings.map(s=>s>=0?'rgba(96,168,245,0.85)':'rgba(224,80,80,0.85)'),borderRadius:4,borderSkipped:false}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      indexAxis:'y',
      layout:{padding:{right:isMobSav?70:60,top:4,bottom:4}},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmt(ctx.raw)},backgroundColor:c.surface,titleColor:c.text,bodyColor:c.text,borderColor:c.border,borderWidth:1}},
      scales:{
        x:{grid:{color:c.grid},ticks:{color:c.text,font:{size:isMobSav?8:10},callback:v=>fmtShort(v),maxTicksLimit:isMobSav?4:8}},
        y:{grid:{display:false},ticks:{color:c.text,font:{size:isMobSav?9:11}}}
      }
    },
    plugins:[sEndLabelPlugin]
  });
}

// ── Cumulative invested capital (dashed line, per period) ──
function renderInvestedChart(){
  const el=document.getElementById('invested-chart'); if(!el) return;
  const purchases=[...cfTransactions].filter(t=>t.type==='purchase').sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(!purchases.length) return;
  const periods=buildSalaryPeriods();
  let cum=0;
  const labels=[],data=[];
  periods.forEach(p=>{
    cum+=purchases.filter(t=>new Date(t.date)>=p.start&&new Date(t.date)<=p.end).reduce((s,t)=>s+t.amount,0);
    labels.push(p.label); data.push(+cum.toFixed(2));
  });
  const c=getChartColors();
  if(investedChart) investedChart.destroy();
  investedChart=new Chart(el,{
    type:'line',
    data:{labels,datasets:[{data,borderColor:'#818cf8',backgroundColor:'rgba(129,140,248,0.07)',borderWidth:2,borderDash:[6,3],tension:0,fill:true,pointRadius:0,pointHoverRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:16,bottom:4}},plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>fmt(ctx.raw)},backgroundColor:c.surface,titleColor:c.text,bodyColor:c.text,borderColor:c.border,borderWidth:1}},layout:{padding:{top:16,right:window.innerWidth<=768?36:20,bottom:8}},scales:{x:{grid:{display:false},ticks:{color:c.text,font:{size:9},maxRotation:0,minRotation:0,maxTicksLimit:8}},y:{grid:{color:c.grid},ticks:{color:c.text,font:{size:10},callback:v=>fmtShort(v)}}}}
  });
}
// ── ALLOCATION ──
function afterInsightsRender(){
}
function renderAllocation(){
  const dark=window.matchMedia('(prefers-color-scheme:dark)').matches;
  const textColor=dark?'#f1f5f9':'#111827';
  const dimColor=dark?'#94a3b8':'#6b7280';
  const total=holdings.reduce((s,h)=>s+getVal(h),0)||1;

  const typeColorMap={bank:'#0ea5e9',bond:'#ec4899',cash:'#84cc16',crypto:'#f59e0b',dividend:'#60a8f5',etf:'#10b981',stock:'#6366f1'};
  // By asset type — all holdings
  const byType={};
  holdings.forEach(h=>{ byType[h.type]=(byType[h.type]||0)+getVal(h); });
  const typeSlices=Object.keys(byType).map(k=>({label:TYPE_LABELS[k]||k,value:byType[k],color:typeColorMap[k]||'#888'}));
  renderDonutSVG('alloc-type-container', typeSlices, total, textColor, dimColor);

  // By holding — investments only (stocks, ETFs, crypto, bonds)
  const invTypes=['stock','etf','crypto','bond'];
  const invHoldings=holdings.filter(h=>invTypes.includes(h.type));
  const invTotal=invHoldings.reduce((s,h)=>s+getVal(h),0)||1;

  // By investment family — same investment-only scope as the chart above, but grouped
  // by asset type (crypto/etf/stock/bond) rather than by individual asset.
  const byFamily={};
  invHoldings.forEach(h=>{ byFamily[h.type]=(byFamily[h.type]||0)+getVal(h); });
  const familySlices=Object.keys(byFamily).map(k=>({label:TYPE_LABELS[k]||k,value:byFamily[k],color:typeColorMap[k]||'#888'}));
  if(familySlices.length){
    renderDonutSVG('alloc-family-container', familySlices, invTotal, textColor, dimColor);
  } else {
    const cf=document.getElementById('alloc-family-container');
    if(cf) cf.innerHTML='<div class="empty" style="padding:2rem"><i class="ti ti-briefcase"></i><p>No investment holdings yet</p></div>';
  }

  const holdSlices=invHoldings.map((h,i)=>({
    label:h.type==='crypto'?cleanCryptoTicker(h.ticker):h.ticker.toUpperCase(),
    value:getVal(h),
    color:PALETTE[i%PALETTE.length]
  }));
  if(holdSlices.length){
    renderDonutSVG('alloc-hold-container', holdSlices, invTotal, textColor, dimColor);
  } else {
    const c=document.getElementById('alloc-hold-container');
    if(c) c.innerHTML='<div class="empty" style="padding:2rem"><i class="ti ti-briefcase"></i><p>No investment holdings yet</p></div>';
  }

  // Per-type breakdown charts (only for types with >1 holding)
  const breakdownContainer=document.getElementById('alloc-type-breakdowns');
  if(breakdownContainer){
    const typeGroups={};
    invHoldings.forEach(h=>{ if(!typeGroups[h.type]) typeGroups[h.type]=[]; typeGroups[h.type].push(h); });
    const typesWithMultiple=Object.keys(typeGroups).filter(t=>typeGroups[t].length>1);
    const typesSingle=Object.keys(typeGroups).filter(t=>typeGroups[t].length===1);

    if(!typesWithMultiple.length){
      breakdownContainer.innerHTML='';
    } else {
      // Layout: single column on mobile, up to 3 per row on desktop
      const perRow=window.innerWidth<=768?1:Math.min(typesWithMultiple.length,3);
      const gridCols=perRow===1?'1fr':perRow===2?'1fr 1fr':'1fr 1fr 1fr';
      let html=`<div class="ins-section-title" style="margin-top:0.5rem">Asset type breakdown</div><div style="display:grid;grid-template-columns:${gridCols};gap:1rem">`;
      typesWithMultiple.forEach(type=>{
        const grpHoldings=typeGroups[type];
        const grpTotal=grpHoldings.reduce((s,h)=>s+getVal(h),0)||1;
        const containerId=`alloc-breakdown-${type}`;
        html+=`<div class="card">
          <div class="card-title" style="margin-bottom:0.5rem">${TYPE_LABELS[type]||type} composition</div>
          <div id="${containerId}" style="width:100%;min-height:${window.innerWidth<=768?'180px':'220px'};display:flex;align-items:center;justify-content:center">
            <div class="spin" style="width:20px;height:20px"></div>
          </div>
        </div>`;
      });
      html+='</div>';
      breakdownContainer.innerHTML=html;
      // Render each breakdown chart
      typesWithMultiple.forEach((type,ti)=>{
        const grpHoldings=typeGroups[type];
        const grpTotal=grpHoldings.reduce((s,h)=>s+getVal(h),0)||1;
        const containerId=`alloc-breakdown-${type}`;
        const slices=grpHoldings.map((h,i)=>({
          label:h.type==='crypto'?cleanCryptoTicker(h.ticker):h.ticker.toUpperCase(),
          value:getVal(h),
          color:PALETTE[(ti*4+i)%PALETTE.length]
        }));
        renderDonutSVG(containerId, slices, grpTotal, textColor, dimColor);
      });
    }
  }
}

// AI-powered donut SVG renderer — calls Anthropic API to place labels perfectly
function renderDonutSVG(containerId, slices, total, textColor, dimColor){
  const container=document.getElementById(containerId);
  if(!container) return;

  const isMob=window.innerWidth<=768;
  const W=container.clientWidth>50?container.clientWidth:(isMob?320:400);
  const H=isMob?210:320;
  const cx=W/2, cy=H/2;
  const outerR=Math.min(W,H)*0.27;
  const innerR=outerR*0.52;
  const labelR=isMob ? outerR+28 : outerR+46;

  // Build arc geometry
  let startAngle=-Math.PI/2;
  const arcs=slices.map(s=>{
    const pct=s.value/total;
    const sweep=pct*2*Math.PI;
    const endAngle=startAngle+sweep;
    const midAngle=startAngle+sweep/2;
    const a={...s,pct:+(pct*100).toFixed(1),startAngle,endAngle,midAngle,sweep,
      tipX:cx+Math.cos(midAngle)*(outerR+5),
      tipY:cy+Math.sin(midAngle)*(outerR+5),
      displayAngle:midAngle,
      side:Math.cos(midAngle)<0?'left':'right'};
    startAngle=endAngle;
    return a;
  });

  // Donut slice path
  function slicePath(sA,eA){
    const f=v=>v.toFixed(2);
    const large=eA-sA>Math.PI?1:0;
    const ox1=cx+Math.cos(sA)*outerR, oy1=cy+Math.sin(sA)*outerR;
    const ox2=cx+Math.cos(eA)*outerR, oy2=cy+Math.sin(eA)*outerR;
    const ix1=cx+Math.cos(eA)*innerR, iy1=cy+Math.sin(eA)*innerR;
    const ix2=cx+Math.cos(sA)*innerR, iy2=cy+Math.sin(sA)*innerR;
    return `M ${f(ox1)} ${f(oy1)} A ${outerR} ${outerR} 0 ${large} 1 ${f(ox2)} ${f(oy2)} L ${f(ix1)} ${f(iy1)} A ${innerR} ${innerR} 0 ${large} 0 ${f(ix2)} ${f(iy2)} Z`;
  }

  // Angular spread: push labels apart along the circumference so connectors stay short
  function spreadAngular(group, minA, maxA){
    if(!group.length) return;
    group.sort((a,b)=>a.displayAngle-b.displayAngle);
    const minGap=28/labelR; // angular gap for ~28px label separation at labelR
    for(let pass=0;pass<60;pass++){
      let moved=false;
      for(let i=1;i<group.length;i++){
        const gap=group[i].displayAngle-group[i-1].displayAngle;
        if(gap<minGap){
          const shift=(minGap-gap)/2;
          group[i-1].displayAngle=Math.max(minA,group[i-1].displayAngle-shift);
          group[i].displayAngle=Math.min(maxA,group[i].displayAngle+shift);
          moved=true;
        }
      }
      if(!moved) break;
    }
    group.forEach(a=>{
      a.lx=cx+Math.cos(a.displayAngle)*labelR;
      a.ly=cy+Math.sin(a.displayAngle)*labelR;
    });
  }

  // Split and spread each half
  const right=arcs.filter(a=>a.side==='right');
  const left=arcs.filter(a=>a.side==='left');
  spreadAngular(right, -Math.PI/2+0.05, Math.PI/2-0.05);
  // Normalize left angles to [π/2, 3π/2] for spreading, then convert back
  left.forEach(a=>{ if(a.displayAngle<0) a.displayAngle+=2*Math.PI; });
  spreadAngular(left, Math.PI/2+0.05, 3*Math.PI/2-0.05);
  left.forEach(a=>{ if(a.displayAngle>Math.PI) a.displayAngle-=2*Math.PI; });

  // Build SVG
  let svg=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="hidden" xmlns="http://www.w3.org/2000/svg" style="display:block;max-width:100%">`;

  // Draw slices
  arcs.forEach(a=>{
    if(a.sweep<0.001) return;
    svg+=`<path d="${slicePath(a.startAngle,a.endAngle)}" fill="${a.color}" opacity="0.92"><title>${a.label}: ${a.pct}%</title></path>`;
  });

  // Draw connectors + labels
  arcs.forEach(a=>{
    if(a.sweep<0.001||!a.lx) return;
    const isLeft=a.side==='left';
    const anchor=isLeft?'end':'start';
    const tx=+(a.lx+(isLeft?-5:5)).toFixed(1);
    const ty=a.ly.toFixed(1);

    // Short straight connector from slice tip to label anchor point
    svg+=`<line x1="${a.tipX.toFixed(1)}" y1="${a.tipY.toFixed(1)}" x2="${a.lx.toFixed(1)}" y2="${ty}" stroke="${a.color}" stroke-width="1.2" opacity="0.75" fill="none"/>`;
    // Dot at tip
    svg+=`<circle cx="${a.tipX.toFixed(1)}" cy="${a.tipY.toFixed(1)}" r="2" fill="${a.color}" opacity="0.85"/>`;
    // Label
    svg+=`<text x="${tx}" y="${ty}" dy="-2" text-anchor="${anchor}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="11" font-weight="600" fill="${a.color}">${a.label}</text>`;
    svg+=`<text x="${tx}" y="${ty}" dy="12" text-anchor="${anchor}" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="10" fill="${dimColor}">${a.pct}%</text>`;
  });

  svg+=`</svg>`;
  container.innerHTML=`<div style="overflow:hidden;width:100%;border-radius:inherit">${svg}</div>`;
}


// ─────────────────────────────────────────
// CASHFLOW
// ─────────────────────────────────────────
let cfCategories=[], cfTransactions=[], cfRecurrences=[];
let cfType='expense', cfIType='purchase', cfCtx='account';
let cfSearchQuery='', bulkSelectMode=false, selectedTxIds=new Set(), dragSrcType=null;

const DEFAULT_CATS=[
  {name:'Food & Dining',icon:'ti-tools-kitchen-2',color:'#f59e0b'},
  {name:'Transport',icon:'ti-car',color:'#3b82f6'},
  {name:'Bills & Utilities',icon:'ti-file-invoice',color:'#6366f1'},
  {name:'Health',icon:'ti-heart-rate-monitor',color:'#ec4899'},
  {name:'Entertainment',icon:'ti-device-tv',color:'#8b5cf6'},
  {name:'Shopping',icon:'ti-shopping-bag',color:'#f97316'},
  {name:'Salary',icon:'ti-briefcase',color:'#10b981'},
  {name:'Investment',icon:'ti-trending-up',color:'#0ea5e9'},
];
const TYPE_COLOR_CF={expense:'var(--red)',income:'var(--green)',transfer:'#f97316',purchase:'#0ea5e9',sale:'#f59e0b'};
const TYPE_ICON_CF={expense:'ti-arrow-up-right',income:'ti-arrow-down-left',transfer:'ti-arrows-exchange',purchase:'ti-shopping-cart',sale:'ti-coin'};
const TYPE_BG_CF={expense:'var(--red-bg)',income:'var(--green-bg)',transfer:'rgba(249,115,22,0.12)',purchase:'rgba(14,165,233,0.12)',sale:'rgba(245,158,11,0.12)'};

