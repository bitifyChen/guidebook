import { defineStore } from 'pinia';
import { getWallet, getWalletVersion } from '@/api/wallet';
import { useTripStore } from '@/store/tripStore';

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    expenses: [],
    isLoading: false,
    loadError: '',
    isStale: false,
    requestId: 0,
    loadedTripId: '',
  }),

  getters: {
    totalSpent: (state) =>
      state.expenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0),
  },

  actions: {
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
        if (!tripId || tripStore.isPublicTrip) {
          this.clear();
          return;
        }
        if (this.loadedTripId !== tripId) {
          this.expenses = [];

          this.loadedTripId = tripId;
          this.isStale = false;
        }
        const key = 'guidebook_' + tripId + '_wallet_cache';
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || 'null');
          if (Array.isArray(parsed?.expenses)) {
            localCache = parsed;
            this.expenses = parsed.expenses;

            this.isStale = true;
          }
        } catch {
          /* A damaged cache must not prevent a network retry. */
        }
        const meta = await getWalletVersion();
        if (requestId !== this.requestId || tripId !== tripStore.currentTripId)
          return;
        if (meta.unavailable) throw new Error('version unavailable');
        if (
          options.force ||
          !localCache ||
          localCache.timestamp !== meta.lastUpdate
        ) {
          const res = await getWallet();
          if (
            requestId !== this.requestId ||
            tripId !== tripStore.currentTripId
          )
            return;
          if (res.status !== 200 || !Array.isArray(res.data))
            throw new Error('invalid response');
          this.expenses = res.data.sort(
            (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
          );
          try {
            localStorage.setItem(
              key,
              JSON.stringify({
                expenses: this.expenses,
                timestamp: meta.lastUpdate,
              })
            );
          } catch {
            /* Fresh data remains usable when device storage is full. */
          }
        }
        this.isStale = Boolean(meta.fromCache);
      } catch (error) {
        if (
          requestId !== this.requestId ||
          (tripId && tripId !== tripStore.currentTripId)
        )
          return;
        this.isStale = Boolean(localCache || this.expenses.length);
        this.loadError = this.isStale
          ? '開支更新失敗，目前顯示上次資料。請確認連線後重試。'
          : '開支載入失敗，請確認連線後重試。';
      } finally {
        if (requestId === this.requestId) this.isLoading = false;
      }
    },
    clear() {
      this.requestId++;
      this.loadedTripId = '';
      this.isLoading = false;
      this.loadError = '';
      this.isStale = false;
      this.expenses = [];
    },
  },
});
