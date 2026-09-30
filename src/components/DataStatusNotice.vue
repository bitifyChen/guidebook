<script setup>
import { RefreshCw } from 'lucide-vue-next';
defineProps({ loading: Boolean, stale: Boolean, error: String });
defineEmits(['retry']);
</script>
<template>
  <div
    v-if="loading || stale || error"
    role="status"
    aria-live="polite"
    class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
  >
    <RefreshCw v-if="loading" :size="16" class="shrink-0 animate-spin" />
    <p class="flex-1">
      {{
        loading
          ? '正在確認最新資料…'
          : error || '目前顯示上次儲存的資料，連線恢復後請重新整理。'
      }}
    </p>
    <button
      v-if="!loading"
      type="button"
      class="min-h-11 shrink-0 px-2 font-bold text-orange-700"
      @click="$emit('retry')"
    >
      重試
    </button>
  </div>
</template>
