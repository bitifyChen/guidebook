<script setup>
import DataStatusNotice from '@/components/DataStatusNotice.vue';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useExpensesStore } from '@/store/expensesStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTravelStore } from '@/store/travelStore';
import { useTripStore } from '@/store/tripStore';
import { useUserStore } from '@/store/userStore';
import {
  User,
  X,
  Leaf,
  Luggage,
  CarFront,
  MapPin,
  Clock,
  ChevronRight,
} from 'lucide-vue-next';
import { lockScroll, unlockScroll } from '@/utils/scrollLock';
import PackingList from '@/components/PackingList.vue';
import WeatherCard from '@/components/WeatherCard.vue';
import ItineraryCard from '@/components/ItineraryCard.vue';
import dayjs from 'dayjs';
import {
  getPackingProgress,
  getPackingStorageKey,
  hasPackingItems,
  mergePackingState,
} from '@/utils/packingList';

const travelStore = useTravelStore();
const expense = useExpensesStore();
const participants = useParticipantsStore();
const tripStore = useTripStore();
const userStore = useUserStore();

const isParticipantsModalOpen = ref(false);
const isPackingListOpen = ref(false);

// 鎖定背景滾動
watch([isParticipantsModalOpen, isPackingListOpen], ([p, l]) => {
  if (p || l) {
    lockScroll();
  } else {
    unlockScroll();
  }
});

// 行李準備進度
const packingProgress = ref(0);
const packingTemplate = computed(
  () => tripStore.currentTrip?.packingList || []
);
const hasTripPackingList = computed(() =>
  hasPackingItems(packingTemplate.value)
);
const packingParticipantId = computed(
  () => userStore.myParticipant?.id || userStore.localParticipantId || 'guest'
);
const updatePackingProgress = () => {
  if (!hasTripPackingList.value) {
    packingProgress.value = 0;
    return;
  }
  const storageKey = getPackingStorageKey(
    tripStore.currentTripId,
    packingParticipantId.value
  );
  const raw =
    localStorage.getItem(storageKey) ||
    localStorage.getItem('guidebook_packing_list_v2') ||
    localStorage.getItem(['jeju', 'packing', 'list', 'v2'].join('_'));
  let saved = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Unable to parse packing progress state', error);
  }
  const state = mergePackingState({
    saved,
    template: packingTemplate.value,
  });
  localStorage.setItem(storageKey, JSON.stringify(state));
  packingProgress.value = getPackingProgress(state);
};

// 當清單關閉時重新計算進度
watch(isPackingListOpen, (val) => {
  if (!val) updatePackingProgress();
});
watch(
  () => [
    tripStore.currentTripId,
    packingParticipantId.value,
    packingTemplate.value,
  ],
  updatePackingProgress,
  { deep: true }
);

const currentActivity = computed(() => travelStore.currentActivity);
const currentSubActivity = computed(() => travelStore.currentSubActivity);
const currentTransit = computed(() => travelStore.currentTransit);
const nextActivity = computed(() => travelStore.nextActivity);
const nextSubActivity = computed(() => travelStore.nextSubActivity);
const visualItem = computed(() =>
  currentActivity.value?.cover
    ? currentActivity.value
    : nextActivity.value?.cover
      ? nextActivity.value
      : travelStore.allItinerary?.find(
          (item) => item.cover && item.category === '景點'
        ) ||
        travelStore.allItinerary?.find((item) => item.cover) ||
        null
);
const visualLabel = computed(() =>
  currentActivity.value?.id === visualItem.value?.id
    ? '此刻停留'
    : nextActivity.value?.id === visualItem.value?.id
      ? '下一站'
      : '旅程片刻'
);

