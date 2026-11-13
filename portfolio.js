// portfolio.js - Paper trading portfolio using localStorage
const STORAGE_KEY = 'paper_portfolio_v1';

export function loadPortfolio() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePortfolio(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function createPortfolio(startingCash) {
  const p = {
    cash: startingCash,
    holdings: {}, // symbol -> { qty, avgCost, name }
    history: [], // { type, symbol, qty, price, total, time }
    createdAt: Date.now()
  };
  savePortfolio(p);
  return p;
}

export function buy(portfolio, symbol, qty, price, name) {
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
  portfolio.history.push({
    type: 'buy',
    symbol,
    qty,
    price,
    total: cost,
    time: Date.now()
  });
  savePortfolio(portfolio);
  return { success: true };
}

export function sell(portfolio, symbol, qty, price) {
  const h = portfolio.holdings[symbol];
  if (!h || h.qty < qty) return { error: 'Not enough shares' };
  const proceeds = qty * price;
  portfolio.cash += proceeds;
  h.qty -= qty;
  if (h.qty <= 0.000001) {
    delete portfolio.holdings[symbol];
  }
  portfolio.history.push({
    type: 'sell',
    symbol,
    qty,
    price,
    total: proceeds,
    time: Date.now()
  });
  savePortfolio(portfolio);
  return { success: true };
}

export function calculatePortfolioValue(portfolio, quotes) {
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
      symbol,
      name: h.name || symbol,
      qty: h.qty,
      avgCost: h.avgCost,
      price,
      value,
      gain,
      gainPct,
      change: q ? q.change : 0,
      changePct: q ? q.changePct : 0
    });
  }
  const total = portfolio.cash + holdingsValue;
  return { total, holdingsValue, positions };
}
