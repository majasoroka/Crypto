# Robinhood Paper Trading Simulator

Ultra-realistic paper trading platform that looks and feels like Robinhood.com. Uses live market data for stocks and crypto (via Yahoo Finance), but all trades are simulated with fake money stored in your browser's localStorage.

**Disclaimer:** This is a simulator for educational/entertainment purposes only. Not affiliated with Robinhood. Not financial advice. Real money is not involved.

## Features
- Realistic Robinhood-style UI (green/red charts, portfolio value, positions)
- Live prices and charts for stocks (AAPL, TSLA, NVDA, etc.) and crypto (BTC-USD, ETH-USD, etc.)
- Choose your starting buying power
- Buy and sell with real-time prices
- Portfolio tracking with gains/losses
- Search and browse popular assets
- All data persists in localStorage (no account needed)

## Files
- `index.html` - Main page
- `css/styles.css` - Styling
- `js/script.js` - Main app logic
- `js/api.js` - Market data fetching
- `js/portfolio.js` - Paper portfolio management

## How to Deploy on GitHub Pages
1. Create a new GitHub repository (public).
2. Upload all these files (keep the folder structure: css/, js/).
3. Go to Settings → Pages → Source: Deploy from branch (main / root).
4. Your site will be live at `https://yourusername.github.io/your-repo-name/`.

## Local Testing
Just open `index.html` in a modern browser. Note: some browsers block local file CORS; for best results serve with a simple local server:
```
python -m http.server 8000
```
Then visit http://localhost:8000

## Notes
- Prices update every ~15 seconds.
- Charts use TradingView's free Lightweight Charts library (loaded from CDN).
- Data comes from Yahoo Finance via a public CORS proxy (proxy.cors.dev). Rate limits may apply.
- To reset your account, clear localStorage for the site or delete the key `paper_portfolio_v1`.

Enjoy your realistic paper trading experience!
