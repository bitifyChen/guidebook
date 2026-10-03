<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  CalendarDays,
  MapPin,
  Wallet,
  Settings,
  RefreshCw,
} from 'lucide-vue-next';
import { useTripStore } from '@/store/tripStore';

const route = useRoute();
const router = useRouter();
const tripStore = useTripStore();
const scrollbarRef = ref(null); // 用於操作捲動條

// 1. 監聽換頁：換頁後回到頂部
watch(
  () => route.path,
  () => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    isNavVisible.value = true; // 換頁時確保導航列是顯示的
  }
);

// 2. 滾動處理：判斷上下滑動來隱藏/顯示導航
const isNavVisible = ref(true);
let lastScrollTop = 0;
let scrollTimer = null; // 用於偵測停頓的定時器

// 下拉刷新邏輯
const pullDistance = ref(0);
const isRefreshing = ref(false);
const pullThreshold = 80;
let touchStartY = 0;

const pullRefreshEnabled = computed(
  () => !route.meta?.fullBleed && route.meta?.disablePullRefresh !== true
);

const handleTouchStart = (e) => {
  if (!pullRefreshEnabled.value) {
    touchStartY = -1;
    pullDistance.value = 0;
    return;
  }
  if (window.scrollY === 0) {
    touchStartY = e.touches[0].pageY;
  } else {
    touchStartY = -1;
  }
};

const handleTouchMove = (e) => {
  if (!pullRefreshEnabled.value || touchStartY === -1 || isRefreshing.value)
    return;

  const touchY = e.touches[0].pageY;
  const diff = touchY - touchStartY;

  // 只有在視窗最頂端且「向下滑」時才處理下拉刷新
  if (diff > 5 && window.scrollY <= 0) {
    // 阻尼系數 0.4
    pullDistance.value = Math.pow(diff, 0.8);
    // 如果已經開始下拉一段距離，防止原生橡皮筋/下拉彈跳
    if (pullDistance.value > 20 && e.cancelable) {
      e.preventDefault();
    }
  } else if (diff < 0) {
    // 如果是向上滑，重置狀態以確保不干擾正常滾動
    pullDistance.value = 0;
  }
};

const handleTouchEnd = () => {
  if (!pullRefreshEnabled.value || touchStartY === -1 || isRefreshing.value) {
    touchStartY = -1;
    pullDistance.value = 0;
    return;
  }

  if (pullDistance.value >= pullThreshold) {
    isRefreshing.value = true;
    // 執行刷新：重新載入頁面
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } else {
    // 平滑重置
    const animateReset = () => {
      if (pullDistance.value > 0) {
        pullDistance.value = Math.max(0, pullDistance.value - 8);
        requestAnimationFrame(animateReset);
      }
    };
    animateReset();
  }
  touchStartY = -1;
};

watch(pullRefreshEnabled, (enabled) => {
  if (enabled) return;
  touchStartY = -1;
  pullDistance.value = 0;
  isRefreshing.value = false;
});

const menuItems = [
  { name: 'home', path: '/', icon: LayoutDashboard, label: '概覽' },
  { name: 'itinerary', path: '/itinerary', icon: CalendarDays, label: '行程' },
  { name: 'wallet', path: '/wallet', icon: Wallet, label: '記帳' },
  { name: 'locations', path: '/locations', icon: MapPin, label: '位置' },
  { name: 'Converter', path: '/Converter', icon: RefreshCw, label: '換算' },
  { name: 'settings', path: '/settings', icon: Settings, label: '我的' },
];

const visibleMenuItems = computed(() =>
  menuItems.filter(
    (item) =>
      !(tripStore.isPublicTrip && ['wallet', 'locations'].includes(item.name))
  )
);

const isPageActive = (item) => {
  return route.name === item.name || route.path === item.path;
};

const pageTitle = computed(() => route.meta?.title || '肥肥六人團');

const triggerHaptic = (type = 'light') => {
  if (!window.navigator.vibrate) return;
  if (type === 'light') window.navigator.vibrate(10);
  else if (type === 'medium') window.navigator.vibrate(20);
};

const navigate = (path) => {
  triggerHaptic('light');
  router.push(path);
};

const handleScroll = () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  if (scrollTimer) clearTimeout(scrollTimer);
  const delta = scrollTop - lastScrollTop;

  if (Math.abs(delta) > 5) {
    if (delta > 0 && scrollTop > 100) {
      isNavVisible.value = false;
    } else {
      isNavVisible.value = true;
    }
    lastScrollTop = scrollTop;
  }

  scrollTimer = setTimeout(() => {
    isNavVisible.value = true;
  }, 1500);
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
  clearTimeout(scrollTimer);
});

const activeIndex = computed(() => {
  const index = visibleMenuItems.value.findIndex((item) => isPageActive(item));
  return index === -1 ? 0 : index;
});

const indicatorStyle = computed(() => {
  const count = visibleMenuItems.value.length;
  const width = 100 / count;
  return {
    width: `${width}%`,
    left: `${activeIndex.value * width}%`,
  };
});
</script>

