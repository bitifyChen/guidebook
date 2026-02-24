import { createRouter, createWebHistory } from 'vue-router';
import generatedRoutes from 'virtual:generated-pages';

const routes = generatedRoutes;
const router = createRouter({
  history: createWebHistory(),
  routes,
});

import { useUserStore } from '@/store/userStore';

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();

  // 如果還沒初始化過 Auth 狀態，先跑一次 init
  if (!userStore.isAuthReady) {
    await userStore.initAuth();
  }

  if (to.path === '/admin') {
    if (userStore.isAdmin) {
      next();
    } else {
      next({ name: 'AdminLoginPage' }); // 或跳到登入頁
    }
  } else {
    next();
  }
});

export default router;
