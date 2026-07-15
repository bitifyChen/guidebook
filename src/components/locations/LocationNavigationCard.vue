<script setup>
import { Compass, ExternalLink, Navigation2, X } from 'lucide-vue-next';

defineProps({
  target: { type: Object, default: null },
  direction: { type: String, default: '等待定位' },
  distanceText: { type: String, default: '等待我的位置' },
  countdownText: { type: String, default: '' },
  rotation: { type: Number, default: 0 },
  googleMapsUrl: { type: String, default: '' },
});

defineEmits(['stop']);
</script>

<template>
  <section
    v-if="target"
    class="navigation-card absolute inset-x-4 top-4 z-[520] mx-auto flex max-w-md items-center gap-3 rounded-2xl p-3 text-white"
  >
    <div
      class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white"
    >
      <Navigation2
        :size="25"
        :stroke-width="2.8"
        class="navigation-card__arrow"
        :style="{ transform: `rotate(${rotation}deg)` }"
      />
    </div>
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2 text-[10px] font-bold text-slate-300">
        <Compass :size="13" />
        <span>{{ direction }}</span>
        <span class="h-3 w-px bg-white/20"></span>
        <span>{{ target.subtitle }}</span>
      </div>
      <h2 class="mt-0.5 truncate text-sm font-black">
        {{ target.name }}
      </h2>
      <p class="mt-0.5 text-xs font-bold text-orange-300">
        {{ distanceText }}
        <span v-if="countdownText" class="text-slate-300">
          ・{{ countdownText }}
        </span>
      </p>
    </div>
    <a
      v-if="googleMapsUrl"
      :href="googleMapsUrl"
      target="_blank"
      rel="noreferrer"
      title="開啟 Google Maps"
      aria-label="開啟 Google Maps"
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-100 active:scale-95"
    >
      <ExternalLink :size="17" :stroke-width="2.5" />
    </a>
    <button
      type="button"
      title="停止指引"
      aria-label="停止指引"
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-slate-200 active:scale-95"
      @click="$emit('stop')"
    >
      <X :size="18" :stroke-width="2.5" />
    </button>
  </section>
</template>

<style scoped>
.navigation-card {
  background:
    linear-gradient(135deg, rgb(30 41 59 / 76%), rgb(15 23 42 / 86%)),
    rgb(15 23 42 / 92%);
  border: 1px solid rgb(255 255 255 / 14%);
  -webkit-backdrop-filter: blur(12px) saturate(145%);
  backdrop-filter: blur(12px) saturate(145%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 18%),
    0 18px 40px rgb(15 23 42 / 32%);
}

.navigation-card__arrow {
  transform-origin: center;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .navigation-card__arrow {
    transition: none;
  }
}
</style>