const weather = ref({});
const getWeather = async () => {
  const tripContext = tripStore.context;
  const cacheScope = tripStore.currentTripId || 'default';
  const CACHE_KEY = `guidebook_${cacheScope}_weather_cache`;
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        console.log('Using cached weather data');
        weather.value = data;
        return;
      }
    }

    const params = new URLSearchParams({
      latitude: String(tripContext.latitude),
      longitude: String(tripContext.longitude),
      current:
        'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index',
      timezone: tripContext.timezone,
    });
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`
    );
    const data = await response.json();
    weather.value = data;

    // 存入快取
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error('Error fetching weather data:', error);
    weather.value = null;
  }
};

onMounted(() => {
  getWeather();
  updatePackingProgress();
});
</script>

<template>
  <div class="journey-home space-y-5">
    <DataStatusNotice
      :loading="travelStore.isLoading"
      :stale="travelStore.isStale"
      :error="travelStore.loadError"
      @retry="travelStore.init({ force: true })"
    />
    <header class="journey-header pt-5 pb-1">
      <p
        class="text-[11px] font-bold tracking-[.22em] text-[var(--travel-teal)] uppercase"
      >
        YOUR JOURNEY
      </p>
      <div class="mt-2 flex items-end justify-between gap-3">
        <div>
          <h1
            class="text-[29px] leading-tight font-black tracking-tight text-[var(--travel-ink)]"
          >
            {{
              tripStore.currentTrip?.title ||
              tripStore.currentTrip?.name ||
              '旅程日誌'
            }}
          </h1>
          <p class="mt-1 text-sm font-medium text-[#60787a]">
            {{ tripStore.context.weatherCity || '旅途中的每一天' }}
          </p>
        </div>
        <router-link
          to="/itinerary"
          class="mb-1 inline-flex min-h-11 items-center gap-1 rounded-full bg-[var(--travel-mist)] px-4 text-sm font-bold text-[var(--travel-teal)]"
          >查看行程 <ChevronRight :size="16"
        /></router-link>
      </div>
    </header>
    <section
      v-if="visualItem"
      class="journey-hero relative overflow-hidden rounded-[26px] bg-[#dce8e5]"
    >
      <img
        :src="visualItem.cover"
        :alt="visualItem.location || '旅程照片'"
        class="journey-hero-image absolute inset-0 h-full w-full object-cover"
        fetchpriority="high"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-[#102e35]/90 via-[#102e35]/15 to-transparent"
      ></div>
      <div
        class="relative flex h-full flex-col justify-end px-5 pb-5 pt-36 text-white"
      >
        <p class="text-[11px] font-bold tracking-[.22em] text-white/80">
          {{ visualLabel }}
        </p>
        <h2 class="mt-2 text-[27px] leading-tight font-black tracking-tight">
          {{ visualItem.location }}
        </h2>
        <div
          class="mt-3 flex items-center justify-between gap-3 border-t border-white/30 pt-3"
        >
          <p class="text-sm font-semibold">
            {{ visualItem.startTime || '--:--' }}
            <span class="mx-1 text-white/60">—</span>
            {{ visualItem.endTime || '--:--' }}
          </p>
          <router-link
            to="/itinerary"
            class="inline-flex min-h-11 items-center gap-1 text-sm font-black"
            >進入行程 <ChevronRight :size="17"
          /></router-link>
        </div>
      </div>
    </section>
    <section
      v-else
      class="rounded-[26px] bg-[var(--travel-mist)] px-6 py-8 text-[var(--travel-ink)]"
    >
      <p class="text-xs font-bold tracking-[.2em] text-[var(--travel-teal)]">
        旅程準備中
      </p>
      <h2 class="mt-2 text-2xl font-black">下一段風景，等你出發</h2>
      <router-link
        to="/itinerary"
        class="mt-5 inline-flex min-h-11 items-center gap-1 font-bold text-[var(--travel-teal)]"
        >查看行程 <ChevronRight :size="17"
      /></router-link>
    </section>
    <WeatherCard :weather="weather" :city="tripStore.context.weatherCity" />
    <section v-if="!tripStore.isPublicTrip">
      <div class="grid grid-cols-2 gap-4">
        <router-link to="/wallet" class="block">
          <div
            class="bg-white p-4 rounded-2xl border border-[#e1e9e4] text-center active:scale-95 transition-transform cursor-pointer"
          >
            <p class="text-xs text-slate-400 font-bold mb-1">已支出</p>
            <p class="text-xl font-bold text-slate-800">
              {{ tripStore.currencySymbol
              }}{{ expense.totalSpent.toLocaleString() }}
            </p>
          </div>
        </router-link>

        <div
          @click="isParticipantsModalOpen = true"
          class="bg-white p-4 rounded-2xl border border-[#e1e9e4] text-center active:scale-95 transition-transform cursor-pointer group"
        >
          <p
            class="text-xs text-slate-400 font-bold mb-1 group-hover:text-[var(--travel-teal)] transition-colors"
          >
            旅行成員
          </p>
          <p
            class="text-xl font-bold text-slate-800 flex items-center justify-center gap-1"
          >
            {{ participants.participants.length }} 位
            <Leaf :size="16" class="text-[var(--travel-teal)]" />
          </p>
        </div>
      </div>

      <!-- 行李準備進度卡片 -->
      <div
        v-if="hasTripPackingList"
        @click="isPackingListOpen = true"
        class="mt-4 bg-white p-4 rounded-2xl border border-[#e1e9e4] active:scale-95 transition-transform cursor-pointer group overflow-hidden relative"
      >
        <div class="relative z-10 w-full">
          <p
            class="text-xs text-slate-400 font-bold mb-1 group-hover:text-[var(--travel-teal)] transition-colors"
          >
            行李準備進度
          </p>
          <div class="flex items-center gap-4 w-full">
            <span class="text-2xl font-black text-slate-800 shrink-0"
              >{{ packingProgress }}%</span
            >
            <div
              class="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50 p-0.5"
            >
              <div
                class="h-full bg-[var(--travel-teal)] rounded-full transition-all duration-700 ease-out"
                :style="{ width: `${packingProgress}%` }"
              ></div>
            </div>
          </div>
        </div>
        <!-- 裝飾背景 -->
        <Luggage
          :size="80"
          class="absolute -bottom-4 -right-4 opacity-5 -rotate-12 group-hover:scale-110 transition-transform"
        />
      </div>
    </section>

    <PackingList
      v-model:visible="isPackingListOpen"
      :template="packingTemplate"
      :trip-id="tripStore.currentTripId"
      :participant-id="packingParticipantId"
      @change="packingProgress = getPackingProgress($event)"
    />

    <!-- 原有的行程區塊保持不變 -->
    <section>
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-slate-800">
          {{ currentTransit ? '正在路程中' : '目前行程' }}
        </h3>
      </div>

      <div v-if="currentActivity">
        <ItineraryCard
          :item="currentActivity"
          :timeLine="false"
          :isNow="true"
        />
      </div>
      <!-- 如果有子形程，顯示在目前行程下方 -->
      <div v-if="currentSubActivity.length">
        <ItineraryCard
          v-for="subActivity in currentSubActivity"
          :item="subActivity"
          :parent-item="currentActivity"
          :key="subActivity.id"
          easyMode
          :timeLine="false"
          :isNow="true"
        />
      </div>

      <div
        v-else-if="currentTransit"
        class="bg-[var(--travel-mist)] p-6 rounded-3xl border border-[#d7e8e2] active:scale-[0.98] transition-all cursor-pointer group relative overflow-hidden"
      >
        <div class="relative z-10 flex items-center gap-4">
          <div class="bg-[var(--travel-teal)] p-3 rounded-2xl text-white">
            <CarFront :size="24" />
          </div>
          <div class="flex-1">
            <p
              class="text-[10px] font-black text-[var(--travel-teal)] uppercase tracking-[0.2em] mb-1"
            >
              On the Way
            </p>
            <h4 class="text-lg font-black text-slate-800">
              前往 {{ nextActivity?.location || '下一個地點' }}
            </h4>
            <div class="flex items-center gap-3 mt-1">
              <span
                v-if="currentTransit.nextDrive?.km"
                class="text-xs font-bold text-slate-400 flex items-center gap-1"
              >
                <MapPin :size="12" /> {{ currentTransit.nextDrive.km }} KM
              </span>
              <span
                v-if="currentTransit.nextDrive?.time"
                class="text-xs font-bold text-slate-400 flex items-center gap-1"
              >
                <Clock :size="12" /> 預計 {{ currentTransit.nextDrive.time }} 分
              </span>
            </div>
          </div>
          <ChevronRight
            :size="20"
            class="text-[var(--travel-teal)] group-hover:translate-x-1 transition-transform"
          />
        </div>
        <!-- 裝飾背景 -->
        <CarFront
          :size="120"
          class="absolute -bottom-8 -right-8 opacity-5 -rotate-12 group-hover:scale-110 transition-transform"
        />
      </div>

      <div
        v-if="!currentActivity && !currentSubActivity.length && !currentTransit"
        class="bg-white/50 p-6 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm"
      >
        目前沒有進行中的行程
      </div>
    </section>
    <section>
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-slate-800">下一個行程</h3>
      </div>
      <ItineraryCard
        v-if="nextActivity"
        :item="nextActivity"
        :timeLine="false"
        :isNext="true"
      />
      <!-- 如果有子形程，顯示在目前行程下方 -->
      <div v-if="nextSubActivity.length">
        <ItineraryCard
          v-for="subActivity in nextSubActivity"
          :item="subActivity"
          :parent-item="nextActivity"
          :key="subActivity.id"
          easyMode
          :timeLine="false"
          :isNow="true"
        />
      </div>
      <div
        v-if="!nextActivity && !nextSubActivity.length"
        class="bg-white/50 p-6 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm"
      >
        之後沒有行程囉，好好休息吧！
      </div>
    </section>

    <!-- 旅途夥伴 -->
    <Teleport to="body">
      <div
        v-if="isParticipantsModalOpen"
        class="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center"
      >
        <!-- 背景遮罩：帶有一點暖色調 -->
        <div
          class="absolute inset-0 bg-[#102e35]/55 animate-in fade-in duration-300"
          @click="isParticipantsModalOpen = false"
        ></div>

        <!-- 視窗主體 -->
        <div
          role="dialog"
          aria-modal="true"
          aria-label="旅途夥伴"
          class="relative w-full max-w-md bg-[var(--travel-paper)] rounded-[26px] shadow-[0_20px_60px_rgba(9,48,50,.24)] overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out"
        >
          <!-- 頂部裝飾：葉子與標題 -->
          <div
            class="bg-[var(--travel-mist)] px-8 py-4 pb-8 text-center relative"
          >
            <div class="hidden"></div>
            <div class="flex flex-col items-center gap-2">
              <Leaf :size="32" class="text-[var(--travel-teal)] mb-1" />
              <h3
                class="text-2xl font-black text-[var(--travel-ink)] tracking-wider"
              >
                旅遊的夥伴
              </h3>
              <div class="bg-white px-4 py-1 rounded-full">
                <p
                  class="text-xs font-black text-[var(--travel-teal)] uppercase tracking-[0.2em]"
                >
                  {{ participants.participants.length }} 個人一起的旅行
                </p>
              </div>
            </div>
            <button
              @click="isParticipantsModalOpen = false"
              class="absolute top-4 right-4 w-11 h-11 bg-white rounded-full flex items-center justify-center text-[var(--travel-ink)] transition-colors"
            >
              <X :size="24" strokeWidth="3" />
            </button>
          </div>

          <!-- 家人清單 -->
          <div class="p-6 max-h-[65dvh] overflow-y-auto custom-scrollbar">
            <div class="grid grid-cols-3 gap-y-7 gap-x-4">
              <div
                v-for="(p, index) in participants.participants"
                :key="p.id"
                class="flex flex-col items-center group animate-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                :style="{ 'animation-delay': `${index * 50}ms` }"
              >
                <!-- 頭像框：加大尺寸 -->
                <div
                  class="w-20 h-20 rounded-[20px] bg-white overflow-hidden border-2 border-white relative"
                >
                  <img
                    v-if="p.avatar"
                    :src="p.avatar"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center bg-stone-100 text-stone-300"
                  >
                    <User :size="40" />
                  </div>

                  <!-- 管理員小皇冠：隨尺寸調整 -->
                  <div
                    v-if="p.isAdmin || p.isSuperAdmin"
                    class="absolute -top-1 -right-1 bg-[var(--travel-coral)] rounded-full p-1.5 border-2 border-white"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      class="w-4 h-4 text-white fill-current"
                    >
                      <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z" />
                    </svg>
                  </div>
                </div>

                <!-- 名字：稍微加大文字 -->
                <div class="mt-4 relative">
                  <span
                    class="text-sm font-black text-[var(--travel-ink)] whitespace-nowrap px-3 py-1 rounded-xl bg-[var(--travel-mist)]"
                  >
                    {{ p.name }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部：AC 經典的分隔線與小圖示 -->
          <div class="px-8 pb-6 flex justify-center">
            <div class="flex items-center gap-2 text-[var(--travel-teal)]">
              <div class="h-[2px] w-8 bg-[#d7e8e2]"></div>
              <Leaf :size="14" class="fill-current" />
              <div class="h-[2px] w-8 bg-[#d7e8e2]"></div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.journey-hero {
  min-height: 360px;
  aspect-ratio: 4 / 4.1;
}
.journey-hero-image {
  animation: journey-image-settle 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.journey-header {
  animation: journey-content-rise 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.journey-hero {
  animation: journey-content-rise 440ms 50ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes journey-image-settle {
  from {
    transform: scale(1.045);
  }
  to {
    transform: scale(1);
  }
}
@keyframes journey-content-rise {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .journey-hero-image,
  .journey-header,
  .journey-hero {
    animation: none !important;
  }
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #d7e8e2;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #d4ccb6;
}
</style>
