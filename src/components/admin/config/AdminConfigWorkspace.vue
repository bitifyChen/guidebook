<script setup>
import { appAlert } from '@/services/dialog';
import { onMounted, ref, computed } from 'vue';
import { useWorkspaceGuard } from '@/composables/useWorkspaceGuard';
import { useTravelStore } from '@/store/travelStore';
import { patchDayConfig } from '@/api/itinerary';
import dayjs from 'dayjs';
import AdminConfigDayRow from '@/components/admin/config/AdminConfigDayRow.vue';

const travelStore = useTravelStore();
const configs = ref([]);
const baseline = ref('[]');
const saving = ref(false);
const dirty = computed(() => JSON.stringify(configs.value) !== baseline.value);
useWorkspaceGuard({ dirty: () => dirty.value, busy: () => saving.value });

onMounted(async () => {
  await travelStore.init();
  configs.value = JSON.parse(JSON.stringify(travelStore.config));
  baseline.value = JSON.stringify(configs.value);
});

// 當第一天日期改變時，自動更新後續日期
const handleFirstDateChange = (val) => {
  if (!val) return;
  const startDate = dayjs(val); // val 為 YYYY-MM-DD
  configs.value.forEach((conf, index) => {
    if (index > 0) {
      conf.date = startDate.add(index, 'day').format('YYYY-MM-DD');
    }
  });
};

const updateConfig = async () => {
  if (saving.value) return;
  saving.value = true;
  try {
    // 儲存前可以考慮將 - 轉回 /，維持資料庫一致性
    const listToSave = configs.value.map((c) => ({
      ...c,
      date: c.date ? c.date.replace(/-/g, '/') : '',
    }));

    await patchDayConfig('dayConfigs', {
      list: listToSave,
    });
    travelStore.config = JSON.parse(JSON.stringify(listToSave));
    baseline.value = JSON.stringify(configs.value);
    await appAlert('設定已儲存');
  } catch (err) {
    await appAlert('儲存失敗');
  } finally {
    saving.value = false;
  }
};

defineExpose({ save: updateConfig });
</script>

<template>
  <div class="bg-slate-50 pb-8">
    <main class="p-3 sm:p-5">
      <div class="space-y-4">
        <AdminConfigDayRow
          v-for="(conf, index) in configs"
          :key="conf.day"
          :config="conf"
          :is-first="index === 0"
          @first-date-change="handleFirstDateChange"
        />

        <button
          @click="updateConfig"
          :disabled="
            saving || travelStore.isLoading || Boolean(travelStore.loadError)
          "
          class="mt-4 w-full rounded-xl bg-indigo-600 py-4 font-black text-white shadow-sm active:scale-[0.98]"
        >
          儲存所有設定
        </button>
      </div>
    </main>
  </div>
</template>
