function renderTx(){
  const filtered=txFilter==='all'?transactions:transactions.filter(t=>t.type===txFilter);
  const empty=document.getElementById('tx-empty'), table=document.getElementById('tx-table'), tbody=document.getElementById('tx-tbody');
  if(!empty||!table||!tbody) return; // old tx page removed
  if(!filtered.length){empty.style.display='';table.style.display='none';return;}
  empty.style.display='none'; table.style.display='';
  tbody.innerHTML=filtered.map(t=>`<tr>
    <td style="color:var(--text2)">${t.date||'—'}</td>
    <td><strong style="font-weight:600">${t.ticker}</strong><br><span style="color:var(--text2);font-size:12px">${t.name||''}</span></td>
    <td><span style="color:${TX_COLORS[t.type]||'var(--text2)'};font-weight:600;text-transform:capitalize">${t.type}</span></td>
    <td>${t.qty?fmtN(t.qty):'—'}</td>
    <td>${t.price?fmt(t.price):'—'}</td>
    <td style="font-weight:600">${t.total?fmt(t.total):'—'}</td>
    <td><button class="btn btn-sm btn-danger" onclick="deleteTx('${t.id}')"><i class="ti ti-trash"></i></button></td>
  </tr>`).join('');
}

async function saveTx(){
  const ticker=document.getElementById('tx-ticker').value.trim().toUpperCase();
  if(!ticker){await showAlert('Please enter a ticker.');return;}
  const row={
    date:document.getElementById('tx-date').value,
    type:document.getElementById('tx-type').value,
    ticker, name:document.getElementById('tx-name').value.trim()||ticker,
    qty:parseFloat(document.getElementById('tx-qty').value)||null,
    price:parseFloat(document.getElementById('tx-price').value)||null,
    notes:document.getElementById('tx-notes').value.trim()||null
  };
  row.total=(row.qty&&row.price)?row.qty*row.price:null;
  await api('transactions',{method:'POST',body:JSON.stringify(row)});
  closeModal('modal-tx'); await loadAll(); toast('Transaction saved ✓');
}

async function deleteTx(id){
  if(!await showConfirm('Remove this transaction?')) return;
  await api(`transactions?id=eq.${id}`,{method:'DELETE'}); await loadAll(); toast('Transaction removed');
}

function setFilter(f,btn){
  txFilter=f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderTx();
}

// ── PRICES ──
// CoinGecko symbol/ticker → coin ID map (runtime, extended on search selection)
const COINGECKO_IDS = {
  'BTC':'bitcoin','ETH':'ethereum','SOL':'solana','BNB':'binancecoin',
  'XRP':'ripple','ADA':'cardano','AVAX':'avalanche-2','DOT':'polkadot',
  'DOGE':'dogecoin','SHIB':'shiba-inu','MATIC':'matic-network','LINK':'chainlink',
  'UNI':'uniswap','LTC':'litecoin','BCH':'bitcoin-cash','ATOM':'cosmos',
  'XLM':'stellar','ALGO':'algorand','VET':'vechain','FIL':'filecoin',
  'ICP':'internet-computer','APT':'aptos','ARB':'arbitrum','OP':'optimism',
  'INJ':'injective-protocol','SUI':'sui','TIA':'celestia','SEI':'sei-network',
  'KAS':'kaspa','NEAR':'near','FTM':'fantom','SAND':'the-sandbox',
  'MANA':'decentraland','AXS':'axie-infinity','GRT':'the-graph',
  'AAVE':'aave','MKR':'maker','CRV':'curve-dao-token','SNX':'havven',
  'COMP':'compound-governance-token','YFI':'yearn-finance','SUSHI':'sushi',
  'PEPE':'pepe','WIF':'dogwifcoin','BONK':'bonk','FLOKI':'floki',
  'TON':'the-open-network','NOT':'notcoin','TRUMP':'maga',
};

// Resolve ticker → CoinGecko ID.
// Ticker may be the raw symbol (e.g. KAS) or whatever Yahoo would use.
// selectCryptoTicker() always registers the correct cgId at selection time.
