let coinsData = [];
let currentCoin = null;
let orderType = 'BUY'; // BUY or SELL
let leverage = 1;
let activeTab = 'positions';
let chartInterval = '24H';

let state = JSON.parse(localStorage.getItem('nexusx_state')) || {
    cash: 10000,
    initialCash: 10000,
    positions: [],
    history: []
};

let chart, candleSeries;

function initChart() {
    const container = document.getElementById('chart-container');
    container.innerHTML = '';
    chart = LightweightCharts.createChart(container, {
        layout: {
            background: { color: '#181a20' },
            textColor: '#848e9c',
        },
        grid: {
            vertLines: { color: '#2b313a' },
            horzLines: { color: '#2b313a' },
        },
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: '#2b313a'
        },
        rightPriceScale: {
            borderColor: '#2b313a'
        }
    });
    candleSeries = chart.addCandlestickSeries({
        upColor: '#0ecb81',
        downColor: '#f6465d',
        borderVisible: false,
        wickUpColor: '#0ecb81',
        wickDownColor: '#f6465d',
    });
}

async function fetchMarkets() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=false');
        const data = await res.json();
        coinsData = data;
        if (!currentCoin && data.length > 0) {
            currentCoin = data[0]; 
            loadCoinChart(currentCoin.id);
        }
        renderCoinList();
        renderTicker();
        updateUI();
    } catch (err) {
        console.error("API Error, using fallback simulation data", err);
    }
}

