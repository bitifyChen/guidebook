<script setup>
import { ref, reactive, watch, onMounted, computed } from 'vue';
import { getExchangeRates, COMMON_CURRENCIES } from '@/api/currency';
import {
  ArrowRightLeft,
  RefreshCw,
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
  <div class="bg-[var(--primary-orange-light)] py-4">
    <div class="space-y-4">
      <!-- 匯率資訊 -->
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
          <span class="text-[9px] font-bold text-orange-400 uppercase"
            >更新匯率</span
          >
        </button>
      </div>

      <!-- 換算主體 -->
      <div
        class="rounded-[40px] overflow-hidden shadow-2xl border border-white/20 bg-white relative"
      >
        <!-- 目標金額 (輸入區) -->
        <div class="px-4 py-4 bg-gradient-to-br from-orange-50/80 to-white">
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
              class="text-2xl font-black tracking-tighter flex-1 text-right text-slate-800 tabular-nums break-all"
            >
              {{ form.targetAmount || '0' }}
            </div>
          </div>
        </div>

        <!-- 切換按鈕 -->
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

        <!-- 基準金額 (顯示區) -->
        <div
          class="px-4 py-4 bg-gradient-to-br from-slate-800 to-slate-900 text-white relative overflow-hidden group"
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
              約合幣值
            </p>
          </div>
          <div class="flex items-baseline gap-3 relative z-10">
            <span class="text-3xl font-black text-indigo-400">{{
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
        class="bg-white/80 backdrop-blur-sm rounded-[32px] p-4 grid grid-cols-3 gap-2 border border-white/40 shadow-sm"
        style="-webkit-touch-callout: none"
      >
        <button
          v-for="n in ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0']"
          :key="n"
          @click="handleKeyPress(n)"
          class="h-16 flex items-center justify-center text-3xl font-black text-slate-700 active:scale-90 active:bg-orange-500 active:text-white transition-all rounded-2xl bg-white/50 shadow-sm border border-slate-100"
        >
          {{ n }}
        </button>
        <button
          @click="handleKeyPress('delete')"
          class="h-16 flex items-center justify-center text-red-500 active:scale-90 bg-red-50 rounded-2xl shadow-sm border border-red-100"
        >
          <Delete :size="28" />
        </button>
      </div>
    </div>

    <!-- 幣別選擇彈窗 -->
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
  </div>
</template>

<style scoped>
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
