// script.js - Main application logic
import { fetchQuote, fetchChart, fetchMultipleQuotes, ALL_POPULAR, POPULAR_STOCKS, POPULAR_CRYPTO } from './api.js';
import { loadPortfolio, createPortfolio, buy, sell, calculatePortfolioValue, savePortfolio } from './portfolio.js';

// Lightweight Charts is loaded via CDN in HTML
const { createChart, LineSeries } = window.LightweightCharts || {};

let portfolio = null;
let currentQuotes = [];
let currentView = 'portfolio'; // or 'asset'
let currentAsset = null;
let portfolioChart = null;
let assetChart = null;
let priceUpdateInterval = null;

// DOM refs
const onboardingModal = document.getElementById('onboarding-modal');
const startBtn = document.getElementById('start-btn');
const startingCashInput = document.getElementById('starting-cash');
const portfolioValueEl = document.getElementById('portfolio-value');
const portfolioChangeEl = document.getElementById('portfolio-change');
const positionsList = document.getElementById('positions-list');
const buyingPowerEl = document.getElementById('buying-power');
const searchInput = document.getElementById('search-input');
const popularList = document.getElementById('popular-list');
const assetDetail = document.getElementById('asset-detail');
const portfolioView = document.getElementById('portfolio-view');
const assetPriceEl = document.getElementById('asset-price');
const assetChangeEl = document.getElementById('asset-change');
const assetNameEl = document.getElementById('asset-name');
const buyBtn = document.getElementById('buy-btn');
const sellBtn = document.getElementById('sell-btn');
const tradeModal = document.getElementById('trade-modal');
const tradeQtyInput = document.getElementById('trade-qty');
const tradeConfirmBtn = document.getElementById('trade-confirm');
const tradeCancelBtn = document.getElementById('trade-cancel');
const tradeTitle = document.getElementById('trade-title');
let tradeAction = 'buy';

function formatMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function formatPct(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function init() {
  portfolio = loadPortfolio();
  if (!portfolio) {
    document.getElementById('onboarding-modal').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  } else {
    document.getElementById('onboarding-modal').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    startApp();
  }
}

startBtn.addEventListener('click', () => {
  const cash = parseFloat(startingCashInput.value) || 10000;
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
  portfolioValueEl.textContent = formatMoney(total);
  // Approximate day change from quotes (simplified)
  let dayChange = 0;
  positions.forEach(p => {
    dayChange += p.qty * (p.change || 0);
  });
  const dayPct = total > 0 ? (dayChange / (total - dayChange)) * 100 : 0;
  portfolioChangeEl.textContent = `${dayChange >= 0 ? '+' : ''}${formatMoney(dayChange)} (${formatPct(dayPct)}) Today`;
  portfolioChangeEl.className = `portfolio-change ${dayChange >= 0 ? 'positive' : 'negative'}`;
  buyingPowerEl.innerHTML = `Buying Power <span>${formatMoney(portfolio.cash)}</span>`;

  positionsList.innerHTML = '';
  if (positions.length === 0) {
    positionsList.innerHTML = '<p style="color:var(--muted);padding:20px 0;">No positions yet. Search and buy some assets!</p>';
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
      positionsList.appendChild(el);
    });
  }
}

async function renderPopular() {
  popularList.innerHTML = '';
  const popularQuotes = currentQuotes.filter(q => ALL_POPULAR.includes(q.symbol));
  popularQuotes.slice(0, 8).forEach(q => {
    const el = document.createElement('div');
    el.className = 'asset-row';
    const cls = q.change >= 0 ? 'positive' : 'negative';
    el.innerHTML = `
      <div>
        <div class="asset-symbol">${q.symbol}</div>
        <div style="font-size:12px;color:var(--muted)">${q.name}</div>
      </div>
      <div class="asset-price ${cls}">${formatMoney(q.price)}<br><small>${formatPct(q.changePct)}</small></div>
    `;
    el.onclick = () => openAsset(q.symbol);
    popularList.appendChild(el);
  });
}

