<script setup>
import { onMounted } from 'vue';
import { useTravelStore } from '@/store/travelStore';
import { patchDayConfig } from '@/api/itinerary';
import dayjs from 'dayjs';
import AdminConfigDayRow from '@/components/admin/config/AdminConfigDayRow.vue';

const travelStore = useTravelStore();

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

defineExpose({ save: updateConfig });
</script>

<template>
  <div class="bg-slate-50 pb-8">
    <main class="p-3 sm:p-5">
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
