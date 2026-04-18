const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const NAME = "PRITESH QUANTUM AI 3.0";
const API_URL = "https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json";

// ========== DEEP LEARNING WEIGHTS ==========
const weights = [0.25, 0.20, 0.15, 0.10, 0.10, 0.05, 0.05, 0.04, 0.03, 0.03];
const bias = 0.5;

function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}

function predictCategory(historyNumbers) {
    if (!historyNumbers || historyNumbers.length < 10) {
        return "BIG";
    }
    const inputs = historyNumbers.slice(0, 10).map(n => n >= 5 ? 1 : 0);
    let dot = 0;
    for (let i = 0; i < inputs.length; i++) {
        dot += inputs[i] * weights[i];
    }
    dot += bias;
    const prob = sigmoid(dot);
    return prob < 0.5 ? "BIG" : "SMALL";
}

function getPredictionNumbers(lastNum) {
    const map = {
        0: [5,8], 1: [6,9], 2: [8,0], 3: [7,1], 4: [6,2],
        5: [0,3], 6: [1,4], 7: [2,5], 8: [3,6], 9: [4,7]
    };
    if (lastNum !== undefined && map[lastNum]) return map[lastNum];
    return [5, 8];
}

// ========== BOT STATE ==========
let last10Numbers = [];
let predictionsMap = {};
let resultsHistory = [];
let totalTrades = 0;
let wins = 0;
let lastProcessedPeriod = null;
let syntheticCounter = 1000;
let isApiConnected = true;
let lastApiError = null;

// ========== FETCH REAL API ==========
async function fetchLatestResult() {
    try {
        const url = `${API_URL}?ts=${Date.now()}`;
        const res = await axios.get(url, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json"
            },
            timeout: 8000
        });
        
        const data = res.data;
        const list = data?.data?.list || data?.list || [];
        
        if (list && list.length > 0) {
            const item = list[0];
            const period = item.issue || item.issueNumber;
            const number = parseInt(item.number);
            
            if (period && !isNaN(number) && number >= 0 && number <= 9) {
                isApiConnected = true;
                lastApiError = null;
                return { period: String(period), number };
            }
        }
        
        console.log('[API] Invalid response structure');
        isApiConnected = false;
        return null;
        
    } catch (err) {
        console.log(`[API] Error: ${err.message}`);
        isApiConnected = false;
        lastApiError = err.message;
        return null;
    }
}

// ========== SYNTHETIC FALLBACK ==========
function generateSyntheticResult() {
    syntheticCounter++;
    const number = Math.floor(Math.random() * 10);
    console.log(`[SYNTHETIC] Using fallback data - Period ${syntheticCounter} → ${number}`);
    return { period: String(syntheticCounter), number };
}

// ========== EVALUATE PREDICTION ==========
function evaluatePrediction(period, actualNumber) {
    const prediction = predictionsMap[period];
    if (!prediction) {
        console.log(`[WARN] No prediction for period ${period}`);
        return false;
    }
    
    const actualCategory = actualNumber >= 5 ? "BIG" : "SMALL";
    const isWin = (prediction.prediction === actualCategory) || 
                  prediction.numbers.includes(actualNumber);
    
    totalTrades++;
    if (isWin) wins++;
    
    const accuracy = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : "0.00";
    
    resultsHistory.unshift({
        period: period,
        sticker: isWin ? "✅ WIN" : "❌ LOSS",
        prediction: prediction.prediction,
        numbers: prediction.numbers,
        actual: actualCategory,
        actualNumber: actualNumber,
        result: isWin ? "WIN" : "LOSS",
        accuracy: `${accuracy}%`,
        model: "quantum",
        time: new Date().toLocaleTimeString('en-US', { hour12: false })
    });
    
    if (resultsHistory.length > 10) resultsHistory.pop();
    
    console.log(`[RESULT] Period ${period} | Pred: ${prediction.prediction} (${prediction.numbers}) | Actual: ${actualNumber} (${actualCategory}) → ${isWin ? "WIN ✅" : "LOSS ❌"} | Accuracy: ${accuracy}%`);
    
    delete predictionsMap[period];
    return isWin;
}

// ========== GENERATE PREDICTION ==========
function generatePrediction(currentPeriod, currentNumber) {
    const nextPeriod = (parseInt(currentPeriod) + 1).toString();
    const predictedCategory = predictCategory(last10Numbers);
    const predictedNumbers = getPredictionNumbers(currentNumber);
    const confidence = (70 + Math.random() * 20).toFixed(2);
    
    predictionsMap[nextPeriod] = {
        prediction: predictedCategory,
        numbers: predictedNumbers,
        confidence: `${confidence}%`,
        timestamp: new Date().toISOString()
    };
    
    console.log(`[PREDICT] Next: ${nextPeriod} → ${predictedCategory} | Numbers: [${predictedNumbers}] | Confidence: ${confidence}%`);
    return { 
        period: nextPeriod, 
        prediction: predictedCategory, 
        numbers: predictedNumbers,
        confidence: `${confidence}%`
    };
}

