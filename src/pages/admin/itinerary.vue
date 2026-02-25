<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTravelStore } from '@/store/travelStore';
import { patchItineraryItem } from '@/api/itinerary';
import { Calendar, ChevronRight, ChevronLeft, Plus } from 'lucide-vue-next';

const router = useRouter();
const travelStore = useTravelStore();

onMounted(() => travelStore.init());

const getDayItems = (day) =>
  travelStore.itinerary
    .filter((i) => i.day === day)
    .sort((a, b) => a.order - b.order);

const updateItem = async (item) => {
  try {
    await patchItineraryItem(item.id, {
      duration: item.duration,
      delay: item.delay,
    });
  } catch (err) {
    alert('更新失敗：' + err.message);
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
    <nav class="p-6 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between">
      <button @click="router.push('/admin')" class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
        <ChevronLeft :size="20" />
      </button>
      <h2 class="font-black text-slate-800 text-lg">行程進度管理</h2>
      <button @click="router.push('/admin/item/add')" class="w-10 h-10 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-sm">
        <Plus :size="20" />
      </button>
    </nav>

    <main class="max-w-4xl mx-auto p-6 space-y-8">
      <div v-for="day in travelStore.totalDays" :key="day" class="space-y-4">
        <h3 class="text-lg font-black text-slate-800 px-2 flex items-center gap-2">
          <Calendar :size="18" class="text-orange-500" /> Day {{ day }}
        </h3>
        <div class="grid gap-3">
          <div v-for="item in getDayItems(day)" :key="item.id" class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
            <div class="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 text-sm">
              {{ item.order }}
            </div>
            <div class="flex-1" @click="router.push(`/admin/item/${item.id}`)">
              <div class="font-black text-slate-700 leading-tight">{{ item.location }}</div>
              <div class="text-[10px] font-bold text-slate-400">{{ item.category }}</div>
            </div>
            <div class="flex gap-2 items-center">
              <div class="flex flex-col items-center bg-slate-50 rounded-xl p-1 px-2 border border-slate-100">
                <span class="text-[8px] font-black text-slate-400">STAY</span>
                <input v-model.number="item.duration" type="number" @change="updateItem(item)" class="w-10 bg-transparent text-center font-mono font-black text-slate-600 outline-none" />
              </div>
              <div class="flex flex-col items-center bg-orange-50 rounded-xl p-1 px-2 border border-orange-100">
                <span class="text-[8px] font-black text-orange-400">DELAY</span>
                <input v-model.number="item.delay" type="number" @change="updateItem(item)" class="w-10 bg-transparent text-center font-mono font-black text-orange-600 outline-none" />
              </div>
              <button @click="router.push(`/admin/item/${item.id}`)" class="p-2 text-slate-300 hover:text-orange-500">
                <ChevronRight :size="20" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<route>
{
  meta: { layout: "empty" }
}
</route>
