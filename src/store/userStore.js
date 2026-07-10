import { defineStore } from 'pinia';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { useParticipantsStore } from '@/store/participantsStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useTravelStore } from '@/store/travelStore';
import { useTripStore } from '@/store/tripStore';
import app from '@/firebase/index.js';
import { getCurrentTripId, setCurrentTripId } from '@/api/trips';
import { getParticipantsByUid } from '@/api/participants';

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    isAuthReady: false,
    googleAdmin: false,
    googleSuperAdmin: false,
    localParticipantId:
      localStorage.getItem(`claimedParticipantId_${getCurrentTripId()}`) ||
      localStorage.getItem('claimedParticipantId') ||
      null,
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
        (state.user && participant?.isSuperAdmin) ||
        state.googleSuperAdmin ||
        ['nJ4o0KAJUhdZ9eIYXSapIMfe74z2'].includes(state.user?.uid) ||
        false
      );
    },

    isAdmin: (state) => {
      const participant = useUserStore().myParticipant;
      return (
        (state.user && (participant?.isSuperAdmin || participant?.isAdmin)) ||
        state.googleSuperAdmin ||
        state.googleAdmin ||
        false
      );
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

    async refreshGoogleAdminAccess() {
      if (!this.user?.uid) {
        this.googleAdmin = false;
        this.googleSuperAdmin = false;
        return;
      }

      const memberships = await getParticipantsByUid(this.user.uid);
      this.googleSuperAdmin = memberships.some(
        (membership) => membership.isSuperAdmin
      );
      this.googleAdmin =
        this.googleSuperAdmin ||
        memberships.some((membership) => membership.isAdmin);
    },

    setLocalParticipant(id) {
      const tripId = getCurrentTripId();
      this.localParticipantId = id;
      if (tripId) {
        localStorage.setItem(`claimedParticipantId_${tripId}`, id);
      }
      localStorage.setItem('claimedParticipantId', id);
    },

    clearLocalParticipant() {
      const tripId = getCurrentTripId();
      this.localParticipantId = null;
      if (tripId) localStorage.removeItem(`claimedParticipantId_${tripId}`);
      localStorage.removeItem('claimedParticipantId');
    },

    async logout() {
      const auth = getAuth(app);
      await signOut(auth);
      this.user = null;
      this.googleAdmin = false;
      this.googleSuperAdmin = false;
      this.localParticipantId = null;
      const tripId = getCurrentTripId();
      if (tripId) localStorage.removeItem(`claimedParticipantId_${tripId}`);
      localStorage.removeItem('claimedParticipantId');
      setCurrentTripId('');
      Object.keys(localStorage)
        .filter(
          (key) =>
            key.startsWith('guidebook_') ||
            key.startsWith('claimedParticipantId_')
        )
        .forEach((key) => localStorage.removeItem(key));
      useTripStore().clearCurrentTrip();
      useTravelStore().clear();
      useExpensesStore().clear();
      useParticipantsStore().clear();
    },
  },
});
