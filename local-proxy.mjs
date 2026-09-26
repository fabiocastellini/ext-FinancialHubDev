// Small local Yahoo Finance proxy for the static Live Server app.
// Run with: node local-proxy.mjs
import { createServer } from 'node:http';

const PORT = 8787;
const allowedOrigins = new Set([
  'http://127.0.0.1:5500',
  'http://localhost:5500',
]);

createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let upstream;
  if (url.pathname === '/api/yh-search') {
    const q = url.searchParams.get('q')?.trim();
    if (!q || q.length > 100) {
      res.writeHead(400).end(JSON.stringify({ error: 'Invalid query' }));
      return;
    }
    upstream = new URL('https://query1.finance.yahoo.com/v1/finance/search');
    upstream.search = new URLSearchParams({ q, lang: 'en-US', region: 'US', quotesCount: '8', newsCount: '0', enableFuzzyQuery: 'false', enableCb: 'false' });
  } else if (url.pathname === '/api/yh-price') {
    const ticker = url.searchParams.get('ticker')?.trim();
    if (!ticker || ticker.length > 30 || !/^[A-Za-z0-9.^=_-]+$/.test(ticker)) {
      res.writeHead(400).end(JSON.stringify({ error: 'Invalid ticker' }));
      return;
    }
    upstream = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
    upstream.search = new URLSearchParams({ interval: '1d', range: '1d' });
  } else {
    res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  try {
    const response = await fetch(upstream, { headers: { 'User-Agent': 'Mozilla/5.0 FinancialHub local development' } });
    const body = await response.text();
    res.writeHead(response.status).end(body);
  } catch (error) {
    res.writeHead(502).end(JSON.stringify({ error: 'Yahoo Finance request failed', detail: error.message }));
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`FinancialHub local Yahoo proxy listening on http://127.0.0.1:${PORT}`);
});
