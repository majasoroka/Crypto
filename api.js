// api.js - Real market data via Yahoo Finance (proxied for CORS)
const PROXY = 'https://proxy.cors.dev/';

export async function fetchQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const res = await fetch(PROXY + url);
    if (!res.ok) throw new Error('Quote fetch failed');
    const data = await res.json();
    const meta = data.chart.result[0].meta;
    const prev = meta.chartPreviousClose || meta.previousClose;
    const price = meta.regularMarketPrice;
    const change = price - prev;
    const changePct = (change / prev) * 100;
    return {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || symbol,
      price,
      change,
      changePct,
      previousClose: prev,
      currency: meta.currency || 'USD',
      exchange: meta.exchangeName || ''
    };
  } catch (e) {
    console.error('fetchQuote error', symbol, e);
    return null;
  }
}

export async function fetchChart(symbol, range = '1d', interval = '5m') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const res = await fetch(PROXY + url);
    if (!res.ok) throw new Error('Chart fetch failed');
    const data = await res.json();
    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const closes = result.indicators.quote[0].close || [];
    const points = timestamps.map((t, i) => ({
      time: t,
      value: closes[i]
    })).filter(p => p.value != null);
    return points;
  } catch (e) {
    console.error('fetchChart error', symbol, e);
    return [];
  }
}

export async function fetchMultipleQuotes(symbols) {
  const results = await Promise.all(symbols.map(s => fetchQuote(s)));
  return results.filter(Boolean);
}

// Popular assets
export const POPULAR_STOCKS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD'];
export const POPULAR_CRYPTO = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD'];
export const ALL_POPULAR = [...POPULAR_STOCKS, ...POPULAR_CRYPTO];
