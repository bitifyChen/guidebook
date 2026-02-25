<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTravelStore } from '@/store/travelStore';
import { patchDayConfig } from '@/api/itinerary';
import { Clock, ChevronLeft, Save } from 'lucide-vue-next';

const router = useRouter();
const travelStore = useTravelStore();

onMounted(() => travelStore.init());

const updateConfig = async () => {
  try {
    await patchDayConfig('dayConfigs', {
      list: travelStore.config,
    });
    alert('設定已儲存');
  } catch (err) {
    alert('儲存失敗');
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
    <nav class="p-6 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between">
      <button @click="router.push('/admin')" class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
        <ChevronLeft :size="20" />
      </button>
      <h2 class="font-black text-slate-800 text-lg">每日起始時間</h2>
      <button @click="updateConfig" class="w-10 h-10 bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-sm">
        <Save :size="20" />
      </button>
    </nav>

    <main class="max-w-4xl mx-auto p-6">
      <div class="bg-white rounded-[32px] p-8 shadow-sm border border-slate-100 space-y-6">
        <div v-for="conf in travelStore.config" :key="conf.day" class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-orange-500 font-black">
              {{ conf.day }}
            </div>
            <div>
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Day {{ conf.day }}</div>
              <div class="font-bold text-slate-700">起始出發時間</div>
            </div>
          </div>
          <input
            v-model="conf.start"
            type="time"
            class="bg-white p-3 rounded-xl font-mono font-black text-slate-700 outline-none border border-slate-100 focus:border-orange-500 transition-all"
          />
        </div>
        
        <button
          @click="updateConfig"
          class="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-100 active:scale-95 transition-all mt-4"
        >
          儲存所有設定
        </button>
      </div>
    </main>
  </div>
</template>

<route>
{
  meta: { layout: "empty" }
}
</route>
