<script setup>
import { ref, reactive, computed, watch } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable';

// --- State ---
const stockCode = ref('');
const stockName = ref('');
const isLoading = ref(false);
const errorMessage = ref('');
const currentStock = reactive({
  code: '', name: '', open: '', high: '', low: '', close: '', volume: '',
  positionLevel: '', shortDefense: '', pivotPoint: '', longDefense: '',
  weekDefense: '', monthDefense: '', trend: '盤整', kd: '', macd: '',
  法人買賣: [], notes: ''
});
const savedStocks = ref({
  多頭: [], 空頭: [], 盤整: []
});
const activeTab = ref('搜尋'); // 新增：追蹤目前活動的 Tab

// --- Computed Properties ---
const priceChange = computed(() => {
  if (currentStock.close && currentStock.open) {
    return parseFloat(currentStock.close) - parseFloat(currentStock.open);
  }
  return 0;
});

const priceChangeColor = computed(() => {
  if (priceChange.value > 0) return 'red';
  if (priceChange.value < 0) return 'green';
  return 'black';
});

// --- Methods ---
const searchStock = async () => {
  if (!stockCode.value) {
    errorMessage.value = '請輸入股票代號';
    return;
  }
  isLoading.value = true;
  errorMessage.value = '';
  // 不再自動清除 currentStock，保留上次資料直到新資料載入或手動清除
  // clearCurrentStockData();

  try {
    const response = await axios.get(`http://localhost:3001/api/stock?code=${stockCode.value}`);
    const data = response.data;

    // 清除舊資料再填入
    clearCurrentStockData(true); // 保留 code & name 輸入框內容

    currentStock.code = data.code || stockCode.value;
    currentStock.name = data.name || stockName.value || '';
    currentStock.open = data.open || '';
    currentStock.high = data.high || '';
    currentStock.low = data.low || '';
    currentStock.close = data.close || '';
    currentStock.volume = data.volume || '';
    stockName.value = currentStock.name; // 同步名稱輸入框

    // 從已儲存資料載入分析欄位 (如果存在)
    loadAnalysisDataForCurrentStock();

    activeTab.value = '表單'; // 搜尋成功後自動切換到表單 Tab

  } catch (error) {
    console.error("Search error:", error);
    if (error.response && error.response.data && error.response.data.error) {
         errorMessage.value = `錯誤: ${error.response.data.error}`;
         if(error.response.data.details) {
             errorMessage.value += ` (${JSON.stringify(error.response.data.details)})`;
         }
    } else {
        errorMessage.value = `無法獲取股票 ${stockCode.value} 的資料，請檢查後端伺服器或股票代號。`;
    }
    // 搜尋失敗時也清除舊的股票數據，但保留搜尋框內容
    clearCurrentStockData(true);
  } finally {
    isLoading.value = false;
  }
};

const clearCurrentStockData = (keepCodeNameInput = false) => {
   currentStock.code = '';
   currentStock.name = '';
   currentStock.open = '';
   currentStock.high = '';
   currentStock.low = '';
   currentStock.close = '';
   currentStock.volume = '';
   currentStock.positionLevel = '';
   currentStock.shortDefense = '';
   currentStock.pivotPoint = '';
   currentStock.longDefense = '';
   currentStock.weekDefense = '';
   currentStock.monthDefense = '';
   currentStock.trend = '盤整';
   currentStock.kd = '';
   currentStock.macd = '';
   currentStock.法人買賣 = [];
   currentStock.notes = '';
   if (!keepCodeNameInput) {
        stockCode.value = '';
        stockName.value = '';
   }
};

