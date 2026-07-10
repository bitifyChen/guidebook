import { defineStore } from 'pinia';
import { getItinerary, getDayConfigs, getGlobalVersion } from '@/api/itinerary';
import { useTripStore } from '@/store/tripStore';
import dayjs from 'dayjs';
export const useTravelStore = defineStore('travel', {
  state: () => ({
    config: [],
    itinerary: [],
    selectedDay: 1,
    isLoading: false,
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
    async init() {
      const tripStore = useTripStore();
      if (!tripStore.currentTripId) await tripStore.init();
      if (!tripStore.currentTripId) {
        this.itinerary = [];
        this.config = [];
        this.selectedDay = 1;
        return;
      }
      const cacheScope = tripStore.currentTripId || 'legacy';
      const CACHE_KEY = `guidebook_${cacheScope}_travel_cache`;
      const SELECTED_DAY_KEY = `guidebook_${cacheScope}_selected_day`;

      // 1. 先抓取本地快取並立即呈現 (Stale-while-revalidate)
      let localCache = null;
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          localCache = JSON.parse(raw);
          this.itinerary = localCache.itinerary;
          this.config = localCache.config;
          const savedDay = Number(localStorage.getItem(SELECTED_DAY_KEY));
          this.selectedDay =
            savedDay || (tripStore.isTimeLocked ? this.selectedDay : this.currentDay) || 1;
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
            const savedDay = Number(localStorage.getItem(SELECTED_DAY_KEY));
            this.selectedDay =
              savedDay ||
              (tripStore.isTimeLocked ? this.selectedDay : this.currentDay) ||
              this.config[0]?.day ||
              1;
          }
        }

        // 5. 更新快取
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            itinerary: this.itinerary,
            config: this.config,
            timestamp: remoteMeta.lastUpdate,
          })
        );
        console.log('Travel data updated to version:', remoteMeta.lastUpdate);
      } catch (error) {
        console.error('初始化失敗:', error);
      } finally {
        this.isLoading = false;
      }
    },

    setSelectedDay(day) {
      this.selectedDay = day;
      const tripStore = useTripStore();
      const cacheScope = tripStore.currentTripId || 'legacy';
      localStorage.setItem(`guidebook_${cacheScope}_selected_day`, String(day));
    },
    clear() {
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

      // 1. 取得起始時間種子 (例如 "07:00")
      let [hours, minutes] = dayConfig.start.split(':').map(Number);
      let rollingMinutes = hours * 60 + minutes;

      // 2. 排序當天原始資料
      const rawDayItems = this.itinerary
        .filter((item) => item.day === day)
        .sort((a, b) => a.order - b.order);

      // 3. 開始累加計算
      return rawDayItems
        .map((item, index) => {
          const startH = Math.floor(rollingMinutes / 60);
          const startM = rollingMinutes % 60;
          const computedStartTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

          const totalStay = (item.duration || 0) + (item.delay || 0);
          rollingMinutes += totalStay;

          const endH = Math.floor(rollingMinutes / 60);
          const endM = rollingMinutes % 60;
          const computedEndTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

          // --- 車程時間累加邏輯修正 ---
          // 只有當此項目是：
          // 1. 獨立項目 (無 parentId 且 無子項目)
          // 2. 子項目且是該群組最後一個 (後續沒有相同 parentId 的項目)
          const isChild = !!item.parentId;
          const nextItem = rawDayItems[index + 1];
          const hasChildren = rawDayItems.some((i) => i.parentId === item.id);
          const isLastInGroup = isChild
            ? !nextItem || nextItem.parentId !== item.parentId
            : !hasChildren;

          if (isLastInGroup) {
            // 如果是子景點結尾，要用父景點的車程時間
            if (isChild) {
              const parent = rawDayItems.find((i) => i.id === item.parentId);
              rollingMinutes += parent?.nextDrive?.time || 0;
            } else {
              // 獨立景點用自己的
              rollingMinutes += item.nextDrive?.time || 0;
            }
          }

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
