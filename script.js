// --- GLOBAL APPLICATION STATE ---
let marketAssets = [];
let selectedAsset = null;
let orderMode = 'BUY';
let orderType = 'MARKET';
let portfolioTimeframe = '1D';

let accountState = JSON.parse(localStorage.getItem('robinhood_ultimate_state')) || {
    cash: 10000,
    positions: [], // { id, symbol, name, shares, avgPrice, type, image }
    history: [     // { id, type, symbol, shares, price, total, time }
        { id: '1', type: 'DEPOSIT', symbol: 'USD', shares: 10000, price: 1, total: 10000, time: new Date().toLocaleDateString() }
    ]
};

let chart, lineSeries;

// --- INITIALIZATION ---
window.onload = async () => {
    initChart();
    await fetchMarketData();
    setupSearchListener();
    setInterval(pollLiveMarkets, 15000); // Live price updates
};

// --- CHART SETUP ---
function initChart() {
    const container = document.getElementById('chart-container');
    container.innerHTML = '';
    chart = LightweightCharts.createChart(container, {
        layout: {
            background: { color: '#ffffff' },
            textColor: '#1e222d',
        },
        grid: {
            vertLines: { color: '#f4f6f8' },
            horzLines: { color: '#f4f6f8' },
        },
        timeScale: {
            timeVisible: true,
            borderColor: '#e8ebef'
        },
        rightPriceScale: {
            borderColor: '#e8ebef'
        }
    });
    lineSeries = chart.addAreaSeries({
        topColor: 'rgba(0, 200, 5, 0.25)',
        bottomColor: 'rgba(0, 200, 5, 0.0)',
        lineColor: '#00c805',
        lineWidth: 2.5,
    });
}

// --- DATA FETCHING (Live Crypto + Stochastic Stock Simulation) ---
async function fetchMarketData() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=15&page=1&sparkline=true');
        const cryptoData = await res.json();

        // Premium Stock Fallbacks with stochastic variation
        const stockAssets = [
            { id: 'apple', symbol: 'AAPL', name: 'Apple Inc.', current_price: 226.50, price_change_percentage_24h: 1.45, type: 'stock', image: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', sparkline_in_7d: { price: [220, 222, 224, 226.5] } },
            { id: 'tesla', symbol: 'TSLA', name: 'Tesla Motors', current_price: 242.80, price_change_percentage_24h: -2.10, type: 'stock', image: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png', sparkline_in_7d: { price: [250, 248, 245, 242.8] } },
            { id: 'nvidia', symbol: 'NVDA', name: 'NVIDIA Corp', current_price: 128.40, price_change_percentage_24h: 3.82, type: 'stock', image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', sparkline_in_7d: { price: [122, 124, 126, 128.4] } },
            { id: 'microsoft', symbol: 'MSFT', name: 'Microsoft Corp', current_price: 415.20, price_change_percentage_24h: 0.92, type: 'stock', image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png', sparkline_in_7d: { price: [410, 412, 413, 415.2] } },
            { id: 'amazon', symbol: 'AMZN', name: 'Amazon.com Inc', current_price: 186.70, price_change_percentage_24h: -0.45, type: 'stock', image: 'https://assets.coingecko.com/coins/images/325/large/Tether.png', sparkline_in_7d: { price: [188, 187, 186, 186.7] } }
        ];

        const formattedCrypto = cryptoData.map(c => ({
            id: c.id,
            symbol: c.symbol.toUpperCase(),
            name: c.name,
            current_price: c.current_price,
            price_change_percentage_24h: c.price_change_percentage_24h || 0,
            type: 'crypto',
            image: c.image,
            sparkline_in_7d: c.sparkline_in_7d
        }));

        marketAssets = [...stockAssets, ...formattedCrypto];

        if (!selectedAsset && marketAssets.length > 0) {
            selectedAsset = marketAssets[0];
            loadAssetIntoTradePanel(selectedAsset);
        }

        renderWatchlist();
        renderCryptoHub();
        loadOptionsChain();
        updateUI();
    } catch (e) {
        console.error("Market fetch error:", e);
    }
}

async function pollLiveMarkets() {
    // Slight random walk simulation for hyper-realism
    marketAssets.forEach(asset => {
        const delta = (Math.random() - 0.49) * (asset.current_price * 0.002);
        asset.current_price = parseFloat((asset.current_price + delta).toFixed(2));
    });
    updateUI();
}

// --- NAVIGATION & VIEWS ---
function switchView(viewName) {
    ['portfolio', 'crypto', 'options', 'history'].forEach(v => {
        document.getElementById(`view-${v}`).classList.add('hidden');
        document.getElementById(`view-${v}`).classList.remove('grid');
        document.getElementById(`nav-btn-${v}`).className = 'text-gray-500 hover:text-black py-5 transition';
    });

    const target = document.getElementById(`view-${viewName}`);
    target.classList.remove('hidden');
    if (viewName === 'portfolio' || viewName === 'crypto') target.classList.add('grid');
    document.getElementById(`nav-btn-${viewName}`).className = 'text-black border-b-2 border-black py-5 transition';
}

// --- SEARCH & WATCHLIST ---
function setupSearchListener() {
    const input = document.getElementById('global-search');
    const dropdown = document.getElementById('search-dropdown');

    input.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (!query) {
            dropdown.classList.add('hidden');
            return;
        }
        const results = marketAssets.filter(a => a.name.toLowerCase().includes(query) || a.symbol.toLowerCase().includes(query));
        dropdown.innerHTML = '';
        if (results.length === 0) {
            dropdown.innerHTML = `<div class="p-3 text-xs text-gray-400">No assets found</div>`;
        } else {
            results.forEach(asset => {
                const div = document.createElement('div');
                div.className = 'p-3 flex items-center justify-between hover:bg-rhGray cursor-pointer';
                div.innerHTML = `
                    <div class="flex items-center space-x-2.5">
                        <img src="${asset.image}" class="w-6 h-6 rounded-full">
                        <div><div class="font-bold text-xs uppercase text-black">${asset.symbol}</div><div class="text-[10px] text-gray-400">${asset.name}</div></div>
                    </div>
                    <div class="text-right font-bold text-xs">$${asset.current_price.toLocaleString()}</div>
                `;
                div.onclick = () => {
                    loadAssetIntoTradePanel(asset);
                    dropdown.classList.add('hidden');
                    input.value = '';
                    switchView('portfolio');
                };
                dropdown.appendChild(div);
            });
        }
        dropdown.classList.remove('hidden');
    });
}

