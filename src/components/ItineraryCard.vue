<script setup>
import { ref } from 'vue';
import {
  Clock,
  MapPin,
  Info,
  X,
  FileText,
  ChevronRight,
  CarFront,
  Image,
} from 'lucide-vue-next';
// 引入 Swiper Vue 元件
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination, Autoplay } from 'swiper/modules';

// 引入 Swiper 樣式
import 'swiper/css';
import 'swiper/css/pagination';

const props = defineProps({
  item: {
    type: Object,
    default: () => ({}),
  },
  timeLine: {
    type: Boolean,
    default: true,
  },
  isLast: {
    type: Boolean,
    default: false,
  },
  isNow: {
    type: Boolean,
    default: false,
  },
  isNext: {
    type: Boolean,
    default: false,
  },
});

const drawerVisible = ref(false);

const openDetail = () => {
  drawerVisible.value = true;
};
const goUrl = (url) => {
  window.open(url, '_blank');
};
// 設定 Swiper 模組
const modules = [Pagination, Autoplay];
</script>

<template>
  <div
    class="relative pr-2 mb-8 group cursor-pointer"
    @click="openDetail"
    :class="timeLine ? 'pl-[60px]' : ''"
  >
    <div
      v-if="timeLine"
      class="absolute left-0 top-0 bottom-0 w-[60px] px-[4px] flex flex-col items-center text-[14px] font-semibold text-slate-500 font-mono tracking-tighter uppercase"
    >
      <span>
        {{ item?.startTime }}
      </span>
      <div class="flex-1">
        <div class="h-full w-[2px] bg-slate-200"></div>
      </div>
      <span>
        {{ item?.endTime }}
      </span>
    </div>

    <div
      class="bg-white rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-50 active:scale-[0.98] transition-all duration-300"
      :class="{
        'border-orange-500 border-2 animate-pulse-border': isNow,
        'border-slate-100': !isNow,
      }"
    >
      <div class="flex flex-col">
        <div v-if="item.cover" class="relative h-32 w-full overflow-hidden">
          <img
            :src="item.cover"
            class="w-full h-full object-cover transition-transform duration-700"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"
          ></div>
          <div class="absolute bottom-3 left-4">
            <span
              class="text-[10px] font-black px-2 py-0.5 bg-orange-500 text-white rounded-lg uppercase tracking-widest shadow-lg"
            >
              {{ item.category }}
            </span>
          </div>
        </div>

        <div class="p-5">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h4
                class="text-lg font-black text-slate-800 leading-tight transition-colors"
              >
                {{ item.location }}
              </h4>
            </div>
            <div
              class="bg-slate-50 p-2 rounded-xl text-slate-300 group-hover:text-orange-400 transition-colors"
            >
              <ChevronRight :size="18" />
            </div>
          </div>

          <p
            class="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-2 font-medium"
          >
            {{ item.description }}
          </p>
        </div>
      </div>
    </div>
  </div>
  <div
    v-if="item.nextDrive && timeLine"
    class="relative pr-2 mb-8"
    :class="timeLine ? 'pl-[60px]' : ''"
  >
    <div class="absolute left-0 top-[-24px] bottom-[-24px] w-[60px]">
      <div class="flex justify-center items-center h-full relative">
        <div
          class="absolute left-[calc(50%-1px)] top-0 bottom-0 w-[2px] bg-slate-200 z-[1]"
        ></div>

        <div
          class="flex flex-col items-center p-2 bg-white rounded-xl z-[2] border border-slate-100 shadow-sm scale-90"
        >
          <span
            class="font-black text-slate-500 leading-none text-[16px] w-[2em] text-center"
          >
            {{ item.nextDrive.time }}
          </span>
          <span class="text-[10px] font-bold text-slate-400">MIN</span>
        </div>
      </div>
    </div>

    <div
      class="bg-slate-50/80 rounded-3xl px-5 py-2 flex items-center relative overflow-hidden border border-slate-100/50"
    >
      <div class="flex-1 flex items-center">
        <div
          class="text-[11px] font-black text-slate-400 uppercase tracking-widest pr-3 border-r border-slate-200 mr-3"
        >
          預計車程
        </div>
        <div class="flex items-baseline gap-1">
          <span class="text-[22px] font-black text-slate-600 font-mono italic">
            {{ item.nextDrive.km }}
          </span>
          <span class="text-[11px] font-black text-slate-400">KM</span>
        </div>
      </div>
      <CarFront
        :size="48"
        class="absolute -bottom-1 -right-1 opacity-[0.05] -rotate-12"
      />
    </div>
  </div>

  <el-drawer
    v-model="drawerVisible"
    direction="btt"
    size="80%"
    :with-header="false"
    :append-to-body="true"
    class="itinerary-detail-drawer"
    round
  >
    <div v-if="item" class="relative h-full flex flex-col">
      <button
        @click.stop="drawerVisible = false"
        class="absolute top-4 right-4 bg-black/40 backdrop-blur-xl text-white p-2 rounded-full z-10"
      >
        <X :size="20" />
      </button>
      <div class="flex-1 p-4 pb-[100px] overflow-y-auto space-y-[20px]">
        <div
          class="h-[160px] mx-[-16px] mt-[-16px] overflow-hidden relative shadow-xl mb-4"
        >
          <img :src="item.cover" class="w-full h-full object-cover" />
        </div>
        <div class="flex justify-between items-end">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span
                class="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-black rounded-md uppercase tracking-wider"
              >
                {{ item.type || 'Point' }}
              </span>
              <span class="text-xs font-bold text-slate-400"
                >/ {{ item.category }}</span
              >
            </div>
            <h2 class="text-3xl font-black text-slate-800 leading-tight">
              {{ item.location }}
            </h2>
          </div>
        </div>
        <div class="bg-[#68686820] rounded-xl p-2 !mt-[4px]">
          <p
            class="text-[12px] font-black text-slate-800 uppercase tracking-tighter"
          >
            停留
            <span class="text-orange-500 text-[16px]">
              {{ item.duration }}
            </span>
            分鐘 / 延遲
            <span class="text-[#f58585] text-[16px]">{{
              item.delay == '0' ? '-' : item.delay
            }}</span>
            分鐘
          </p>
          <p
            class="text-2xl font-black text-orange-500 font-mono italic text-right"
          >
            {{ item.startTime }} - {{ item.endTime }}
          </p>
        </div>
        <div class="prose prose-slate max-w-none">
          <h3
            class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"
          >
            <FileText :size="14" /> 介紹
          </h3>
          <div
            v-if="item.detail"
            v-html="item.detail"
            class="text-slate-600 leading-relaxed font-medium detail-content text-[14px]"
          ></div>
          <p v-else class="text-slate-600 leading-relaxed font-medium">
            {{ item.description }}
          </p>
        </div>

        <div v-if="item.images && item.images.length > 0">
          <h3
            class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"
          >
            <Image :size="14" /> 照片
          </h3>

          <swiper
            :modules="[Pagination, Autoplay]"
            :slides-per-view="1.5"
            :space-between="4"
            :pagination="{ clickable: true, dynamicBullets: true }"
            :autoplay="{ delay: 3000, disableOnInteraction: false }"
            class="w-full !overflow-visible gallery-swiper"
          >
            <swiper-slide v-for="(img, idx) in item.images" :key="idx">
              <div
                class="aspect-[4/3] rounded-[24px] overflow-hidden bg-slate-100 border border-slate-50 shadow-sm"
              >
                <img :src="img" class="w-full h-full object-cover" />
              </div>
            </swiper-slide>
          </swiper>
        </div>
      </div>

      <div
        class="absolute bottom-[0px] left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent pt-10 z-10"
      >
        <div class="flex gap-3 max-w-lg mx-auto">
          <el-button
            v-if="item.map"
            @click="goUrl(item.map)"
            type="primary"
            class="flex-1 !rounded-[24px] !h-14 !bg-slate-900 !border-none !text-base font-black shadow-xl shadow-slate-200"
          >
            <div class="flex items-center gap-2">
              <Navigation :size="18" /> 開啟 Naver Map
            </div>
          </el-button>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
