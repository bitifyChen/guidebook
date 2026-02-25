import { defineStore } from 'pinia';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { useParticipantsStore } from '@/store/participantsStore';
import app from '@/firebase/index.js';

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    isAuthReady: false,
    localParticipantId: localStorage.getItem('claimedParticipantId') || null,
  }),

  getters: {
    // 取得目前旅客個人資料 (優先順序：Firebase UID > 本地認領 ID)
    myParticipant: (state) => {
      const participantsStore = useParticipantsStore();
      if (state.user) {
        return participantsStore.participants.find(
          (p) => p.uid === state.user.uid
        );
      }
      if (state.localParticipantId) {
        return participantsStore.participants.find(
          (p) => p.id === state.localParticipantId
        );
      }
      return null;
    },

    isSuperAdmin: (state) => {
      // 透過 getter 存取另一個 getter
      const participant = useUserStore().myParticipant;
      return (
        participant?.isSuperAdmin ||
        ['nJ4o0KAJUhdZ9eIYXSapIMfe74z2'].includes(state.user?.uid) ||
        false
      );
    },

    isAdmin: (state) => {
      const participant = useUserStore().myParticipant;
      return participant?.isSuperAdmin || participant?.isAdmin || false;
    },
  },

  actions: {
    // 初始化監聽登入狀態
    initAuth() {
      const auth = getAuth(app);
      return new Promise((resolve) => {
        onAuthStateChanged(auth, (firebaseUser) => {
          this.user = firebaseUser;
          this.isAuthReady = true;
          resolve(firebaseUser);
        });
      });
    },

    setLocalParticipant(id) {
      this.localParticipantId = id;
      localStorage.setItem('claimedParticipantId', id);
    },

    async logout() {
      const auth = getAuth(app);
      await signOut(auth);
      this.user = null;
      this.localParticipantId = null;
      localStorage.removeItem('claimedParticipantId');
    },
  },
});
