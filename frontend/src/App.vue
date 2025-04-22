<script setup>
import { ref, reactive, computed, watch } from 'vue';
import axios from 'axios';
import draggable from 'vuedraggable'; // 引入 draggable

// --- State ---
const stockCode = ref('');
const stockName = ref(''); // 股票名稱 (可選，後端若能提供更好)
const isLoading = ref(false);
const errorMessage = ref('');
const currentStock = reactive({
  code: '',
  name: '',
  open: '',
  high: '',
  low: '',
  close: '',
  volume: '',
  // --- 自訂分析欄位 ---
  positionLevel: '', // 位階
  shortDefense: '', // 空防守
  pivotPoint: '',   // 多空點
  longDefense: '',  // 多防守
  weekDefense: '',  // 週守值
  monthDefense: '', // 月守值
  trend: '盤整',      // 走勢 (預設值)
  kd: '',
  macd: '',
  法人買賣: [],      // MultiSelect (存成陣列)
  notes: ''          // 補充說明
});
const savedStocks = ref({
  多頭: [],
  空頭: [],
  盤整: []
});

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
  return 'black'; // 或灰色
});

// --- Methods ---
const searchStock = async () => {
  if (!stockCode.value) {
    errorMessage.value = '請輸入股票代號';
    return;
  }
  isLoading.value = true;
  errorMessage.value = '';
  clearCurrentStockData(); // 清除舊資料

  try {
    // !! 注意：URL 指向你的後端 API !!
    const response = await axios.get(`http://localhost:3001/api/stock?code=${stockCode.value}`);
    const data = response.data;

    // 更新 currentStock 的基本資料
    currentStock.code = data.code || stockCode.value;
    currentStock.name = data.name || stockName.value || ''; // 使用後端或輸入的名稱
    currentStock.open = data.open || '';
    currentStock.high = data.high || '';
    currentStock.low = data.low || '';
    currentStock.close = data.close || '';
    currentStock.volume = data.volume || '';

    stockName.value = currentStock.name; // 同步輸入框的名稱

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
    clearCurrentStockData(true); // 保留代號/名稱，清除其他數據
  } finally {
    isLoading.value = false;
  }
};

const clearCurrentStockData = (keepCodeName = false) => {
   if (!keepCodeName) {
       currentStock.code = '';
       currentStock.name = '';
   }
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
};

const saveStock = () => {
  if (!currentStock.code) {
    alert('沒有要儲存的股票資料');
    return;
  }
  // 簡單檢查是否已存在 (基於代號)
  const group = currentStock.trend;
  if (!savedStocks.value[group]) {
      savedStocks.value[group] = []; // 以防萬一
  }
  const existingIndex = savedStocks.value[group].findIndex(s => s.code === currentStock.code);

  const stockToSave = JSON.parse(JSON.stringify(currentStock)); // 深拷貝

  if (existingIndex > -1) {
    // 更新已存在的股票
    savedStocks.value[group][existingIndex] = stockToSave;
    alert(`已更新 ${currentStock.code} 的資料`);
  } else {
     // 新增股票到對應的組別
     // 先從其他組別移除 (如果存在)
     Object.keys(savedStocks.value).forEach(key => {
         if (key !== group) {
             savedStocks.value[key] = savedStocks.value[key].filter(s => s.code !== currentStock.code);
         }
     });
     savedStocks.value[group].push(stockToSave);
     alert(`已將 ${currentStock.code} 儲存到 ${group} 分類`);
  }
   saveToLocalStorage(); // 儲存到 LocalStorage
};