async function loadCoinChart(coinId) {
    const coin = coinsData.find(c => c.id === coinId) || currentCoin;
    currentCoin = coin;
    
    document.getElementById('active-coin-title').innerText = `${coin.name} / USD`;
    document.getElementById('active-coin-price').innerText = `$${coin.current_price.toLocaleString()}`;
    const changeElem = document.getElementById('active-coin-change');
    const isPos = coin.price_change_percentage_24h >= 0;
    changeElem.innerText = `${isPos ? '+' : ''}${coin.price_change_percentage_24h.toFixed(2)}%`;
    changeElem.className = `text-xs px-1.5 py-0.5 rounded font-bold ${isPos ? 'bg-accentGreen/20 text-accentGreen' : 'bg-accentRed/20 text-accentRed'}`;

    try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=1`);
        const ohlcData = await res.json();
        const formattedData = ohlcData.map(item => ({
            time: item[0] / 1000,
            open: item[1],
            high: item[2],
            low: item[3],
            close: item[4]
        }));
        candleSeries.setData(formattedData);
        chart.timeScale().fitContent();
    } catch (e) {
        generateMockCandles(coin.current_price);
    }
}

function generateMockCandles(basePrice) {
    let candles = [];
    let time = Math.floor(Date.now() / 1000) - 86400;
    let price = basePrice * 0.98;
    for (let i = 0; i < 50; i++) {
        let open = price;
        let close = open + (Math.random() - 0.48) * (basePrice * 0.01);
        let high = Math.max(open, close) + Math.random() * (basePrice * 0.005);
        let low = Math.min(open, close) - Math.random() * (basePrice * 0.005);
        candles.push({ time, open, high, low, close });
        time += 1800;
        price = close;
    }
    candleSeries.setData(candles);
    chart.timeScale().fitContent();
}

function renderCoinList(filter = '') {
    const listElem = document.getElementById('coin-list');
    listElem.innerHTML = '';
    const filtered = coinsData.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()) || c.symbol.toLowerCase().includes(filter.toLowerCase()));
    
    filtered.forEach(coin => {
        const isSelected = currentCoin && currentCoin.id === coin.id;
        const isPos = coin.price_change_percentage_24h >= 0;
        const div = document.createElement('div');
        div.className = `p-3 flex items-center justify-between cursor-pointer hover:bg-cardBorder/50 transition ${isSelected ? 'bg-cardBorder/70 border-l-2 border-accentYellow' : ''}`;
        div.onclick = () => loadCoinChart(coin.id);
        div.innerHTML = `
            <div class="flex items-center space-x-2">
                <img src="${coin.image}" class="w-6 h-6 rounded-full">
                <div>
                    <div class="text-xs font-bold text-white uppercase">${coin.symbol}</div>
                    <div class="text-[10px] text-gray-400">${coin.name}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="text-xs font-semibold text-white">$${coin.current_price.toLocaleString()}</div>
                <div class="text-[10px] ${isPos ? 'text-accentGreen' : 'text-accentRed'}">${isPos ? '+' : ''}${coin.price_change_percentage_24h.toFixed(2)}%</div>
            </div>
        `;
        listElem.appendChild(div);
    });
}

function renderTicker() {
    const ticker = document.getElementById('ticker-tape');
    ticker.innerHTML = '';
    coinsData.slice(0, 10).forEach(coin => {
        const isPos = coin.price_change_percentage_24h >= 0;
        const span = document.createElement('div');
        span.className = 'inline-flex items-center space-x-2 mr-6';
        span.innerHTML = `
            <span class="text-white font-bold uppercase">${coin.symbol}/USD</span>
            <span class="text-gray-300">$${coin.current_price.toLocaleString()}</span>
            <span class="${isPos ? 'text-accentGreen' : 'text-accentRed'}">${isPos ? '+' : ''}${coin.price_change_percentage_24h.toFixed(2)}%</span>
        `;
        ticker.appendChild(span);
    });
}

document.getElementById('coin-search').addEventListener('input', (e) => {
    renderCoinList(e.target.value);
});

function setOrderType(type) {
    orderType = type;
    const buyBtn = document.getElementById('btn-buy-mode');
    const sellBtn = document.getElementById('btn-sell-mode');
    const execBtn = document.getElementById('execute-btn');

    if (type === 'BUY') {
        buyBtn.className = 'py-1.5 rounded bg-accentGreen text-darkBg cursor-pointer transition font-bold';
        sellBtn.className = 'py-1.5 rounded text-gray-400 cursor-pointer transition';
        execBtn.className = 'w-full py-3 rounded font-bold text-sm bg-accentGreen text-darkBg hover:opacity-90 transition shadow-lg';
        execBtn.innerText = 'Open Long Position';
    } else {
        buyBtn.className = 'py-1.5 rounded text-gray-400 cursor-pointer transition';
        sellBtn.className = 'py-1.5 rounded bg-accentRed text-darkBg cursor-pointer transition font-bold';
        execBtn.className = 'w-full py-3 rounded font-bold text-sm bg-accentRed text-darkBg hover:opacity-90 transition shadow-lg';
        execBtn.innerText = 'Open Short Position';
    }
}

function updateLeverage(val) {
    leverage = parseInt(val);
    document.getElementById('leverage-label').innerText = `${leverage}x`;
    calculateSummary();
}

function setPercent(pct) {
    const amount = state.cash * pct;
    document.getElementById('trade-amount').value = amount.toFixed(2);
    calculateSummary();
}

function calculateSummary() {
    const amount = parseFloat(document.getElementById('trade-amount').value) || 0;
    const fee = amount * 0.0005;
    document.getElementById('est-fee').innerText = `$${fee.toFixed(2)}`;
    document.getElementById('est-position').innerText = `$${(amount * leverage).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

document.getElementById('trade-amount').addEventListener('input', calculateSummary);

function executeTrade() {
    if (!currentCoin) return;
    const amount = parseFloat(document.getElementById('trade-amount').value);
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid investment amount.');
        return;
    }
    if (amount > state.cash) {
        alert('Insufficient simulated funds in your wallet.');
        return;
    }

    state.cash -= amount;
    const positionValue = amount * leverage;
    const newPos = {
        id: Math.random().toString(36).substring(2, 9),
        coinId: currentCoin.id,
        symbol: currentCoin.symbol.toUpperCase(),
        name: currentCoin.name,
        image: currentCoin.image,
        type: orderType,
        entryPrice: currentCoin.current_price,
        amount: amount,
        leverage: leverage,
        positionValue: positionValue,
        time: new Date().toLocaleTimeString()
    };

    state.positions.push(newPos);
    state.history.unshift({
        ...newPos,
        action: `Opened ${orderType}`
    });

    saveAndRefresh();
}

function closePosition(id) {
    const index = state.positions.findIndex(p => p.id === id);
    if (index !== -1) {
        const pos = state.positions[index];
        const currentCoinObj = coinsData.find(c => c.id === pos.coinId) || pos;
        const priceDiff = currentCoinObj.current_price - pos.entryPrice;
        const percentageChange = (priceDiff / pos.entryPrice) * (pos.type === 'BUY' ? 1 : -1);
        const pnl = pos.positionValue * percentageChange;
        const returnAmount = pos.amount + pnl;

        state.cash += Math.max(0, returnAmount);
        state.history.unshift({
            ...pos,
            action: `Closed PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`
        });

        state.positions.splice(index, 1);
        saveAndRefresh();
    }
}

function switchTab(tab) {
    activeTab = tab;
    const posBtn = document.getElementById('tab-btn-positions');
    const histBtn = document.getElementById('tab-btn-history');
    if (tab === 'positions') {
        posBtn.className = 'py-2.5 mr-4 text-white border-b-2 border-accentYellow';
        histBtn.className = 'py-2.5 text-gray-400 hover:text-white transition';
    } else {
        posBtn.className = 'py-2.5 mr-4 text-gray-400 hover:text-white transition';
        histBtn.className = 'py-2.5 text-white border-b-2 border-accentYellow';
    }
    renderTabContent();
}

function renderTabContent() {
    const content = document.getElementById('tab-content');
    content.innerHTML = '';

    if (activeTab === 'positions') {
        if (state.positions.length === 0) {
            content.innerHTML = `<div class="text-center text-gray-500 py-8 text-xs">No open positions. Start trading above!</div>`;
            return;
        }
        const table = document.createElement('table');
        table.className = 'w-full text-left text-xs';
        table.innerHTML = `
            <thead class="text-gray-400 border-b border-cardBorder">
                <tr>
                    <th class="pb-2">Asset</th>
                    <th class="pb-2">Type</th>
                    <th class="pb-2">Entry</th>
                    <th class="pb-2">Size</th>
                    <th class="pb-2">PnL (Est)</th>
                    <th class="pb-2 text-right">Action</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-cardBorder/40" id="positions-rows"></tbody>
        `;
        content.appendChild(table);

        const tbody = document.getElementById('positions-rows');
        state.positions.forEach(pos => {
            const cObj = coinsData.find(c => c.id === pos.coinId) || pos;
            const diff = cObj.current_price - pos.entryPrice;
            const pct = (diff / pos.entryPrice) * (pos.type === 'BUY' ? 1 : -1);
            const pnl = pos.positionValue * pct;
            const isGreen = pnl >= 0;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="py-2 flex items-center space-x-1.5"><img src="${pos.image}" class="w-4 h-4 rounded-full"><span class="font-bold text-white uppercase">${pos.symbol}</span></td>
                <td class="py-2 font-semibold ${pos.type === 'BUY' ? 'text-accentGreen' : 'text-accentRed'}">${pos.type} ${pos.leverage}x</td>
                <td class="py-2 text-gray-300">$${pos.entryPrice.toLocaleString()}</td>
                <td class="py-2 text-gray-300">$${pos.positionValue.toLocaleString()}</td>
                <td class="py-2 font-bold ${isGreen ? 'text-accentGreen' : 'text-accentRed'}">${isGreen ? '+' : ''}$${pnl.toFixed(2)} (${(pct * pos.leverage * 100).toFixed(2)}%)</td>
                <td class="py-2 text-right"><button onclick="closePosition('${pos.id}')" class="bg-cardBorder hover:bg-gray-700 text-white px-2 py-1 rounded">Close</button></td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        if (state.history.length === 0) {
            content.innerHTML = `<div class="text-center text-gray-500 py-8 text-xs">No trade history yet.</div>`;
            return;
        }
        const ul = document.createElement('div');
        ul.className = 'space-y-2';
        state.history.forEach(h => {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center bg-darkBg p-2 rounded border border-cardBorder';
            item.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="font-bold uppercase text-white">${h.symbol}</span>
                    <span class="text-gray-400">${h.action} @ $${h.entryPrice.toLocaleString()}</span>
                </div>
                <div class="text-gray-400 text-[10px]">${h.time}</div>
            `;
            ul.appendChild(item);
        });
        content.appendChild(ul);
    }
}

function updateUI() {
    document.getElementById('cash-balance').innerText = `$${state.cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    let openPnlTotal = 0;
    state.positions.forEach(pos => {
        const cObj = coinsData.find(c => c.id === pos.coinId) || pos;
        const diff = cObj.current_price - pos.entryPrice;
        const pct = (diff / pos.entryPrice) * (pos.type === 'BUY' ? 1 : -1);
        openPnlTotal += (pos.positionValue * pct);
    });

    const totalVal = state.cash + state.positions.reduce((acc, p) => acc + p.amount, 0) + openPnlTotal;
    document.getElementById('header-total-val').innerText = `$${totalVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('open-count').innerText = state.positions.length;

    renderTabContent();
    renderHoldings();
    calculateSummary();
}

function renderHoldings() {
    const container = document.getElementById('portfolio-holdings');
    container.innerHTML = '';
    if (state.positions.length === 0) {
        container.innerHTML = `<div class="text-gray-500 text-center py-2">No active assets</div>`;
        return;
    }
    state.positions.forEach(p => {
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center bg-darkBg p-2 rounded border border-cardBorder';
        div.innerHTML = `
            <div class="flex items-center space-x-1.5">
                <img src="${p.image}" class="w-4 h-4 rounded-full">
                <span class="font-bold text-white uppercase">${p.symbol}</span>
            </div>
            <span class="text-gray-300">$${p.positionValue.toLocaleString()}</span>
        `;
        container.appendChild(div);
    });
}

function saveAndRefresh() {
    localStorage.setItem('nexusx_state', JSON.stringify(state));
    updateUI();
}

function openResetModal() {
    document.getElementById('reset-modal').style.display = 'flex';
}
function closeResetModal() {
    document.getElementById('reset-modal').style.display = 'none';
}
function confirmReset() {
    const newBal = parseFloat(document.getElementById('new-balance-input').value);
    if (!isNaN(newBal) && newBal > 0) {
        state.cash = newBal;
        state.initialCash = newBal;
        state.positions = [];
        state.history.unshift({ action: 'Wallet Reset', symbol: 'USD', entryPrice: newBal, time: new Date().toLocaleTimeString() });
        saveAndRefresh();
        closeResetModal();
    }
}

window.onload = () => {
    initChart();
    fetchMarkets();
    setInterval(fetchMarkets, 15000);
};