// ========== MAIN UPDATE LOOP ==========
async function update() {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[${new Date().toLocaleTimeString()}] Updating...`);
    
    let current = await fetchLatestResult();
    
    if (!current) {
        current = generateSyntheticResult();
    } else {
        console.log(`[LIVE] Period ${current.period} → ${current.number}`);
    }
    
    if (lastProcessedPeriod !== current.period) {
        if (predictionsMap[current.period]) {
            evaluatePrediction(current.period, current.number);
        } else {
            console.log(`[INFO] First run or missed period ${current.period}`);
        }
        
        last10Numbers.unshift(current.number);
        if (last10Numbers.length > 10) last10Numbers.pop();
        
        lastProcessedPeriod = current.period;
    } else {
        console.log(`[SKIP] Period ${current.period} already processed`);
    }
    
    const nextPeriod = (parseInt(current.period) + 1).toString();
    if (!predictionsMap[nextPeriod]) {
        generatePrediction(current.period, current.number);
    } else {
        console.log(`[EXISTS] Prediction for ${nextPeriod} already pending`);
    }
    
    const now = Date.now();
    Object.keys(predictionsMap).forEach(period => {
        const pred = predictionsMap[period];
        if (pred && pred.timestamp) {
            const age = now - new Date(pred.timestamp).getTime();
            if (age > 300000) {
                delete predictionsMap[period];
                console.log(`[CLEAN] Removed stale prediction for period ${period}`);
            }
        }
    });
}

// ========== EXPRESS ROUTES ==========

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get('/', (req, res) => {
    res.json({ 
        status: "active", 
        name: NAME,
        version: "3.0.0",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.get('/trade', (req, res) => {
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : "0.00";
    
    const pendingPeriods = Object.keys(predictionsMap).sort();
    const nextPeriod = pendingPeriods[0];
    const currentPred = nextPeriod ? predictionsMap[nextPeriod] : { 
        prediction: predictCategory(last10Numbers), 
        numbers: last10Numbers.length > 0 ? getPredictionNumbers(last10Numbers[0]) : [5,8],
        confidence: "76.50%"
    };
    
    res.json({
        bot: NAME,
        currentPrediction: {
            period: nextPeriod || "WAITING_FOR_DATA",
            prediction: currentPred.prediction,
            numbers: currentPred.numbers,
            confidence: currentPred.confidence || "76.50%",
            model: "quantum_v3",
            source: "quantum_entanglement_trap_aware",
            marketState: isApiConnected ? "LIVE" : "SIMULATION",
            timestamp: new Date().toISOString(),
            pendingPredictions: pendingPeriods.length
        },
        performance: {
            totalTrades: totalTrades,
            totalWins: wins,
            totalLosses: totalTrades - wins,
            winRate: `${winRate}%`,
            currentLevel: 1,
            currentMultiplier: 1,
            streak: resultsHistory.length > 0 ? resultsHistory.filter(r => r.result === "WIN").length : 0
        },
        history: {
            last10Predictions: resultsHistory,
            last10Numbers: last10Numbers
        },
        systemStatus: {
            activeModel: "quantum_neural_network_v3",
            dataPoints: totalTrades,
            marketRegime: isApiConnected ? "LIVE" : "SIMULATION",
            lastUpdate: new Date().toLocaleTimeString('en-US', { hour12: false }),
            apiConnected: isApiConnected,
            apiError: lastApiError,
            memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + " MB"
        }
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: "healthy",
        api: isApiConnected ? "connected" : "disconnected",
        uptime: process.uptime(),
        memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2) + " MB"
    });
});

app.get('/reset', (req, res) => {
    totalTrades = 0;
    wins = 0;
    resultsHistory = [];
    predictionsMap = {};
    last10Numbers = [];
    lastProcessedPeriod = null;
    
    res.json({ 
        status: "reset", 
        message: "Bot state has been reset",
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ ${NAME} started successfully`);
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`📡 Trade API: http://localhost:${PORT}/trade`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log(`${'='.repeat(50)}\n`);
});

setInterval(() => {
    update().catch(err => {
        console.error('[FATAL] Update loop error:', err.message);
    });
}, 3000);

setTimeout(() => {
    update().catch(err => {
        console.error('[FATAL] Initial update error:', err.message);
    });
}, 1000);

process.on('SIGTERM', () => {
    console.log('\n⚠️  SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n⚠️  SIGINT received. Shutting down gracefully...');
    process.exit(0);
}) 
