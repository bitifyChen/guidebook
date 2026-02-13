<script setup>
import { ref } from 'vue';
import {
  Clock,
  MapPin,
  Info,
  X,
  ChevronRight,
  CarFront,
} from 'lucide-vue-next';

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
});

const drawerVisible = ref(false);

const openDetail = () => {
  drawerVisible.value = true;
};
const goUrl = (url) => {
  window.open(url, '_blank');
};
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
                class="text-lg font-black text-slate-800 leading-tight mb-1 transition-colors"
              >
                {{ item.location }}
              </h4>
              <div class="flex items-center gap-1 text-slate-400">
                <MapPin :size="12" />
                <span class="text-[11px] font-bold"
                  >Jeju Special Self-Governing Province</span
                >
              </div>
            </div>
            <div
              class="bg-slate-50 p-2 rounded-xl text-slate-300 group-hover:text-orange-400 transition-colors"
            >
              <ChevronRight :size="18" />
            </div>
          </div>

          <p
            class="mt-3 text-xs text-slate-500 leading-relaxed line-clamp-2 font-medium"
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
    :append-to-body="false"
    class="itinerary-detail-drawer"
    round
  >
    <div v-if="item" class="relative h-full flex flex-col p-6">
      <div
        class="w-full h-64 overflow-hidden rounded-3xl mb-6 relative shadow-2xl"
      >
        <img :src="item.cover" class="w-full h-full object-cover" />
        <button
          @click.stop="drawerVisible = false"
          class="absolute top-4 right-4 bg-black/40 backdrop-blur-xl text-white p-2 rounded-full"
        >
          <X :size="20" />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div class="flex justify-between items-start mb-6">
          <div>
            <span
              class="text-xs font-black text-orange-500 uppercase tracking-[0.2em]"
              >{{ item.category }}</span
            >
            <h2 class="text-3xl font-black text-slate-800 mt-1">
              {{ item.location }}
            </h2>
          </div>
          <div class="text-right">
            <p class="text-[10px] font-black text-slate-300 uppercase">
              Schedule
            </p>
            <p class="text-2xl font-black text-orange-500 font-mono">
              {{ item.startTime }} - {{ item.endTime }}
            </p>
          </div>
        </div>
        <div class="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-6">
          <p class="text-slate-600 leading-loose font-medium">
            {{ item.description }}
          </p>
        </div>
      </div>
      <div class="pt-4 flex gap-4" v-if="item.map" @click="goUrl(item.map)">
        <el-button
          type="primary"
          class="flex-1 !rounded-2xl !h-14 !bg-orange-500 !border-none !text-lg font-black shadow-xl shadow-orange-100"
          >開啟導航</el-button
        >
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
/* 確保 Drawer 的自定義樣式 */
:global(.itinerary-detail-drawer) {
  border-radius: 40px 40px 0 0 !important;
}
:global(.itinerary-detail-drawer .el-drawer__body) {
  padding: 0 !important;
}
</style>
