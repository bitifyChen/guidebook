<script setup>
import { ref, watch, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import ItineraryCard from '@/components/ItineraryCard.vue';
import { useTravelStore } from '@/store/travelStore';

const travelStore = useTravelStore();
const activeDay = ref(travelStore.currentDay || 1);
const days = computed(() => travelStore.totalDays);
const itinerary = computed(() => travelStore.dailyItinerary);
watch(
  () => travelStore.currentDay,
  (newDay) => {
    if (newDay) activeDay.value = newDay;
  },
  { immediate: true }
);
watch(
  activeDay,
  (val) => {
    travelStore.setSelectedDay(parseInt(val));
  },
  { immediate: true }
);

// --- 左右滑動切換天數邏輯 ---
let touchStartX = 0;
let touchStartY = 0;

const handleTouchStart = (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
};

const handleTouchEnd = (e) => {
  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const dx = touchEndX - touchStartX;
  const dy = touchEndY - touchStartY;

  // 1. 確保是水平滑動（水平位移必須遠大於垂直位移，避免誤觸）
  // 2. 滑動距離必須超過 80px
  if (Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dx) > 80) {
    if (dx > 0) {
      // 向右滑 -> 切換到前一天
      if (activeDay.value > 1) {
        activeDay.value--;
      }
    } else {
      // 向左滑 -> 切換到後一天
      if (activeDay.value < days.value) {
        activeDay.value++;
      }
    }
  }
};
</script>

<template>
  <div
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    class="min-h-screen"
  >
    <div
      class="fixed top-[8px] left-[16px] right-[16px] z-30 bg-slate-900/90 backdrop-blur-md px-4 shadow-sm rounded-[28px]"
    >
      <el-tabs v-model="activeDay" class="custom-tabs">
        <el-tab-pane
          :label="`D${day}`"
          :name="day"
          v-for="day in days"
          :key="day"
        />
      </el-tabs>
    </div>
    <div class="mt-6 space-y-6">
      <ItineraryCard
        v-for="(item, idx) in itinerary"
        :key="item.id"
        :item="item"
        :isNow="item.id === travelStore.currentActivity?.id"
        :isNext="item.id === travelStore.nextActivity?.id"
        :isLast="idx === itinerary.length - 1"
      />
      <div
        v-if="itinerary.length === 0"
        class="text-center py-20 text-slate-400 italic"
      >
        本日無行程，享受悠閒時光吧！
      </div>
    </div>
  </div>
</template>

<style>
/* 1. 基礎樣式 (保留你原本的邏輯並優化) */
.custom-tabs .el-tabs__item {
  font-weight: bold;
  flex: 1;
  text-align: center;
  transition: transform 0.1s ease; /* 加入輕微的縮放動畫 */
  -webkit-tap-highlight-color: transparent; /* 移除手機預設點擊藍框 */
  color: var(--primary-orange-light);
}

.custom-tabs .el-tabs__nav {
  width: 100%;
  display: flex;
}

/* 2. 選中狀態樣式 */
.custom-tabs .el-tabs__active-bar {
  background-color: #ff8c00;
  height: 3px;
  border-radius: 3px;
}

.custom-tabs .el-tabs__item.is-active {
  color: #ff8c00 !important;
}

/* --- 核心優化：解決手機點擊問題 --- */

/* 3. 解決手機 Hover 殘留：僅在支援懸停的裝置上觸發 hover */
@media (hover: hover) {
  .custom-tabs .el-tabs__item:hover {
    color: #ff8c00;
  }
}

/* 4. 增加點擊觸感：手指按下去時有縮小回饋 */
.custom-tabs .el-tabs__item:active {
  transform: scale(0.9); /* 按下去微縮，讓使用者知道「有按到」 */
  opacity: 0.8;
  transition: transform 0.05s ease;
}

/* 5. 介面優化：移除 Tab 下方的長灰線，讓風格更現代 */
.custom-tabs .el-tabs__nav-wrap::after {
  display: none;
}
.custom-tabs .el-tabs__header {
  margin-bottom: 0px;
}
</style>
