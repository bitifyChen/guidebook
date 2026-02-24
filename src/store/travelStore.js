import { defineStore } from 'pinia';
import { getItinerary, getDayConfigs } from '@/api/itinerary';

export const useTravelStore = defineStore('travel', {
  state: () => ({
    // 初始化為空，等待 init 填充
    config: [],
    itinerary: [],
    selectedDay: 1,
    isLoading: false,
  }),

  getters: {
    // 取得當前選擇日期的配置 (包含當天起始時間)
    currentDayConfig: (state) => {
      if (state.config.length === 0)
        return { day: state.selectedDay, start: '09:00' };
      return (
        state.config.find((c) => c.day === state.selectedDay) || state.config[0]
      );
    },

    // 核心邏輯：計算動態時間鏈 (邏輯不變，增加空資料判斷)
    dailyItinerary: (state) => {
      const dayConfig = state.config.find((c) => c.day === state.selectedDay);
      if (!dayConfig || state.itinerary.length === 0) return [];

      // 1. 取得起始時間種子 (例如 "07:00")
      let [hours, minutes] = dayConfig.start.split(':').map(Number);
      let rollingMinutes = hours * 60 + minutes;

      // 2. 排序當天原始資料
      const rawDayItems = state.itinerary
        .filter((item) => item.day === state.selectedDay)
        .sort((a, b) => a.order - b.order);

      // 3. 開始累加計算
      return rawDayItems.map((item) => {
        const startH = Math.floor(rollingMinutes / 60);
        const startM = rollingMinutes % 60;
        const computedStartTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

        const totalStay = (item.duration || 0) + (item.delay || 0);
        rollingMinutes += totalStay;

        const endH = Math.floor(rollingMinutes / 60);
        const endM = rollingMinutes % 60;
        const computedEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        rollingMinutes += item.nextDrive?.time || 0;

        return {
          ...item,
          startTime: computedStartTime,
          endTime: computedEndTime,
        };
      });
    },

    totalDays: (state) => state.config.length || 5,
  },

  actions: {
    // --- 核心：從 Firebase 初始化資料 ---
    async init() {
      this.isLoading = true;
      try {
        // 同時抓取景點和配置
        const [itineraryRes, configRes] = await Promise.all([
          getItinerary(),
          getDayConfigs(),
        ]);

        if (itineraryRes.status === 200) {
          this.itinerary = itineraryRes.data;
        }

        if (configRes.status === 200) {
          // 因為 getDayConfigs 回傳的是陣列，我們要找到 ID 為 'dayConfigs' 的那一個
          const target = configRes.data.find((doc) => doc.id === 'dayConfigs');
          if (target && target.list) {
            this.config = target.list;
          }
        }
      } catch (error) {
        console.error('初始化失敗:', error);
      } finally {
        this.isLoading = false;
      }
    },

    setSelectedDay(day) {
      this.selectedDay = day;
    },

    // 更新本地 state (當 Admin 修改成功後，可以手動更新 store 避免重新 fetch)
    updateLocalItem(itemId, params) {
      const index = this.itinerary.findIndex((item) => item.id === itemId);
      if (index !== -1) {
        this.itinerary[index] = { ...this.itinerary[index], ...params };
      }
    },

    updateLocalConfig(day, newStart) {
      const index = this.config.findIndex((c) => c.day === day);
      if (index !== -1) {
        this.config[index].start = newStart;
      }
    },
  },
});