// 新增：當 currentStock.code 改變時，嘗試從 savedStocks 載入對應的分析資料
const loadAnalysisDataForCurrentStock = () => {
    if (!currentStock.code) return;
    let foundStock = null;
    for (const group in savedStocks.value) {
        foundStock = savedStocks.value[group].find(s => s.code === currentStock.code);
        if (foundStock) break;
    }

    if (foundStock) {
        // 只載入分析欄位，不覆蓋剛抓到的市場數據
        currentStock.positionLevel = foundStock.positionLevel || '';
        currentStock.shortDefense = foundStock.shortDefense || '';
        currentStock.pivotPoint = foundStock.pivotPoint || '';
        currentStock.longDefense = foundStock.longDefense || '';
        currentStock.weekDefense = foundStock.weekDefense || '';
        currentStock.monthDefense = foundStock.monthDefense || '';
        currentStock.trend = foundStock.trend || '盤整';
        currentStock.kd = foundStock.kd || '';
        currentStock.macd = foundStock.macd || '';
        currentStock.法人買賣 = Array.isArray(foundStock.法人買賣) ? [...foundStock.法人買賣] : [];
        currentStock.notes = foundStock.notes || '';
    }
};

// 新增：從列表點擊股票時載入
const loadStockFromList = (stock) => {
    stockCode.value = stock.code;
    stockName.value = stock.name;
    searchStock(); // 重新觸發搜尋以獲取最新市場數據，並載入分析數據
    // 或者，如果不想重新觸發 API，可以直接載入數據：
    // Object.assign(currentStock, JSON.parse(JSON.stringify(stock))); // 深拷貝載入
    // activeTab.value = '表單';
};


const saveStock = () => {
  if (!currentStock.code) {
    alert('沒有要儲存的股票資料 (請先成功搜尋)');
    return;
  }
  const group = currentStock.trend;
  if (!savedStocks.value[group]) {
      savedStocks.value[group] = [];
  }
  const existingIndex = savedStocks.value[group].findIndex(s => s.code === currentStock.code);
  const stockToSave = JSON.parse(JSON.stringify(currentStock));

  if (existingIndex > -1) {
    savedStocks.value[group][existingIndex] = stockToSave;
    // alert(`已更新 ${currentStock.code} 的資料`); // 更新時不提示，避免干擾
  } else {
     Object.keys(savedStocks.value).forEach(key => {
         if (key !== group) {
             savedStocks.value[key] = savedStocks.value[key].filter(s => s.code !== currentStock.code);
         }
     });
     savedStocks.value[group].push(stockToSave);
     // alert(`已將 ${currentStock.code} 儲存到 ${group} 分類`); // 新增時不提示
  }
   saveToLocalStorage();
   // activeTab.value = '股票清單'; // 儲存後可選切換到清單 Tab
};

