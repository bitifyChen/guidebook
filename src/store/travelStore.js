import { defineStore } from 'pinia';
import { getItinerary, getDayConfigs, getGlobalVersion } from '@/api/itinerary';
import { useTripStore } from '@/store/tripStore';
import { calculateDayItinerary } from '@/utils/itinerarySchedule';
import dayjs from 'dayjs';
export const useTravelStore = defineStore('travel', {
  state: () => ({
    config: [],
    itinerary: [],
    selectedDay: 1,
    isLoading: false,
    loadError: '',
    isStale: false,
    requestId: 0,
    loadedTripId: '',
    now: dayjs(),
    imageStatus: {}, // { [itemId]: 'ok' | 'error' | 'loading' }
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
      const tripStore = useTripStore();
      if (tripStore.isTimeLocked) return null;
      const today = dayjs().format('YYYY/MM/DD');
      const configForToday = state.config.find((c) => c.date === today);
      return configForToday ? configForToday.day : null;
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
          (now.isAfter(start) || now.isSame(start)) &&
          now.isBefore(end)
        );
      });
    },
    //行程-目前行程子項目
    currentSubActivity: (state) => {
      const current = state.currentActivity;
      if (!current) return [];
      return state.allItinerary.filter((item) => item.parentId === current.id);
    },
    //行程-交通中
    currentTransit: (state) => {
      const now = state.now;
      return state.allItinerary.find((item) => {
        const end = dayjs(item.endTime, 'HH:mm');
        const transitEnd = end.add(item.nextDrive?.time || 0, 'minute');
        // 只有非子景點（或群組最後一個）才會有交通時間
        return (
          item.day === state.currentDay &&
          (now.isAfter(end) || now.isSame(end)) &&
          now.isBefore(transitEnd) &&
          item.nextDrive?.time > 0
        );
      });
    },
    //行程-下一個行程
    nextActivity: (state) => {
      const now = state.now;
      const current = state.currentActivity;

      return state.allItinerary.find((item) => {
        if (item.day !== state.currentDay) return false;
        const start = dayjs(item.startTime, 'HH:mm');

        // 如果目前有活動，下一個必須不是目前這個
        if (current && item.id === current.id) return false;
        // 下一個形程不是目前活動的子項目
        if (current && item.parentId === current.id) return false;
        return start.isAfter(now);
      });
    },
    //行程-下一個行程子項目
    nextSubActivity: (state) => {
      const next = state.nextActivity;
      if (!next) return [];
      return state.allItinerary.filter((item) => item.parentId === next.id);
    },
  },

  actions: {
    setImageStatus(itemId, status) {
      this.imageStatus[itemId] = status;
    },
    clearImageStatus() {
      this.imageStatus = {};
    },
    // --- 核心：從 Firebase 初始化資料 ---
    async init(options = {}) {
      const requestId = ++this.requestId;
      const tripStore = useTripStore();
      this.isLoading = true;
      this.loadError = '';
      let localCache = null;
      let tripId = '';
      try {
        if (!tripStore.currentTripId) await tripStore.init();
        if (requestId !== this.requestId) return;
        tripId = tripStore.currentTripId;
        if (!tripId) {
          this.clear();
          return;
        }
        if (this.loadedTripId !== tripId) {
          this.itinerary = [];
          this.config = [];
          this.selectedDay = 1;
          this.loadedTripId = tripId;
          this.isStale = false;
        }
        const key = 'guidebook_' + tripId + '_travel_cache';
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || 'null');
          if (
            Array.isArray(parsed?.itinerary) &&
            Array.isArray(parsed?.config)
          ) {
            localCache = parsed;
            this.itinerary = parsed.itinerary;
            this.config = parsed.config;
            this.isStale = true;
          }
        } catch {
          /* A damaged cache must not prevent a network retry. */
        }
        const meta = await getGlobalVersion();
        if (requestId !== this.requestId || tripId !== tripStore.currentTripId)
          return;
        if (meta.unavailable) throw new Error('version unavailable');
        if (
          options.force ||
          !localCache ||
          localCache.timestamp !== meta.lastUpdate
        ) {
          const [items, configs] = await Promise.all([
            getItinerary(),
            getDayConfigs(),
          ]);
          if (
            requestId !== this.requestId ||
            tripId !== tripStore.currentTripId
          )
            return;
          if (items.status !== 200 || configs.status !== 200)
            throw new Error('invalid response');
          this.itinerary = items.data;
          this.config =
            configs.data.find((doc) => doc.id === 'dayConfigs')?.list || [];
          try {
            localStorage.setItem(
              key,
              JSON.stringify({
                itinerary: this.itinerary,
                config: this.config,
                timestamp: meta.lastUpdate,
              })
            );
          } catch {
            /* Fresh data remains usable when device storage is full. */
          }
        }
        this.isStale = Boolean(meta.fromCache);
        try {
          const saved = Number(
            localStorage.getItem('guidebook_' + tripId + '_selected_day')
          );
          this.selectedDay =
            saved ||
            (tripStore.isTimeLocked ? this.selectedDay : this.currentDay) ||
            this.config[0]?.day ||
            1;
        } catch {
          /* Keep the selected day when storage is unavailable. */
        }
      } catch (error) {
        if (
          requestId !== this.requestId ||
          (tripId && tripId !== tripStore.currentTripId)
        )
          return;
        this.isStale = Boolean(localCache || this.itinerary.length);
        this.loadError = this.isStale
          ? '行程更新失敗，目前顯示上次資料。請確認連線後重試。'
          : '行程載入失敗，請確認連線後重試。';
      } finally {
        if (requestId === this.requestId) this.isLoading = false;
      }
    },
    setSelectedDay(day) {
      this.selectedDay = day;
      const tripStore = useTripStore();
      const cacheScope = tripStore.currentTripId || 'legacy';
      localStorage.setItem(`guidebook_${cacheScope}_selected_day`, String(day));
    },
    clear() {
      this.requestId++;
      this.loadedTripId = '';
      this.isLoading = false;
      this.loadError = '';
      this.isStale = false;
      this.config = [];
      this.itinerary = [];
      this.selectedDay = 1;
      this.imageStatus = {};
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
      const rawDayItems = this.itinerary
        .filter((item) => item.day === day)
        .sort((a, b) => a.order - b.order);
      return calculateDayItinerary(rawDayItems, dayConfig.start);
    },
  },
});
