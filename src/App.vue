<script setup>
import { onMounted, onUnmounted, computed, ref, watch } from 'vue';
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
import { setupItinerarySyncSignals } from '@/utils/itinerarySyncSignal';
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue';
import { startPwaUpdateChecks } from '@/services/pwaUpdate';

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
let cleanupItinerarySyncSignals = () => {};
let cleanupPwaUpdateChecks = () => {};

let timer = null;
const isAppBooting = ref(true);
const isAdminLayout = computed(() => route.meta.layout === 'admin');
const shouldShowAppBoot = computed(
  () => isAppBooting.value && !isAdminLayout.value
);

const initFrontendStores = () => {
  if (isAdminLayout.value || hasInitializedFrontendStores) return;
  hasInitializedFrontendStores = true;
  travelStore.init();
  expensesStore.init();
  participantsStore.init();
};

const updateAppIdentity = () => {
  const appName = tripStore.currentTrip?.title || 'Guidebook';
  const startUrl = tripStore.currentTrip ? '/' : '/settings';
  document.title = appName;
  const appleTitle = document.querySelector(
    'meta[name="apple-mobile-web-app-title"]'
  );
  if (appleTitle) appleTitle.setAttribute('content', appName);

  const manifest = {
    name: appName,
    short_name: appName.slice(0, 12),
    description: `${appName} 旅程手冊`,
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    theme_color: '#136A70',
    background_color: '#136A70',
    icons: [
      { src: '/192.png', sizes: '192x192', type: 'image/png' },
      { src: '/512.png', sizes: '512x512', type: 'image/png' },
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
  try {
    await tripStore.init();
    updateAppIdentity();
    initFrontendStores();
    cleanupItinerarySyncSignals = await setupItinerarySyncSignals({
      travelStore,
      tripStore,
    });
  } finally {
    isAppBooting.value = false;
  }
  cleanupPwaUpdateChecks = startPwaUpdateChecks();

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
  cleanupItinerarySyncSignals();
  cleanupPwaUpdateChecks();
  if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
});
</script>

<template>
  <component :is="currentLayout">
    <router-view />
  </component>
  <IOSInstallPrompt v-if="!isAdminLayout" />
  <PwaUpdatePrompt />
  <Transition name="boot-fade">
    <div
      v-if="shouldShowAppBoot"
      class="app-loading-screen"
      role="status"
      aria-label="正在載入旅程"
    >
      <div class="app-loading-card">
        <div class="app-loading-spinner" aria-hidden="true"></div>
        <div class="app-loading-text">正在準備旅程</div>
      </div>
    </div>
  </Transition>
</template>

<style>
html,
body {
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}

.app-loading-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #136a70;
  color: #fff;
}

.app-loading-card {
  width: min(280px, calc(100vw - 48px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  text-align: center;
}

.app-loading-text {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: rgba(255, 255, 255, 0.84);
}

.app-loading-spinner {
  width: 48px;
  height: 48px;
  border: 2px solid rgba(255, 255, 255, 0.24);
  border-top-color: #fff;
  border-radius: 999px;
  animation: app-loading-spin 1s linear infinite;
}

.boot-fade-leave-active {
  transition: opacity 0.2s ease;
}

.boot-fade-leave-to {
  opacity: 0;
}

@keyframes app-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .app-loading-spinner {
    animation: none;
  }
}
</style>
