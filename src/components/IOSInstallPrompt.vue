<script setup>
import { ref, onMounted } from 'vue';
import { Share, PlusSquare, X } from 'lucide-vue-next';

const isVisible = ref(false);

onMounted(() => {
  // 偵測是否為 iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  
  // 偵測是否已經在 PWA 模式 (standalone)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  // 檢查 localStorage 是否曾經關閉過
  const isDismissed = localStorage.getItem('ios-prompt-dismissed');

  if (isIOS && !isStandalone && !isDismissed) {
    // 延遲一點點顯示，效果比較自然
    setTimeout(() => {
      isVisible.value = true;
    }, 2000);
  }

  // 監聽強制顯示事件
  window.addEventListener('show-ios-install-prompt', () => {
    isVisible.value = true;
  });
});

const dismiss = () => {
  isVisible.value = false;
  localStorage.setItem('ios-prompt-dismissed', 'true');
};
</script>

<template>
  <Transition
    enter-active-class="transition duration-500 ease-out"
    enter-from-class="transform translate-y-32 opacity-0"
    enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition duration-300 ease-in"
    leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-32 opacity-0"
  >
    <div
      v-if="isVisible"
      class="fixed bottom-6 left-4 right-4 z-[100] bg-white/90 backdrop-blur-xl rounded-[32px] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col gap-4"
    >
      <button @click="dismiss" class="absolute top-4 right-4 text-slate-300 hover:text-slate-500">
        <X :size="18" />
      </button>

      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-200">
          <img src="/192.png" class="w-8 h-8 rounded-lg" alt="App Icon" />
        </div>
        <div>
          <h3 class="font-black text-slate-800 text-sm">將「濟州小幫手」加入主畫面</h3>
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">像 App 一樣離線使用與快速開啟</p>
        </div>
      </div>

      <div class="bg-slate-50 rounded-2xl p-4 space-y-3">
        <div class="flex items-center gap-3">
          <div class="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm text-blue-500">
            <Share :size="14" />
          </div>
          <p class="text-xs font-bold text-slate-600">1. 點擊瀏覽器下方的「分享」按鈕</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm text-slate-600">
            <PlusSquare :size="14" />
          </div>
          <p class="text-xs font-bold text-slate-600">2. 選擇「加入主畫面」</p>
        </div>
      </div>

      <!-- 三角形箭頭 (指向 Safari 的分享按鈕) -->
      <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/90 rotate-45 border-r border-b border-slate-100"></div>
    </div>
  </Transition>
</template>

<style scoped>
/* 避免在桌機測試時太突兀 */
@media (min-width: 640px) {
  .fixed {
    max-width: 360px;
    left: auto;
    right: 24px;
  }
}
</style>
