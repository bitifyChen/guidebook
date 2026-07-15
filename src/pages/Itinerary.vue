<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import ItineraryCard from '@/components/ItineraryCard.vue';
import { useTravelStore } from '@/store/travelStore';

const route = useRoute();
const travelStore = useTravelStore();
const activeDay = ref(travelStore.currentDay || 1);
const dayTabsRef = ref(null);
const days = computed(() => travelStore.totalDays);
const itinerary = computed(() => {
  const items = travelStore.dailyItinerary;
  return items.map((item, index) => {
    const isChild = !!item.parentId;
    // 判斷是否為群組的最後一個項目
    // 邏輯：下一個項目的 parentId 不同於目前的 parentId (如果目前是 child)
    // 或者目前是 parent 但下一個項目不是它的 child
    const nextItem = items[index + 1];
    let isLastInGroup = false;

    if (isChild) {
      // 如果下一個項目不存在，或者是另一個群組，或是一個新的主景點
      isLastInGroup = !nextItem || nextItem.parentId !== item.parentId;
    } else {
      // 如果自己是 parent，但沒有任何 child 跟隨，那自己也是 Last
      const hasChildren = items.some((i) => i.parentId === item.id);
      isLastInGroup = !hasChildren;
    }

    // --- 資料繼承邏輯 ---
    // 如果是子景點且是結尾，從父景點抓取 nextDrive 供 UI 顯示
    let displayNextDrive = item.nextDrive;
    if (isChild && isLastInGroup) {
      const parent = items.find((i) => i.id === item.parentId);
      if (parent) {
        displayNextDrive = parent.nextDrive;
      }
    }

    return {
      ...item,
      isGroupChild: isChild,
      isGroupLast: isLastInGroup,
      nextDrive: displayNextDrive,
    };
  });
});
watch(
  () => [route.query.day, days.value],
  ([queryDay, totalDays]) => {
    const day = Number(queryDay);
    if (Number.isInteger(day) && day >= 1 && day <= totalDays) {
      activeDay.value = day;
    }
  },
  { immediate: true }
);
watch(
  () => travelStore.currentDay,
  (newDay) => {
    const requestedDay = Number(route.query.day);
    if (
      Number.isInteger(requestedDay) &&
      requestedDay >= 1 &&
      requestedDay <= days.value
    ) {
      return;
    }
    if (newDay) activeDay.value = newDay;
  },
  { immediate: true }
);
watch(
  activeDay,
  (val) => {
    travelStore.setSelectedDay(parseInt(val));
    // 切換天數時回到最上方
    window.scrollTo({ top: 0, behavior: 'smooth' });
    nextTick(() => {
      const activeTab = dayTabsRef.value?.$el?.querySelector(
        '.el-tabs__item.is-active'
      );
      activeTab?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    });
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
      class="itinerary-day-glass fixed top-[8px] left-[16px] right-[16px] z-30 px-4 rounded-[28px]"
      @touchstart.stop
      @touchend.stop
    >
      <el-tabs ref="dayTabsRef" v-model="activeDay" class="custom-tabs">
        <el-tab-pane
          :label="`D${day}`"
          :name="day"
          v-for="day in days"
          :key="day"
        />
      </el-tabs>
    </div>
    <div class="mt-16 space-y-6">
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
.itinerary-day-glass {
  position: fixed;
  isolation: isolate;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgb(30 41 59 / 52%), rgb(15 23 42 / 38%)),
    rgb(15 23 42 / 62%);
  -webkit-backdrop-filter: blur(3px) saturate(145%) contrast(1.04)
    url('#guidebook-liquid-glass');
  backdrop-filter: blur(3px) saturate(145%) contrast(1.04)
    url('#guidebook-liquid-glass');
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 24%),
    inset 0 -1px 0 rgb(255 255 255 / 10%),
    inset 7px 7px 18px rgb(255 255 255 / 8%),
    0 18px 38px rgb(15 23 42 / 32%);
}

.itinerary-day-glass::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: '';
  background:
    radial-gradient(circle at 16% 0%, rgb(255 255 255 / 18%), transparent 34%),
    linear-gradient(
      105deg,
      rgb(255 255 255 / 10%),
      transparent 42%,
      rgb(255 255 255 / 5%)
    );
  border-radius: inherit;
  pointer-events: none;
}

.itinerary-day-glass::after {
  position: absolute;
  inset: 1px;
  z-index: 1;
  content: '';
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: inherit;
  pointer-events: none;
}

.itinerary-day-glass .custom-tabs {
  position: relative;
  z-index: 2;
}

/* 1. 基礎樣式 (保留你原本的邏輯並優化) */
.custom-tabs .el-tabs__item {
  font-weight: bold;
  flex: 0 0 20%;
  min-width: 20%;
  padding: 0;
  text-align: center;
  transition: transform 0.1s ease; /* 加入輕微的縮放動畫 */
  -webkit-tap-highlight-color: transparent; /* 移除手機預設點擊藍框 */
  color: rgb(226 232 240 / 76%);
  text-shadow: 0 1px 10px rgb(15 23 42 / 45%);
}

.custom-tabs .el-tabs__nav {
  width: max-content;
  min-width: 100%;
  display: flex;
}

.custom-tabs .el-tabs__nav-wrap {
  overflow: hidden;
}

.custom-tabs .el-tabs__nav-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.custom-tabs .el-tabs__nav-scroll::-webkit-scrollbar {
  display: none;
}

/* 2. 選中狀態樣式 */
.custom-tabs .el-tabs__active-bar {
  background-color: #fb923c;
  height: 3px;
  border-radius: 3px;
  box-shadow: 0 0 16px rgb(251 146 60 / 55%);
}

.custom-tabs .el-tabs__item.is-active {
  color: #fdba74 !important;
  text-shadow:
    0 1px 10px rgb(15 23 42 / 34%),
    0 0 18px rgb(251 146 60 / 42%);
}

/* --- 核心優化：解決手機點擊問題 --- */

/* 3. 解決手機 Hover 殘留：僅在支援懸停的裝置上觸發 hover */
@media (hover: hover) {
  .custom-tabs .el-tabs__item:hover {
    color: #fdba74;
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

@supports not (
  (backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))
) {
  .itinerary-day-glass {
    background: rgb(15 23 42 / 92%);
  }
}
</style>