function renderWatchlist() {
    const container = document.getElementById('watchlist-container');
    container.innerHTML = '';
    marketAssets.slice(0, 8).forEach(asset => {
        const isPos = asset.price_change_percentage_24h >= 0;
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between py-3 px-2 hover:bg-rhGray rounded-2xl cursor-pointer transition';
        div.onclick = () => loadAssetIntoTradePanel(asset);
        div.innerHTML = `
            <div class="flex items-center space-x-3">
                <img src="${asset.image}" class="w-8 h-8 rounded-full">
                <div><div class="font-bold text-sm uppercase text-black">${asset.symbol}</div><div class="text-xs text-gray-500">${asset.name}</div></div>
            </div>
            <div class="text-right">
                <div class="font-bold text-sm text-black">$${asset.current_price.toLocaleString()}</div>
                <div class="text-xs font-semibold ${isPos ? 'text-rhGreen' : 'text-rhRed'}">${isPos ? '+' : ''}${asset.price_change_percentage_24h.toFixed(2)}%</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function loadAssetIntoTradePanel(asset) {
    selectedAsset = asset;
    document.getElementById('trade-asset-title').innerText = asset.name;
    document.getElementById('trade-asset-symbol').innerText = `${asset.symbol} · ${asset.type.toUpperCase()}`;
    document.getElementById('trade-asset-price').innerText = `$${asset.current_price.toLocaleString()}`;
    const changeElem = document.getElementById('trade-asset-change');
    const isPos = asset.price_change_percentage_24h >= 0;
    changeElem.innerText = `${isPos ? '+' : ''}${asset.price_change_percentage_24h.toFixed(2)}%`;
    changeElem.className = `text-xs font-semibold ${isPos ? 'text-rhGreen' : 'text-rhRed'}`;

    // Load Chart Data
    const sparkline = asset.sparkline_in_7d?.price || [asset.current_price * 0.95, asset.current_price];
    let time = Math.floor(Date.now() / 1000) - (sparkline.length * 3600);
    const chartData = sparkline.map(val => ({ time: time += 3600, value: val }));
    lineSeries.setData(chartData);
    chart.timeScale().fitContent();
    calculateEstShares();
}

// --- TRADING ENGINE ---
function setOrderMode(mode) {
    orderMode = mode;
    const buyBtn = document.getElementById('mode-buy');
    const sellBtn = document.getElementById('mode-sell');
    const subBtn = document.getElementById('order-submit-btn');

    if (mode === 'BUY') {
        buyBtn.className = 'py-2.5 rounded-xl bg-white text-black shadow-sm cursor-pointer transition';
        sellBtn.className = 'py-2.5 rounded-xl text-gray-500 cursor-pointer transition';
        subBtn.className = 'w-full bg-rhGreen text-white font-bold py-4 rounded-full hover:bg-rhGreenHover transition shadow-lg text-sm';
        subBtn.innerText = `Buy ${selectedAsset ? selectedAsset.symbol : ''}`;
    } else {
        buyBtn.className = 'py-2.5 rounded-xl text-gray-500 cursor-pointer transition';
        sellBtn.className = 'py-2.5 rounded-xl bg-white text-black shadow-sm cursor-pointer transition';
        subBtn.className = 'w-full bg-rhRed text-white font-bold py-4 rounded-full hover:bg-red-600 transition shadow-lg text-sm';
        subBtn.innerText = `Sell ${selectedAsset ? selectedAsset.symbol : ''}`;
    }
}

function toggleOrderType() {
    orderType = document.getElementById('order-type-select').value;
    const limitContainer = document.getElementById('limit-price-container');
    if (orderType === 'LIMIT' || orderType === 'STOP') {
        limitContainer.classList.remove('hidden');
        if (selectedAsset) document.getElementById('limit-price-input').value = selectedAsset.current_price;
    } else {
        limitContainer.classList.add('hidden');
    }
}

document.getElementById('trade-amount').addEventListener('input', calculateEstShares);
function calculateEstShares() {
    const amount = parseFloat(document.getElementById('trade-amount').value) || 0;
    if (!selectedAsset) return;
    const shares = amount / selectedAsset.current_price;
    document.getElementById('est-shares-calc').innerText = `${shares.toFixed(4)} shares`;
}

function executeOrder() {
    if (!selectedAsset) return;
    const amount = parseFloat(document.getElementById('trade-amount').value);
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid dollar amount.');
        return;
    }

    const executionPrice = orderType === 'MARKET' ? selectedAsset.current_price : parseFloat(document.getElementById('limit-price-input').value);

    if (orderMode === 'BUY') {
        if (amount > accountState.cash) {
            alert('Insufficient buying power.');
            return;
        }
        accountState.cash -= amount;
        const sharesBought = amount / executionPrice;

        const existing = accountState.positions.find(p => p.id === selectedAsset.id);
        if (existing) {
            const totalShares = existing.shares + sharesBought;
            existing.avgPrice = ((existing.shares * existing.avgPrice) + amount) / totalShares;
            existing.shares = totalShares;
        } else {
            accountState.positions.push({
                id: selectedAsset.id,
                symbol: selectedAsset.symbol,
                name: selectedAsset.name,
                shares: sharesBought,
                avgPrice: executionPrice,
                type: selectedAsset.type,
                image: selectedAsset.image
            });
        }
    } else {
        const existing = accountState.positions.find(p => p.id === selectedAsset.id);
        if (!existing) {
            alert('You do not own this position.');
            return;
        }
        const sharesToSell = amount / executionPrice;
        if (sharesToSell > existing.shares) {
            alert('You cannot sell more shares than you own.');
            return;
        }
        existing.shares -= sharesToSell;
        accountState.cash += amount;

        if (existing.shares <= 0.000001) {
            accountState.positions = accountState.positions.filter(p => p.id !== selectedAsset.id);
        }
    }

    accountState.history.unshift({
        id: Math.random().toString(36).substring(2, 9),
        type: `${orderMode} (${orderType})`,
        symbol: selectedAsset.symbol,
        shares: amount / executionPrice,
        price: executionPrice,
        total: amount,
        time: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    saveAndRefresh();
    alert(`Successfully executed ${orderMode} order for ${selectedAsset.symbol}!`);
}

// --- OPTIONS CHAIN ---
function loadOptionsChain() {
    const assetSymbol = document.getElementById('options-asset-select').value;
    const asset = marketAssets.find(a => a.symbol === assetSymbol) || { current_price: 200 };
    const basePrice = asset.current_price;

    const callsBody = document.getElementById('calls-table-body');
    const putsBody = document.getElementById('puts-table-body');
    callsBody.innerHTML = '';
    putsBody.innerHTML = '';

    for (let i = -3; i <= 3; i++) {
        const strike = Math.round(basePrice + (i * 5));
        const callBid = (Math.max(1, (basePrice - strike) + (Math.random() * 5))).toFixed(2);
        const callAsk = (parseFloat(callBid) + 0.35).toFixed(2);
        const putBid = (Math.max(1, (strike - basePrice) + (Math.random() * 5))).toFixed(2);
        const putAsk = (parseFloat(putBid) + 0.35).toFixed(2);

        // Calls Row
        const trC = document.createElement('tr');
        trC.innerHTML = `
            <td class="py-3 font-bold text-black">$${strike}</td>
            <td class="py-3 text-gray-600">$${callBid}</td>
            <td class="py-3 text-black font-semibold">$${callAsk}</td>
            <td class="py-3 text-gray-400">34.2%</td>
            <td class="py-3 text-right"><button onclick="tradeOption('CALL', ${strike}, ${callAsk})" class="bg-rhGreen/10 text-rhGreen hover:bg-rhGreen hover:text-white px-3 py-1 rounded-full font-bold transition">Buy Call</button></td>
        `;
        callsBody.appendChild(trC);

        // Puts Row
        const trP = document.createElement('tr');
        trP.innerHTML = `
            <td class="py-3 font-bold text-black">$${strike}</td>
            <td class="py-3 text-gray-600">$${putBid}</td>
            <td class="py-3 text-black font-semibold">$${putAsk}</td>
            <td class="py-3 text-gray-400">38.9%</td>
            <td class="py-3 text-right"><button onclick="tradeOption('PUT', ${strike}, ${putAsk})" class="bg-rhRed/10 text-rhRed hover:bg-rhRed hover:text-white px-3 py-1 rounded-full font-bold transition">Buy Put</button></td>
        `;
        putsBody.appendChild(trP);
    }
}

function tradeOption(type, strike, askPrice) {
    const cost = askPrice * 100; // Options contracts represent 100 shares
    if (cost > accountState.cash) {
        alert('Insufficient buying power for options contract.');
        return;
    }
    accountState.cash -= cost;
    accountState.history.unshift({
        id: Math.random().toString(36).substring(2, 9),
        type: `OPTIONS ${type}`,
        symbol: `${document.getElementById('options-asset-select').value} $${strike}`,
        shares: 1,
        price: askPrice,
        total: cost,
        time: new Date().toLocaleDateString()
    });
    saveAndRefresh();
    alert(`Successfully purchased 1 ${type} contract at $${strike} strike!`);
}

// --- CRYPTO HUB & LEDGER RENDERERS ---
function renderCryptoHub() {
    const grid = document.getElementById('crypto-market-grid');
    grid.innerHTML = '';
    marketAssets.filter(a => a.type === 'crypto').forEach(crypto => {
        const isPos = crypto.price_change_percentage_24h >= 0;
        const card = document.createElement('div');
        card.className = 'border border-rhBorder rounded-2xl p-4 flex items-center justify-between hover:border-black cursor-pointer transition';
        card.onclick = () => { loadAssetIntoTradePanel(crypto); switchView('portfolio'); };
        card.innerHTML = `
            <div class="flex items-center space-x-3">
                <img src="${crypto.image}" class="w-10 h-10 rounded-full">
                <div><div class="font-bold text-sm text-black">${crypto.name}</div><div class="text-xs uppercase text-gray-400">${crypto.symbol}</div></div>
            </div>
            <div class="text-right">
                <div class="font-bold text-sm text-black">$${crypto.current_price.toLocaleString()}</div>
                <div class="text-xs font-semibold ${isPos ? 'text-rhGreen' : 'text-rhRed'}">${isPos ? '+' : ''}${crypto.price_change_percentage_24h.toFixed(2)}%</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderHistoryLedger() {
    const ledger = document.getElementById('history-ledger-list');
    ledger.innerHTML = '';
    if (accountState.history.length === 0) {
        ledger.innerHTML = `<div class="text-center text-gray-400 py-6 text-sm">No recorded transactions yet.</div>`;
        return;
    }
    accountState.history.forEach(h => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between py-3';
        item.innerHTML = `
            <div><div class="font-bold text-sm text-black">${h.type} — ${h.symbol}</div><div class="text-xs text-gray-400">${h.time}</div></div>
            <div class="text-right"><div class="font-bold text-sm text-black">$${h.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</div><div class="text-xs text-gray-500">${h.shares.toFixed(3)} units @ $${h.price}</div></div>
        `;
        ledger.appendChild(item);
    });
}

// --- UI REFRESH & STATE PERSISTENCE ---
function updateUI() {
    document.getElementById('cash-balance').innerText = `$${accountState.cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    let portfolioVal = accountState.cash;
    const posList = document.getElementById('positions-list');
    posList.innerHTML = '';

    if (accountState.positions.length === 0) {
        posList.innerHTML = `<div class="text-gray-400 text-sm py-4 text-center">No open positions. Start investing!</div>`;
    } else {
        accountState.positions.forEach(pos => {
            const live = marketAssets.find(a => a.id === pos.id) || pos;
            const currentVal = pos.shares * live.current_price;
            portfolioVal += currentVal;
            const pnl = currentVal - (pos.shares * pos.avgPrice);
            const isGreen = pnl >= 0;

            const div = document.createElement('div');
            div.className = 'flex items-center justify-between py-3';
            div.innerHTML = `
                <div class="flex items-center space-x-3">
                    <img src="${pos.image}" class="w-8 h-8 rounded-full">
                    <div><div class="font-bold text-sm uppercase text-black">${pos.symbol}</div><div class="text-xs text-gray-500">${pos.shares.toFixed(4)} shares</div></div>
                </div>
                <div class="text-right">
                    <div class="font-bold text-sm text-black">$${currentVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                    <div class="text-xs font-semibold ${isGreen ? 'text-rhGreen' : 'text-rhRed'}">${isGreen ? '+' : ''}$${pnl.toFixed(2)}</div>
                </div>
            `;
            posList.appendChild(div);
        });
    }

    document.getElementById('main-portfolio-val').innerText = `$${portfolioVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('header-portfolio-val').innerText = `$${portfolioVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    renderHistoryLedger();
}

function saveAndRefresh() {
    localStorage.setItem('robinhood_ultimate_state', JSON.stringify(accountState));
    updateUI();
}

// --- MODALS & EXPORTS ---
let modalMode = 'deposit';
function openDepositModal() {
    modalMode = 'deposit';
    document.getElementById('modal-title').innerText = 'Deposit Cash';
    document.getElementById('modal-overlay').style.display = 'flex';
}
function openAccountModal() {
    modalMode = 'account';
    document.getElementById('modal-title').innerText = 'Reset Account Balance';
    document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}
function confirmModalAction() {
    const val = parseFloat(document.getElementById('modal-input').value);
    if (!isNaN(val) && val > 0) {
        if (modalMode === 'deposit') {
            accountState.cash += val;
            accountState.history.unshift({ id: 'dep', type: 'DEPOSIT', symbol: 'USD', shares: val, price: 1, total: val, time: new Date().toLocaleDateString() });
        } else {
            accountState.cash = val;
            accountState.positions = [];
            accountState.history = [];
        }
        saveAndRefresh();
        closeModal();
    }
}

function exportAccountStatement() {
    let csv = 'ID,Type,Symbol,Shares,Price,Total,Timestamp\n';
    accountState.history.forEach(h => {
        csv += `${h.id},${h.type},${h.symbol},${h.shares},${h.price},${h.total},${h.time}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Robinhood_Account_Statement.csv';
    a.click();
}
