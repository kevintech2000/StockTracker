// backend/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cheerio = require('cheerio'); // 如果需要解析 HTML

const app = express();
const PORT = 3001; // 後端 API 使用不同於前端的 port

app.use(cors()); // 允許所有來源的跨域請求 (開發用，生產環境應更嚴格)
app.use(express.json());

// API 端點：獲取股票資訊
// GET /api/stock?code=2330
app.get('/api/stock', async (req, res) => {
    const stockCode = req.query.code;
    if (!stockCode) {
        return res.status(400).json({ error: 'Stock code is required' });
    }

    // --- 嘗試抓取 TWSE 資料 ---
    // !!! 警告：以下 URL 和解析邏輯可能隨時失效，且有使用條款風險 !!!
    // 這裡假設一個可能的目標頁面或 API 端點，你需要自行研究並找到可靠的來源
    // 範例：假設某個非官方 API 或需要解析的 HTML 頁面
    // const targetUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${stockCode}.tw`; // 這是一個假設的 URL
    const targetUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=20231026&stockNo=${stockCode}`; // 嘗試抓取每日交易資訊 (範例日期)
    // 注意：每日交易資訊不包含 "即時" 開高低收，僅為範例

    try {
        console.log(`Fetching data for ${stockCode} from ${targetUrl}`);
        const response = await axios.get(targetUrl, {
            headers: {
                // 有些網站需要 User-Agent
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // --- 解析回應 ---
        // 這部分高度依賴於目標 URL 回傳的格式 (JSON 或 HTML)
        // 範例：假設回傳的是 TWSE 每日交易 JSON
        if (response.data && response.data.stat === 'OK' && response.data.data && response.data.data.length > 0) {
            // 取最後一筆資料 (最近交易日)
            const latestData = response.data.data[response.data.data.length - 1];
            const stockInfo = {
                code: stockCode,
                name: response.data.title ? response.data.title.split(' ')[2] : 'N/A', // 嘗試從標題解析名稱
                open: latestData[3],
                high: latestData[4],
                low: latestData[5],
                close: latestData[6],
                volume: latestData[8] / 1000, // 成交股數轉為張數
            };
            console.log("Data fetched successfully:", stockInfo);
            res.json(stockInfo);
        } else {
             // 如果回傳是 HTML，需要用 cheerio 解析
             // const $ = cheerio.load(response.data);
             // const open = $('#openPriceSelector').text(); // 假設的 CSS 選擇器
             // ... etc ...
             console.error("Failed to parse data or no data found", response.data);
             res.status(404).json({ error: 'Could not find or parse stock data', details: response.data });
        }

    } catch (error) {
        console.error('Error fetching stock data:', error.message);
         if (error.response) {
             console.error('Error status:', error.response.status);
             console.error('Error data:', error.response.data);
             res.status(error.response.status).json({ error: 'Error from external source', details: error.response.data });
        } else if (error.request) {
             console.error('No response received:', error.request);
             res.status(504).json({ error: 'No response received from external source' });
        } else {
            res.status(500).json({ error: 'Internal server error while fetching data', details: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});