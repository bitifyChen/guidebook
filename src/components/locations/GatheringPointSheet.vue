<script setup>
import { Flag, Navigation, Pencil, Plus, Trash2, X } from 'lucide-vue-next';

defineProps({
  open: { type: Boolean, default: false },
  points: { type: Array, default: () => [] },
  activePointId: { type: String, default: '' },
  deleteArmedPointId: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false },
  formatMeetAt: { type: Function, required: true },
  formatCountdown: { type: Function, required: true },
  formatDistanceToPoint: { type: Function, required: true },
});

defineEmits([
  'close',
  'create',
  'select',
  'navigate',
  'edit',
  'remove',
]);
</script>

<template>
  <div
    v-if="open"
    class="absolute inset-0 z-[700] bg-slate-950/45 backdrop-blur-[2px]"
    @click.self="$emit('close')"
  >
    <section
      class="member-sheet absolute inset-x-0 bottom-0 max-h-[78dvh] rounded-t-[24px] bg-white shadow-2xl"
    >
      <div class="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200"></div>
      <header
        class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-3"
      >
        <div>
          <h2 class="font-black text-slate-900">集合點</h2>
          <p class="mt-1 text-xs font-bold text-slate-400">
            {{ points.length ? '選擇集合目標開始指引' : '尚未設定集合點' }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="isAdmin"
            type="button"
            title="新增集合點"
            aria-label="新增集合點"
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"
            @click="$emit('create')"
          >
            <Plus :size="18" :stroke-width="2.6" />
          </button>
          <button
            type="button"
            title="關閉"
            aria-label="關閉集合點"
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
            @click="$emit('close')"
          >
            <X :size="19" :stroke-width="2.4" />
          </button>
        </div>
      </header>

      <div
        class="max-h-[calc(78dvh-82px)] overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <article
          v-for="pin in points"
          :key="pin.id"
          class="gathering-row my-3 rounded-2xl p-3"
          :class="activePointId === pin.id ? 'gathering-row--active' : ''"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 text-left"
            @click="$emit('select', pin)"
          >
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white"
            >
              <Flag :size="20" :stroke-width="2.5" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-sm font-black text-slate-900">
                {{ pin.title || '集合地點' }}
              </h3>
              <p class="mt-0.5 text-[11px] font-bold text-slate-500">
                {{ formatMeetAt(pin.meetAt) }}
                <span v-if="formatCountdown(pin.meetAt)" class="text-orange-600">
                  ・{{ formatCountdown(pin.meetAt) }}
                </span>
              </p>
              <p class="mt-0.5 text-[11px] font-bold text-slate-400">
                {{ formatDistanceToPoint(pin) }}
              </p>
            </div>
          </button>

          <div class="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-black text-white"
              @click="$emit('navigate', pin)"
            >
              <Navigation :size="15" />
              開始指引
            </button>
            <button
              v-if="isAdmin"
              type="button"
              class="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-700"
              @click="$emit('edit', pin)"
            >
              <Pencil :size="15" />
              編輯
            </button>
          </div>
          <button
            v-if="isAdmin"
            type="button"
            class="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl text-xs font-black"
            :class="
              deleteArmedPointId === pin.id
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-500'
            "
            @click="$emit('remove', pin)"
          >
            <Trash2 :size="14" />
            {{ deleteArmedPointId === pin.id ? '再按一次移除' : '移除集合點' }}
          </button>
        </article>
        <div
          v-if="points.length === 0"
          class="py-10 text-center text-sm font-black text-slate-400"
        >
          尚無集合點
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.member-sheet {
  animation: member-sheet-enter 220ms ease-out;
}

.gathering-row {
  background: #fff7ed;
}

.gathering-row--active {
  background:
    linear-gradient(90deg, rgb(249 115 22 / 16%), rgb(255 247 237 / 90%)),
    #fff7ed;
}

.gathering-row button:active {
  transform: scale(0.97);
}

@keyframes member-sheet-enter {
  from {
    opacity: 0;
    transform: translateY(24px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .member-sheet {
    animation: none;
  }
}
</style>
