<script setup>
import { onMounted, computed } from 'vue';
import { useTravelStore } from '@/store/travelStore';
import { useExpensesStore } from '@/store/expensesStore';

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

onMounted(() => {
  travelStore.init();
  expensesStore.init();
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
  background: #eef2fa;
}
</style>
