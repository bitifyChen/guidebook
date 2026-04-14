<script setup>
import { ref, reactive, watch, onMounted, onUnmounted, computed } from 'vue';
import { getExchangeRates, COMMON_CURRENCIES } from '@/api/currency';
import {
  Camera,
  ArrowRightLeft,
  RefreshCw,
  Info,
  Scan,
  X,
  Coins,
  Delete,
  ChevronRight,
  RotateCcw,
  Check,
  TrendingUp,
} from 'lucide-vue-next';

const loading = ref(false);
const rates = ref({});
const lastUpdated = ref(null);
const activeTab = ref('smart');

const form = reactive({
  baseCurrency: 'TWD',
  targetCurrency: 'KRW',
  baseAmount: '',
  targetAmount: '',
});

const showPicker = ref(false);
const pickingType = ref('base');

const openPicker = (type) => {
  pickingType.value = type;
  showPicker.value = true;
};
const selectCurrency = (code) => {
  if (pickingType.value === 'base') form.baseCurrency = code;
  else form.targetCurrency = code;
  showPicker.value = false;
};

const swapCurrencies = () => {
  const temp = form.baseCurrency;
  form.baseCurrency = form.targetCurrency;
  form.targetCurrency = temp;
  updateBaseAmount();
};

// --- OCR 與 視覺反饋 相關 ---
const videoRef = ref(null);
const canvasRef = ref(null);
const ocrLoading = ref(false);
const isScanning = ref(false);
const lastDetectedValue = ref('');
const worker = ref(null);

const detectedBox = reactive({
  visible: false,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  status: 'red',
  targetX: 0,
  targetY: 0,
});

let scanTimer = null;
let rafId = null;

const updateBoxAnimation = () => {
  if (detectedBox.visible) {
    detectedBox.x += (detectedBox.targetX - detectedBox.x) * 0.4;
    detectedBox.y += (detectedBox.targetY - detectedBox.y) * 0.4;
  }
  rafId = requestAnimationFrame(updateBoxAnimation);
};

const fetchRates = async () => {
  loading.value = true;
  const data = await getExchangeRates(form.baseCurrency);
  if (data) {
    rates.value = data.rates;
    lastUpdated.value = new Date(
      data.time_last_update_unix * 1000
    ).toLocaleString();
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
  if (rate)
    form.targetAmount = Math.round(
      parseFloat(form.baseAmount) * rate
    ).toString();
};

const updateBaseAmount = () => {
  if (!form.targetAmount) {
    form.baseAmount = '';
    return;
  }
  const rate = rates.value[form.targetCurrency];
  if (rate) form.baseAmount = (parseFloat(form.targetAmount) / rate).toFixed(2);
};

watch(() => form.baseCurrency, fetchRates);
watch(() => form.targetCurrency, updateTargetAmount);

const handleKeyPress = (key) => {
  if (key === 'delete') form.targetAmount = form.targetAmount.slice(0, -1);
  else if (key === '.') {
    if (!form.targetAmount.includes('.')) form.targetAmount += '.';
  } else {
    if (form.targetAmount.length < 12) form.targetAmount += key;
  }
  updateBaseAmount();
};

// --- 掃描核心邏輯 (極速版) ---
const startScanning = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 } },
    });
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      isScanning.value = true;
      initOCR();
      updateBoxAnimation();
    }
  } catch (err) {
    console.error(err);
  }
};

const stopScanning = async () => {
  if (videoRef.value?.srcObject)
    videoRef.value.srcObject.getTracks().forEach((t) => t.stop());
  isScanning.value = false;
  detectedBox.visible = false;
  if (scanTimer) clearTimeout(scanTimer);
  if (rafId) cancelAnimationFrame(rafId);
  if (worker.value) {
    await worker.value.terminate();
    worker.value = null;
  }
};

const initOCR = async () => {
  if (!window.Tesseract) {
    await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/tesseract.js@5.0.0/dist/tesseract.min.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }
  if (!worker.value) {
    worker.value = await Tesseract.createWorker('eng', 1);
    await worker.value.setParameters({
      tessedit_char_whitelist: '0123456789.,',
      tessedit_pageseg_mode: '7', // 單行模式，極快
      tessjs_create_hocr: '0',
      tessjs_create_tsv: '0',
    });
  }
  performContinuousOCR();
};

