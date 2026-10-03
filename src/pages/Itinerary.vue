<script setup>
import DataStatusNotice from '@/components/DataStatusNotice.vue';
import { ref, watch, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import ItineraryCard from '@/components/ItineraryCard.vue';
import ItineraryTimingDrawer from '@/components/ItineraryTimingDrawer.vue';
import { useTravelStore } from '@/store/travelStore';
import { useTripStore } from '@/store/tripStore';
import { useUserStore } from '@/store/userStore';
import { patchItineraryItem } from '@/api/itinerary';
import { sendItinerarySyncSignal } from '@/api/notifications';
import { calculateTimingAdjustment } from '@/utils/itineraryTiming';
import { ElMessage } from 'element-plus';

const route = useRoute();
const travelStore = useTravelStore();
const tripStore = useTripStore();
const userStore = useUserStore();
const activeDay = ref(travelStore.currentDay || 1);
const dayTabsRef = ref(null);
const days = computed(() => travelStore.totalDays);
const timingDrawer = ref({
  open: false,
  item: null,
  mode: 'arrived',
  actualTime: '',
  isSaving: false,
});
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
        return {
          ...item,
          scheduledEndTime: parent.scheduledEndTime,
          endTime: parent.endTime,
          isGroupChild: true,
          isGroupLast: true,
          nextDrive: displayNextDrive,
        };
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
const itineraryById = computed(
  () => new Map(itinerary.value.map((item) => [item.id, item]))
);
const dayHero = computed(
  () =>
    itinerary.value.find((item) => item.cover && item.category === '景點') ||
    itinerary.value.find((item) => item.cover && item.category === '美食') ||
    itinerary.value.find((item) => item.cover) ||
    null
);
const heroImageFailed = ref(false);
watch(
  () => dayHero.value?.cover,
  () => {
    heroImageFailed.value = false;
  }
);
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
    window.scrollTo({ top: 0, behavior: 'auto' });
    nextTick(() => {
      const activeTab = dayTabsRef.value?.$el?.querySelector(
        '.el-tabs__item.is-active'
      );
      activeTab?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
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

const openTimingAdjustment = ({ item, mode }) => {
  if (!userStore.canManageCurrentTripTiming || item?.isGroupChild) return;
  timingDrawer.value = {
    open: true,
    item,
    mode,
    actualTime: new Date().toTimeString().slice(0, 5),
    isSaving: false,
  };
};

const saveTimingAdjustment = async ({ actualTime, arrivalPolicy = '' }) => {
  const item = timingDrawer.value.item;
  if (
    !item?.id ||
    !actualTime ||
    item.isGroupChild ||
    !userStore.canManageCurrentTripTiming ||
    tripStore.currentTrip?.status !== 'active'
  ) {
    return;
  }

  timingDrawer.value.actualTime = actualTime;
  const preview = calculateTimingAdjustment({
    item,
    mode: timingDrawer.value.mode,
    actualTime,
    arrivalPolicy,
  });
  const recordedAt = Date.now();
  const recordedBy = userStore.myParticipant?.id || userStore.user?.uid || '';
  const actualTiming = {
    ...(item.actualTiming || {}),
    ...(timingDrawer.value.mode === 'arrived'
      ? {
          arrivalTime: actualTime,
          arrivalPolicy,
          arrivalRecordedAt: recordedAt,
          arrivalRecordedBy: recordedBy,
        }
      : {
          departureTime: actualTime,
          departureRecordedAt: recordedAt,
          departureRecordedBy: recordedBy,
        }),
  };
  const timingRecord = {
    mode: timingDrawer.value.mode,
    actualTime,
    arrivalPolicy: timingDrawer.value.mode === 'arrived' ? arrivalPolicy : '',
    previousDelay: preview.previousDelay,
    delay: preview.nextDelay,
    adjustedAt: recordedAt,
    adjustedBy: recordedBy,
  };
  const changes = {
    delay: preview.nextDelay,
    actualTiming,
    timingStatus: timingDrawer.value.mode,
    lastTimingAdjustment: timingRecord,
  };

  timingDrawer.value.isSaving = true;
  try {
    await patchItineraryItem(item.id, changes);
    travelStore.updateLocalItem(item.id, changes);
    await travelStore.init({ force: true });
    if (tripStore.currentTrip?.status === 'active') {
      await sendItinerarySyncSignal({
        tripId: tripStore.currentTripId,
        day: item.day,
        reason: `timing-${timingDrawer.value.mode}`,
      }).catch((error) =>
        console.error('Itinerary sync signal failed:', error)
      );
    }
    timingDrawer.value.open = false;
    ElMessage.success('行程時間已更新');
  } catch (error) {
    ElMessage.error(`時間更新失敗：${error.message}`);
  } finally {
    timingDrawer.value.isSaving = false;
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
      class="itinerary-day-glass fixed top-[calc(8px_+_env(safe-area-inset-top))] left-1/2 z-30 w-[calc(100%_-_32px)] max-w-[416px] -translate-x-1/2 px-4 rounded-[20px] bg-white border border-[#dfeae5] shadow-[0_10px_30px_rgba(20,70,70,.12)]"
      @touchstart.stop
      @touchend.stop
    >
      <el-tabs
        ref="dayTabsRef"
        v-model="activeDay"
        class="custom-tabs"
        :class="{ 'custom-tabs--compact': days <= 5 }"
      >
        <el-tab-pane
          :label="`D${day}`"
          :name="day"
          v-for="day in days"
          :key="day"
        />
      </el-tabs>
    </div>
    <Transition name="travel-day" mode="out-in">
      <div :key="activeDay">
        <section
          class="day-cover relative isolate overflow-hidden bg-[#136a70]"
          :class="{ 'day-cover--empty': !dayHero }"
        >
          <h1 class="sr-only">
            {{
              tripStore.currentTrip?.title ||
              tripStore.currentTrip?.name ||
              '旅程行事曆'
            }}
            · 第 {{ activeDay }} 天行程
          </h1>
          <img
            v-if="dayHero && !heroImageFailed"
            :src="dayHero.cover"
            :alt="dayHero.location || '當日旅程照片'"
            class="absolute inset-0 h-full w-full object-cover object-[center_58%]"
            @error="heroImageFailed = true"
          />
          <div
            class="absolute inset-0 bg-gradient-to-b from-[#102e35]/35 via-transparent to-[#102e35]/85"
            aria-hidden="true"
          ></div>
          <div
            v-if="dayHero"
            class="absolute bottom-12 left-6 right-6 text-white"
          >
            <p
              class="truncate text-[24px] font-black leading-tight tracking-tight"
            >
              {{ dayHero.location }}
            </p>
          </div>
        </section>
        <div
          class="day-list relative z-10 -mx-4 -mt-6 space-y-5 rounded-t-[28px] bg-[var(--travel-paper)] px-4 pt-7"
        >
          <DataStatusNotice
            :loading="travelStore.isLoading"
            :stale="travelStore.isStale"
            :error="travelStore.loadError"
            @retry="travelStore.init({ force: true })"
          />
          <ItineraryCard
            v-for="(item, idx) in itinerary"
            :key="item.id"
            :item="item"
            :parent-item="
              item.parentId ? itineraryById.get(item.parentId) : null
            "
            :isNow="item.id === travelStore.currentActivity?.id"
            :isNext="item.id === travelStore.nextActivity?.id"
            :isLast="idx === itinerary.length - 1"
            :featured="false"
            :can-manage-timing="userStore.canManageCurrentTripTiming"
            @adjust-timing="openTimingAdjustment"
          />
          <div
            v-if="
              itinerary.length === 0 &&
              !travelStore.isLoading &&
              !travelStore.loadError
            "
            class="text-center py-20 text-slate-400 italic"
          >
            本日無行程，享受悠閒時光吧！
          </div>
        </div>
      </div>
    </Transition>

    <ItineraryTimingDrawer
      v-model:open="timingDrawer.open"
      :item="timingDrawer.item"
      :mode="timingDrawer.mode"
      :is-saving="timingDrawer.isSaving"
      @save="saveTimingAdjustment"
    />
  </div>
</template>

<style>
.itinerary-day-glass {
  position: fixed;
}

.itinerary-day-glass .custom-tabs {
  position: relative;
  z-index: 2;
}

/* 1. 基礎樣式 (保留你原本的邏輯並優化) */
.custom-tabs .el-tabs__item {
  min-height: 48px;
  font-weight: bold;
  flex: 0 0 20%;
  min-width: 20%;
  padding: 0;
  text-align: center;
  transition: transform 0.1s ease; /* 加入輕微的縮放動畫 */
  -webkit-tap-highlight-color: transparent; /* 移除手機預設點擊藍框 */
  color: #6f8585;
  text-shadow: none;
}

.custom-tabs .el-tabs__nav {
  width: max-content;
  min-width: 100%;
  display: flex;
}

.custom-tabs--compact .el-tabs__nav {
  width: 100%;
}

.custom-tabs--compact .el-tabs__item {
  flex: 1 1 0;
  min-width: 0;
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
  background-color: var(--travel-coral);
  height: 3px;
  border-radius: 3px;
  box-shadow: none;
}

.custom-tabs .el-tabs__item.is-active {
  color: var(--travel-teal) !important;
  text-shadow: none;
}

/* --- 核心優化：解決手機點擊問題 --- */

/* 3. 解決手機 Hover 殘留：僅在支援懸停的裝置上觸發 hover */
@media (hover: hover) {
  .custom-tabs .el-tabs__item:hover {
    color: var(--travel-teal);
  }
}

/* 4. 增加點擊觸感：手指按下去時有縮小回饋 */
.custom-tabs .el-tabs__item:active {
  transform: scale(0.97); /* 按下去微縮，讓使用者知道「有按到」 */
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
.day-cover {
  height: clamp(360px, 46dvh, 430px);
  margin: calc(-8px - env(safe-area-inset-top)) -16px 0;
}
.day-cover--empty {
  height: clamp(160px, 25dvh, 240px);
}
.travel-day-enter-active,
.travel-day-leave-active {
  transition: opacity 220ms ease;
}
.travel-day-enter-from {
  opacity: 0;
}
.travel-day-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .custom-tabs .el-tabs__item,
  .custom-tabs .el-tabs__active-bar {
    transition: none !important;
  }
  .travel-day-enter-active,
  .travel-day-leave-active {
    transition: none !important;
  }
}
</style>
