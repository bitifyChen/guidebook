<script setup>
import { Check, Copy, Loader2, MapPin, Route, Trash2 } from 'lucide-vue-next';

defineProps({
  activeToken: { type: Object, default: null },
  isLoading: { type: Boolean, default: false },
  isCreating: { type: Boolean, default: false },
  isRemoving: { type: Boolean, default: false },
  copied: { type: Boolean, default: false },
});
const emit = defineEmits(['copy', 'remove', 'enable', 'view-history']);
</script>

<template>
  <section
    class="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"
  >
    <div class="flex items-center justify-between gap-3">
      <h4 class="font-black text-slate-800">位置分享</h4>
      <span
        class="rounded-lg px-2 py-1 text-[10px] font-black"
        :class="
          activeToken
            ? 'bg-green-100 text-green-700'
            : 'bg-slate-100 text-slate-500'
        "
      >
        {{ activeToken ? '已啟用' : '未啟用' }}
      </span>
    </div>
    <div
      v-if="isLoading"
      class="py-5 text-center text-xs font-black text-slate-400"
    >
      載入位置分享狀態中...
    </div>
    <div
      v-else-if="activeToken"
      class="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white p-3"
    >
      <div class="min-w-0">
        <div class="truncate text-xs font-black text-slate-700">
          {{ activeToken.deviceId || '未設定裝置名稱' }}
        </div>
        <div class="mt-1 text-[10px] font-bold text-slate-400">
          每 {{ activeToken.minIntervalSeconds || 30 }} 秒更新
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <button
          type="button"
          class="inline-flex h-9 items-center gap-1 rounded-xl bg-orange-500 px-3 text-xs font-black text-white"
          @click="emit('copy')"
        >
          <component :is="copied ? Check : Copy" :size="13" />
          {{ copied ? '已複製' : '複製連結' }}
        </button>
        <button
          type="button"
          :disabled="isRemoving"
          class="inline-flex h-9 items-center gap-1 rounded-xl bg-red-50 px-3 text-xs font-black text-red-600 disabled:opacity-50"
          @click="emit('remove')"
        >
          <Loader2 v-if="isRemoving" class="animate-spin" :size="13" />
          <Trash2 v-else :size="13" /> 移除
        </button>
      </div>
    </div>
    <button
      v-else
      type="button"
      :disabled="isCreating"
      class="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-xs font-black text-white disabled:opacity-50"
      @click="emit('enable')"
    >
      <Loader2 v-if="isCreating" class="animate-spin" :size="14" />
      <MapPin v-else :size="14" /> 啟用位置分享
    </button>
    <button
      type="button"
      class="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-white text-xs font-black text-indigo-600"
      @click="emit('view-history')"
    >
      <Route :size="14" /> 查看歷史軌跡
    </button>
  </section>
</template>
