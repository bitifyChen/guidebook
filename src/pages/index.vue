<script setup>
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
  <div class="space-y-4">
    <WeatherCard :weather="weather" :city="tripStore.context.weatherCity" />
    <section v-if="!tripStore.isPublicTrip">
      <div class="grid grid-cols-2 gap-4">
        <router-link to="/wallet" class="block">
          <div
            class="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm active:scale-95 transition-transform cursor-pointer"
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
          class="bg-white p-4 rounded-2xl border border-slate-100 text-center shadow-sm active:scale-95 transition-transform cursor-pointer group"
        >
          <p
            class="text-xs text-slate-400 font-bold mb-1 group-hover:text-lime-500 transition-colors"
          >
            旅行成員
          </p>
          <p
            class="text-xl font-bold text-slate-800 flex items-center justify-center gap-1"
          >
            {{ participants.participants.length }} 位
            <Leaf :size="16" class="text-lime-500" />
          </p>
        </div>
      </div>

      <!-- 行李準備進度卡片 -->
      <div
        v-if="hasTripPackingList"
        @click="isPackingListOpen = true"
        class="mt-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm active:scale-95 transition-transform cursor-pointer group overflow-hidden relative"
      >
        <div class="relative z-10 w-full">
          <p
            class="text-xs text-slate-400 font-bold mb-1 group-hover:text-orange-500 transition-colors"
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
                class="h-full bg-orange-500 rounded-full transition-all duration-700 ease-out"
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
          :key="subActivity.id"
          easyMode
          :timeLine="false"
          :isNow="true"
        />
      </div>

      <div
        v-else-if="currentTransit"
        class="bg-orange-50 p-6 rounded-3xl border border-orange-100 shadow-sm active:scale-[0.98] transition-all cursor-pointer group relative overflow-hidden"
      >
        <div class="relative z-10 flex items-center gap-4">
          <div
            class="bg-orange-500 p-3 rounded-2xl text-white shadow-lg shadow-orange-200 animate-bounce-slow"
          >
            <CarFront :size="24" />
          </div>
          <div class="flex-1">
            <p
              class="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-1"
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
            class="text-orange-300 group-hover:translate-x-1 transition-transform"
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

    <!-- 動物森友會風格 彈出視窗 -->
    <Teleport to="body">
      <div
        v-if="isParticipantsModalOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-6"
      >
        <!-- 背景遮罩：帶有一點暖色調 -->
        <div
          class="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300"
          @click="isParticipantsModalOpen = false"
        ></div>

        <!-- 視窗主體 -->
        <div
          class="relative w-full max-w-xl bg-[#fdf6e3] rounded-[60px] shadow-[0_20px_0_0_rgba(0,0,0,0.05),0_30px_60px_-12px_rgba(0,0,0,0.25)] border-[8px] border-[#7dd329] overflow-hidden animate-in zoom-in-90 fade-in duration-300 ease-out"
        >
          <!-- 頂部裝飾：葉子與標題 -->
          <div class="bg-[#7dd329] px-8 py-4 pb-10 text-center relative">
            <div
              class="absolute -bottom-5 left-1/2 -translate-x-1/2 w-10 h-10 bg-[#7dd329] rotate-45"
            ></div>
            <div class="flex flex-col items-center gap-2">
              <Leaf :size="40" class="text-white fill-white/20 mb-1" />
              <h3 class="text-3xl font-black text-white tracking-wider">
                旅遊的夥伴
              </h3>
              <div class="bg-white/20 px-4 py-1 rounded-full">
                <p
                  class="text-xs font-black text-white uppercase tracking-[0.2em]"
                >
                  {{ participants.participants.length }} 個人一起的旅行
                </p>
              </div>
            </div>
            <button
              @click="isParticipantsModalOpen = false"
              class="absolute top-6 right-6 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors"
            >
              <X :size="24" strokeWidth="3" />
            </button>
          </div>

          <!-- 家人清單 -->
          <div class="p-10 pt-12 max-h-[65vh] overflow-y-auto custom-scrollbar">
            <div class="grid grid-cols-3 sm:grid-cols-4 gap-y-10 gap-x-6">
              <div
                v-for="(p, index) in participants.participants"
                :key="p.id"
                class="flex flex-col items-center group animate-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                :style="{ 'animation-delay': `${index * 50}ms` }"
              >
                <!-- 頭像框：加大尺寸 -->
                <div
                  class="w-24 h-24 sm:w-28 sm:h-28 rounded-[40px] bg-white shadow-md overflow-hidden border-[6px] border-white ring-4 ring-[#e9e2cf] group-hover:ring-[#7dd329] transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 relative"
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
                    class="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1.5 shadow-sm border-2 border-white"
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
                    class="text-base font-black text-[#5c5443] whitespace-nowrap px-3 py-1 rounded-xl bg-[#e9e2cf]/60 transition-colors group-hover:bg-[#7dd329]/10"
                  >
                    {{ p.name }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部：AC 經典的分隔線與小圖示 -->
          <div class="px-8 pb-8 flex justify-center">
            <div class="flex items-center gap-2 text-[#b5ae9a]">
              <div class="h-[2px] w-8 bg-[#e9e2cf]"></div>
              <Leaf :size="14" class="fill-current" />
              <div class="h-[2px] w-8 bg-[#e9e2cf]"></div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e9e2cf;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #d4ccb6;
}

@keyframes bounce-slow {
  0%,
  100% {
    transform: translateY(-5%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}
.animate-bounce-slow {
  animation: bounce-slow 2s infinite;
}
</style>
