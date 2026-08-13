<script setup>
import { Download, Image, Upload } from 'lucide-vue-next';

defineProps({
  isCheckingImages: { type: Boolean, default: false },
});

const emit = defineEmits(['export', 'import', 'check-images']);

const handleImport = (event) => {
  emit('import', event);
  event.target.value = '';
};
</script>

<template>
  <div class="flex flex-wrap gap-2 px-2">
    <slot name="json-assistant" />
    <button
      type="button"
      class="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white px-4 text-xs font-bold text-slate-500 shadow-sm transition-transform active:scale-95"
      @click="emit('export')"
    >
      <Download :size="14" /> 匯出
    </button>
    <label
      class="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white px-4 text-xs font-bold text-slate-500 shadow-sm transition-transform active:scale-95"
    >
      <Upload :size="14" /> 匯入
      <input type="file" accept=".json" class="hidden" @change="handleImport" />
    </label>
    <button
      type="button"
      :disabled="isCheckingImages"
      class="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white px-4 text-xs font-bold text-slate-500 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
      @click="emit('check-images')"
    >
      <Image
        :size="14"
        :class="
          isCheckingImages ? 'animate-spin text-slate-400' : 'text-blue-500'
        "
      />
      {{ isCheckingImages ? '檢查中...' : '圖片檢查' }}
    </button>
  </div>
</template>