/* 確保 Drawer 的自定義樣式 */
:global(.itinerary-detail-drawer) {
  border-radius: 40px 40px 0 0 !important;
  overflow: hidden;
}
:global(.itinerary-detail-drawer .el-drawer__body) {
  padding: 0 !important;
}

.gallery-swiper:deep() {
  padding-bottom: 30px !important; // 留空間給分頁

  .swiper-pagination {
    bottom: 0 !important;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
  }

  // 預設的小點點樣式
  .swiper-pagination-bullet {
    width: 6px;
    height: 6px;
    background: #cbd5e1; // slate-300
    opacity: 1;
    border-radius: 10px;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    margin: 0 !important;
  }

  // 當前選中的長條膠囊樣式
  .swiper-pagination-bullet-active {
    width: 24px; // 變長
    background: #f97316; // orange-500
    box-shadow: 0 4px 10px rgba(249, 115, 22, 0.3);
  }
}

// 讓圖片滑動時帶有一點縮放感 (選配)
.gallery-swiper .swiper-slide {
  transition: transform 0.3s;
  &:not(.swiper-slide-active) {
    transform: scale(0.95);
    opacity: 0.8;
  }
}

/* 現在進行中的呼吸效果 */
@keyframes pulse-border {
  0% {
    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.3);
    border-color: #f97316;
  }
  50% {
    box-shadow: 0 0 0 6px rgba(249, 115, 22, 0);
    border-color: #fb923c;
  }
  100% {
    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
    border-color: #f97316;
  }
}
.animate-pulse-border {
  animation: pulse-border 2s infinite ease-in-out;
}

@keyframes fade-in {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 1;
  }
}
</style>
