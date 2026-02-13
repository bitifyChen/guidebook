import { createRouter, createWebHistory } from 'vue-router'
import generatedRoutes from 'virtual:generated-pages'

const routes = generatedRoutes
const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
