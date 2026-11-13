// Single-file script - no modules so it works reliably on GitHub Pages
const PROXY = 'https://proxy.cors.dev/';
const STORAGE_KEY = 'paper_portfolio_v1';

const POPULAR_STOCKS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD'];
const POPULAR_CRYPTO = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD'];
const ALL_POPULAR = [...POPULAR_STOCKS, ...POPULAR_CRYPTO];

// Portfolio functions
function loadPortfolio() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function savePortfolio(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}
function createPortfolio(startingCash) {
  const p = { cash: startingCash, holdings: {}, history: [], createdAt: Date.now() };
  savePortfolio(p);
  return p;
}
function buy(portfolio, symbol, qty, price, name) {
  const cost = qty * price;
  if (cost > portfolio.cash + 0.01) return { error: 'Insufficient buying power' };
  portfolio.cash -= cost;
  if (!portfolio.holdings[symbol]) {
    portfolio.holdings[symbol] = { qty: 0, avgCost: 0, name: name || symbol };
  }
  const h = portfolio.holdings[symbol];
  const totalCost = h.avgCost * h.qty + cost;
  h.qty += qty;
  h.avgCost = totalCost / h.qty;
  portfolio.history.push({ type: 'buy', symbol, qty, price, total: cost, time: Date.now() });
  savePortfolio(portfolio);
  return { success: true };
}
function sell(portfolio, symbol, qty, price) {
  const h = portfolio.holdings[symbol];
  if (!h || h.qty < qty) return { error: 'Not enough shares' };
  const proceeds = qty * price;
  portfolio.cash += proceeds;
  h.qty -= qty;
  if (h.qty <= 0.000001) delete portfolio.holdings[symbol];
  portfolio.history.push({ type: 'sell', symbol, qty, price, total: proceeds, time: Date.now() });
  savePortfolio(portfolio);
  return { success: true };
}
function calculatePortfolioValue(portfolio, quotes) {
  let holdingsValue = 0;
  const positions = [];
  for (const [symbol, h] of Object.entries(portfolio.holdings)) {
    const q = quotes.find(x => x.symbol === symbol);
    const price = q ? q.price : h.avgCost;
    const value = h.qty * price;
    holdingsValue += value;
    const gain = value - (h.qty * h.avgCost);
    const gainPct = h.avgCost ? (gain / (h.qty * h.avgCost)) * 100 : 0;
    positions.push({
      symbol, name: h.name || symbol, qty: h.qty, avgCost: h.avgCost,
      price, value, gain, gainPct, change: q ? q.change : 0, changePct: q ? q.changePct : 0
    });
  }
  return { total: portfolio.cash + holdingsValue, holdingsValue, positions };
}

// API functions
async function fetchQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(PROXY + url);
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const meta = data.chart.result[0].meta;
    const prev = meta.chartPreviousClose || meta.previousClose;
    const price = meta.regularMarketPrice;
    const change = price - prev;
    const changePct = (change / prev) * 100;
    return {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || symbol,
      price, change, changePct, previousClose: prev
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}
async function fetchChart(symbol, range = '1d', interval = '5m') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const res = await fetch(PROXY + url);
    if (!res.ok) throw new Error('failed');
    const data = await res.json();
    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const closes = result.indicators.quote[0].close || [];
    return timestamps.map((t, i) => ({ time: t, value: closes[i] })).filter(p => p.value != null);
  } catch (e) {
    console.error(e);
    return [];
  }
}
async function fetchMultipleQuotes(symbols) {
  const results = await Promise.all(symbols.map(s => fetchQuote(s)));
  return results.filter(Boolean);
}

