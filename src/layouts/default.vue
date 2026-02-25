<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Settings,
  RefreshCw,
} from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
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

  if (diff > 0 && window.scrollY <= 0) {
    // 阻尼系數 0.4
    pullDistance.value = Math.pow(diff, 0.8);
    if (pullDistance.value > 10) {
      // 如果已經開始下拉，防止原生彈跳
      if (e.cancelable) e.preventDefault();
    }
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
  { name: 'settings', path: '/settings', icon: Settings, label: '我的' },
];

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
  const index = menuItems.findIndex((item) => isPageActive(item));
  return index === -1 ? 0 : index;
});

const indicatorStyle = computed(() => {
  const count = menuItems.length;
  const width = 100 / count;
  return {
    width: `${width}%`,
    left: `${activeIndex.value * width}%`,
  };
});
</script>

<template>
  <div
    class="mx-auto min-h-screen max-w-md flex flex-col bg-[var(--primary-orange-light)] relative font-sans touch-pan-y pt-[env(safe-area-inset-top)]"
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
      <div class="p-4 pb-32 pt-2">
        <slot />
      </div>
    </main>

    <div
      class="fixed bottom-6 pb-[env(safe-area-inset-bottom)] left-0 right-0 px-6 z-50 transition-all duration-500 ease-in-out pointer-events-none max-w-md mx-auto"
      :class="{ 'translate-y-[120px] opacity-0': !isNavVisible }"
    >
      <nav class="relative flex justify-around py-2 px-4 pointer-events-auto">
        <div
          class="absolute inset-0 bg-slate-900/95 backdrop-blur-xl rounded-[28px] shadow-[0_15px_30px_rgba(0,0,0,0.3)] border border-white/5 overflow-hidden pointer-events-none"
        >
          <div
            class="absolute bottom-0 h-[3px] bg-orange-400 rounded-full transition-all duration-300 ease-out"
            :style="indicatorStyle"
          ></div>
        </div>

        <div
          class="absolute -top-2 -left-1 z-30 pointer-events-none select-none"
        >
          <div
            class="relative w-7 h-7 bg-orange-500 rounded-full shadow-lg flex items-center justify-center transform -rotate-12 border border-white/20 animate-wiggle"
          >
            <div
              class="absolute -top-1.5 right-1 w-3 h-2 bg-green-500 rounded-full rotate-[30deg]"
            ></div>
            <div class="w-1.5 h-1.5 bg-white/40 rounded-full -mt-1 -ml-1"></div>
          </div>
        </div>

        <button
          v-for="item in menuItems"
          :key="item.name"
          @click="navigate(item.path)"
          :class="[
            'flex flex-col items-center gap-1 transition-all duration-500 relative z-10 py-[4px] w-full',
            isPageActive(item) ? 'text-orange-400 scale-110' : 'text-slate-400',
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
@keyframes wiggle {
  0%,
  100% {
    transform: rotate(-12deg) scale(1);
  }
  50% {
    transform: rotate(5deg) scale(1.1);
  }
}
.animate-wiggle {
  animation: wiggle 3s ease-in-out infinite;
}
</style>
