import { defineStore } from 'pinia';
import { getItinerary, getDayConfigs, getGlobalVersion } from '@/api/itinerary';
import dayjs from 'dayjs';
export const useTravelStore = defineStore('travel', {
  state: () => ({
    config: [],
    itinerary: [],
    selectedDay: 1,
    isLoading: false,
    now: dayjs(),
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
    //行程列表-全部
    allItinerary: (state) => {
      return state.config.map(({ day }) => state.getDayItinerary(day)).flat();
    },
    //行程列表-當天
    dailyItinerary: (state) => {
      const dayConfig = state.config.find((c) => c.day === state.selectedDay);
      if (!dayConfig || state.itinerary.length === 0) return [];
      return state.getDayItinerary(state.selectedDay);
    },
    //行程日期-當天
    currentDay: (state) => {
      const today = dayjs().format('YYYY/MM/DD');
      const configForToday = state.config.find((c) => c.date === today);
      return configForToday ? configForToday.day : 1;
    },
    //行程日期-總天數
    totalDays: (state) => state.config.length || 5,
    //行程-目前行程
    currentActivity: (state) => {
      const now = state.now;
      return state.allItinerary.find((item) => {
        const start = dayjs(item.startTime, 'HH:mm');
        const end = dayjs(item.endTime, 'HH:mm');
        return (
          item.day === state.currentDay &&
          now.isAfter(start) &&
          now.isBefore(end)
        );
      });
    },
    //行程-下一個行程
    nextActivity: (state) => {
      const now = state.now;
      return state.allItinerary.find(
        (item) =>
          item.day === state.currentDay &&
          dayjs(item.startTime, 'HH:mm').isAfter(now)
      );
    },
  },

  actions: {
    // --- 核心：從 Firebase 初始化資料 ---
    async init() {
      const CACHE_KEY = 'jeju_travel_cache';
      
      // 1. 先抓取本地快取並立即呈現 (Stale-while-revalidate)
      let localCache = null;
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          localCache = JSON.parse(raw);
          this.itinerary = localCache.itinerary;
          this.config = localCache.config;
          this.selectedDay = this.currentDay;
        }
      } catch (e) {
        console.warn('Cache load failed', e);
      }

      try {
        // 2. 抓取遠端版本號 (極小請求)
        const remoteMeta = await getGlobalVersion();
        
        // 3. 如果版本一致且已有資料，就不再抓取大宗資料
        if (localCache && localCache.timestamp === remoteMeta.lastUpdate) {
          console.log('Using travel cache (version match)');
          return;
        }

        // 4. 版本不一致或無快取，才抓取大宗資料
        this.isLoading = true;
        const [itineraryRes, configRes] = await Promise.all([
          getItinerary(),
          getDayConfigs(),
        ]);

        if (itineraryRes.status === 200) {
          this.itinerary = itineraryRes.data;
        }

        if (configRes.status === 200) {
          const target = configRes.data.find((doc) => doc.id === 'dayConfigs');
          if (target && target.list) {
            this.config = target.list;
            this.selectedDay = this.currentDay;
          }
        }

        // 5. 更新快取
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          itinerary: this.itinerary,
          config: this.config,
          timestamp: remoteMeta.lastUpdate
        }));
        console.log('Travel data updated to version:', remoteMeta.lastUpdate);
      } catch (error) {
        console.error('初始化失敗:', error);
      } finally {
        this.isLoading = false;
      }
    },

    setSelectedDay(day) {
      this.selectedDay = day;
    },
    setNow(time) {
      this.now = time;
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

    //取得該日行程
    getDayItinerary(day) {
      const dayConfig = this.config.find((c) => c.day === day);
      if (!dayConfig || this.itinerary.length === 0) return [];

      // 1. 取得起始時間種子 (例如 "07:00")
      let [hours, minutes] = dayConfig.start.split(':').map(Number);
      let rollingMinutes = hours * 60 + minutes;

      // 2. 排序當天原始資料
      const rawDayItems = this.itinerary
        .filter((item) => item.day === day)
        .sort((a, b) => a.order - b.order);

      // 3. 開始累加計算
      return rawDayItems
        .map((item) => {
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
        })
        .sort((a, b) => {
          return dayjs(a.startTime, 'HH:mm').diff(dayjs(b.startTime, 'HH:mm'));
        });
    },
  },
});