const performContinuousOCR = async () => {
  if (!isScanning.value || ocrLoading.value || !worker.value) return;

  const video = videoRef.value;
  const canvas = canvasRef.value;
  if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
    scanTimer = setTimeout(performContinuousOCR, 100);
    return;
  }

  const context = canvas.getContext('2d');
  const videoW = video.videoWidth;
  const videoH = video.videoHeight;

  // 1. 精確裁切
  const cropW = videoW * 0.7;
  const cropH = videoH * 0.3;
  const cropX = (videoW - cropW) / 2;
  const cropY = (videoH - cropH) / 2;

  // 2. 極速縮放：將影像縮小到固定高度 (數字辨識 64px 高度就綽綽有餘)
  const targetH = 64;
  const scale = targetH / cropH;
  canvas.width = cropW * scale;
  canvas.height = targetH;

  // 3. 影像優化：適度的對比度 (太強反而會有鋸齒)
  context.filter = 'grayscale(1) contrast(150%) brightness(110%)';
  context.drawImage(
    video,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    canvas.width,
    canvas.height
  );

  ocrLoading.value = true;
  try {
    const { data } = await worker.value.recognize(canvas);
    const validWords = data.words.filter(
      (w) => /\d/.test(w.text) && w.confidence > 60
    );

    if (validWords.length > 0) {
      const centerX = canvas.width / 2;
      const bestWord = validWords.reduce((prev, curr) => {
        const prevDist = Math.abs((prev.bbox.x0 + prev.bbox.x1) / 2 - centerX);
        const currDist = Math.abs((curr.bbox.x0 + curr.bbox.x1) / 2 - centerX);
        return currDist < prevDist ? curr : prev;
      });

      const isFractionalCurrency = ['USD', 'EUR', 'HKD'].includes(
        form.targetCurrency
      );
      let priceStr = bestWord.text.replace(/,/g, '');
      if (!isFractionalCurrency) priceStr = priceStr.replace(/\./g, '');
      priceStr = priceStr.replace(/[^\d.]/g, '');

      if (priceStr && !isNaN(priceStr)) {
        const uiScale = videoRef.value.clientWidth / videoW;
        detectedBox.targetX = (bestWord.bbox.x0 / scale + cropX) * uiScale;
        detectedBox.targetY = (bestWord.bbox.y0 / scale + cropY) * uiScale;
        detectedBox.w =
          ((bestWord.bbox.x1 - bestWord.bbox.x0) / scale) * uiScale;
        detectedBox.h =
          ((bestWord.bbox.y1 - bestWord.bbox.y0) / scale) * uiScale;

        if (!detectedBox.visible) {
          detectedBox.x = detectedBox.targetX;
          detectedBox.y = detectedBox.targetY;
        }
        detectedBox.visible = true;
        detectedBox.status = 'red';

        if (priceStr === lastDetectedValue.value || bestWord.confidence > 85) {
          detectedBox.status = 'green';
          if (form.targetAmount !== priceStr) {
            form.targetAmount = priceStr;
            updateBaseAmount();
            triggerHaptic();
          }
        }
        lastDetectedValue.value = priceStr;
      }
    } else {
      detectedBox.visible = false;
    }
  } catch (err) {
    console.warn(err);
  } finally {
    ocrLoading.value = false;
    if (isScanning.value) scanTimer = setTimeout(performContinuousOCR, 150); // 縮短間隔，實現流暢偵測
  }
};

const triggerHaptic = () => {
  if (window.navigator.vibrate) window.navigator.vibrate(8);
};

watch(activeTab, (v) => (v === 'smart' ? startScanning() : stopScanning()));
onMounted(() => {
  fetchRates();
  if (activeTab.value === 'smart') startScanning();
});
onUnmounted(() => stopScanning());

const currentBase = computed(() =>
  COMMON_CURRENCIES.find((c) => c.code === form.baseCurrency)
);
const currentTarget = computed(() =>
  COMMON_CURRENCIES.find((c) => c.code === form.targetCurrency)
);
</script>

