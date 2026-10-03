<script setup>
import { ref, reactive, watch, onMounted, computed } from 'vue';
import { getExchangeRates, COMMON_CURRENCIES } from '@/api/currency';
import { useTripStore } from '@/store/tripStore';
import {
  ArrowRightLeft,
  RefreshCw,
  Coins,
  Delete,
  ChevronRight,
  RotateCcw,
  Check,
  TrendingUp,
} from 'lucide-vue-next';
import FrontendBottomDrawer from '@/components/FrontendBottomDrawer.vue';

const loading = ref(false);
const rates = ref({});
const lastUpdated = ref(null);
const tripStore = useTripStore();

const form = reactive({
  baseCurrency: 'TWD',
  targetCurrency: tripStore.currencyCode,
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
  if (key === 'delete') {
    form.targetAmount = form.targetAmount.slice(0, -1);
  } else if (key === '.') {
    if (!form.targetAmount.includes('.')) form.targetAmount += '.';
  } else {
    if (form.targetAmount.length < 12) form.targetAmount += key;
  }
  updateBaseAmount();
};

onMounted(() => {
  fetchRates();
});

const currentBase = computed(() =>
  COMMON_CURRENCIES.find((c) => c.code === form.baseCurrency)
);
const currentTarget = computed(() =>
  COMMON_CURRENCIES.find((c) => c.code === form.targetCurrency)
);
</script>

<template>
  <div class="bg-[var(--travel-paper)] py-4">
    <div class="space-y-4">
      <!-- 匯率資訊 -->
      <div
        class="flex items-center justify-between rounded-2xl border border-[#dfe8e4] bg-white px-5 py-3 shadow-sm"
      >
        <div class="flex items-center gap-3">
          <TrendingUp :size="14" class="text-[var(--travel-teal)]" />
          <p
            class="text-[10px] font-black text-slate-600 uppercase tracking-widest tabular-nums"
          >
            1 {{ form.baseCurrency }} ≈
            {{ rates[form.targetCurrency] || '...' }} {{ form.targetCurrency }}
          </p>
        </div>
        <button
          type="button"
          aria-label="更新匯率"
          @click="fetchRates"
          class="flex min-h-11 items-center gap-1.5 rounded-xl px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--travel-coral)]"
          :disabled="loading"
        >
          <RefreshCw
            :size="12"
            :class="{ 'animate-spin': loading }"
            class="text-[var(--travel-teal)]"
          />
          <span class="text-[9px] font-bold text-[var(--travel-teal)] uppercase"
            >更新匯率</span
          >
        </button>
      </div>

      <!-- 換算主體 -->
      <div
        class="rounded-[40px] overflow-hidden shadow-2xl border border-white/20 bg-white relative"
      >
        <!-- 目標金額 (輸入區) -->
        <div
          class="bg-gradient-to-br from-[var(--travel-mist)] to-white px-4 py-4"
        >
          <div class="flex justify-between items-center mb-6">
            <button
              type="button"
              @click="openPicker('target')"
              class="group flex min-h-11 items-center gap-3 rounded-2xl border border-[#d7e8e2] bg-white px-4 py-1.5 shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--travel-coral)] active:scale-95"
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
                class="text-[var(--travel-teal)]/50 transition-transform group-hover:translate-x-1"
              />
            </button>
            <button
              type="button"
              aria-label="清除換算金額"
              @click="
                form.targetAmount = '';
                updateBaseAmount();
              "
              class="flex h-12 w-12 items-center justify-center rounded-xl text-slate-400 transition-transform duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--travel-coral)] active:rotate-180"
            >
              <RotateCcw :size="22" />
            </button>
          </div>
          <div class="flex items-baseline gap-3">
            <span class="text-3xl font-black text-[var(--travel-teal)]">{{
              currentTarget?.symbol
            }}</span>
            <div
              class="text-2xl font-black tracking-tighter flex-1 text-right text-slate-800 tabular-nums break-all"
            >
              {{ form.targetAmount || '0' }}
            </div>
          </div>
        </div>

        <!-- 切換按鈕 -->
        <div
          class="relative z-20 flex h-1 items-center justify-center overflow-visible bg-[var(--travel-ink)]"
        >
          <button
            type="button"
            aria-label="交換幣別"
            @click="swapCurrencies"
            class="absolute flex h-14 w-14 items-center justify-center rounded-full border-4 border-[var(--travel-paper)] bg-[var(--travel-teal)] shadow-lg transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--travel-coral)] active:scale-90 active:bg-[var(--travel-ink)] group"
          >
            <ArrowRightLeft
              :size="24"
              class="rotate-90 text-white transition-colors"
            />
          </button>
        </div>

        <!-- 基準金額 (顯示區) -->
        <div
          class="relative overflow-hidden bg-[var(--travel-ink)] px-4 py-4 text-white group"
        >
          <div class="flex justify-between items-center mb-6 relative z-10">
            <button
              type="button"
              @click="openPicker('base')"
              class="group flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-[#285458] px-4 py-1.5 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--travel-coral)] active:scale-95"
            >
              <span class="text-lg font-black text-white">{{
                currentBase?.code
              }}</span>
              <span
                class="text-[10px] font-bold uppercase tracking-tighter text-white/70"
                >{{ currentBase?.name }}</span
              >
              <ChevronRight
                :size="16"
                class="text-white/70 transition-transform group-hover:translate-x-1"
              />
            </button>
            <p
              class="text-[10px] font-black uppercase tracking-[0.2em] text-white/60"
            >
              約合幣值
            </p>
          </div>
          <div class="flex items-baseline gap-3 relative z-10">
            <span class="text-3xl font-black text-[var(--travel-coral)]">{{
              currentBase?.symbol
            }}</span>
            <div
              class="text-2xl font-black tracking-tighter text-white tabular-nums flex-1 text-right drop-shadow-lg"
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

      <!-- 數字鍵盤 -->
      <div
        class="grid grid-cols-3 gap-2 rounded-[28px] border border-[#dfe8e4] bg-white p-4 shadow-sm"
        style="-webkit-touch-callout: none"
      >
        <button
          v-for="n in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0']"
          :key="n"
          type="button"
          @click="handleKeyPress(n)"
          class="flex h-16 items-center justify-center rounded-2xl border border-[#e7eeea] bg-[var(--travel-paper)] text-3xl font-black text-slate-700 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--travel-coral)] active:scale-90 active:bg-[var(--travel-teal)] active:text-white"
        >
          {{ n }}
        </button>
        <button
          type="button"
          aria-label="刪除最後一位數字"
          @click="handleKeyPress('delete')"
          class="flex h-16 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500 shadow-sm transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--travel-coral)] active:scale-90"
        >
          <Delete :size="28" />
        </button>
      </div>
    </div>

    <FrontendBottomDrawer
      :model-value="showPicker"
      title="選擇幣別"
      :description="
        pickingType === 'base' ? '選擇輸入金額的貨幣' : '選擇要換算成的貨幣'
      "
      @update:model-value="showPicker = $event"
    >
      <div class="grid max-h-[58dvh] grid-cols-2 gap-3 overflow-y-auto pb-1">
        <button
          v-for="c in COMMON_CURRENCIES"
          :key="c.code"
          type="button"
          class="flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors"
          :class="
            (pickingType === 'base'
              ? form.baseCurrency
              : form.targetCurrency) === c.code
              ? 'border-[var(--travel-teal)] bg-[var(--travel-mist)]'
              : 'border-[#e7eeea] bg-[var(--travel-paper)]'
          "
          :aria-pressed="
            (pickingType === 'base'
              ? form.baseCurrency
              : form.targetCurrency) === c.code
          "
          @click="selectCurrency(c.code)"
        >
          <div class="min-w-0">
            <p class="text-lg font-black text-[var(--travel-ink)]">
              {{ c.code }}
            </p>
            <p class="truncate text-[10px] font-bold text-slate-500">
              {{ c.name }}
            </p>
          </div>
          <span
            v-if="
              (pickingType === 'base'
                ? form.baseCurrency
                : form.targetCurrency) === c.code
            "
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--travel-teal)] text-white"
          >
            <Check :size="14" stroke-width="4" />
          </span>
        </button>
      </div>
    </FrontendBottomDrawer>
  </div>
</template>
