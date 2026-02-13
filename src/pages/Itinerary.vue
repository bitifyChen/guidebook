<script setup>
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import ItineraryCard from '@/components/ItineraryCard.vue';
import { useTravelStore } from '@/store/travelStore';

const store = useTravelStore();
const activeDay = ref(1);
const days = ref(5);
watch(activeDay, (val) => {
  store.selectedDay = parseInt(val);
});
</script>

<template>
  <div>
    <div
      class="sticky top-[8px] z-30 bg-slate-900/90 backdrop-blur-md px-4 shadow-sm rounded-[28px]"
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
        v-for="(item, idx) in store.dailyItinerary"
        :key="item.id"
        :item="item"
        :isLast="idx === store.dailyItinerary.length - 1"
      />
      <div
        v-if="store.dailyItinerary.length === 0"
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

/* 3. 解決手機 Hover 殘留：當設備不支援懸停時，移除 hover 樣式 */
@media (hover: none) {
  .custom-tabs .el-tabs__item:hover {
    color: inherit; /* 手機上不觸發懸停變色 */
  }
}

/* 4. 增加點擊觸感：手指按下去時有縮小回饋 */
.custom-tabs .el-tabs__item:active {
  transform: scale(0.9); /* 按下去微縮，讓使用者知道「有按到」 */
  opacity: 0.7;
}

/* 5. 介面優化：移除 Tab 下方的長灰線，讓風格更現代 */
.custom-tabs .el-tabs__nav-wrap::after {
  display: none;
}
.custom-tabs .el-tabs__header {
  margin-bottom: 0px;
}
</style>