// --- Import / Export ---
const exportData = () => {
    if (Object.values(savedStocks.value).every(arr => arr.length === 0)) {
        alert('沒有可匯出的資料');
        return;
    }
    const dataStr = JSON.stringify(savedStocks.value, null, 2); // 格式化 JSON
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
      // 基本驗證匯入的資料結構
      if (typeof importedData === 'object' && importedData !== null &&
          ('多頭' in importedData || '空頭' in importedData || '盤整' in importedData))
      {
         // 合併或替換現有資料 (這裡選擇替換)
         savedStocks.value = {
             多頭: importedData['多頭'] || [],
             空頭: importedData['空頭'] || [],
             盤整: importedData['盤整'] || [],
         };
         alert('資料匯入成功！');
         saveToLocalStorage(); // 儲存到 LocalStorage
      } else {
         alert('匯入失敗：檔案格式不符');
      }
    } catch (err) {
      console.error("Import error:", err);
      alert(`匯入失敗：無法解析 JSON 檔案 (${err.message})`);
    } finally {
        // 清空 input value 允許再次選擇同一個檔案
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
       // 基本驗證
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
      localStorage.removeItem('savedStocksData'); // 清除損壞的資料
    }
  }
};

// --- Drag & Drop ---
const handleDragEnd = (event) => {
    console.log("Drag ended, updating localStorage", event);
    saveToLocalStorage(); // 拖曳結束後儲存狀態
};

 // --- Watcher ---
// 當走勢改變時，自動將 currentStock 移動到對應的 savedStocks 分類 (如果已儲存)
watch(() => currentStock.trend, (newTrend, oldTrend) => {
    if (!currentStock.code) return; // 必須有代號

    let stockToMove = null;
    let originalIndex = -1;

    // 從舊組別找到並移除
    if (savedStocks.value[oldTrend]) {
        originalIndex = savedStocks.value[oldTrend].findIndex(s => s.code === currentStock.code);
        if (originalIndex > -1) {
            stockToMove = savedStocks.value[oldTrend].splice(originalIndex, 1)[0];
        }
    }

    // 如果找到了，加入到新組別
    if (stockToMove) {
        if (!savedStocks.value[newTrend]) {
            savedStocks.value[newTrend] = [];
        }
        // 檢查是否已在新組別 (避免重複添加)
        if (!savedStocks.value[newTrend].some(s => s.code === stockToMove.code)) {
           savedStocks.value[newTrend].push(stockToMove);
           saveToLocalStorage(); // 保存變更
           console.log(`Moved ${stockToMove.code} from ${oldTrend} to ${newTrend}`);
        }
    } else {
         // 如果在舊組別沒找到 (代表是新加入的股票，尚未 save)，則不需移動
         console.log(`Stock ${currentStock.code} not found in saved group ${oldTrend}, no move needed.`);
    }
});


// --- Lifecycle Hooks ---
import { onMounted } from 'vue';
onMounted(() => {
  loadFromLocalStorage(); // 頁面載入時讀取資料
});

</script>

