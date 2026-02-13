import { defineStore } from 'pinia';
import itineraryData from '@/data/itinerary.json';
import itineraryConfig from '@/data/itineraryConfig.json';

export const useTravelStore = defineStore('travel', {
  state: () => ({
    // 這裡未來會對接 Firebase
    config: itineraryConfig,
    itinerary: itineraryData,
    selectedDay: 1,
  }),

  getters: {
    // 取得當前選擇日期的配置 (包含當天起始時間)
    currentDayConfig: (state) =>
      state.config.find((c) => c.day === state.selectedDay) || state.config[0],

    // 核心邏輯：計算動態時間鏈
    dailyItinerary: (state) => {
      const dayConfig = state.config.find((c) => c.day === state.selectedDay);
      if (!dayConfig) return [];

      // 1. 取得起始時間種子 (例如 "07:00")
      let [hours, minutes] = dayConfig.start.split(':').map(Number);
      let rollingMinutes = hours * 60 + minutes;

      // 2. 排序當天原始資料
      const rawDayItems = state.itinerary
        .filter((item) => item.day === state.selectedDay)
        .sort((a, b) => a.order - b.order);

      // 3. 開始累加計算
      return rawDayItems.map((item) => {
        // --- 計算抵達/開始時間 ---
        const startH = Math.floor(rollingMinutes / 60);
        const startM = rollingMinutes % 60;
        const computedStartTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

        // --- 計算在該點結束時間 (開始 + 停留 + 延遲) ---
        const totalStay = (item.duration || 0) + (item.delay || 0);
        rollingMinutes += totalStay;

        const endH = Math.floor(rollingMinutes / 60);
        const endM = rollingMinutes % 60;
        const computedEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        // --- 為下一站做準備 (加上車程時間) ---
        rollingMinutes += item.nextDrive?.time || 0;

        // 回傳帶有計算後時間的物件
        return {
          ...item,
          startTime: computedStartTime,
          endTime: computedEndTime,
        };
      });
    },

    totalDays: (state) => state.config.length,
  },

  actions: {
    setSelectedDay(day) {
      this.selectedDay = day;
    },

    // Admin Page 會用到的：更新特定行程的延遲時間
    updateDelay(itemId, newDelay) {
      const index = this.itinerary.findIndex((item) => item.id === itemId);
      if (index !== -1) {
        this.itinerary[index].delay = newDelay;
      }
    },

    // 這裡未來改為從 Firebase 獲取最新資料
    setItinerary(newData) {
      this.itinerary = newData;
    },

    setConfig(newConfig) {
      this.config = newConfig;
    },
  },
});
