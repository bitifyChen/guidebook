import { defineStore } from 'pinia';

export const useParticipantsStore = defineStore('participants', {
  state: () => ({
    participants: [
      { id: 'p1', name: '彰彰' },
      { id: 'p2', name: '純純' },
      { id: 'p3', name: '貢丸' },
      { id: 'p4', name: '本丸' },
      { id: 'p5', name: '如如' },
      { id: 'p6', name: '陳陳' },
    ],
  }),

  getters: {},

  actions: {
    addParticipant(name) {
      this.participants.push({
        id: `p${Date.now()}`,
        name,
      });
    },
    getParticipant(id) {
      return this.participants.find((p) => p.id === id);
    },
    removeParticipant(id) {
      this.participants = this.participants.filter((p) => p.id !== id);
    },
  },
});