<template>
  <div class="stock-tracker">
    <h1>股市分析紀錄</h1>

    <!-- 搜尋區域 -->
    <div class="search-section card">
      <h2>搜尋股票</h2>
      <div class="form-inline">
        <label for="stockCode">股票代號:</label>
        <input type="text" id="stockCode" v-model="stockCode" placeholder="例如: 2330">
        <label for="stockName">股票名稱:</label>
        <input type="text" id="stockName" v-model="stockName" placeholder="(可選)">
        <button @click="searchStock" :disabled="isLoading">
          {{ isLoading ? '搜尋中...' : '搜尋' }}
        </button>
      </div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </div>

    <!-- 資料顯示與編輯區域 -->
    <div class="display-section card" v-if="currentStock.code || isLoading">
      <h2>{{ currentStock.name }} ({{ currentStock.code }}) - 分析資料</h2>
      <div class="grid-container">
        <!-- 基本資料 -->
        <div class="data-field">
          <label>開盤價:</label>
          <input type="text" v-model="currentStock.open" readonly :style="{ color: priceChangeColor }">
        </div>
        <div class="data-field">
          <label>最高價:</label>
          <input type="text" v-model="currentStock.high" readonly :style="{ color: priceChangeColor }">
        </div>
        <div class="data-field">
          <label>最低價:</label>
          <input type="text" v-model="currentStock.low" readonly :style="{ color: priceChangeColor }">
        </div>
        <div class="data-field">
          <label>收盤價:</label>
          <input type="text" v-model="currentStock.close" readonly :style="{ color: priceChangeColor }">
        </div>
        <div class="data-field">
          <label>成交量(張):</label>
          <input type="text" v-model="currentStock.volume" readonly>
        </div>

        <!-- 分隔線 -->
        <hr class="grid-separator">

        <!-- 自訂分析欄位 -->
        <div class="data-field">
          <label for="positionLevel">位階:</label>
          <input type="text" id="positionLevel" v-model="currentStock.positionLevel">
        </div>
        <div class="data-field">
          <label for="shortDefense">空防守:</label>
          <input type="text" id="shortDefense" v-model="currentStock.shortDefense">
        </div>
         <div class="data-field">
          <label for="pivotPoint">多空點:</label>
          <input type="text" id="pivotPoint" v-model="currentStock.pivotPoint">
        </div>
        <div class="data-field">
          <label for="longDefense">多防守:</label>
          <input type="text" id="longDefense" v-model="currentStock.longDefense">
        </div>
        <div class="data-field">
          <label for="weekDefense">週守值:</label>
          <input type="text" id="weekDefense" v-model="currentStock.weekDefense">
        </div>
        <div class="data-field">
          <label for="monthDefense">月守值:</label>
          <input type="text" id="monthDefense" v-model="currentStock.monthDefense">
        </div>
        <div class="data-field">
          <label for="trend">走勢:</label>
          <select id="trend" v-model="currentStock.trend">
            <option>多頭</option>
            <option>回後買上漲</option>
            <option>盤整</option>
            <option>空頭</option>
            <option>彈後空下跌</option>
          </select>
        </div>
        <div class="data-field">
          <label for="kd">KD:</label>
          <input type="text" id="kd" v-model="currentStock.kd">
        </div>
        <div class="data-field">
          <label for="macd">MACD:</label>
          <input type="text" id="macd" v-model="currentStock.macd">
        </div>

        <!-- 法人買賣 MultiSelect -->
        <div class="data-field multiselect-field">
            <label>法人買賣:</label>
            <div class="checkbox-group">
                <label><input type="checkbox" value="外資買" v-model="currentStock.法人買賣"> 外資買</label>
                <label><input type="checkbox" value="外資賣" v-model="currentStock.法人買賣"> 外資賣</label>
                <label><input type="checkbox" value="投信買" v-model="currentStock.法人買賣"> 投信買</label>
                <label><input type="checkbox" value="投信賣" v-model="currentStock.法人買賣"> 投信賣</label>
                <label><input type="checkbox" value="自營買" v-model="currentStock.法人買賣"> 自營買</label>
                <label><input type="checkbox" value="自營賣" v-model="currentStock.法人買賣"> 自營賣</label>
             </div>
        </div>

        <!-- 補充說明 -->
        <div class="data-field notes-field">
          <label for="notes">補充說明:</label>
          <textarea id="notes" v-model="currentStock.notes" rows="4"></textarea>
        </div>

      </div>

       <!-- 操作按鈕 -->
        <div class="actions-section">
          <button @click="saveStock" class="save-button">儲存此股票分析</button>
          <button @click="exportData">匯出全部資料 (.json)</button>
          <button @click="triggerImport">匯入資料 (.json)</button>
          <input type="file" id="importFile" @change="importData" accept=".json" style="display: none;">
        </div>

    </div>

    <!-- 已儲存列表 -->
    <div class="saved-section card">
      <h2>已儲存股票 (可拖曳調整順序或移動分類)</h2>
      <div class="saved-groups">
        <div v-for="(list, groupName) in savedStocks" :key="groupName" class="stock-group">
          <h3>{{ groupName }} ({{ list.length }})</h3>
          <draggable
            :list="list"
            item-key="code"
            group="stocks"
            ghost-class="ghost"
            @end="handleDragEnd"
            class="draggable-list"
            :data-group-name="groupName"
			tag="div"
           >
            <template #item="{ element }">
              <!-- 只渲染一個最簡單的 div，包含股票代號 -->
              <div>{{ element.code }} - {{ element.name }}</div>
            </template>
          </draggable>
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