// App logic
let portfolio = null;
let currentQuotes = [];
let currentView = 'portfolio';
let currentAsset = null;
let assetChart = null;
let priceUpdateInterval = null;

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}
function formatPct(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function init() {
  portfolio = loadPortfolio();
  const modal = document.getElementById('onboarding-modal');
  const app = document.getElementById('app');
  if (!portfolio) {
    modal.style.display = 'flex';
    app.style.display = 'none';
  } else {
    modal.style.display = 'none';
    app.style.display = 'block';
    startApp();
  }
}

document.getElementById('start-btn').addEventListener('click', () => {
  const cash = parseFloat(document.getElementById('starting-cash').value) || 10000;
  if (cash < 100) {
    alert('Please enter at least $100');
    return;
  }
  portfolio = createPortfolio(cash);
  document.getElementById('onboarding-modal').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  startApp();
});

async function startApp() {
  await refreshQuotes();
  renderPortfolio();
  renderPopular();
  startPriceUpdates();
  setupSearch();
}

async function refreshQuotes() {
  const symbols = new Set(ALL_POPULAR);
  Object.keys(portfolio.holdings).forEach(s => symbols.add(s));
  currentQuotes = await fetchMultipleQuotes([...symbols]);
}

function renderPortfolio() {
  const { total, positions } = calculatePortfolioValue(portfolio, currentQuotes);
  document.getElementById('portfolio-value').textContent = formatMoney(total);
  let dayChange = 0;
  positions.forEach(p => { dayChange += p.qty * (p.change || 0); });
  const dayPct = total > 0 ? (dayChange / (total - dayChange)) * 100 : 0;
  const changeEl = document.getElementById('portfolio-change');
  changeEl.textContent = `${dayChange >= 0 ? '+' : ''}${formatMoney(dayChange)} (${formatPct(dayPct)}) Today`;
  changeEl.className = `portfolio-change ${dayChange >= 0 ? 'positive' : 'negative'}`;
  document.getElementById('buying-power').innerHTML = `Buying Power <span>${formatMoney(portfolio.cash)}</span>`;

  const list = document.getElementById('positions-list');
  list.innerHTML = '';
  if (positions.length === 0) {
    list.innerHTML = '<p style="color:#5C6166;padding:20px 0;">No positions yet. Search and buy some assets!</p>';
  } else {
    positions.forEach(p => {
      const el = document.createElement('div');
      el.className = 'position-item';
      el.innerHTML = `
        <div class="position-info">
          <div class="position-symbol">${p.symbol}</div>
          <div class="position-name">${p.name}</div>
        </div>
        <div class="position-value">
          <div style="font-weight:700">${formatMoney(p.value)}</div>
          <div class="position-qty ${p.gain >= 0 ? 'positive' : 'negative'}">${p.gain >= 0 ? '+' : ''}${formatMoney(p.gain)} (${formatPct(p.gainPct)})</div>
        </div>
      `;
      el.onclick = () => openAsset(p.symbol);
      list.appendChild(el);
    });
  }
}

async function renderPopular() {
  const list = document.getElementById('popular-list');
  list.innerHTML = '';
  const popularQuotes = currentQuotes.filter(q => ALL_POPULAR.includes(q.symbol));
  popularQuotes.slice(0, 8).forEach(q => {
    const el = document.createElement('div');
    el.className = 'asset-row';
    const cls = q.change >= 0 ? 'positive' : 'negative';
    el.innerHTML = `
      <div>
        <div class="asset-symbol">${q.symbol}</div>
        <div style="font-size:12px;color:#5C6166">${q.name}</div>
      </div>
      <div class="asset-price ${cls}">${formatMoney(q.price)}<br><small>${formatPct(q.changePct)}</small></div>
    `;
    el.onclick = () => openAsset(q.symbol);
    list.appendChild(el);
  });
}

async function openAsset(symbol) {
  currentAsset = symbol;
  currentView = 'asset';
  document.getElementById('portfolio-view').style.display = 'none';
  document.getElementById('asset-detail').style.display = 'block';
  const q = currentQuotes.find(x => x.symbol === symbol) || await fetchQuote(symbol);
  if (!q) return;
  document.getElementById('asset-name').textContent = q.name;
  document.getElementById('asset-price').textContent = formatMoney(q.price);
  const changeEl = document.getElementById('asset-change');
  changeEl.textContent = `${q.change >= 0 ? '+' : ''}${formatMoney(q.change)} (${formatPct(q.changePct)})`;
  changeEl.className = q.change >= 0 ? 'positive' : 'negative';
  await loadAssetChart(symbol);
}

async function loadAssetChart(symbol) {
  const container = document.getElementById('asset-chart');
  container.innerHTML = '';
  if (!window.LightweightCharts) {
    container.innerHTML = '<div class="loading">Chart loading...</div>';
    return;
  }
  const { createChart, LineSeries } = window.LightweightCharts;
  const points = await fetchChart(symbol, '1d', '5m');
  if (points.length === 0) {
    container.innerHTML = '<div class="loading">No chart data</div>';
    return;
  }
  const chart = createChart(container, {
    layout: { background: { color: '#ffffff' }, textColor: '#1B1B1B' },
    grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false },
    width: container.clientWidth,
    height: 280
  });
  const isUp = points[points.length - 1].value >= points[0].value;
  const series = chart.addSeries(LineSeries, {
    color: isUp ? '#00C805' : '#FF5000',
    lineWidth: 2
  });
  series.setData(points.map(p => ({ time: p.time, value: p.value })));
  chart.timeScale().fitContent();
  assetChart = chart;
}

