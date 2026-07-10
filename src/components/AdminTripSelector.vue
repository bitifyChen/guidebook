<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTripStore } from '@/store/tripStore';
import { CheckCircle2, ChevronDown, Circle, Loader2, Plane, Settings } from 'lucide-vue-next';

const router = useRouter();
const tripStore = useTripStore();
const selectedTripId = ref('');
const isOpen = ref(false);
const isSwitching = ref(false);

const currentStatusLabel = computed(() => {
  const status = tripStore.currentTrip?.status;
  if (status === 'completed') return '已完成';
  if (status === 'archived') return '已封存';
  if (status === 'active') return '進行中';
  return '未選擇';
});

const currentTitle = computed(() => {
  if (!tripStore.currentTrip) return '選擇旅程';
  return `${tripStore.currentTrip.title} · ${tripStore.currentTrip.inviteCode || '未設定'}`;
});

const currentStatusClass = computed(() => {
  if (tripStore.currentTrip?.status === 'completed') return 'bg-blue-100 text-blue-700';
  if (tripStore.currentTrip?.status === 'archived') return 'bg-slate-100 text-slate-600';
  if (tripStore.currentTrip?.status === 'active') return 'bg-green-100 text-green-700';
  return 'bg-amber-100 text-amber-700';
});

watch(
  () => tripStore.currentTripId,
  (value) => {
    selectedTripId.value = value || '';
  }
);

onMounted(async () => {
  await tripStore.init();
  await tripStore.refreshTrips();
  selectedTripId.value = tripStore.currentTripId;
});

const clearGuidebookCaches = () => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('guidebook_') && key.endsWith('_cache'))
    .forEach((key) => localStorage.removeItem(key));
};

const switchTrip = async (tripId) => {
  if (!tripId || tripId === tripStore.currentTripId) {
    isOpen.value = false;
    return;
  }
  selectedTripId.value = tripId;
  isSwitching.value = true;
  try {
    await tripStore.switchTrip(tripId);
    clearGuidebookCaches();
  } finally {
    isSwitching.value = false;
    isOpen.value = false;
  }
};
</script>

<template>
  <div class="relative hidden sm:block">
    <button
      @click="isOpen = !isOpen"
      class="h-11 w-[320px] max-w-[34vw] rounded-xl border border-slate-200 bg-slate-50 px-3 text-left flex items-center gap-3 hover:bg-white hover:border-indigo-200 transition-colors"
    >
      <div class="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-500">
        <Plane :size="16" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">目前旅程</div>
        <div class="text-sm font-black text-slate-800 truncate">{{ currentTitle }}</div>
      </div>
      <span class="px-2 py-1 rounded-lg text-[10px] font-black shrink-0" :class="currentStatusClass">
        {{ currentStatusLabel }}
      </span>
      <ChevronDown
        :size="16"
        class="text-slate-400 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 top-12 z-50 w-[360px] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
    >
      <div class="p-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div class="text-sm font-black text-slate-900">切換旅程</div>
          <div class="text-[10px] font-bold text-slate-400">切換後會重新載入本頁資料</div>
        </div>
        <button
          @click="router.push('/admin/trips'); isOpen = false"
          class="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100"
          title="旅程管理"
        >
          <Settings :size="16" />
        </button>
      </div>

      <div class="max-h-80 overflow-y-auto p-2">
        <button
          v-for="trip in tripStore.trips"
          :key="trip.id"
          @click="switchTrip(trip.id)"
          class="w-full rounded-xl px-3 py-3 text-left flex items-center gap-3 hover:bg-slate-50"
          :class="trip.id === tripStore.currentTripId ? 'bg-indigo-50' : ''"
        >
          <component
            :is="trip.id === tripStore.currentTripId ? CheckCircle2 : Circle"
            :size="18"
            :class="trip.id === tripStore.currentTripId ? 'text-indigo-600' : 'text-slate-300'"
          />
          <div class="min-w-0 flex-1">
            <div class="font-black text-sm text-slate-800 truncate">{{ trip.title }}</div>
            <div class="text-[11px] font-bold text-slate-400 truncate">
              {{ trip.destination || '未設定目的地' }} · {{ trip.inviteCode || '未設定邀請碼' }}
            </div>
          </div>
          <span class="text-[10px] font-black text-slate-400 uppercase">{{ trip.status || 'active' }}</span>
        </button>

        <div v-if="tripStore.trips.length === 0" class="py-8 text-center text-xs font-bold text-slate-400">
          尚未建立旅程
        </div>
      </div>
    </div>

    <div
      v-if="isOpen"
      class="fixed inset-0 z-40"
      @click="isOpen = false"
    ></div>

    <div
      v-if="isSwitching"
      class="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center"
    >
      <div class="flex items-center gap-3 text-slate-600 font-black">
        <Loader2 :size="20" class="animate-spin text-indigo-500" />
        正在切換旅程
      </div>
    </div>
  </div>
</template>
