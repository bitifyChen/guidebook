import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import app from '@/firebase/index.js';

export const useUserStore = defineStore('user', () => {
  const auth = getAuth(app);
  const user = ref(null);
  const isAuthReady = ref(false); // 標記 Firebase 是否已完成初始化檢查

  const isAdmin = computed(() => {
    return ['nJ4o0KAJUhdZ9eIYXSapIMfe74z2'].includes(user.value?.uid);
  });

  // 初始化監聽登入狀態
  const initAuth = () => {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (firebaseUser) => {
        user.value = firebaseUser;
        isAuthReady.value = true;
        resolve(firebaseUser);
      });
    });
  };

  const logout = async () => {
    await signOut(auth);
    user.value = null;
  };

  return { user, isAdmin, isAuthReady, initAuth, logout };
});
