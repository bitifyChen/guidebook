<script setup>
import { onMounted, onUnmounted, computed, watch } from 'vue';
import { useTravelStore } from '@/store/travelStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { useUserStore } from '@/store/userStore';
import { useTripStore } from '@/store/tripStore';
import IOSInstallPrompt from '@/components/IOSInstallPrompt.vue';
import dayjs from 'dayjs';

import { useRoute } from 'vue-router';
import DefaultLayout from './layouts/default.vue';
import EmptyLayout from './layouts/empty.vue';
import AdminLayout from './layouts/admin.vue';

const route = useRoute();

const currentLayout = computed(() => {
  const layout = route.meta.layout || 'default'; // Default to 'default' if not specified
  switch (layout) {
    case 'default':
      return DefaultLayout;
    case 'empty':
      return EmptyLayout;
    case 'admin':
      return AdminLayout;
    default:
      return DefaultLayout; // Fallback to default layout
  }
});

const travelStore = useTravelStore();
const expensesStore = useExpensesStore();
const participantsStore = useParticipantsStore();
const userStore = useUserStore();
const tripStore = useTripStore();
let hasInitializedFrontendStores = false;
let manifestObjectUrl = '';

let timer = null;
const isAdminLayout = computed(() => route.meta.layout === 'admin');

const initFrontendStores = () => {
  if (isAdminLayout.value || hasInitializedFrontendStores) return;
  hasInitializedFrontendStores = true;
  travelStore.init();
  expensesStore.init();
  participantsStore.init();
};

const updateAppIdentity = () => {
  const appName = tripStore.currentTrip?.title || 'Guidebook';
  document.title = appName;

  const manifest = {
    name: appName,
    short_name: appName.slice(0, 12),
    description: `${appName} 旅程手冊`,
    start_url: '/guidebook/',
    scope: '/guidebook/',
    display: 'standalone',
    theme_color: '#FF8C00',
    background_color: '#FF8C00',
    icons: [
      { src: '/guidebook/192.png', sizes: '192x192', type: 'image/png' },
      { src: '/guidebook/512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
  const nextUrl = URL.createObjectURL(
    new Blob([JSON.stringify(manifest)], {
      type: 'application/manifest+json',
    })
  );
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  link.href = nextUrl;
  if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
  manifestObjectUrl = nextUrl;
};

onMounted(async () => {
  await tripStore.init();
  updateAppIdentity();
  initFrontendStores();

  // 每 30 秒更新一次全域時間
  timer = setInterval(() => {
    travelStore.setNow(dayjs());
  }, 30000);
});

watch(
  () => route.meta.layout,
  () => initFrontendStores()
);

watch(
  () => tripStore.currentTrip?.title,
  () => updateAppIdentity()
);

onUnmounted(() => {
  clearInterval(timer);
  if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
});
</script>

<template>
  <component :is="currentLayout">
    <router-view />
  </component>
  <IOSInstallPrompt v-if="!isAdminLayout" />
</template>

<style>
html,
body {
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}
</style>
