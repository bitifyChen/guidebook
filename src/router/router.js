import { createRouter, createWebHistory } from 'vue-router';
import generatedRoutes from 'virtual:generated-pages';

const routes = generatedRoutes;
const router = createRouter({
  history: createWebHistory('/guidebook/'),
  routes,
});

import { useUserStore } from '@/store/userStore';
import { useParticipantsStore } from '@/store/participantsStore';

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();
  const participantsStore = useParticipantsStore();

  // 2. 確保旅客資料已載入 (權限判斷依賴此資料)
  if (participantsStore.participants.length === 0) {
    await participantsStore.init();
  }

  // 3. 檢查權限 (以 /admin 開頭的路由)
  if (to.path.startsWith('/admin')) {
    // 1. 確保 Firebase Auth 已就緒 (F5 重新整理時必備)
    if (!userStore.isAuthReady) {
      await userStore.initAuth();
    }
    // 排除登入頁
    if (to.path === '/admin/login') {
      return next();
    }

    // 檢查是否具備 Admin 或 SuperAdmin 權限
    if (userStore.isAdmin || userStore.isSuperAdmin) {
      next();
    } else {
      next({ path: '/Settings' });
    }
  } else {
    next();
  }
});

export default router;
