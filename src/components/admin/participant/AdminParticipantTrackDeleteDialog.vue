<script setup>
import { computed, ref, watch } from 'vue';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-vue-next';

const props = defineProps({
  open: { type: Boolean, default: false },
  scope: { type: String, default: 'point' },
  preview: { type: Object, default: () => ({}) },
  participantName: { type: String, default: '' },
  warning: { type: Boolean, default: false },
  isDeleting: { type: Boolean, default: false },
  timezone: { type: String, default: 'UTC' },
});

const emit = defineEmits(['update:open', 'confirm']);
const confirmation = ref('');

const title = computed(() => {
  if (props.scope === 'day') return '清除當日軌跡';
  if (props.scope === 'all') return '清除全部歷史軌跡';
  return '刪除定位點';
});

const canConfirm = computed(
  () =>
    !props.isDeleting &&
    (props.scope !== 'all' || confirmation.value === props.participantName)
);

const formatTime = (value) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: props.timezone || 'UTC',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(Number(value)));
};

watch(
  () => props.open,
  (open) => {
    if (open) confirmation.value = '';
  }
);
</script>

<template>
  <el-dialog
    :model-value="open"
    :title="title"
    width="min(92vw, 480px)"
    :append-to-body="true"
    :close-on-click-modal="!isDeleting"
    :close-on-press-escape="!isDeleting"
    :show-close="!isDeleting"
    :z-index="120"
    @update:model-value="emit('update:open', $event)"
  >
    <div class="space-y-4">
      <div class="rounded-xl bg-slate-50 p-4">
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="font-bold text-slate-500">將刪除</span>
          <strong class="text-slate-900"
            >{{ preview.pointCount || 0 }} 個定位點</strong
          >
        </div>
        <div
          v-if="preview.date"
          class="mt-2 flex items-center justify-between gap-3 text-sm"
        >
          <span class="font-bold text-slate-500">日期</span>
          <strong class="text-slate-900">{{ preview.date }}</strong>
        </div>
        <div
          v-if="preview.firstTimestamp"
          class="mt-2 text-xs font-bold text-slate-400"
        >
          {{ formatTime(preview.firstTimestamp) }} 至
          {{ formatTime(preview.lastTimestamp) }}
        </div>
      </div>

      <div
        v-if="warning"
        class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-relaxed text-amber-700"
      >
        <AlertTriangle :size="18" class="mt-0.5 shrink-0" />
        定位仍在運作時，新定位點可能在清除後繼續產生。清除歷史不會停用位置分享。
      </div>

      <label v-if="scope === 'all'" class="block space-y-2">
        <span class="text-xs font-black text-slate-600">
          請輸入「{{ participantName }}」確認只清除目前旅程
        </span>
        <input
          v-model="confirmation"
          class="h-11 w-full rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-bold text-red-700 outline-none focus:border-red-400"
          :placeholder="participantName"
          autocomplete="off"
        />
      </label>

      <p class="text-xs font-bold leading-relaxed text-slate-400">
        此操作無法復原，但不會移除即時位置、定位綁定、集合點或其他旅程資料。
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          :disabled="isDeleting"
          class="h-10 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-600 disabled:opacity-50"
          @click="emit('update:open', false)"
        >
          取消
        </button>
        <button
          type="button"
          :disabled="!canConfirm"
          class="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white disabled:opacity-40"
          @click="emit('confirm', confirmation)"
        >
          <Loader2 v-if="isDeleting" :size="16" class="animate-spin" />
          <Trash2 v-else :size="16" /> 確認刪除
        </button>
      </div>
    </template>
  </el-dialog>
</template>
