const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Global Tracking Variable ---
let stats = {
    win: 0,
    loss: 0,
    accuracy: 0,
    last_period: null,
    last_pred: null
};

// --- Prediction Logic Function ---
const getPredictionLogic = (data) => {
    if (!data || data.length < 5) return "WAIT";

    // Latest 10 results ko binary (1 for BIG, 0 for SMALL) mein badalna
    // 5-9 = BIG (1), 0-4 = SMALL (0)
    const binary = data.slice(0, 10).map(item => (parseInt(item.number) >= 5 ? 1 : 0));

    // Weighted Math Logic (Latest results have 45% weight)
    const weights = [0.45, 0.20, 0.15, 0.10, 0.05, 0.02, 0.01, 0.01, 0.005, 0.005];
    
    let score = 0;
    binary.forEach((val, i) => {
        score += val * weights[i];
    });

    return score >= 0.5 ? "BIG" : "SMALL";
};

// --- MAIN API ENDPOINT ---
app.get("/api", async (req, res) => {
    const API_URL = `https://draw.ar-lottery01.com/WinGo/WinGo_30S/GetHistoryIssuePage.json?ts=${Date.now()}`;
    
    try {
        const response = await axios.get(API_URL, { timeout: 5000 });
        const list = response.data.data.list;

        if (!list || list.length === 0) {
            return res.status(500).json({ success: false, message: "Data nahi mila" });
        }

        const current_period = list[0].issue;
        const actual_num = parseInt(list[0].number);
        const actual_type = actual_num >= 5 ? "BIG" : "SMALL";

        // --- Win/Loss Tracking Logic ---
        if (stats.last_period === current_period) {
            if (stats.last_pred === actual_type) {
                stats.win += 1;
            } else {
                stats.loss += 1;
            }
            stats.last_period = null; // Reset taaki baar-baar refresh pe count na ho
            
            const total = stats.win + stats.loss;
            stats.accuracy = ((stats.win / total) * 100).toFixed(2) + "%";
        }

        // --- Next Prediction ---
        const prediction = getPredictionLogic(list);
        const next_period = (parseInt(current_period) + 1).toString();

        // Save tracking data for next refresh
        if (stats.last_period !== next_period) {
            stats.last_period = next_period;
            stats.last_pred = prediction;
        }

        // --- JSON Response ---
        res.json({
            success: true,
            prediction_data: {
                next_period: next_period,
                prediction: prediction,
                current_accuracy: stats.accuracy,
                total_wins: stats.win,
                total_loss: stats.loss
            },
            last_result: {
                period: current_period,
                number: actual_num,
                result: actual_type
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "API Fetch Error" });
    }
});

// --- Default Routes ---
app.get("/", (req, res) => {
    res.send("Elite Predictor API Chal Rahi Hai. Use /api for JSON data.");
});

app.listen(PORT, () => {
    console.log(`Server chal gaya port ${PORT}`);
});