async function openAsset(symbol) {
  currentAsset = symbol;
  currentView = 'asset';
  portfolioView.style.display = 'none';
  assetDetail.style.display = 'block';
  const q = currentQuotes.find(x => x.symbol === symbol) || await fetchQuote(symbol);
  if (!q) return;
  assetNameEl.textContent = q.name;
  assetPriceEl.textContent = formatMoney(q.price);
  assetChangeEl.textContent = `${q.change >= 0 ? '+' : ''}${formatMoney(q.change)} (${formatPct(q.changePct)})`;
  assetChangeEl.className = q.change >= 0 ? 'positive' : 'negative';
  await loadAssetChart(symbol);
}

async function loadAssetChart(symbol) {
  const container = document.getElementById('asset-chart');
  container.innerHTML = '';
  if (!createChart) {
    container.innerHTML = '<div class="loading">Chart library loading...</div>';
    return;
  }
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
    crosshair: { mode: 0 },
    width: container.clientWidth,
    height: 280
  });
  const isUp = points[points.length - 1].value >= points[0].value;
  const series = chart.addSeries(LineSeries, {
    color: isUp ? '#00C805' : '#FF5000',
    lineWidth: 2,
    priceLineVisible: false
  });
  series.setData(points.map(p => ({ time: p.time, value: p.value })));
  chart.timeScale().fitContent();
  assetChart = chart;
}

function showPortfolio() {
  currentView = 'portfolio';
  assetDetail.style.display = 'none';
  portfolioView.style.display = 'block';
  if (assetChart) {
    assetChart.remove();
    assetChart = null;
  }
}

document.getElementById('back-btn').addEventListener('click', showPortfolio);

// Trade modal
function openTrade(action) {
  tradeAction = action;
  tradeTitle.textContent = action === 'buy' ? 'Buy' : 'Sell';
  tradeModal.style.display = 'flex';
  tradeQtyInput.value = '1';
  tradeQtyInput.focus();
}

buyBtn.addEventListener('click', () => openTrade('buy'));
sellBtn.addEventListener('click', () => openTrade('sell'));

tradeCancelBtn.addEventListener('click', () => tradeModal.style.display = 'none');

tradeConfirmBtn.addEventListener('click', async () => {
  const qty = parseFloat(tradeQtyInput.value);
  if (!qty || qty <= 0) return alert('Enter a valid quantity');
  const q = currentQuotes.find(x => x.symbol === currentAsset) || await fetchQuote(currentAsset);
  if (!q) return alert('Could not get price');
  let result;
  if (tradeAction === 'buy') {
    result = buy(portfolio, currentAsset, qty, q.price, q.name);
  } else {
    result = sell(portfolio, currentAsset, qty, q.price);
  }
  if (result.error) {
    alert(result.error);
    return;
  }
  tradeModal.style.display = 'none';
  await refreshQuotes();
  renderPortfolio();
  if (currentView === 'asset') openAsset(currentAsset);
});

function setupSearch() {
  searchInput.addEventListener('input', async (e) => {
    const q = e.target.value.trim().toUpperCase();
    if (q.length < 1) return;
    // Simple: if matches popular or try fetch
    if (ALL_POPULAR.includes(q) || q.endsWith('-USD')) {
      openAsset(q);
    }
  });
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const symbol = searchInput.value.trim().toUpperCase();
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
        assetPriceEl.textContent = formatMoney(q.price);
        assetChangeEl.textContent = `${q.change >= 0 ? '+' : ''}${formatMoney(q.change)} (${formatPct(q.changePct)})`;
        assetChangeEl.className = q.change >= 0 ? 'positive' : 'negative';
      }
    }
  }, 15000); // every 15s
}

// Timeframe buttons (stub - can expand)
document.querySelectorAll('.timeframe-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // In full version, reload chart with different range
  });
});

// Init
init();

// Resize charts
window.addEventListener('resize', () => {
  if (assetChart) assetChart.applyOptions({ width: document.getElementById('asset-chart').clientWidth });
});
