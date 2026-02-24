<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTravelStore } from '@/store/travelStore';
import { postItineraryItem } from '@/api/itinerary';
import {
  ChevronLeft,
  MapPin,
  Image,
  Clock,
  Trash2,
  Plus,
  MoveVertical,
  ExternalLink,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const travelStore = useTravelStore();
const currentItem = ref({
  order: 0,
  nextDrive: {
    time: 0,
    km: '',
  },
});

// --- 圖片管理 ---
const addImage = () => {
  currentItem.value.images.push('');
};
const removeImage = (index) => {
  currentItem.value.images.splice(index, 1);
};

// --- 儲存邏輯 ---
const handleSave = async () => {
  try {
    const { startTime, endTime, ...updateData } = currentItem.value;
    // 確保數字欄位格式正確
    updateData.day = Number(updateData.day);
    updateData.duration = Number(updateData.duration);
    updateData.delay = Number(updateData.delay);
    updateData.nextDrive.time = Number(updateData.nextDrive.time);

    await postItineraryItem(updateData);
    await travelStore.init();
    router.back();
  } catch (error) {
    alert('儲存失敗：' + error.message);
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
    <nav
      class="p-6 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between"
    >
      <button
        @click="router.back()"
        class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"
      >
        <ChevronLeft :size="20" />
      </button>
      <h2 class="font-black text-slate-800 text-lg">編輯行程資訊</h2>
      <button
        @click="handleSave"
        class="px-6 py-2 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-200 active:scale-95 transition-all"
      >
        儲存更新
      </button>
    </nav>

    <main class="px-6 space-y-8 max-w-2xl mx-auto">
      <section class="space-y-3">
        <label
          class="text-xs font-black text-slate-400 uppercase tracking-widest ml-2"
          >Base Settings</label
        >
        <div
          class="grid grid-cols-3 gap-4 bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm"
        >
          <div>
            <span class="text-[10px] font-black text-slate-400 block mb-1"
              >DAY</span
            >
            <select
              v-model="currentItem.day"
              class="w-full bg-slate-50 p-2 rounded-xl font-black text-slate-700 outline-none appearance-none cursor-pointer"
            >
              <option
                v-for="day in travelStore.config"
                :value="day.day"
                :key="day"
              >
                {{ day.day }}
              </option>
            </select>
          </div>
          <div>
            <span class="text-[10px] font-black text-slate-400 block mb-1"
              >TYPE</span
            >
            <select
              v-model="currentItem.type"
              class="w-full bg-slate-50 p-2 rounded-xl font-black text-slate-700 outline-none appearance-none cursor-pointer"
            >
              <option value="point">📍 Point</option>
              <option value="transport">🚗 Transport</option>
              <option value="free">☕ Free</option>
            </select>
          </div>
          <div>
            <span class="text-[10px] font-black text-slate-400 block mb-1"
              >ORDER</span
            >
            <input
              v-model.number="currentItem.order"
              type="number"
              class="w-full bg-slate-50 p-2 rounded-xl font-black text-slate-700 outline-none"
            />
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <label
          class="text-xs font-black text-slate-400 uppercase tracking-widest ml-2"
          >Location Information</label
        >
        <div
          class="bg-white rounded-[32px] p-6 border border-slate-100 space-y-4 shadow-sm"
        >
          <input
            v-model="currentItem.location"
            class="text-xl font-black w-full outline-none border-b-2 border-slate-50 focus:border-orange-200 pb-2"
            placeholder="景點名稱"
          />
          <input
            v-model="currentItem.category"
            class="text-sm font-bold w-full outline-none text-orange-500"
            placeholder="景點類別 (e.g. 美食, 景點)"
          />
        </div>
      </section>
      <section>
        <div class="space-y-2">
          <label
            class="text-xs font-black text-slate-400 uppercase tracking-widest ml-2"
            >Links & Media</label
          >
          <div
            class="bg-white rounded-[32px] p-6 border border-slate-100 space-y-4 shadow-sm"
          >
            <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
              <Image :size="18" class="text-slate-400" />
              <input
                v-model="currentItem.cover"
                class="bg-transparent text-xs font-medium w-full outline-none"
                placeholder="封面圖片 URL"
              />
            </div>
            <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl">
              <MapPin :size="18" class="text-slate-400" />
              <input
                v-model="currentItem.map"
                class="bg-transparent text-xs font-medium w-full outline-none"
                placeholder="Naver Map 導航連結"
              />
            </div>
          </div>
        </div>
      </section>
      <section class="space-y-3">
        <label
          class="text-xs font-black text-slate-400 uppercase tracking-widest ml-2"
          >Time & Next Trip</label
        >
        <div
          class="bg-white rounded-[32px] p-6 border border-slate-100 space-y-4 shadow-sm"
        >
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-slate-50 p-3 rounded-2xl">
              <span
                class="text-[10px] font-black text-slate-400 block mb-1 uppercase"
                >Stay (min)</span
              >
              <input
                v-model.number="currentItem.duration"
                type="number"
                class="bg-transparent w-full font-mono font-black text-slate-700 outline-none"
              />
            </div>
            <div class="bg-orange-50 p-3 rounded-2xl">
              <span
                class="text-[10px] font-black text-orange-400 block mb-1 uppercase"
                >Delay (min)</span
              >
              <input
                v-model.number="currentItem.delay"
                type="number"
                class="bg-transparent w-full font-mono font-black text-orange-700 outline-none"
              />
            </div>
          </div>
          <div
            v-if="currentItem.nextDrive"
            class="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3"
          >
            <span class="text-[10px] font-black text-blue-400 block uppercase"
              >Next Drive (下段路程)</span
            >
            <div class="flex gap-4">
              <div class="flex-1">
                <span class="text-[9px] font-bold text-blue-300 block"
                  >TIME (min)</span
                >
                <input
                  v-model.number="currentItem.nextDrive.time"
                  type="number"
                  class="w-full bg-white p-2 rounded-xl text-sm font-black text-blue-600 outline-none"
                />
              </div>
              <div class="flex-1">
                <span class="text-[9px] font-bold text-blue-300 block"
                  >DISTANCE (km)</span
                >
                <input
                  v-model="currentItem.nextDrive.km"
                  class="w-full bg-white p-2 rounded-xl text-sm font-black text-blue-600 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <label
          class="text-xs font-black text-slate-400 uppercase tracking-widest ml-2"
          >Description & Details</label
        >
        <div class="space-y-4">
          <textarea
            v-model="currentItem.description"
            rows="2"
            class="w-full bg-white rounded-[24px] p-4 border border-slate-100 shadow-sm outline-none text-sm font-bold text-slate-500"
            placeholder="短描述"
          ></textarea>
          <textarea
            v-model="currentItem.detail"
            rows="6"
            class="w-full bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm outline-none focus:border-orange-200 font-medium text-slate-600 leading-relaxed"
            placeholder="詳細內容 (支援 HTML)"
          ></textarea>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex justify-between items-center ml-2">
          <label
            class="text-xs font-black text-slate-400 uppercase tracking-widest"
            >Images Array</label
          >
          <button
            @click="addImage"
            class="flex items-center gap-1 text-[10px] font-black bg-slate-200 text-slate-600 px-3 py-1 rounded-full hover:bg-slate-300"
          >
            <Plus :size="12" /> ADD IMAGE
          </button>
        </div>
        <div class="space-y-4">
          <div
            v-for="(img, index) in currentItem.images"
            :key="index"
            class="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center font-mono text-xs font-black text-slate-400"
              >
                {{ index + 1 }}
              </div>
              <input
                v-model="currentItem.images[index]"
                class="flex-1 bg-slate-50 p-2 rounded-xl text-xs font-medium outline-none"
                placeholder="Image URL"
              />
              <button
                @click="removeImage(index)"
                class="text-red-300 hover:text-red-500 p-1"
              >
                <Trash2 :size="18" />
              </button>
            </div>
            <div
              v-if="img"
              class="relative group aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-100"
            >
              <img :src="img" class="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<route>
  {
    name: "AdminItemAddPage",
    meta: {
      layout: "empty"
    }
  }
</route>
