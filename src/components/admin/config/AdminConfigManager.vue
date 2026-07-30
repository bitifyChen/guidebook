<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTravelStore } from '@/store/travelStore';
import { patchDayConfig } from '@/api/itinerary';
import { ChevronLeft, Save } from 'lucide-vue-next';
import dayjs from 'dayjs';
import AdminConfigDayRow from '@/components/admin/config/AdminConfigDayRow.vue';

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

const updateConfig = async () => {
  try {
    // 儲存前可以考慮將 - 轉回 /，維持資料庫一致性
    const listToSave = travelStore.config.map((c) => ({
      ...c,
      date: c.date ? c.date.replace(/-/g, '/') : '',
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
  <div
    :class="
      props.embedded ? 'bg-slate-50 pb-8' : 'min-h-screen bg-slate-50 pb-20'
    "
  >
    <!-- ... (導航列保持不變) ... -->
    <nav
      v-if="!props.embedded"
      class="p-6 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between"
    >
      <button
        @click="router.push('/admin')"
        class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"
      >
        <ChevronLeft :size="20" />
      </button>
      <h2 class="font-black text-slate-800 text-lg">行程全域設定</h2>
      <button
        @click="updateConfig"
        class="w-10 h-10 bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-sm"
      >
        <Save :size="20" />
      </button>
    </nav>

    <main
      :class="props.embedded ? 'p-3 sm:p-5' : 'max-w-4xl mx-auto p-3 sm:p-6'"
    >
      <div class="space-y-4">
        <AdminConfigDayRow
          v-for="(conf, index) in travelStore.config"
          :key="conf.day"
          :config="conf"
          :is-first="index === 0"
          @first-date-change="handleFirstDateChange"
        />

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
