<script setup>
import { Loader2, Send } from 'lucide-vue-next';

defineProps({
  statusLabel: { type: String, default: '未啟用' },
  statusClass: { type: String, default: '' },
  tokens: { type: Array, default: () => [] },
  enabled: { type: Boolean, default: false },
  isSending: { type: Boolean, default: false },
});
const emit = defineEmits(['send-test']);
</script>

<template>
  <section
    class="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
  >
    <div class="flex items-center justify-between gap-3">
      <h4 class="font-black text-slate-800">推播通知</h4>
      <span
        class="rounded-lg px-2 py-1 text-[10px] font-black"
        :class="statusClass"
      >
        {{ statusLabel }}
      </span>
    </div>
    <div v-if="enabled" class="space-y-2">
      <div
        v-for="item in tokens"
        :key="item.token"
        class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
      >
        <div class="min-w-0">
          <div class="text-xs font-black text-slate-700">
            {{ item.platform || 'Web 裝置' }}
          </div>
          <div class="mt-1 text-[10px] font-bold text-slate-400">
            {{
              item.updatedAt
                ? new Date(item.updatedAt).toLocaleString()
                : '尚未記錄更新時間'
            }}
          </div>
        </div>
        <span
          class="shrink-0 rounded-lg bg-green-100 px-2 py-1 text-[10px] font-black text-green-700"
        >
          可測試
        </span>
      </div>
    </div>
    <button
      type="button"
      :disabled="isSending || !enabled"
      class="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-black text-white disabled:opacity-50"
      @click="emit('send-test')"
    >
      <Loader2 v-if="isSending" class="animate-spin" :size="14" />
      <Send v-else :size="14" /> 發送測試推播
    </button>
  </section>
</template>
