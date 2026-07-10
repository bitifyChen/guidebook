<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { getExchangeRates, COMMON_CURRENCIES } from '@/api/currency';
import { useTripStore } from '@/store/tripStore';
import {
  X,
  Camera,
  ArrowRightLeft,
  RefreshCw,
  Info,
  Coins,
  Scan,
} from 'lucide-vue-next';

const props = defineProps({
  visible: Boolean,
});

const emit = defineEmits(['update:visible']);
const tripStore = useTripStore();

const loading = ref(false);
const rates = ref({});
const lastUpdated = ref(null);

// 換算表單
const form = reactive({
  baseCurrency: 'TWD',
  targetCurrency: tripStore.currencyCode,
  baseAmount: '',
  targetAmount: '',
});

// OCR 相關
const cameraActive = ref(false);
const videoRef = ref(null);
const canvasRef = ref(null);
const ocrLoading = ref(false);
const worker = ref(null);

const fetchRates = async () => {
  loading.value = true;
  const data = await getExchangeRates(form.baseCurrency);
  if (data) {
    rates.value = data.rates;
    lastUpdated.value = new Date(data.time_last_update_unix * 1000).toLocaleString();
    updateTargetAmount();
  }
  loading.value = false;
};

const updateTargetAmount = () => {
  if (!form.baseAmount) {
    form.targetAmount = '';
    return;
  }
  const rate = rates.value[form.targetCurrency];
  if (rate) {
    form.targetAmount = (parseFloat(form.baseAmount) * rate).toFixed(2);
  }
};

const updateBaseAmount = () => {
  if (!form.targetAmount) {
    form.baseAmount = '';
    return;
  }
  const rate = rates.value[form.targetCurrency];
  if (rate) {
    form.baseAmount = (parseFloat(form.targetAmount) / rate).toFixed(2);
  }
};

watch(() => form.baseCurrency, fetchRates);
watch(() => form.targetCurrency, updateTargetAmount);

// OCR 邏輯
const startCamera = async () => {
  try {
    cameraActive.value = true;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
    }
  } catch (err) {
    console.error('Camera Error:', err);
    alert('無法開啟相機，請確認權限設定。');
    cameraActive.value = false;
  }
};

const stopCamera = () => {
  if (videoRef.value && videoRef.value.srcObject) {
    const tracks = videoRef.value.srcObject.getTracks();
    tracks.forEach((track) => track.stop());
  }
  cameraActive.value = false;
};

const captureAndOCR = async () => {
  if (!videoRef.value || ocrLoading.value) return;

  ocrLoading.value = true;
  const video = videoRef.value;
  const canvas = canvasRef.value;
  const context = canvas.getContext('2d');

  // 設定畫布大小與視訊一致
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    // 延遲載入 Tesseract 以優化初始效能
    if (!window.Tesseract) {
        // 動態載入 CDN 版本的 Tesseract.js (如果 npm 未安裝)
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/tesseract.js@5.0.0/dist/tesseract.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
      logger: m => console.log(m)
    });

    // 擷取數字 (包含小數點)
    const numbers = text.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length > 0) {
      // 假設最大的數字通常是價格
      const price = Math.max(...numbers.map(Number));
      form.targetAmount = price.toString();
      updateBaseAmount();
      stopCamera();
    } else {
      alert('未能辨識到數字，請再試一次。');
    }
  } catch (err) {
    console.error('OCR Error:', err);
    alert('辨識失敗：' + err.message);
  } finally {
    ocrLoading.value = false;
  }
};

