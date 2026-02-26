import { defineStore } from 'pinia';
import { getWallet, getWalletVersion } from '@/api/wallet';

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    expenses: [],
    isLoading: false,
  }),

  getters: {
    totalSpent: (state) =>
      state.expenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0),
  },

  actions: {
    // --- 核心：從 Firebase 初始化資料 ---
    async init() {
      const CACHE_KEY = 'jeju_wallet_cache';

      // 1. 先抓取本地快取並立即呈現 (Stale-while-revalidate)
      let localCache = null;
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          localCache = JSON.parse(raw);
          this.expenses = localCache.expenses;
        }
      } catch (e) {
        console.warn('Wallet cache load failed', e);
      }

      try {
        // 2. 抓取遠端版本號 (極小請求)
        const remoteMeta = await getWalletVersion();

        // 3. 如果版本一致且已有資料，就不再抓取大宗資料
        if (localCache && localCache.timestamp === remoteMeta.lastUpdate) {
          console.log('Using wallet cache (version match)');
          return;
        }

        // 4. 版本不一致或無快取，才抓取大宗資料
        this.isLoading = true;
        const res = await getWallet();

        if (res.status === 200) {
          this.expenses = res.data;
        }

        // 5. 更新快取
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            expenses: this.expenses,
            timestamp: remoteMeta.lastUpdate,
          })
        );
        console.log('Wallet data updated to version:', remoteMeta.lastUpdate);
      } catch (error) {
        console.error('Wallet 初始化失敗:', error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