// --- Import / Export / Clear ---
const exportData = () => {
    if (Object.values(savedStocks.value).every(arr => arr.length === 0)) {
        alert('沒有可匯出的資料');
        return;
    }
    const dataStr = JSON.stringify(savedStocks.value, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.download = `stock_data_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const triggerImport = () => {
  document.getElementById('importFile').click();
};

const importData = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      if (typeof importedData === 'object' && importedData !== null &&
          ('多頭' in importedData || '空頭' in importedData || '盤整' in importedData)) {
         savedStocks.value = {
             多頭: importedData['多頭'] || [],
             空頭: importedData['空頭'] || [],
             盤整: importedData['盤整'] || [],
         };
         alert('資料匯入成功！');
         saveToLocalStorage();
         // 匯入後清除當前股票顯示
         clearCurrentStockData();
         stockCode.value = '';
         stockName.value = '';
         activeTab.value = '股票清單'; // 匯入後跳轉到清單查看
      } else {
         alert('匯入失敗：檔案格式不符');
      }
    } catch (err) {
      console.error("Import error:", err);
      alert(`匯入失敗：無法解析 JSON 檔案 (${err.message})`);
    } finally {
       event.target.value = null;
    }
  };
  reader.onerror = (err) => {
      console.error("File reading error:", err);
      alert(`讀取檔案時發生錯誤: ${err}`);
      event.target.value = null;
  };
  reader.readAsText(file);
};

// 新增：清除所有資料
const clearAllData = () => {
    if (confirm('確定要清除所有已儲存的股票資料嗎？此操作無法復原！')) {
        savedStocks.value = { 多頭: [], 空頭: [], 盤整: [] };
        clearCurrentStockData();
        stockCode.value = '';
        stockName.value = '';
        saveToLocalStorage();
        activeTab.value = '搜尋'; // 清除後回到搜尋頁面
        alert('所有已儲存資料已被清除。');
    }
};

// --- Local Storage Persistence ---
const saveToLocalStorage = () => {
  localStorage.setItem('savedStocksData', JSON.stringify(savedStocks.value));
  console.log("Data saved to localStorage");
};

const loadFromLocalStorage = () => {
  const data = localStorage.getItem('savedStocksData');
  if (data) {
    try {
      const parsedData = JSON.parse(data);
       if (typeof parsedData === 'object' && parsedData !== null) {
          savedStocks.value = {
               多頭: parsedData['多頭'] || [],
               空頭: parsedData['空頭'] || [],
               盤整: parsedData['盤整'] || [],
           };
           console.log("Data loaded from localStorage");
       }
    } catch (e) {
      console.error("Error loading from localStorage:", e);
      localStorage.removeItem('savedStocksData');
    }
  }
};

// --- Drag & Drop ---
const handleDragEnd = (event) => {
    console.log("Drag ended, updating localStorage", event);
    // 拖曳後自動儲存 (因為 vuedraggable 直接修改了 savedStocks.value)
    saveToLocalStorage();
};

// --- Watcher ---
// 當走勢改變時，自動將 currentStock 移動到對應的 savedStocks 分類 (如果已儲存)
// 注意：這個 watcher 現在只在「表單」區塊編輯時觸發
watch(() => currentStock.trend, (newTrend, oldTrend) => {
    if (!currentStock.code || activeTab.value !== '表單') return; // 只在表單頁且有股票代號時觸發

    let stockToMove = null;
    let originalIndex = -1;

    if (savedStocks.value[oldTrend]) {
        originalIndex = savedStocks.value[oldTrend].findIndex(s => s.code === currentStock.code);
        if (originalIndex > -1) {
            // 找到並複製資料，但不立即從舊列表移除，等儲存時再處理
            stockToMove = JSON.parse(JSON.stringify(savedStocks.value[oldTrend][originalIndex]));
            stockToMove.trend = newTrend; // 確保趨勢已更新
        }
    }

    // 如果找到了，則在下次 saveStock 時，會因為 code 相同而更新到新 group
    // 如果沒找到 (代表是新搜尋的，尚未儲存)，則 saveStock 時會直接存到 newTrend group
    // 因此這裡不需要直接移動 savedStocks.value 的數據，交給 saveStock 處理即可
    if (stockToMove) {
        console.log(`Stock ${currentStock.code} trend changed from ${oldTrend} to ${newTrend}. Will be saved to new group.`);
    } else {
        console.log(`Stock ${currentStock.code} not saved yet. Will be saved to ${newTrend} group.`);
    }
    // 取消自動移動，統一由 saveStock 處理
    // ... (移除原本移動 savedStocks 的邏輯) ...
});

// --- Lifecycle Hooks ---
import { onMounted } from 'vue';
onMounted(() => {
  loadFromLocalStorage();
});

</script>

<template>
  <div class="stock-tracker">
    <!-- 頂部標題和全局按鈕 -->
    <div class="main-header">
        <h1>資訊分析</h1>
        <div class="global-actions">
            <button @click="triggerImport" title="匯入之前匯出的 .json 資料">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-upload" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z"/>
              </svg>
              匯入
            </button>
            <input type="file" id="importFile" @change="importData" accept=".json" style="display: none;">
            <button @click="exportData" title="將目前已儲存的股票資料匯出為 .json">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
              </svg>
              匯出
            </button>
            <button @click="clearAllData" class="danger-button" title="清除所有已儲存的股票資料">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
                <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm-9.115 1h11.23l-.824 10.303A1 1 0 0 1 11.115 15h-6.23a1 1 0 0 1-.997-.924L3.03 3.5zM4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06L5.002 5a.5.5 0 0 0-.998.06m3.5-.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 0 0-.998.06m3.5.029l-.5 8.5a.5.5 0 1 0 .998.06l.5-8.5a.5.5 0 1 0-.998-.06"/>
              </svg>
              清除所有資料
            </button>
        </div>
    </div>

    <!-- Tab 導航 -->
    <div class="tab-nav card">
        <button @click="activeTab = '搜尋'" :class="{ active: activeTab === '搜尋' }">搜尋</button>
        <button @click="activeTab = '表單'" :class="{ active: activeTab === '表單' }">表單</button>
        <button @click="activeTab = '列表清單'" :class="{ active: activeTab === '列表清單' }">列表清單</button>
    </div>

    <!-- Tab 內容區域 -->
    <div class="tab-content">
        <!-- 搜尋 Tab -->
        <div v-if="activeTab === '搜尋'" class="tab-pane search-section card">
          <!-- <h2>搜尋股票</h2> --> <!-- 標題由 Tab 提供 -->
          <div class="form-inline">
            <label for="stockCode">股票代號:</label>
            <input type="text" id="stockCode" v-model="stockCode" placeholder="例如: 2330" @keyup.enter="searchStock">
            <label for="stockName">股票名稱:</label>
            <input type="text" id="stockName" v-model="stockName" placeholder="(可選)" @keyup.enter="searchStock">
            <button @click="searchStock" :disabled="isLoading">
              {{ isLoading ? '搜尋中...' : '搜尋' }}
            </button>
          </div>
           <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
           <p v-if="!errorMessage && !isLoading" class="info-message">請輸入股票代號進行搜尋，搜尋成功後將自動跳轉至「表單」頁面。</p>
        </div>

        <!-- 表單 Tab -->
        <div v-if="activeTab === '表單'" class="tab-pane display-section card">
          <div v-if="isLoading" class="loading-message">載入中...</div>
          <div v-else-if="!currentStock.code">請先透過「搜尋」頁面搜尋股票，或從「股票清單」選擇。</div>
          <div v-else>
            <!-- <h2>{{ currentStock.name }} ({{ currentStock.code }}) - 分析資料</h2> --> <!-- 標題由 Tab 提供 -->
            <h3>{{ currentStock.name }} ({{ currentStock.code }}) - 市場資料 & 分析紀錄</h3>
            <div class="grid-container">
              <!-- 基本資料 -->
              <div class="data-field"> <label>開盤價:</label> <input type="text" v-model="currentStock.open" readonly :style="{ color: priceChangeColor }"> </div>
              <div class="data-field"> <label>最高價:</label> <input type="text" v-model="currentStock.high" readonly :style="{ color: priceChangeColor }"> </div>
              <div class="data-field"> <label>最低價:</label> <input type="text" v-model="currentStock.low" readonly :style="{ color: priceChangeColor }"> </div>
              <div class="data-field"> <label>收盤價:</label> <input type="text" v-model="currentStock.close" readonly :style="{ color: priceChangeColor }"> </div>
              <div class="data-field"> <label>成交量(張):</label> <input type="text" v-model="currentStock.volume" readonly> </div>
              <hr class="grid-separator">
              <!-- 自訂分析欄位 -->
              <div class="data-field"> <label for="positionLevel">位階:</label> <input type="text" id="positionLevel" v-model="currentStock.positionLevel"> </div>
              <div class="data-field"> <label for="shortDefense">空防守:</label> <input type="text" id="shortDefense" v-model="currentStock.shortDefense"> </div>
              <div class="data-field"> <label for="pivotPoint">多空點:</label> <input type="text" id="pivotPoint" v-model="currentStock.pivotPoint"> </div>
              <div class="data-field"> <label for="longDefense">多防守:</label> <input type="text" id="longDefense" v-model="currentStock.longDefense"> </div>
              <div class="data-field"> <label for="weekDefense">週守值:</label> <input type="text" id="weekDefense" v-model="currentStock.weekDefense"> </div>
              <div class="data-field"> <label for="monthDefense">月守值:</label> <input type="text" id="monthDefense" v-model="currentStock.monthDefense"> </div>
              <div class="data-field"> <label for="trend">走勢:</label> <select id="trend" v-model="currentStock.trend"> <option>多頭</option> <option>回後買上漲</option> <option>盤整</option> <option>空頭</option> <option>彈後空下跌</option> </select> </div>
              <div class="data-field"> <label for="kd">KD:</label> <input type="text" id="kd" v-model="currentStock.kd"> </div>
              <div class="data-field"> <label for="macd">MACD:</label> <input type="text" id="macd" v-model="currentStock.macd"> </div>
              <div class="data-field multiselect-field"> <label>法人買賣:</label> <div class="checkbox-group"> <label><input type="checkbox" value="外資買" v-model="currentStock.法人買賣"> 外資買</label> <label><input type="checkbox" value="外資賣" v-model="currentStock.法人買賣"> 外資賣</label> <label><input type="checkbox" value="投信買" v-model="currentStock.法人買賣"> 投信買</label> <label><input type="checkbox" value="投信賣" v-model="currentStock.法人買賣"> 投信賣</label> <label><input type="checkbox" value="自營買" v-model="currentStock.法人買賣"> 自營買</label> <label><input type="checkbox" value="自營賣" v-model="currentStock.法人買賣"> 自營賣</label> </div> </div>
              <div class="data-field notes-field"> <label for="notes">補充說明:</label> <textarea id="notes" v-model="currentStock.notes" rows="4"></textarea> </div>
            </div>
             <!-- 操作按鈕 (只保留儲存) -->
              <div class="actions-section form-actions">
                <button @click="saveStock" class="save-button">儲存分析資料</button>
                <span class="save-hint">(儲存後會更新或加入至下方「股票清單」)</span>
              </div>
          </div>
        </div>

        <!-- 股票清單 Tab -->
        <div v-if="activeTab === '股票清單'" class="tab-pane saved-section card">
          <!-- <h2>已儲存股票 (可拖曳調整順序或移動分類)</h2> --> <!-- 標題由 Tab 提供 -->
          <div v-if="Object.values(savedStocks).every(list => list.length === 0)">
              目前沒有儲存任何股票分析資料。
          </div>
          <div v-else class="saved-groups">
            <div v-for="(list, groupName) in savedStocks" :key="groupName" class="stock-group">
              <h3>{{ groupName }} ({{ list.length }})</h3>
              <draggable
                :list="list"
                item-key="code"
                group="stocks"
                ghost-class="ghost"
                @end="handleDragEnd"
                class="draggable-list"
                tag="div"
               >
                <!-- 保留空插槽解決渲染問題 -->
                <template #header></template>
                <template #item="{ element }">
                  <!-- 使用原本的結構 -->
                  <div>
                    <div class="saved-stock-item" @click="loadStockFromList(element)" title="點擊載入此股票資料至表單">
                      <span class="stock-code">{{ element.code }}</span>
                      <span class="stock-name">{{ element.name }}</span>
                      <span :style="{ color: parseFloat(element.close) > parseFloat(element.open) ? 'red' : (parseFloat(element.close) < parseFloat(element.open) ? 'green' : 'black') }">
                          {{ element.close }}
                      </span>
                    </div>
                  </div>
                </template>
                <template #footer></template>
              </draggable>
            </div>
          </div>
        </div>
    </div>

  </div>
</template>

<style scoped>
.stock-tracker {
  font-family: sans-serif;
  max-width: 1200px;
  margin: 20px auto;
  padding: 15px;
}

/* 新增：頂部標題和全局按鈕樣式 */
.main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #eee;
}
.main-header h1 {
    margin: 0;
}
.global-actions {
    display: flex;
    gap: 10px;
}
.global-actions button {
    padding: 8px 12px;
    border: 1px solid #ccc;
    background-color: #fff;
    border-radius: 4px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: background-color 0.2s, border-color 0.2s;
}
.global-actions button:hover {
    background-color: #f8f9fa;
    border-color: #bbb;
}
.global-actions button.danger-button {
    border-color: #dc3545;
    color: #dc3545;
}
.global-actions button.danger-button:hover {
    background-color: #dc3545;
    color: white;
}
.global-actions button svg {
    margin-right: 4px;
}

/* 新增：Tab 導航樣式 */
.tab-nav {
    display: flex;
    gap: 5px; /* 輕微間隔 */
    margin-bottom: 20px;
    background-color: #e9ecef; /* 給 tab 容器一個背景色 */
    padding: 5px;
    border-radius: 6px;
}
.tab-button {
    padding: 10px 20px;
    border: none;
    background-color: transparent; /* 未選中時透明 */
    border-radius: 4px;
    cursor: pointer;
    font-size: 1em;
    color: #495057;
    transition: background-color 0.2s, color 0.2s;
}
.tab-button.active {
    background-color: #fff; /* 選中時白色背景 */
    color: #007bff; /* 選中時文字顏色 */
    font-weight: bold;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.tab-button:not(.active):hover {
    background-color: #f8f9fa; /* 滑過時淺灰色 */
}

/* 通用卡片樣式 */
.card {
  background-color: #fff; /* 改為白色背景 */
  border: 1px solid #e3e3e3; /* 邊框顏色稍淺 */
  border-radius: 8px;
  padding: 25px; /* 增加內邊距 */
  margin-bottom: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05); /* 陰影減淡 */
}

/* 移除 Tab 內容區塊的獨立標題 */
.tab-pane h2 { display: none; }
.tab-pane h3 { margin-top: 0; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px;}


/* 搜尋區域樣式 */
.search-section .form-inline { display: flex; align-items: center; gap: 15px; }
.search-section label { margin-bottom: 0; }
.search-section input[type="text"] { flex-grow: 1; margin-right: 0; padding: 10px 12px; font-size: 1em;}
.search-section button { padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; font-size: 1em;}
.search-section button:disabled { background-color: #aaa; cursor: not-allowed; }
.search-section button:hover:not(:disabled) { background-color: #0056b3; }
.info-message { margin-top: 15px; color: #6c757d; font-size: 0.9em;}

/* 表單區域樣式 */
.grid-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 20px; }
.grid-separator { grid-column: 1 / -1; border: 0; border-top: 1px solid #eee; margin: 15px 0; }
.data-field { display: flex; flex-direction: column; }
.data-field label { margin-bottom: 6px; font-weight: bold; font-size: 0.9em; color: #555; }
.data-field input[type="text"], .data-field select, .data-field textarea { padding: 9px 12px; border: 1px solid #ccc; border-radius: 4px; width: 100%; box-sizing: border-box; font-size: 0.95em; }
.data-field input[readonly] { background-color: #e9ecef; cursor: not-allowed; }
.multiselect-field .checkbox-group { display: flex; flex-wrap: wrap; gap: 5px 15px; border: 1px solid #ccc; padding: 10px; border-radius: 4px; background-color: white; }
.multiselect-field .checkbox-group label { display: inline-flex; align-items: center; margin-bottom: 0; font-weight: normal; font-size: 0.9em; cursor: pointer; }
.multiselect-field input[type="checkbox"] { margin-right: 5px; }
.notes-field { grid-column: 1 / -1; }
.notes-field textarea { min-height: 80px; resize: vertical; }
.form-actions { margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; display: flex; align-items: center; gap: 15px; }
.form-actions .save-button { padding: 10px 18px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1em; transition: background-color 0.2s; }
.form-actions .save-button:hover { background-color: #218838; }
.save-hint { font-size: 0.85em; color: #6c757d; }

/* 已儲存列表樣式 */
.saved-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; }
.stock-group { border: 1px solid #e3e3e3; padding: 15px 20px; border-radius: 6px; background-color: #f8f9fa; min-height: 100px; }
.stock-group h3 { background-color: transparent; padding: 0; border-radius: 0; margin-bottom: 15px; color: #343a40; border-bottom: none; font-size: 1.1em;}
.draggable-list { min-height: 50px; padding-bottom: 5px; }
.saved-stock-item { background-color: #fff; border: 1px solid #ddd; padding: 10px 15px; margin-bottom: 10px; border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background-color 0.2s, box-shadow 0.2s; }
.saved-stock-item:hover { background-color: #f0f8ff; box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
.saved-stock-item .stock-code { font-weight: bold; margin-right: 10px; }
.saved-stock-item .stock-name { color: #555; flex-grow: 1; margin-right: 10px; }
.ghost { opacity: 0.5; background: #c8ebfb; border: 1px dashed #007bff; }

/* 通用樣式 */
.error-message { color: red; margin-top: 10px; font-weight: bold; }
.loading-message { padding: 20px; text-align: center; color: #6c757d; }

</style>