import { defineStore } from 'pinia';

export const useExpensesStore = defineStore('expenses', {
  state: () => ({
    expenses: [
      {
        id: 'e1770886992337',
        amount: 1222200,
        description: '烤肉',
        payerId: 'p1',
        splitWithIds: ['p1', 'p2', 'p3'],
        date: '2026/2/12',
      },
    ],
  }),

  getters: {
    // 移除所有類型定義
    totalSpent: (state) =>
      state.expenses.reduce((acc, exp) => acc + exp.amount, 0),
  },

  actions: {
    add(expense) {
      this.expenses.unshift({
        ...expense,
      });
    },
    patch(id, updatedData) {
      const index = this.expenses.findIndex((e) => e.id === id);
      if (index !== -1) {
        // 使用解構保留原本的 ID 和日期，只更新內容
        this.expenses[index] = {
          ...this.expenses[index],
          ...updatedData,
        };
      }
    },
    delete(id) {
      this.expenses = this.expenses.filter((e) => e.id !== id);
    },
  },
});