onMounted(() => {
  fetchRates();
});
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    direction="btt"
    size="90%"
    :with-header="false"
    :append-to-body="true"
    class="currency-drawer"
  >
    <div class="p-6 h-full flex flex-col">
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
            <ArrowRightLeft :size="20" />
          </div>
          <h2 class="text-2xl font-black text-slate-800 tracking-tight">匯率換算</h2>
        </div>
        <button @click="emit('update:visible', false)" class="p-2 bg-slate-100 rounded-full text-slate-400">
          <X :size="20" />
        </button>
      </div>

      <div class="space-y-6 flex-1 overflow-y-auto">
        <!-- 匯率資訊卡片 -->
        <div class="bg-indigo-50 rounded-2xl p-4 flex items-start gap-3">
          <Info class="text-indigo-500 shrink-0 mt-0.5" :size="16" />
          <div>
            <p class="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-1">即時匯率</p>
            <p class="text-sm font-bold text-indigo-900">
              1 {{ form.baseCurrency }} = {{ rates[form.targetCurrency] || '...' }} {{ form.targetCurrency }}
            </p>
            <p class="text-[10px] text-indigo-300 mt-1" v-if="lastUpdated">最後更新: {{ lastUpdated }}</p>
          </div>
          <button @click="fetchRates" class="ml-auto p-2 text-indigo-400 active:rotate-180 transition-transform duration-500">
            <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
          </button>
        </div>

        <!-- 換算區塊 -->
        <div class="space-y-4">
          <!-- 基準貨幣 -->
          <div class="bg-slate-50 rounded-3xl p-6 border-2 border-transparent focus-within:border-orange-200 transition-all">
            <div class="flex justify-between items-center mb-2">
              <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">支付貨幣</span>
              <el-select v-model="form.baseCurrency" class="currency-select-mini" size="small">
                <el-option v-for="c in COMMON_CURRENCIES" :key="c.code" :label="c.code" :value="c.code">
                  <span class="font-bold">{{ c.code }}</span> <span class="text-xs opacity-50">{{ c.name }}</span>
                </el-option>
              </el-select>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-3xl font-black text-slate-400">{{ COMMON_CURRENCIES.find(c => c.code === form.baseCurrency)?.symbol }}</span>
              <input
                v-model="form.baseAmount"
                type="number"
                inputmode="decimal"
                placeholder="0"
                class="bg-transparent border-none w-full text-4xl font-black text-slate-800 focus:ring-0 p-0"
                @input="updateTargetAmount"
              />
            </div>
          </div>

          <!-- 切換按鈕 -->
          <div class="flex justify-center -my-6 relative z-10">
            <button
              @click="[form.baseCurrency, form.targetCurrency] = [form.targetCurrency, form.baseCurrency]"
              class="w-12 h-12 bg-white rounded-2xl shadow-lg border border-slate-100 flex items-center justify-center text-orange-500 active:scale-90 transition-all"
            >
              <ArrowRightLeft :size="24" class="rotate-90" />
            </button>
          </div>

          <!-- 目標貨幣 -->
          <div class="bg-slate-800 rounded-3xl p-6 border-2 border-transparent focus-within:border-orange-500 transition-all shadow-xl shadow-slate-200">
            <div class="flex justify-between items-center mb-2">
              <span class="text-[11px] font-black text-slate-600 uppercase tracking-widest">目標貨幣</span>
              <el-select v-model="form.targetCurrency" class="currency-select-mini-dark" size="small">
                <el-option v-for="c in COMMON_CURRENCIES" :key="c.code" :label="c.code" :value="c.code">
                  <span class="font-bold">{{ c.code }}</span> <span class="text-xs opacity-50">{{ c.name }}</span>
                </el-option>
              </el-select>
            </div>
            <div class="flex items-center gap-4">
              <span class="text-3xl font-black text-orange-400">{{ COMMON_CURRENCIES.find(c => c.code === form.targetCurrency)?.symbol }}</span>
              <input
                v-model="form.targetAmount"
                type="number"
                inputmode="decimal"
                placeholder="0"
                class="bg-transparent border-none w-full text-4xl font-black text-white focus:ring-0 p-0"
                @input="updateBaseAmount"
              />
              <button
                @click="startCamera"
                class="p-3 bg-orange-500 rounded-2xl text-white shadow-lg shadow-orange-900/40 active:scale-90 transition-all"
              >
                <Camera :size="24" />
              </button>
            </div>
          </div>
        </div>

        <!-- 相機區塊 -->
        <div v-if="cameraActive" class="fixed inset-0 z-[2000] bg-black flex flex-col">
          <div class="p-6 flex justify-between items-center text-white">
            <h3 class="font-bold">掃描價格標籤</h3>
            <button @click="stopCamera" class="p-2 bg-white/10 rounded-full">
              <X :size="24" />
            </button>
          </div>

          <div class="flex-1 relative flex items-center justify-center overflow-hidden">
            <video ref="videoRef" autoplay playsinline class="h-full w-full object-cover"></video>

            <!-- 掃描框區域 -->
            <div class="absolute inset-0 border-[40px] border-black/60 pointer-events-none">
              <div class="w-full h-full border-2 border-orange-500 rounded-xl relative">
                <div class="absolute inset-0 bg-orange-500/10 animate-pulse"></div>
                <!-- 角角裝飾 -->
                <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 -mt-1 -ml-1"></div>
                <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 -mt-1 -mr-1"></div>
                <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 -mb-1 -ml-1"></div>
                <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 -mb-1 -mr-1"></div>
              </div>
            </div>

            <p class="absolute bottom-10 left-0 right-0 text-center text-white/70 text-sm px-10">
              將價格數字置於框內，點擊下方按鈕進行辨識
            </p>
          </div>

          <div class="p-10 flex justify-center bg-black">
            <button
              @click="captureAndOCR"
              :disabled="ocrLoading"
              class="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-900 active:scale-90 transition-all disabled:opacity-50"
            >
              <div v-if="ocrLoading" class="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-orange-500"></div>
              <Scan v-else :size="36" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <canvas ref="canvasRef" class="hidden"></canvas>
  </el-drawer>
</template>

<style scoped>
.currency-drawer :deep(.el-drawer__body) {
  padding: 0;
  border-radius: 32px 32px 0 0;
}

.currency-select-mini :deep(.el-input__wrapper) {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  width: 70px;
}
.currency-select-mini :deep(.el-input__inner) {
  font-weight: 900;
  color: #94a3b8;
  text-align: right;
}

.currency-select-mini-dark :deep(.el-input__wrapper) {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  width: 70px;
}
.currency-select-mini-dark :deep(.el-input__inner) {
  font-weight: 900;
  color: #fb923c;
  text-align: right;
}

/* 隱藏 type="number" 的箭頭 */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
