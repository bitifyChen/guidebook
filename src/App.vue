<script setup>
import { onMounted, onUnmounted, computed } from 'vue';
import { useTravelStore } from '@/store/travelStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { useUserStore } from '@/store/userStore';
import dayjs from 'dayjs';

import { useRoute } from 'vue-router';
import DefaultLayout from './layouts/default.vue';
import EmptyLayout from './layouts/empty.vue';

const route = useRoute();

const currentLayout = computed(() => {
  const layout = route.meta.layout || 'default'; // Default to 'default' if not specified
  switch (layout) {
    case 'default':
      return DefaultLayout;
    case 'empty':
      return EmptyLayout;
    default:
      return DefaultLayout; // Fallback to default layout
  }
});

const travelStore = useTravelStore();
const expensesStore = useExpensesStore();
const participantsStore = useParticipantsStore();
const userStore = useUserStore();

let timer = null;
onMounted(async () => {
  travelStore.init();
  expensesStore.init();
  participantsStore.init();

  // 每 30 秒更新一次全域時間
  timer = setInterval(() => {
    travelStore.setNow(dayjs());
  }, 30000);
});
onUnmounted(() => {
  clearInterval(timer);
});
</script>

<template>
  <component :is="currentLayout">
    <router-view />
  </component>
</template>

<style>
html,
body {
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}
</style>
