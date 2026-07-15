<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTravelStore } from '@/store/travelStore';
import { patchDayConfig } from '@/api/itinerary';
import { Clock, ChevronLeft, Save, Type, CalendarDays } from 'lucide-vue-next';
import dayjs from 'dayjs';

const router = useRouter();
const travelStore = useTravelStore();
const props = defineProps({
  embedded: { type: Boolean, default: false },
});

onMounted(() => travelStore.init());

// 當第一天日期改變時，自動更新後續日期
const handleFirstDateChange = (val) => {
  if (!val) return;
  const startDate = dayjs(val); // val 為 YYYY-MM-DD
  travelStore.config.forEach((conf, index) => {
    if (index > 0) {
      conf.date = startDate.add(index, 'day').format('YYYY-MM-DD');
    }
  });
};

// 輔助函式：確保日期格式正確 (將 YYYY/MM/DD 轉為 YYYY-MM-DD 以供 input date 顯示)
const formatDateForInput = (dateStr) => {
  if (!dateStr) return '';
  return dateStr.replace(/\//g, '-');
};

const updateConfig = async () => {
  try {
    // 儲存前可以考慮將 - 轉回 /，維持資料庫一致性
    const listToSave = travelStore.config.map(c => ({
      ...c,
      date: c.date ? c.date.replace(/-/g, '/') : ''
    }));

    await patchDayConfig('dayConfigs', {
      list: listToSave,
    });
    alert('設定已儲存');
  } catch (err) {
    alert('儲存失敗');
  }
};
</script>

<template>
  <div :class="props.embedded ? 'bg-slate-50 pb-8' : 'min-h-screen bg-slate-50 pb-20'">
    <!-- ... (導航列保持不變) ... -->
    <nav
      v-if="!props.embedded"
      class="p-6 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between"
    >
      <button @click="router.push('/admin')" class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
        <ChevronLeft :size="20" />
      </button>
      <h2 class="font-black text-slate-800 text-lg">行程全域設定</h2>
      <button @click="updateConfig" class="w-10 h-10 bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-sm">
        <Save :size="20" />
      </button>
    </nav>

    <main :class="props.embedded ? 'p-3 sm:p-5' : 'max-w-4xl mx-auto p-3 sm:p-6'">
      <div class="space-y-4">
        <div v-for="(conf, index) in travelStore.config" :key="conf.day" class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div class="flex items-center gap-4 border-b border-slate-50 pb-4">
            <div class="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black text-sm">
              {{ conf.day }}
            </div>
            <h3 class="font-black text-slate-800">Day {{ conf.day }} 配置</h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- 標題 -->
            <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                <Type :size="10" /> 行程標題
              </label>
              <input
                v-model="conf.title"
                type="text"
                placeholder="例如：東部海岸之旅"
                class="w-full bg-slate-50 p-3 rounded-xl font-bold text-slate-700 outline-none border border-slate-100 focus:border-orange-500 transition-all text-sm"
              />
            </div>

            <!-- 日期 (改為 type="date") -->
            <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                <CalendarDays :size="10" /> 日期
              </label>
              <input
                :value="formatDateForInput(conf.date)"
                @input="
                  conf.date = $event.target.value;
                  index === 0 && handleFirstDateChange($event.target.value);
                "
                type="date"
                class="w-full bg-slate-50 p-3 rounded-xl font-mono font-bold text-slate-700 outline-none border border-slate-100 focus:border-orange-500 transition-all text-sm"
              />
            </div>

            <!-- 出發時間 -->
            <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                <Clock :size="10" /> 起始出發時間
              </label>
              <input
                v-model="conf.start"
                type="time"
                class="w-full bg-slate-50 p-3 rounded-xl font-mono font-bold text-slate-700 outline-none border border-slate-100 focus:border-orange-500 transition-all text-sm"
              />
            </div>
          </div>
        </div>
        
        <button
          @click="updateConfig"
          class="mt-4 w-full rounded-xl bg-indigo-600 py-4 font-black text-white shadow-sm active:scale-[0.98]"
        >
          儲存所有設定
        </button>
      </div>
    </main>
  </div>
</template>

<route>
{
  meta: { layout: "admin" }
}
</route>
