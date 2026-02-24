<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTravelStore } from '@/store/travelStore';
import { useUserStore } from '@/store/userStore';
import { patchItineraryItem, patchDayConfig } from '@/api/itinerary';
import { Clock, Calendar, ChevronRight, LogOut } from 'lucide-vue-next';

const router = useRouter();
const travelStore = useTravelStore();
const userStore = useUserStore();

// 初始化抓取 Firebase 資料
onMounted(() => travelStore.init());

const getDayItems = (day) =>
  travelStore.itinerary
    .filter((i) => i.day === day)
    .sort((a, b) => a.order - b.order);

// 更新 Itinerary：確保 item.id 是隨機 ID (如 zX8y...)
const updateItem = async (item) => {
  try {
    await patchItineraryItem(item.id, {
      duration: item.duration,
      delay: item.delay,
    });
    console.log(`✅ 已更新 ${item.location} 的時間設定`);
  } catch (err) {
    alert('更新失敗：' + err.message);
  }
};

// 更新 Config：這裡的 conf.id 應該是 'dayConfigs'
const updateConfig = async () => {
  try {
    await patchDayConfig('dayConfigs', {
      list: travelStore.config,
    });
    console.log('✅ 每日起始時間已同步');
  } catch (err) {
    alert('Config 更新失敗');
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
    <header
      class="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 p-6"
    >
      <div class="max-w-4xl mx-auto flex justify-between items-center">
        <div>
          <h1 class="text-xl font-black text-slate-800">Jeju Admin</h1>
          <p
            class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
          >
            Itinerary Management
          </p>
        </div>
        <button
          @click="
            userStore.logout();
            router.push('/admin/login');
          "
          class="p-2 text-slate-300 hover:text-red-400"
        >
          <LogOut :size="20" />
        </button>
      </div>
    </header>

    <main class="max-w-4xl mx-auto p-6 space-y-8">
      <section
        class="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100"
      >
        <h2
          class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"
        >
          <Clock :size="16" /> Start Time Config
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div
            v-for="conf in travelStore.config"
            :key="conf.day"
            class="p-3 bg-slate-50 rounded-2xl border border-slate-100"
          >
            <div class="text-[10px] font-black text-slate-400 mb-1">
              DAY {{ conf.day }}
            </div>
            <input
              v-model="conf.start"
              type="time"
              @change="updateConfig"
              class="bg-transparent font-mono font-black text-slate-700 w-full outline-none"
            />
          </div>
        </div>
      </section>
      <div class="p-4">
        <button
          @click="router.push('/admin/item/add')"
          class="w-full py-3 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-200 active:scale-95 transition-all"
        >
          添加行程
        </button>
      </div>
      <div v-for="day in travelStore.totalDays" :key="day" class="space-y-4">
        <h3
          class="text-lg font-black text-slate-800 px-2 flex items-center gap-2"
        >
          <Calendar :size="18" class="text-orange-500" /> Day {{ day }}
        </h3>
        <div class="grid gap-3">
          <div
            v-for="item in getDayItems(day)"
            :key="item.id"
            class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div
              class="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 text-sm"
            >
              {{ item.order }}
            </div>

            <div class="flex-1" @click="router.push(`/admin/item/${item.id}`)">
              <div class="font-black text-slate-700 leading-tight">
                {{ item.location }}
              </div>
              <div class="text-[10px] font-bold text-slate-400">
                {{ item.category }}
              </div>
            </div>

            <div class="flex gap-2 items-center">
              <div
                class="flex flex-col items-center bg-slate-50 rounded-xl p-1 px-2 border border-slate-100"
              >
                <span class="text-[8px] font-black text-slate-400">STAY</span>
                <input
                  v-model.number="item.duration"
                  type="number"
                  @change="updateItem(item)"
                  class="w-10 bg-transparent text-center font-mono font-black text-slate-600 outline-none"
                />
              </div>
              <div
                class="flex flex-col items-center bg-orange-50 rounded-xl p-1 px-2 border border-orange-100"
              >
                <span class="text-[8px] font-black text-orange-400">DELAY</span>
                <input
                  v-model.number="item.delay"
                  type="number"
                  @change="updateItem(item)"
                  class="w-10 bg-transparent text-center font-mono font-black text-orange-600 outline-none"
                />
              </div>
              <button
                @click="router.push(`/admin/item/${item.id}`)"
                class="p-2 text-slate-300 hover:text-orange-500 transition-colors"
              >
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
    name: "AdminPage",
    meta: {
      layout: "empty"
    }
  }
</route>
