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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

const handleTouchStart = (e) => {
  if (window.scrollY === 0) {
    touchStartY = e.touches[0].pageY;
  } else {
    touchStartY = -1;
  }
};

const handleTouchMove = (e) => {
  if (touchStartY === -1 || isRefreshing.value) return;

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
  if (touchStartY === -1 || isRefreshing.value) return;

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

const handleScroll = () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  // 1. 清除之前的定時器
  if (scrollTimer) clearTimeout(scrollTimer);

  // 2. 判斷上下滑動隱藏/顯示
  // 為了靈敏度，我們縮小判斷距離到 5px
  const delta = scrollTop - lastScrollTop;

  if (Math.abs(delta) > 5) {
    if (delta > 0 && scrollTop > 100) {
      // 向下滑動且超過一定距離 -> 隱藏
      isNavVisible.value = false;
    } else {
      // 向上滑動 -> 顯示
      isNavVisible.value = true;
    }
    lastScrollTop = scrollTop;
  }

  // 3. 核心功能：停留超過 2 秒自動顯示
  scrollTimer = setTimeout(() => {
    isNavVisible.value = true;
  }, 1500); // 1500 毫秒 = 1.5 秒
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
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
    class="frontend-shell mx-auto min-h-screen max-w-md flex flex-col bg-[var(--primary-orange-light)] relative font-sans touch-pan-y pt-[env(safe-area-inset-top)]"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <svg
      aria-hidden="true"
      focusable="false"
      class="liquid-glass-filter-svg"
      width="0"
      height="0"
    >
      <defs>
        <filter
          id="guidebook-liquid-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.004"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.4" result="map" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="88"
            xChannelSelector="R"
            yChannelSelector="B"
          />
        </filter>
      </defs>
    </svg>

    <!-- 下拉刷新指示器 -->
    <div
      class="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-[100] transition-all duration-75"
      :style="{
        height: pullDistance + 'px',
        opacity: Math.min(pullDistance / pullThreshold, 1),
      }"
    >
      <div
        class="flex items-center justify-center gap-2 text-orange-600 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 mt-2 shadow-lg"
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
        <slot />
      </div>
    </main>

    <div
      class="fixed bottom-6 pb-[env(safe-area-inset-bottom)] left-0 right-0 px-6 z-50 transition-all duration-500 ease-in-out pointer-events-none max-w-md mx-auto"
      :class="{ 'translate-y-[120px] opacity-0': !isNavVisible }"
    >
      <nav class="relative flex justify-around py-2 px-4 pointer-events-auto">
        <div
          class="liquid-glass-nav absolute inset-0 rounded-[28px] overflow-hidden pointer-events-none"
        >
          <div
            class="absolute bottom-1 z-10 h-[3px] bg-orange-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_16px_rgba(251,146,60,0.55)]"
            :style="indicatorStyle"
          ></div>
        </div>

        <button
          v-for="item in visibleMenuItems"
          :key="item.name"
          @click="navigate(item.path)"
          :class="[
            'nav-tab flex flex-col items-center gap-1 transition-all duration-500 relative z-10 py-[4px] w-full',
            isPageActive(item)
              ? 'nav-tab--active text-orange-300 scale-110'
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
.frontend-shell {
  --liquid-highlight: rgb(255 255 255 / 46%);
  --liquid-edge: rgb(255 255 255 / 18%);
  --liquid-shadow: rgb(15 23 42 / 26%);
}

.liquid-glass-filter-svg {
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: 0;
  height: 0;
  pointer-events: none;
}

.liquid-glass-nav {
  position: absolute;
  isolation: isolate;
  background:
    linear-gradient(135deg, rgb(30 41 59 / 52%), rgb(15 23 42 / 38%)),
    rgb(15 23 42 / 62%);
  -webkit-backdrop-filter: blur(3px) saturate(145%) contrast(1.04)
    url('#guidebook-liquid-glass');
  backdrop-filter: blur(3px) saturate(145%) contrast(1.04)
    url('#guidebook-liquid-glass');
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 24%),
    inset 0 -1px 0 rgb(255 255 255 / 10%),
    inset 7px 7px 18px rgb(255 255 255 / 8%),
    0 18px 38px rgb(15 23 42 / 32%);
}

.liquid-glass-nav {
  color: rgb(248 250 252 / 92%);
}

.liquid-glass-nav::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: '';
  background:
    radial-gradient(circle at 16% 0%, rgb(255 255 255 / 18%), transparent 34%),
    linear-gradient(
      105deg,
      rgb(255 255 255 / 10%),
      transparent 42%,
      rgb(255 255 255 / 5%)
    );
  border-radius: inherit;
  pointer-events: none;
}

.liquid-glass-nav::after {
  position: absolute;
  inset: 1px;
  z-index: 1;
  content: '';
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: inherit;
  pointer-events: none;
}

.nav-tab {
  text-shadow: 0 1px 10px rgb(15 23 42 / 45%);
}

.nav-tab--idle {
  color: rgb(226 232 240 / 76%);
  mix-blend-mode: normal;
}

.nav-tab--active {
  mix-blend-mode: normal;
  text-shadow:
    0 1px 10px rgb(15 23 42 / 34%),
    0 0 18px rgb(251 146 60 / 42%);
}

@supports not (
  (backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))
) {
  .liquid-glass-nav {
    background: rgb(15 23 42 / 92%);
  }
}

/* 滾動條優化 */
:deep(.el-scrollbar__bar.is-vertical) {
  width: 4px !important;
  right: 4px;
}
:deep(.el-scrollbar__thumb) {
  background-color: #ff8c0080 !important;
}

/* 點擊果凍感 */
button:active {
  transform: scale(0.9);
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
</style>
