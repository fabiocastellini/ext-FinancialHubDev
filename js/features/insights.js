import { exposeLegacyFunctions } from '../utils/legacy.js';

import { TYPE_LABELS, TYPE_ICONS, PALETTE } from '../config.js';

import { api } from '../api.js';

import {fmt, fmtN, fmtPct, fmtShort } from '../utils/date.js';
import { getVal, getCost, getGain, getGainPct, cleanCryptoName, cleanCryptoTicker} from '../utils/calculations.js';

import { state } from '../state.js';

import { openSelectPicker } from '../components/select-picker.js';

import { showPage } from '../features/navigation.js';
import { renderOverview } from '../features/overview.js'
import { loadCashflow } from '../features/cashflow.js'

import { refreshPrices, refreshHoldingsViews } from '../data/holdings.js';

import { loadAll } from '../app.js';

// ── INSIGHTS ──

let holdings=[], transactions=[], prices={}, snapshots=[], transactionFilter='all', activePeriod=30;
let trendChart, liquidityChart, monthlyChart, yearlyIncomeChart, yearlyOutcomeChart, savingsChart, investedChart;
// Use app font in all Chart.js charts
if(typeof Chart!=='undefined'){
  Chart.defaults.font.family="'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif";
  Chart.defaults.font.size=11;
}

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
  if(!state.cfTransactions.length) return [];
  const sorted=[...state.cfTransactions].sort((a,b)=>new Date(a.date)-new Date(b.date));
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
export function toggleYearDropdown(){
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

export function renderInsights(){
  // Populate year selector
  const years=[...new Set(state.cfTransactions.map(t=>new Date(t.date).getFullYear()))].sort((a,b)=>b-a);
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

// ── Liquidity over time ──
function renderLiquidityChart(){
  const el=document.getElementById('liquidity-chart'); if(!el) return;
  const emptyEl=document.getElementById('liquidity-empty');
  const wrapEl=document.getElementById('liquidity-wrap');
  const liqHoldings=state.holdings.filter(h=>h.type==='bank'||h.type==='cash');
  if(!liqHoldings.length){
    if(liquidityChart){liquidityChart.destroy();liquidityChart=null;}
    if(emptyEl) emptyEl.style.display='';
    if(wrapEl) wrapEl.style.display='none';
    return;
  }
  if(emptyEl) emptyEl.style.display='none';
  if(wrapEl) wrapEl.style.display='';

  // buildSalaryPeriods needs state.cfTransactions — if empty, fall back to a
  // single data point using the current balance
  const liqIds=new Set(liqHoldings.map(h=>h.id));
  const liqTx=[...state.cfTransactions].filter(t=>liqIds.has(t.holding_id)||liqIds.has(t.holding_to_id));

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
export function renderMonthlyChart(){
  const el=document.getElementById('monthly-chart'); if(!el) return;
  const allPeriods=buildSalaryPeriods();
  const periods=insightsYear ? allPeriods.filter(p=>p.start.getFullYear()===insightsYear||p.end.getFullYear()===insightsYear) : allPeriods;
  if(!periods.length) return;
  const incomes=[],outcomes=[];
  periods.forEach(p=>{
    const pTxs=state.cfTransactions.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end;});
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
  const years=[...new Set(state.cfTransactions.map(t=>new Date(t.date).getFullYear()))].sort();
  const incByYear=years.map(y=>+(state.cfTransactions.filter(t=>new Date(t.date).getFullYear()===y&&isIncomeTx(t)).reduce((s,t)=>s+t.amount,0)).toFixed(2));
  const outByYear=years.map(y=>+(state.cfTransactions.filter(t=>new Date(t.date).getFullYear()===y&&isOutcomeTx(t)).reduce((s,t)=>s+t.amount,0)).toFixed(2));
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
    const savYears=[...new Set(state.cfTransactions.map(t=>new Date(t.date).getFullYear()))].length;
    sWrap.style.height=Math.max(130,savYears*42)+'px';
  }
  const years=[...new Set(state.cfTransactions.map(t=>new Date(t.date).getFullYear()))].sort();
  const savings=years.map(y=>{
    const inc=state.cfTransactions.filter(t=>new Date(t.date).getFullYear()===y&&isIncomeTx(t)).reduce((s,t)=>s+t.amount,0);
    const out=state.cfTransactions.filter(t=>new Date(t.date).getFullYear()===y&&isOutcomeTx(t)).reduce((s,t)=>s+t.amount,0);
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
  const purchases=[...state.cfTransactions].filter(t=>t.type==='purchase').sort((a,b)=>new Date(a.date)-new Date(b.date));
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
export function renderAllocation(){
  const dark=window.matchMedia('(prefers-color-scheme:dark)').matches;
  const textColor=dark?'#f1f5f9':'#111827';
  const dimColor=dark?'#94a3b8':'#6b7280';
  const total=state.holdings.reduce((s,h)=>s+getVal(h),0)||1;

  const typeColorMap={bank:'#0ea5e9',bond:'#ec4899',cash:'#84cc16',crypto:'#f59e0b',dividend:'#60a8f5',etf:'#10b981',stock:'#6366f1'};
  // By asset type — all holdings
  const byType={};
  state.holdings.forEach(h=>{ byType[h.type]=(byType[h.type]||0)+getVal(h); });
  const typeSlices=Object.keys(byType).map(k=>({label:TYPE_LABELS[k]||k,value:byType[k],color:typeColorMap[k]||'#888'}));
  renderDonutSVG('alloc-type-container', typeSlices, total, textColor, dimColor);

  // By holding — investments only (stocks, ETFs, crypto, bonds)
  const invTypes=['stock','etf','crypto','bond'];
  const invHoldings=state.holdings.filter(h=>invTypes.includes(h.type));
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
// REPORTS
// ─────────────────────────────────────────

export function openRptYearPicker() {
  const current = document.getElementById('rpt-year-sel').value;
  openSelectPicker('Filter by year', state.rptYearOptionsCache, current, (val) => {
    document.getElementById('rpt-year-sel').value = val;
    state.rptFilterYear = val;
    document.getElementById('rpt-year-label').textContent = val === 'all' ? 'All time' : val;
    window.renderReports?.();
  });
}

// Extra categories from Excel that might be missing
const EXTRA_CATS = [
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

export async function ensureExtraCategories(){
  const existing = state.cfCategories.map(c=>c.name.toLowerCase());
  let added = false;
  for(const cat of EXTRA_CATS){
    if(!existing.includes(cat.name.toLowerCase())){
      try{
        const r = await api('cashflow_categories',{method:'POST',body:JSON.stringify(cat)});
        if(Array.isArray(r)&&r[0]){ state.cfCategories.push(r[0]); added=true; }
      }catch(e){ console.warn('Could not add category:', cat.name, e); }
    }
  }
  if(added){
    // Re-fetch to ensure correct order
    state.cfCategories = await api('cashflow_categories?order=name.asc');
    renderSettings();
  }
}

function rptFmt(n){ return n==null?'—':'€ '+Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function rptPct(n){ if(n==null) return '—'; return (n>=0?'+':'')+Number(n).toFixed(1)+'%'; }

function mkStat(label, val, cls=''){
  return `<div class="rpt-stat"><div class="rpt-stat-label">${label}</div><div class="rpt-stat-val ${cls}">${val}</div></div>`;
}

let rptFilterYear = String(new Date().getFullYear());

function populateRptYearSel(){
  const trigger = document.getElementById('rpt-year-trigger'); if(!trigger) return;
  const years = [...new Set(state.cfTransactions.map(t=>new Date(t.date).getFullYear()))].sort((a,b)=>b-a);
  // Ensure current year default is valid (fall back to 'all' if no transactions this year)
  if(years.length && rptFilterYear !== 'all' && !years.includes(Number(rptFilterYear))) rptFilterYear = 'all';
  state.rptYearOptionsCache = [{value:'all', label:'All time'}, ...years.map(y=>({value:String(y), label:String(y)}))];
  document.getElementById('rpt-year-sel').value = rptFilterYear;
  document.getElementById('rpt-year-label').textContent = rptFilterYear==='all' ? 'All time' : String(rptFilterYear);
}

function onRptYearChange(){
  const sel = document.getElementById('rpt-year-sel'); if(!sel) return;
  rptFilterYear = sel.value;

  renderReports();
}

function getRptTransactions(){
  if(rptFilterYear==='all') return state.cfTransactions;
  return state.cfTransactions.filter(t=>new Date(t.date).getFullYear()===Number(rptFilterYear));
}

export function renderReports(){
  populateRptYearSel();
  renderCashflowReport();
  renderIncomesReport();
  renderOutcomesReport();
  renderInvestmentsReport();
  renderAssetReport('crypto');
  renderAssetReport('etf');
  renderAssetReport('stock');
}

// ── Cashflow table ──
function renderCashflowReport(){
  const allTx = getRptTransactions();
  const periods = buildSalaryPeriods().filter(p=>{
    if(rptFilterYear==='all') return true;
    const y=Number(rptFilterYear); return p.start.getFullYear()===y||p.end.getFullYear()===y;
  });
  const liqHoldings = state.holdings.filter(h=>h.type==='bank'||h.type==='cash');
  const liqIds = new Set(liqHoldings.map(h=>h.id));

  // Reconstruct liquidity per period (same logic as liquidity chart)
  const sortedTxDesc = [...allTx]
    .filter(t=>liqIds.has(t.holding_id)||liqIds.has(t.holding_to_id))
    .sort((a,b)=>new Date(b.date)-new Date(a.date));
  let bal = liqHoldings.reduce((s,h)=>s+h.avg_cost,0);
  const liqByPeriod = {};
  liqByPeriod[periods.length-1] = bal;
  for(let i=periods.length-2;i>=0;i--){
    const p=periods[i+1];
    sortedTxDesc.forEach(t=>{
      const td=new Date(t.date);
      if(td>=p.start&&td<=p.end){
        if(t.type==='income'&&liqIds.has(t.holding_id)) bal-=t.amount;
        else if(t.type==='expense'&&liqIds.has(t.holding_id)) bal+=t.amount;
        else if(t.type==='transfer'){ if(liqIds.has(t.holding_to_id)) bal-=t.amount; if(liqIds.has(t.holding_id)) bal+=t.amount; }
        else if(t.type==='purchase'&&liqIds.has(t.holding_to_id)) bal+=t.amount;
        else if(t.type==='sale'&&liqIds.has(t.holding_to_id)) bal-=t.amount;
      }
    });
    liqByPeriod[i]=Math.max(0,bal);
  }

  // Build rows
  const salCatIds = new Set(state.cfCategories.filter(c=>{ const n=c.name.toLowerCase(); return n.includes('salary')||n.includes('salario')||n.includes('stipendio')||n.includes('wage')||n==='salary'; }).map(c=>c.id));
  const rows = periods.map((p,i)=>{
    const pTxs = allTx.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end;});
    const salary = pTxs.filter(t=>isIncomeTx(t)&&salCatIds.has(t.category_id)).reduce((s,t)=>s+t.amount,0);
    const variables = pTxs.filter(t=>isIncomeTx(t)&&!salCatIds.has(t.category_id)).reduce((s,t)=>s+t.amount,0);
    const totalInc = pTxs.filter(t=>isIncomeTx(t)).reduce((s,t)=>s+t.amount,0);
    const totalOut = pTxs.filter(t=>isOutcomeTx(t)).reduce((s,t)=>s+t.amount,0);
    const invested = pTxs.filter(t=>t.type==='purchase').reduce((s,t)=>s+t.amount,0);
    const savings = totalInc - totalOut;
    return {period:p.label, liquidity:liqByPeriod[i]??0, salary, variables, totalInc, totalOut, savings, invested};
  });

  const totalInc = rows.reduce((s,r)=>s+r.totalInc,0);
  const totalOut = rows.reduce((s,r)=>s+r.totalOut,0);
  const totalSav = totalInc - totalOut;
  const totalInv = rows.reduce((s,r)=>s+r.invested,0);

  document.getElementById('rpt-cf-summary').innerHTML =
    mkStat('Total income', rptFmt(totalInc), 'pos') +
    mkStat('Total outcomes', rptFmt(totalOut), 'neg') +
    mkStat('Net savings', rptFmt(totalSav), totalSav>=0?'pos':'neg') +
    mkStat('Invested capital', rptFmt(totalInv)) +
    mkStat('Periods', rows.length);

  const thead = `<thead><tr><th>Period</th><th>Liquidity</th><th>Salary</th><th>Variables</th><th>Total income</th><th>Outcomes</th><th>Savings</th><th>Invested</th></tr></thead>`;
  const tbody = rows.map(r=>`<tr>
    <td>${r.period}</td>
    <td>${rptFmt(r.liquidity)}</td>
    <td>${rptFmt(r.salary)}</td>
    <td>${rptFmt(r.variables)||'—'}</td>
    <td style="color:var(--green);font-weight:600">${rptFmt(r.totalInc)}</td>
    <td style="color:var(--red)">${rptFmt(r.totalOut)}</td>
    <td style="color:${r.savings>=0?'var(--green)':'var(--red)'};font-weight:600">${rptFmt(r.savings)}</td>
    <td>${r.invested>0?rptFmt(r.invested):'—'}</td>
  </tr>`).join('');
  const tfoot = `<tfoot><tr class="total-row"><td>TOTAL</td><td>—</td><td>—</td><td>—</td><td>${rptFmt(totalInc)}</td><td>${rptFmt(totalOut)}</td><td>${rptFmt(totalSav)}</td><td>${rptFmt(totalInv)}</td></tr></tfoot>`;
  document.getElementById('rpt-cf-table').innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

// ── Incomes table ──
function renderIncomesReport(){
  const allTx = getRptTransactions();
  const periods = buildSalaryPeriods().filter(p=>{
    if(rptFilterYear==='all') return true;
    const y=Number(rptFilterYear); return p.start.getFullYear()===y||p.end.getFullYear()===y;
  });
  const salCatIds = new Set(state.cfCategories.filter(c=>{ const n=c.name.toLowerCase(); return n.includes('salary')||n.includes('salario')||n.includes('stipendio')||n.includes('wage')||n==='salary'; }).map(c=>c.id));
  const rows = periods.map(p=>{
    const pTxs = allTx.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end&&isIncomeTx(t);});
    const salary = pTxs.filter(t=>salCatIds.has(t.category_id)).reduce((s,t)=>s+t.amount,0);
    const variables = pTxs.filter(t=>!salCatIds.has(t.category_id)).reduce((s,t)=>s+t.amount,0);
    const total = salary+variables;
    return {period:p.label, salary, variables, total};
  }).filter(r=>r.total>0);

  const totSal = rows.reduce((s,r)=>s+r.salary,0);
  const totVar = rows.reduce((s,r)=>s+r.variables,0);
  const totAll = totSal+totVar;
  const avgMon = rows.length ? totAll/rows.length : 0;

  document.getElementById('rpt-inc-summary').innerHTML =
    mkStat('Total salary', rptFmt(totSal), 'pos') +
    mkStat('Total variables', rptFmt(totVar)) +
    mkStat('Grand total', rptFmt(totAll), 'pos') +
    mkStat('Monthly avg', rptFmt(avgMon));

  const thead = `<thead><tr><th>Period</th><th>Salary</th><th>Variable income</th><th>Total</th></tr></thead>`;
  const tbody = rows.map(r=>`<tr>
    <td>${r.period}</td>
    <td>${rptFmt(r.salary)}</td>
    <td>${r.variables>0?rptFmt(r.variables):'—'}</td>
    <td style="color:var(--green);font-weight:600">${rptFmt(r.total)}</td>
  </tr>`).join('');
  const tfoot = `<tfoot><tr class="total-row"><td>TOTAL</td><td>${rptFmt(totSal)}</td><td>${rptFmt(totVar)}</td><td>${rptFmt(totAll)}</td></tr></tfoot>`;
  document.getElementById('rpt-inc-table').innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

// ── Outcomes by category ──
function renderOutcomesReport(){
  const allTx = getRptTransactions();
  const periods = buildSalaryPeriods().filter(p=>{
    if(rptFilterYear==='all') return true;
    const y=Number(rptFilterYear); return p.start.getFullYear()===y||p.end.getFullYear()===y;
  });
  // Get all expense categories that have been used (sub-categories roll up into their parent)
  const usedCatIds = new Set(allTx.filter(t=>isOutcomeTx(t)&&t.category_id).map(t=>getTopCategoryId(t.category_id)));
  const cats = state.cfCategories.filter(c=>usedCatIds.has(c.id)&&!c.parent_id).sort((a,b)=>a.name.localeCompare(b.name));

  const rows = periods.map(p=>{
    const pTxs = allTx.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end&&isOutcomeTx(t);});
    const total = pTxs.reduce((s,t)=>s+t.amount,0);
    if(!total) return null;
    const byCat = {};
    cats.forEach(c=>{ byCat[c.id]=pTxs.filter(t=>getTopCategoryId(t.category_id)===c.id).reduce((s,t)=>s+t.amount,0); });
    const fixed = pTxs.filter(t=>t.recurring_id).reduce((s,t)=>s+t.amount,0);
    return {period:p.label, byCat, total, fixed};
  }).filter(Boolean);

  const grandTotal = rows.reduce((s,r)=>s+r.total,0);
  const catTotals = {};
  cats.forEach(c=>{ catTotals[c.id]=rows.reduce((s,r)=>s+(r.byCat[c.id]||0),0); });
  const biggestCat = cats.sort((a,b)=>(catTotals[b.id]||0)-(catTotals[a.id]||0))[0];
  const avgMon = rows.length ? grandTotal/rows.length : 0;

  document.getElementById('rpt-out-summary').innerHTML =
    mkStat('Grand total', rptFmt(grandTotal), 'neg') +
    mkStat('Monthly avg', rptFmt(avgMon)) +
    mkStat('Periods', rows.length) +
    (biggestCat ? mkStat('Biggest category', biggestCat.name) : '');

  const catHeaders = cats.map(c=>`<th>${c.name}</th>`).join('');
  const thead = `<thead><tr><th>Period</th><th>🔁 Fixed</th>${catHeaders}<th>Total</th></tr></thead>`;
  const totalFixed = rows.reduce((s,r)=>s+(r.fixed||0),0);
  const tbody = rows.map(r=>`<tr>
    <td>${r.period}</td>
    <td style="color:var(--accent)">${r.fixed>0?rptFmt(r.fixed):'—'}</td>
    ${cats.map(c=>`<td>${r.byCat[c.id]>0?rptFmt(r.byCat[c.id]):'—'}</td>`).join('')}
    <td style="color:var(--red);font-weight:600">${rptFmt(r.total)}</td>
  </tr>`).join('');
  const catTotalCells = cats.map(c=>`<td>${catTotals[c.id]>0?rptFmt(catTotals[c.id]):'—'}</td>`).join('');
  const tfoot = `<tfoot><tr class="total-row"><td>TOTAL</td><td style="color:var(--accent)">${rptFmt(totalFixed)}</td>${catTotalCells}<td>${rptFmt(grandTotal)}</td></tr></tfoot>`;
  document.getElementById('rpt-out-table').innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

// ── Investments over time ──
function renderInvestmentsReport(){
  const allTx = getRptTransactions();
  const periods = buildSalaryPeriods().filter(p=>{
    if(rptFilterYear==='all') return true;
    const y=Number(rptFilterYear); return p.start.getFullYear()===y||p.end.getFullYear()===y;
  });
  const invTypes = ['crypto','etf','stock','bond'];
  const rows = periods.map(p=>{
    const pTxs = allTx.filter(t=>{const d=new Date(t.date);return d>=p.start&&d<=p.end&&t.type==='purchase';});
    if(!pTxs.length) return null;
    const byType = {};
    invTypes.forEach(type=>{
      const typeHoldings = state.holdings.filter(h=>h.type===type);
      const typeIds = new Set(typeHoldings.map(h=>h.id));
      byType[type] = pTxs.filter(t=>typeIds.has(t.holding_id)).reduce((s,t)=>s+t.amount,0);
    });
    const total = pTxs.reduce((s,t)=>s+t.amount,0);
    return {period:p.label, byType, total};
  }).filter(Boolean);

  const grandTotal = rows.reduce((s,r)=>s+r.total,0);
  const byTypeTotal = {};
  invTypes.forEach(type=>{ byTypeTotal[type]=rows.reduce((s,r)=>s+(r.byType[type]||0),0); });
  const currentVal = state.holdings.filter(h=>invTypes.includes(h.type)).reduce((s,h)=>s+getVal(h),0);
  const pnl = currentVal - grandTotal;
  const pnlPct = grandTotal>0 ? pnl/grandTotal*100 : 0;

  document.getElementById('rpt-inv-summary').innerHTML =
    mkStat('Total invested', rptFmt(grandTotal)) +
    mkStat('Current value', rptFmt(currentVal)) +
    mkStat('Gain / Loss', rptFmt(pnl)+(pnl!==0?' ('+rptPct(pnlPct)+')':''), pnl>=0?'pos':'neg') +
    mkStat('Periods active', rows.length);

  const thead = `<thead><tr><th>Period</th><th>Crypto</th><th>ETF</th><th>Stocks</th><th>Bonds</th><th>Total</th></tr></thead>`;
  const tbody = rows.map(r=>`<tr>
    <td>${r.period}</td>
    ${invTypes.map(type=>`<td>${r.byType[type]>0?rptFmt(r.byType[type]):'—'}</td>`).join('')}
    <td style="font-weight:600">${rptFmt(r.total)}</td>
  </tr>`).join('');
  const tfoot = `<tfoot><tr class="total-row"><td>TOTAL</td>${invTypes.map(t=>`<td>${byTypeTotal[t]>0?rptFmt(byTypeTotal[t]):'—'}</td>`).join('')}<td>${rptFmt(grandTotal)}</td></tr></tfoot>`;
  document.getElementById('rpt-inv-table').innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

// ── Asset tables (crypto/etf/stock) ──
function renderAssetReport(type){
  const typeHoldings = state.holdings.filter(h=>h.type===type);
  const summaryEl = document.getElementById(`rpt-${type}-summary`);
  const tableEl = document.getElementById(`rpt-${type}-table`);
  if(!summaryEl||!tableEl) return;

  if(!typeHoldings.length){
    summaryEl.innerHTML='';
    tableEl.innerHTML=`<tbody><tr><td style="text-align:center;padding:1.5rem;color:var(--text3)">No ${TYPE_LABELS[type]||type} holdings</td></tr></tbody>`;
    return;
  }

  const totalInvested = typeHoldings.reduce((s,h)=>s+getCost(h),0);
  const totalCurrent  = typeHoldings.reduce((s,h)=>s+getVal(h),0);
  const totalPnl      = totalCurrent - totalInvested;
  const totalPnlPct   = totalInvested>0 ? totalPnl/totalInvested*100 : 0;

  summaryEl.innerHTML =
    mkStat('Total invested', rptFmt(totalInvested)) +
    mkStat('Current value', rptFmt(totalCurrent)) +
    mkStat('Gain / Loss', rptFmt(totalPnl), totalPnl>=0?'pos':'neg') +
    mkStat('Return', rptPct(totalPnlPct), totalPnlPct>=0?'pos':'neg') +
    mkStat('Holdings', typeHoldings.length);

  const isCrypto = type==='crypto';
  const thead = `<thead><tr>
    <th>Asset</th><th>Qty</th><th>Avg cost</th><th>Live price</th><th>Invested</th><th>Current value</th><th>Gain / Loss</th><th>Return</th>
  </tr></thead>`;
  const tbody = typeHoldings.map(h=>{
    const dispTicker = isCrypto?cleanCryptoTicker(h.ticker):h.ticker;
    const dispName   = isCrypto?cleanCryptoName(h.name||h.ticker):(h.name||h.ticker);
    const cost   = getCost(h);
    const val    = getVal(h);
    const gain   = val - cost;
    const gainPct= cost>0 ? gain/cost*100 : 0;
    const price  = prices[dispTicker]??prices[h.ticker];
    return `<tr>
      <td><strong>${dispTicker}</strong><br><span style="color:var(--text2);font-size:11px">${dispName}</span></td>
      <td>${fmtN(h.qty,8)}</td>
      <td>${rptFmt(h.avg_cost)}</td>
      <td>${price?rptFmt(price):'—'}</td>
      <td>${rptFmt(cost)}</td>
      <td style="font-weight:600">${rptFmt(val)}</td>
      <td style="color:${gain>=0?'var(--green)':'var(--red)'};font-weight:600">${rptFmt(gain)}</td>
      <td style="color:${gainPct>=0?'var(--green)':'var(--red)'}">${rptPct(gainPct)}</td>
    </tr>`;
  }).join('');
  const tfoot = `<tfoot><tr class="total-row">
    <td>TOTAL</td><td>—</td><td>—</td><td>—</td>
    <td>${rptFmt(totalInvested)}</td>
    <td>${rptFmt(totalCurrent)}</td>
    <td style="color:${totalPnl>=0?'var(--green)':'var(--red)'}">${rptFmt(totalPnl)}</td>
    <td style="color:${totalPnlPct>=0?'var(--green)':'var(--red)'}">${rptPct(totalPnlPct)}</td>
  </tr></tfoot>`;
  tableEl.innerHTML = thead+`<tbody>${tbody}</tbody>`+tfoot;
}

// ─────────────────────────────────────────
// SNAPSHOTS & RESTORE
// ─────────────────────────────────────────
export async function loadSnapshots(){
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

export async function restoreSnapshot(id, date){
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

// ─────────────────────────────────────────────
// Legacy inline-HTML compatibility
// ─────────────────────────────────────────────
exposeLegacyFunctions({
  renderInsights,
  toggleYearDropdown,
  renderMonthlyChart,
  openRptYearPicker,
  renderAllocation,
  renderReports,
  restoreSnapshot,
  loadSnapshots,
});