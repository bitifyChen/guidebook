<script setup>
import { Clock3, Route, X } from 'lucide-vue-next';

defineProps({
  open: { type: Boolean, default: false },
  member: { type: Object, default: null },
  stops: { type: Array, default: () => [] },
  selectedStopIndex: { type: Number, default: -1 },
  formatTime: { type: Function, required: true },
});

defineEmits(['close', 'select']);
</script>

<template>
  <div
    v-if="open"
    class="pointer-events-auto absolute inset-0 z-[740] bg-slate-950/35 backdrop-blur-[2px]"
    @click.self="$emit('close')"
  >
    <section
      class="location-track-stops-sheet absolute inset-x-0 bottom-0 max-h-[68dvh] overflow-hidden rounded-t-[24px] bg-white shadow-2xl"
    >
      <div class="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200"></div>
      <header
        class="flex items-center gap-3 border-b border-slate-100 px-5 pb-3 pt-3"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"
        >
          <Route :size="19" :stroke-width="2.5" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="font-black text-slate-900">停留點</h2>
          <p class="mt-0.5 truncate text-xs font-bold text-slate-400">
            {{ member?.name || '成員' }} · {{ stops.length }} 個停留
          </p>
        </div>
        <button
          type="button"
          title="關閉停留點"
          aria-label="關閉停留點"
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          @click="$emit('close')"
        >
          <X :size="17" :stroke-width="2.6" />
        </button>
      </header>

      <div
        class="max-h-[calc(68dvh-78px)] overflow-y-auto px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <button
          v-for="(stop, index) in stops"
          :key="stop.id"
          type="button"
          class="mt-2 flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition"
          :class="
            selectedStopIndex === index
              ? 'border-orange-300 bg-orange-50'
              : 'border-slate-100 bg-slate-50'
          "
          @click="$emit('select', index)"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black"
            :class="
              selectedStopIndex === index
                ? 'bg-orange-500 text-white'
                : 'bg-slate-800 text-white'
            "
          >
            {{ index + 1 }}
          </span>
          <span class="min-w-0 flex-1">
            <span
              class="flex items-center gap-1 text-xs font-black text-slate-800"
            >
              <Clock3 :size="13" class="text-orange-500" />
              {{ formatTime(stop.arrivedAt) }} - {{ formatTime(stop.leftAt) }}
            </span>
            <span class="mt-1 block text-[11px] font-bold text-slate-400">
              停留 {{ stop.durationMinutes }} 分鐘 ·
              {{ stop.pointsCount }} 個定位點
            </span>
          </span>
          <span class="text-xs font-black text-orange-600">查看</span>
        </button>

        <p
          v-if="stops.length === 0"
          class="py-10 text-center text-sm font-black text-slate-400"
        >
          尚無可辨識的停留點
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.location-track-stops-sheet {
  animation: track-stops-enter 220ms ease-out;
}

@keyframes track-stops-enter {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