.card {
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

h1, h2, h3 {
  color: #333;
  margin-top: 0;
}
 h2 { border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; }
 h3 { background-color: #e9ecef; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; color: #495057;}


.form-inline label {
  margin-right: 5px;
}
.form-inline input[type="text"] {
  margin-right: 15px;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.form-inline button {
  padding: 8px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.form-inline button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}
.form-inline button:hover:not(:disabled) {
  background-color: #0056b3;
}

.error-message {
  color: red;
  margin-top: 10px;
  font-weight: bold;
}

.grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* 響應式網格 */
    gap: 15px; /* 間隔 */
    margin-bottom: 20px;
}

.grid-separator {
    grid-column: 1 / -1; /* 橫跨所有列 */
    border: 0;
    border-top: 1px solid #eee;
    margin: 10px 0;
}


.data-field {
  display: flex;
  flex-direction: column; /* 讓標籤在輸入框上方 */
}

.data-field label {
  margin-bottom: 5px;
  font-weight: bold;
  font-size: 0.9em;
  color: #555;
}

.data-field input[type="text"],
.data-field select,
.data-field textarea {
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 100%; /* 佔滿網格單元 */
  box-sizing: border-box; /* padding 不會撐大寬度 */
}
 .data-field input[readonly] {
    background-color: #e9ecef; /* 唯讀欄位給點背景色 */
    cursor: not-allowed;
}

.multiselect-field .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px; /* Checkbox之間的間隔 */
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 4px;
    background-color: white;
}
 .multiselect-field .checkbox-group label {
     display: inline-flex; /* 讓 checkbox 和文字對齊 */
     align-items: center;
     margin-bottom: 0; /* 覆蓋 data-field 的 margin */
     font-weight: normal; /* 取消粗體 */
     font-size: 0.9em;
     cursor: pointer;
 }
 .multiselect-field input[type="checkbox"] {
     margin-right: 5px;
 }

.notes-field {
    grid-column: 1 / -1; /* 讓補充說明橫跨多列 */
}
 .notes-field textarea {
    min-height: 80px; /* 設定最小高度 */
    resize: vertical; /* 允許垂直調整大小 */
 }

.actions-section {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #eee;
    display: flex;
    gap: 10px; /* 按鈕間距 */
    flex-wrap: wrap; /* 換行 */
}
 .actions-section button {
     padding: 10px 15px;
     border: none;
     border-radius: 4px;
     cursor: pointer;
     font-size: 0.9em;
     transition: background-color 0.2s, box-shadow 0.2s;
 }
 .actions-section .save-button {
     background-color: #28a745; /* 綠色 */
     color: white;
 }
  .actions-section .save-button:hover {
      background-color: #218838;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }
 .actions-section button:not(.save-button) {
     background-color: #6c757d; /* 灰色 */
     color: white;
 }
 .actions-section button:not(.save-button):hover {
     background-color: #5a6268;
     box-shadow: 0 2px 5px rgba(0,0,0,0.15);
 }


.saved-section {
    margin-top: 30px;
}
.saved-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); /* 響應式分組 */
  gap: 20px;
}
.stock-group {
    border: 1px dashed #ccc;
    padding: 15px;
    border-radius: 4px;
    background-color: #fff;
     min-height: 100px; /* 至少有個高度，方便拖曳 */
}

.draggable-list {
   min-height: 50px; /* 拖曳區域的最小高度 */
   padding-bottom: 10px; /* 留點空間 */
}


.saved-stock-item {
  background-color: #fff;
  border: 1px solid #eee;
  padding: 8px 12px;
  margin-bottom: 8px;
  border-radius: 4px;
  cursor: grab; /* 表示可拖曳 */
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}
.saved-stock-item:hover {
   background-color: #f0f0f0;
}

 .saved-stock-item .stock-code { font-weight: bold; margin-right: 10px;}
 .saved-stock-item .stock-name { color: #555; flex-grow: 1; margin-right: 10px;}

.ghost { /* 拖曳時的佔位符樣式 */
  opacity: 0.5;
  background: #c8ebfb;
}

</style>