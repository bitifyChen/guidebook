<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTravelStore } from '@/store/travelStore';
import { patchItineraryItem, deleteItineraryItem } from '@/api/itinerary';
import { uploadImage } from '@/api/storage';
import {
  ChevronLeft,
  MapPin,
  Image,
  Clock,
  Trash2,
  Plus,
  MoveVertical,
  ExternalLink,
  Upload,
  Loader2,
  Layers,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const travelStore = useTravelStore();
const currentItem = ref(null);

const isUploadingCover = ref(false);
const isUploadingImages = ref(false);

onMounted(async () => {
  if (travelStore.itinerary.length === 0) await travelStore.init();
  const targetId = route.params.id;
  const item = travelStore.itinerary.find((i) => i.id === targetId);
  if (item) {
    // 確保 nextDrive 和 images 有初始結構，避免報錯
    currentItem.value = {
      ...item,
      nextDrive: item.nextDrive || { time: 0, km: 0 },
      images: item.images || [],
      parentId: item.parentId || '',
    };
  }
});

// 可選擇的父項目清單 (同天、非自身、非交通)
const availableParents = computed(() => {
  if (!currentItem.value) return [];
  return travelStore.itinerary.filter(
    (item) =>
      item.day === currentItem.value.day &&
      item.id !== currentItem.value.id &&
      item.type !== 'transport' &&
      !item.parentId // 避免巢狀巢狀
  );
});

// --- 圖片管理 ---
const addImage = () => {
  currentItem.value.images.push('');
};
const removeImage = (index) => {
  currentItem.value.images.splice(index, 1);
};

// --- ImgBB 上傳邏輯 ---
const handleCoverUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isUploadingCover.value = true;
  try {
    const url = await uploadImage(file);
    currentItem.value.cover = url;
  } catch (error) {
    alert('封面上傳失敗：' + error.message);
  } finally {
    isUploadingCover.value = false;
    event.target.value = ''; // 清除 input
  }
};

const handleImagesUpload = async (event) => {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;

  isUploadingImages.value = true;
  try {
    const uploadPromises = files.map((file) => uploadImage(file));
    const urls = await Promise.all(uploadPromises);
    currentItem.value.images.push(...urls);
  } catch (error) {
    alert('圖片上傳失敗：' + error.message);
  } finally {
    isUploadingImages.value = false;
    event.target.value = ''; // 清除 input
  }
};

// --- 儲存邏輯 ---
const handleSave = async () => {
  try {
    const { id, startTime, endTime, ...updateData } = currentItem.value;

    // 如果有父項目，強制時間歸零
    if (updateData.parentId) {
      updateData.duration = 0;
      updateData.nextDrive.time = 0;
      updateData.nextDrive.km = '0';
    } else {
      updateData.duration = Number(updateData.duration);
      updateData.nextDrive.time = Number(updateData.nextDrive.time);
    }

    updateData.day = Number(updateData.day);
    updateData.delay = Number(updateData.delay);

    await patchItineraryItem(id, updateData);
    await travelStore.init();
    router.back();
  } catch (error) {
    alert('儲存失敗：' + error.message);
  }
};

// --- 刪除邏輯 ---
const handleDelete = async () => {
  try {
    await deleteItineraryItem(currentItem.value.id);
    router.back();
  } catch (error) {
    alert('刪除失敗：' + error.message);
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20" v-if="currentItem">
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
      <div class="space-x-4">
        <button
          @click="handleDelete"
          class="px-6 py-2 bg-red-500 text-white rounded-2xl font-black shadow-lg shadow-red-200 active:scale-95 transition-all"
        >
          刪除
        </button>
        <button
          @click="handleSave"
          class="px-6 py-2 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-200 active:scale-95 transition-all"
        >
          儲存更新
        </button>
      </div>
    </nav>

    <main class="px-6 space-y-8 max-w-2xl mx-auto">
      <!-- Base Settings -->
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

        <!-- Parent Selector -->
        <div class="bg-white rounded-[24px] p-4 border border-slate-100 shadow-sm flex items-center gap-3">
          <Layers :size="18" class="text-orange-500 shrink-0" />
          <div class="flex-1">
            <span class="text-[10px] font-black text-slate-400 block uppercase">Parent Item (Optional)</span>
            <select
              v-model="currentItem.parentId"
              class="w-full bg-transparent font-bold text-slate-700 outline-none appearance-none cursor-pointer"
            >
              <option value="">-- No Parent (Standalone) --</option>
              <option v-for="p in availableParents" :key="p.id" :value="p.id">
                {{ p.location }}
              </option>
            </select>
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
            <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl relative">
              <Image :size="18" class="text-slate-400 shrink-0" />
              <input
                v-model="currentItem.cover"
                class="bg-transparent text-xs font-medium w-full outline-none pr-10"
                placeholder="封面圖片 URL"
              />
              <div class="absolute right-3 flex items-center">
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  ref="coverInput"
                  @change="handleCoverUpload"
                />
                <button
                  @click="$refs.coverInput.click()"
                  :disabled="isUploadingCover"
                  class="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <Loader2 v-if="isUploadingCover" :size="14" class="animate-spin text-orange-500" />
                  <Upload v-else :size="14" class="text-slate-400" />
                </button>
              </div>
            </div>
            <!-- 封面圖即時預覽 -->
            <div
              v-if="currentItem.cover"
              class="relative aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 group"
            >
              <img
                :src="currentItem.cover"
                class="w-full h-full object-cover"
                @error="
                  (e) => (e.target.src = 'https://placehold.co/600x400?text=Cover+Image+Error')
                "
              />
              <div
                class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <span class="text-white text-[10px] font-black uppercase tracking-widest"
                  >Cover Preview</span
                >
              </div>
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
      
      <!-- Time & Next Trip -->
      <section class="space-y-3">
        <label
          class="text-xs font-black text-slate-400 uppercase tracking-widest ml-2"
          >Time & Next Trip</label
        >
        <div
          class="bg-white rounded-[32px] p-6 border border-slate-100 space-y-4 shadow-sm overflow-hidden relative"
        >
          <!-- Disable Overlay for Sub-items -->
          <div 
            v-if="currentItem.parentId"
            class="absolute inset-0 bg-slate-50/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center"
          >
            <div class="bg-white p-4 rounded-3xl shadow-xl border border-slate-100">
              <Clock :size="32" class="text-orange-500 mx-auto mb-2" />
              <p class="text-xs font-black text-slate-700 uppercase tracking-tight">Time Controlled by Parent</p>
              <p class="text-[10px] font-bold text-slate-400 mt-1">子項目不設定停留時間與下段路程</p>
            </div>
          </div>

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
          <div class="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              ref="imagesInput"
              @change="handleImagesUpload"
            />
            <button
              @click="$refs.imagesInput.click()"
              :disabled="isUploadingImages"
              class="flex items-center gap-1 text-[10px] font-black bg-orange-100 text-orange-600 px-3 py-1 rounded-full hover:bg-orange-200 transition-colors"
            >
              <Loader2 v-if="isUploadingImages" :size="12" class="animate-spin" />
              <Upload v-else :size="12" /> BATCH UPLOAD
            </button>
            <button
              @click="addImage"
              class="flex items-center gap-1 text-[10px] font-black bg-slate-200 text-slate-600 px-3 py-1 rounded-full hover:bg-slate-300 transition-colors"
            >
              <Plus :size="12" /> ADD IMAGE
            </button>
          </div>
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
    name: "AdminItemDetailPage",
    meta: {
      layout: "empty"
    }
  }
</route>