document.getElementById('back-btn').addEventListener('click', () => {
  currentView = 'portfolio';
  document.getElementById('asset-detail').style.display = 'none';
  document.getElementById('portfolio-view').style.display = 'block';
  if (assetChart) { assetChart.remove(); assetChart = null; }
});

let tradeAction = 'buy';
document.getElementById('buy-btn').addEventListener('click', () => {
  tradeAction = 'buy';
  document.getElementById('trade-title').textContent = 'Buy';
  document.getElementById('trade-modal').style.display = 'flex';
});
document.getElementById('sell-btn').addEventListener('click', () => {
  tradeAction = 'sell';
  document.getElementById('trade-title').textContent = 'Sell';
  document.getElementById('trade-modal').style.display = 'flex';
});
document.getElementById('trade-cancel').addEventListener('click', () => {
  document.getElementById('trade-modal').style.display = 'none';
});
document.getElementById('trade-confirm').addEventListener('click', async () => {
  const qty = parseFloat(document.getElementById('trade-qty').value);
  if (!qty || qty <= 0) return alert('Enter a valid quantity');
  const q = currentQuotes.find(x => x.symbol === currentAsset) || await fetchQuote(currentAsset);
  if (!q) return alert('Could not get price');
  let result = tradeAction === 'buy'
    ? buy(portfolio, currentAsset, qty, q.price, q.name)
    : sell(portfolio, currentAsset, qty, q.price);
  if (result.error) { alert(result.error); return; }
  document.getElementById('trade-modal').style.display = 'none';
  await refreshQuotes();
  renderPortfolio();
  if (currentView === 'asset') openAsset(currentAsset);
});

function setupSearch() {
  const input = document.getElementById('search-input');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const symbol = input.value.trim().toUpperCase();
      if (symbol) openAsset(symbol);
    }
  });
}

function startPriceUpdates() {
  if (priceUpdateInterval) clearInterval(priceUpdateInterval);
  priceUpdateInterval = setInterval(async () => {
    await refreshQuotes();
    if (currentView === 'portfolio') renderPortfolio();
    renderPopular();
    if (currentView === 'asset' && currentAsset) {
      const q = currentQuotes.find(x => x.symbol === currentAsset);
      if (q) {
        document.getElementById('asset-price').textContent = formatMoney(q.price);
        const changeEl = document.getElementById('asset-change');
        changeEl.textContent = `${q.change >= 0 ? '+' : ''}${formatMoney(q.change)} (${formatPct(q.changePct)})`;
        changeEl.className = q.change >= 0 ? 'positive' : 'negative';
      }
    }
  }, 15000);
}

// Start
init();
