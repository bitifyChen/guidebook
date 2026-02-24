import { defineStore } from 'pinia';
import { getWallet } from '@/api/wallet';

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    expenses: [],
    isLoading: false,
  }),

  getters: {
    // 移除所有類型定義
    totalSpent: (state) =>
      state.expenses.reduce((acc, exp) => acc + exp.amount, 0),
  },

  actions: {
    // --- 核心：從 Firebase 初始化資料 ---
    async init() {
      this.isLoading = true;
      try {
        const res = await getWallet();

        if (res.status === 200) {
          this.expenses = res.data;
        }
      } catch (error) {
        console.error('初始化失敗:', error);
      } finally {
        this.isLoading = false;
      }
    },
  },
});