<template>
  <div class="bg-[var(--primary-orange-light)]">
    <div
      class="fixed top-[8px] left-[16px] right-[16px] z-30 bg-slate-900/90 backdrop-blur-md px-4 shadow-sm rounded-[28px]"
    >
      <el-tabs v-model="activeTab" class="custom-tabs">
        <el-tab-pane label="智慧偵測" name="smart" />
        <el-tab-pane label="手動換算" name="manual" />
      </el-tabs>
    </div>

    <div class="mt-16 space-y-4">
      <div
        class="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex justify-between items-center border border-white/40 shadow-sm"
      >
        <div class="flex items-center gap-3">
          <TrendingUp :size="14" class="text-orange-500" />
          <p
            class="text-[10px] font-black text-slate-600 uppercase tracking-widest tabular-nums"
          >
            1 {{ form.baseCurrency }} ≈
            {{ rates[form.targetCurrency] || '...' }} {{ form.targetCurrency }}
          </p>
        </div>
        <button
          @click="fetchRates"
          class="flex items-center gap-1.5"
          :disabled="loading"
        >
          <RefreshCw
            :size="12"
            :class="{ 'animate-spin': loading }"
            class="text-orange-400"
          />
        </button>
      </div>

      <!-- 智慧掃描方塊 -->
      <div
        v-if="activeTab === 'smart'"
        class="relative aspect-video bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl ring-1 ring-slate-200"
      >
        <video
          ref="videoRef"
          autoplay
          playsinline
          class="w-full h-full object-cover opacity-80"
        ></video>

        <!-- 平滑跟隨識別框 -->
        <div
          v-if="detectedBox.visible"
          class="absolute border-2 z-20 rounded-lg pointer-events-none transition-colors duration-300"
          :class="
            detectedBox.status === 'green'
              ? 'border-emerald-500 shadow-[0_0_20px_#10b981]'
              : 'border-red-500 shadow-[0_0_10px_#ef4444]'
          "
          :style="{
            left: detectedBox.x + 'px',
            top: detectedBox.y + 'px',
            width: detectedBox.w + 'px',
            height: detectedBox.h + 'px',
          }"
        >
          <div
            class="absolute -top-6 left-0 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider whitespace-nowrap"
          >
            {{ detectedBox.status === 'green' ? '● 已辨識' : '○ 偵測中' }}
          </div>
        </div>

        <div
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div
            class="w-[70%] h-[40%] border-2 border-orange-500/20 rounded-2xl relative shadow-[0_0_0_1000px_rgba(15,23,42,0.7)]"
          >
            <div
              class="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-xl"
            ></div>
            <div
              class="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-xl"
            ></div>
            <div
              class="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-xl"
            ></div>
            <div
              class="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-xl"
            ></div>
            <div
              class="absolute left-0 right-0 h-0.5 bg-orange-500/40 shadow-[0_0_15px_rgba(255,140,0,1)] animate-scan-line"
            ></div>
          </div>
        </div>
        <div class="absolute bottom-4 left-0 right-0 text-center">
          <span
            class="bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-[10px] font-black tracking-widest uppercase border border-white/10"
          >
            自動掃描中
          </span>
        </div>
      </div>

      <div
        class="rounded-[40px] overflow-hidden shadow-2xl border border-white/20 bg-white relative"
      >
        <div class="px-4 py-6 bg-gradient-to-br from-orange-50/80 to-white">
          <div class="flex justify-between items-center mb-6">
            <button
              @click="openPicker('target')"
              class="group flex items-center gap-3 bg-white px-4 py-1.5 rounded-2xl shadow-sm border border-orange-100 active:scale-95 transition-all"
            >
              <span class="text-lg font-black text-slate-800">{{
                currentTarget?.code
              }}</span>
              <span
                class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter"
                >{{ currentTarget?.name }}</span
              >
              <ChevronRight
                :size="16"
                class="text-orange-300 group-hover:translate-x-1 transition-transform"
              />
            </button>
            <button
              @click="
                form.targetAmount = '';
                updateBaseAmount();
              "
              class="w-12 h-12 flex items-center justify-center text-slate-300 active:rotate-180 transition-transform duration-500"
            >
              <RotateCcw :size="22" />
            </button>
          </div>
          <div class="flex items-baseline gap-3">
            <span class="text-3xl font-black text-orange-500">{{
              currentTarget?.symbol
            }}</span>
            <div
              class="text-4xl font-black tracking-tighter flex-1 text-right text-slate-800 tabular-nums"
            >
              {{ form.targetAmount || '0' }}
            </div>
          </div>
        </div>

        <div
          class="h-1 bg-slate-900 flex justify-center items-center overflow-visible relative z-20"
        >
          <button
            @click="swapCurrencies"
            class="absolute w-14 h-14 bg-slate-900 rounded-full border-4 border-[var(--primary-orange-light)] flex items-center justify-center shadow-xl active:scale-90 active:bg-orange-600 transition-all group"
          >
            <ArrowRightLeft
              :size="24"
              class="text-orange-500 rotate-90 group-active:text-white transition-colors"
            />
          </button>
        </div>

        <div
          class="px-4 py-6 bg-gradient-to-br from-slate-800 to-slate-900 text-white relative overflow-hidden group"
        >
          <div class="flex justify-between items-center mb-6 relative z-10">
            <button
              @click="openPicker('base')"
              class="group flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-2xl border border-white/10 active:scale-95 transition-all"
            >
              <span class="text-lg font-black text-white">{{
                currentBase?.code
              }}</span>
              <span
                class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter"
                >{{ currentBase?.name }}</span
              >
              <ChevronRight
                :size="16"
                class="text-white/20 group-hover:translate-x-1 transition-transform"
              />
            </button>
            <p
              class="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]"
            >
              約合新台幣
            </p>
          </div>
          <div class="flex items-baseline gap-3 relative z-10">
            <span class="text-3xl font-black text-indigo-400">{{
              currentBase?.symbol
            }}</span>
            <div
              class="text-4xl font-black tracking-tighter text-white tabular-nums flex-1 text-right drop-shadow-lg"
            >
              {{ form.baseAmount || '0.00' }}
            </div>
          </div>
          <Coins
            :size="180"
            class="absolute -bottom-16 -right-16 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-700"
          />
        </div>
      </div>

      <div
        v-if="activeTab === 'manual'"
        class="bg-white/80 backdrop-blur-sm rounded-[32px] p-6 grid grid-cols-3 gap-4 border border-white/40 shadow-sm"
      >
        <button
          v-for="n in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0']"
          :key="n"
          @click="handleKeyPress(n)"
          class="h-14 flex items-center justify-center text-3xl font-black text-slate-700 active:scale-90 active:text-orange-50 transition-all rounded-2xl"
        >
          {{ n }}
        </button>
        <button
          @click="handleKeyPress('delete')"
          class="h-14 flex items-center justify-center text-red-500 active:scale-90 transition-all rounded-2xl"
        >
          <Delete :size="28" />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showPicker"
          class="fixed inset-0 z-[4000] bg-slate-900/60 backdrop-blur-sm flex items-end"
          @click.self="showPicker = false"
        >
          <div
            class="w-full bg-white rounded-t-[40px] p-8 pb-12 space-y-6 shadow-2xl animate-slide-up"
          >
            <div class="flex justify-between items-center">
              <div>
                <h3 class="text-2xl font-black text-slate-800">選擇幣別</h3>
                <p
                  class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1"
                >
                  Select Currency
                </p>
              </div>
              <button
                @click="showPicker = false"
                class="p-3 bg-slate-100 rounded-full text-slate-400 active:scale-90 transition-all"
              >
                <X :size="24" />
              </button>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <button
                v-for="c in COMMON_CURRENCIES"
                :key="c.code"
                @click="selectCurrency(c.code)"
                :class="[
                  'flex items-center justify-between p-5 rounded-[24px] border-4 transition-all',
                  (pickingType === 'base'
                    ? form.baseCurrency
                    : form.targetCurrency) === c.code
                    ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-100'
                    : 'border-slate-50 bg-slate-50 text-slate-400',
                ]"
              >
                <div class="text-left">
                  <p
                    class="text-xl font-black"
                    :class="
                      (pickingType === 'base'
                        ? form.baseCurrency
                        : form.targetCurrency) === c.code
                        ? 'text-slate-800'
                        : 'text-slate-500'
                    "
                  >
                    {{ c.code }}
                  </p>
                  <p class="text-[10px] font-bold opacity-60">{{ c.name }}</p>
                </div>
                <div
                  v-if="
                    (pickingType === 'base'
                      ? form.baseCurrency
                      : form.targetCurrency) === c.code
                  "
                  class="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white"
                >
                  <Check :size="14" stroke-width="4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <canvas ref="canvasRef" class="hidden"></canvas>
  </div>
</template>

<style scoped>
.custom-tabs :deep(.el-tabs__item) {
  font-weight: bold;
  flex: 1;
  text-align: center;
  transition: transform 0.1s ease;
  color: #ffca99;
  height: 48px;
  line-height: 48px;
}
.custom-tabs :deep(.el-tabs__nav) {
  width: 100%;
  display: flex;
}
.custom-tabs :deep(.el-tabs__active-bar) {
  background-color: #ff8c00;
  height: 3px;
  border-radius: 3px;
}
.custom-tabs :deep(.el-tabs__item.is-active) {
  color: #ff8c00 !important;
}
.custom-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
.custom-tabs :deep(.el-tabs__header) {
  margin-bottom: 0px;
}
@keyframes scan {
  0% {
    top: 0%;
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    top: 100%;
    opacity: 0;
  }
}
.animate-scan-line {
  animation: scan 2s linear infinite;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
.animate-slide-up {
  animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
