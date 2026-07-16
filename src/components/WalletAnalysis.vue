<script setup>
import { computed } from 'vue';
import { X, PieChart, TrendingUp } from 'lucide-vue-next';
import dayjs from 'dayjs';
import { useTripStore } from '@/store/tripStore';

const tripStore = useTripStore();

const props = defineProps({
  visible: Boolean,
  expenses: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:visible']);

// 星期對照表
const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const getWeekDay = (date) => weekDays[dayjs(date).day()];

// 每日花費統計
const dailyStats = computed(() => {
  const groups = {};
  props.expenses.forEach((exp) => {
    const d = exp.date || dayjs().format('YYYY-MM-DD');
    if (!groups[d]) groups[d] = 0;
    groups[d] += Number(exp.amount) || 0;
  });

  return Object.keys(groups)
    .sort()
    .map((date) => ({
      date,
      total: groups[date],
    }));
});

// 圖表最大值計算
const maxDailyTotal = computed(() => {
  const totals = dailyStats.value.map((s) => s.total);
  return totals.length > 0 ? Math.max(...totals) : 1;
});

const close = () => emit('update:visible', false);
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="(val) => emit('update:visible', val)"
    direction="btt"
    size="100%"
    :with-header="false"
    :append-to-body="true"
    class="full-screen-drawer frontend-contained-drawer"
  >
    <div class="h-full bg-slate-50 flex flex-col">
      <nav
        class="p-6 shrink-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between border-b border-slate-100"
      >
        <button
          @click="close"
          class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"
        >
          <X :size="20" class="text-slate-400" />
        </button>
        <h2 class="font-black text-slate-800 text-lg">每日花費分析</h2>
        <div class="w-10"></div>
      </nav>

      <el-scrollbar class="flex-1">
        <main class="max-w-xl mx-auto p-6 space-y-8 pb-20">
          <!-- 趨勢圖表區 -->
          <div
            class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm overflow-hidden"
          >
            <div class="flex justify-between items-center mb-10">
              <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp :size="14" class="text-indigo-500" /> 支出走勢
              </h3>
              <span class="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg">
                MAX: {{ tripStore.currencySymbol }}{{ maxDailyTotal.toLocaleString() }}
              </span>
            </div>

            <!-- 圖表主體 -->
            <div class="h-56 flex items-end justify-around gap-2 px-2 pb-8 border-b border-slate-50">
              <div
                v-for="s in dailyStats"
                :key="s.date"
                class="flex-1 max-w-[32px] flex flex-col items-center group relative h-full"
              >
                <!-- 數值提示 (Hover) -->
                <div
                  class="absolute -top-10 bg-slate-800 text-white text-[10px] px-2 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 whitespace-nowrap z-10 font-bold shadow-xl"
                >
                  {{ tripStore.currencySymbol }}{{ s.total.toLocaleString() }}
                  <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>

                <!-- 柱狀圖背景軌道 -->
                <div class="w-full bg-slate-50 rounded-full h-full flex items-end overflow-hidden border border-slate-100/50">
                  <!-- 實際數值柱子 -->
                  <div
                    class="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(79,70,229,0.3)]"
                    :style="{ height: `${Math.max((s.total / maxDailyTotal) * 100, 5)}%` }"
                  ></div>
                </div>

                <!-- 日期標籤 -->
                <div class="absolute -bottom-8 flex flex-col items-center">
                  <span class="text-[9px] font-black text-slate-400 whitespace-nowrap">
                    {{ dayjs(s.date).format('MM/DD') }}
                  </span>
                  <div class="w-1 h-1 bg-indigo-200 rounded-full mt-1"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 每日清單 -->
          <div class="space-y-4">
            <div class="flex justify-between items-center px-2">
              <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">每日明細</h3>
              <span class="text-[10px] font-bold text-slate-300">{{ dailyStats.length }} Days</span>
            </div>
            
            <div
              v-for="s in dailyStats.slice().reverse()"
              :key="s.date"
              class="bg-white p-5 rounded-[28px] border border-slate-100 flex justify-between items-center shadow-sm group active:scale-[0.98] transition-transform"
            >
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-400 text-[10px] border border-slate-100 text-center leading-tight">
                  {{ dayjs(s.date).format('MM') }}<br/>{{ dayjs(s.date).format('DD') }}
                </div>
                <div>
                  <p class="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">{{ s.date }}</p>
                  <p class="text-base font-black text-slate-700">{{ getWeekDay(s.date) }}</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-xs font-bold text-slate-300 mb-0.5">DAILY TOTAL</p>
                <p class="text-lg font-black text-slate-800 tracking-tighter">
                  {{ tripStore.currencySymbol }}{{ s.total.toLocaleString() }}
                </p>
              </div>
            </div>
          </div>
        </main>
      </el-scrollbar>
    </div>
  </el-drawer>
</template>

<style scoped>
/* 自定義動畫，讓柱子長出來更有感 */
@keyframes barGrow {
  from { height: 0; }
}
.bg-gradient-to-t {
  animation: barGrow 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