<template>
  <div
    class="frontend-shell mx-auto min-h-screen max-w-md flex flex-col bg-[var(--travel-paper)] relative font-sans touch-pan-y pt-[env(safe-area-inset-top)]"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- 下拉刷新指示器 -->
    <div
      class="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-[100] transition-all duration-75"
      :style="{
        height: pullDistance + 'px',
        opacity: Math.min(pullDistance / pullThreshold, 1),
      }"
    >
      <div
        class="flex items-center justify-center gap-2 text-[var(--travel-teal)] bg-white rounded-full px-4 py-2 mt-2 shadow-lg"
        :style="{
          transform: `scale(${Math.min(pullDistance / pullThreshold, 1)}) translateY(${Math.min(pullDistance - 40, 0)}px)`,
        }"
      >
        <RefreshCw
          :size="16"
          class="transition-transform duration-200"
          :class="{
            'animate-spin': isRefreshing,
            'rotate-180': pullDistance >= pullThreshold && !isRefreshing,
          }"
        />
        <span class="text-xs font-black tracking-widest">{{
          isRefreshing
            ? '載入中...'
            : pullDistance >= pullThreshold
              ? '放開刷新'
              : '下拉刷新'
        }}</span>
      </div>
    </div>

    <main class="flex-1 relative">
      <div
        :class="
          route.meta?.fullBleed
            ? 'h-full min-h-0 overflow-hidden'
            : 'p-4 pb-32 pt-2'
        "
        :style="
          route.meta?.fullBleed
            ? { height: 'calc(100dvh - env(safe-area-inset-top))' }
            : undefined
        "
      >
        <Transition name="travel-page" mode="out-in">
          <div
            :key="route.path"
            class="travel-page"
            :class="{ 'h-full': route.meta?.fullBleed }"
          >
            <slot />
          </div>
        </Transition>
      </div>
    </main>

    <div
      class="fixed bottom-3 pb-[env(safe-area-inset-bottom)] left-0 right-0 px-4 z-50 transition-all duration-300 ease-out pointer-events-none max-w-md mx-auto"
      :class="{ 'translate-y-[120px] opacity-0': !isNavVisible }"
    >
      <nav
        aria-label="主要導覽"
        class="relative flex justify-around rounded-[22px] py-2 px-2 pointer-events-auto bg-white border border-[#e1e9e4] shadow-[0_14px_36px_rgba(25,65,66,.13)]"
      >
        <div class="nav-selection-track" aria-hidden="true">
          <div class="nav-selection" :style="indicatorStyle" />
        </div>

        <button
          v-for="item in visibleMenuItems"
          :key="item.name"
          @click="navigate(item.path)"
          :aria-current="isPageActive(item) ? 'page' : undefined"
          :class="[
            'nav-tab flex flex-col items-center gap-1 transition-all duration-300 relative z-10 min-h-11 py-[4px] w-full',
            isPageActive(item)
              ? 'nav-tab--active text-[var(--travel-teal)]'
              : 'nav-tab--idle',
          ]"
        >
          <component
            :is="item.icon"
            :size="18"
            :stroke-width="isPageActive(item) ? 2.5 : 2"
            class="transition-transform duration-300"
          />
          <span class="text-[10px] font-black tracking-widest uppercase">{{
            item.label
          }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.nav-selection-track {
  position: absolute;
  inset: 6px 8px;
  pointer-events: none;
}
.nav-selection {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 20px;
  background: var(--travel-mist);
  transition:
    left 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
    width 280ms ease;
}
.nav-selection::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 32%;
  right: 32%;
  height: 2px;
  border-radius: 2px;
  background: var(--travel-coral);
}
.nav-tab:focus-visible {
  outline: 2px solid var(--travel-coral);
  outline-offset: 1px;
  border-radius: 18px;
}
@media (prefers-reduced-motion: reduce) {
  .nav-selection,
  .nav-tab {
    transition: none !important;
  }
}
.nav-tab {
  text-shadow: none;
}

.nav-tab--idle {
  color: #60787a;
  mix-blend-mode: normal;
}

.nav-tab--active {
  mix-blend-mode: normal;
  text-shadow: none;
}
.travel-page-enter-active,
.travel-page-leave-active {
  transition:
    opacity 180ms ease,
    transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.travel-page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.travel-page-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

/* 滾動條優化 */
:deep(.el-scrollbar__bar.is-vertical) {
  width: 4px !important;
  right: 4px;
}
:deep(.el-scrollbar__thumb) {
  background-color: #136a7080 !important;
}

/* 點擊果凍感 */
button:active {
  transform: scale(0.97);
}

/* 禁止選擇 */
nav {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
}

.nav-container {
  /* 使用 cubic-bezier 增加一點點果凍感的回彈 */
  transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@media (prefers-reduced-motion: reduce) {
  .travel-page-enter-active,
  .travel-page-leave-active {
    transition: none !important;
  }
}
</style>
