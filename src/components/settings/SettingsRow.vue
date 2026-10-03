<script setup>
import { ChevronRight } from 'lucide-vue-next';

defineProps({
  icon: { type: [Object, Function], required: true },
  title: { type: String, required: true },
  detail: { type: String, default: '' },
  status: { type: String, default: '' },
  statusTone: { type: String, default: 'neutral' },
  tone: { type: String, default: 'default' },
  busy: { type: Boolean, default: false },
});
</script>

<template>
  <button
    type="button"
    class="settings-row flex min-h-[76px] w-full items-center gap-4 border-b border-slate-100 px-5 py-4 text-left last:border-b-0 disabled:opacity-60"
    :disabled="busy"
  >
    <span
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
      :class="
        tone === 'danger'
          ? 'bg-red-50 text-red-500'
          : 'bg-[var(--travel-mist)] text-[var(--travel-teal)]'
      "
    >
      <component :is="icon" :size="20" :class="{ 'animate-spin': busy }" />
    </span>
    <span class="min-w-0 flex-1">
      <span
        class="block text-sm font-bold"
        :class="tone === 'danger' ? 'text-red-600' : 'text-slate-800'"
        >{{ title }}</span
      >
      <span v-if="detail" class="mt-1 block text-xs leading-5 text-slate-500">{{
        detail
      }}</span>
    </span>
    <span
      v-if="status"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold leading-5"
      :class="{
        'border-emerald-200 bg-emerald-100 text-emerald-800':
          statusTone === 'success',
        'border-[#f4c9bd] bg-[#fff0ea] text-[#9b4634]':
          statusTone === 'warning',
        'border-slate-200 bg-slate-100 text-slate-700':
          statusTone === 'neutral',
      }"
      ><span
        class="h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden="true"
      ></span
      >{{ status }}</span
    >
    <ChevronRight
      :size="18"
      class="shrink-0 text-slate-300"
      aria-hidden="true"
    />
  </button>
</template>

<style scoped>
.settings-row:focus-visible {
  outline: 2px solid var(--travel-coral);
  outline-offset: -3px;
}

@media (hover: hover) {
  .settings-row:hover {
    background: var(--travel-paper);
  }
}
</style>
