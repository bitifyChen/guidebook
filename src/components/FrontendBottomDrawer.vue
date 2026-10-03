<script setup>
import { X } from 'lucide-vue-next';

defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    direction="btt"
    size="auto"
    :with-header="false"
    :append-to-body="true"
    class="frontend-contained-drawer frontend-bottom-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="frontend-bottom-drawer__content">
      <div
        class="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200"
        aria-hidden="true"
      ></div>
      <div class="frontend-bottom-drawer__header mb-6 flex items-start gap-4">
        <div class="min-w-0 flex-1">
          <h2 class="text-xl font-black text-[var(--travel-ink)]">
            {{ title }}
          </h2>
          <p v-if="description" class="mt-1 text-sm leading-6 text-slate-500">
            {{ description }}
          </p>
        </div>
        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--travel-mist)] text-[var(--travel-teal)]"
          :aria-label="`關閉${title}`"
          @click="emit('update:modelValue', false)"
        >
          <X :size="20" />
        </button>
      </div>
      <slot />
    </div>
  </el-drawer>
</template>

<style>
.frontend-bottom-drawer button:focus-visible {
  outline: 2px solid var(--travel-coral);
  outline-offset: 2px;
}

.frontend-bottom-drawer.el-drawer {
  max-height: min(86dvh, 820px);
  border-radius: 28px 28px 0 0;
  overflow: hidden;
  background: white;
}

.frontend-bottom-drawer .el-drawer__body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0;
}

.frontend-bottom-drawer__content {
  padding: 12px 24px max(28px, env(safe-area-inset-bottom));
}

.frontend-bottom-drawer__header {
  position: sticky;
  top: -12px;
  z-index: 2;
  background: white;
  padding-top: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .frontend-bottom-drawer.el-drawer {
    transition-duration: 0.1s !important;
  }
}
</style>
