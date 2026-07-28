<script setup>
import { Loader2, Route, X } from 'lucide-vue-next';

defineProps({
  open: { type: Boolean, default: false },
  member: { type: Object, default: null },
  selectedDate: { type: String, default: '' },
  isLoading: { type: Boolean, default: false },
  pointsCount: { type: Number, default: 0 },
  stopsCount: { type: Number, default: 0 },
  firstPointTime: { type: String, default: '' },
  lastPointTime: { type: String, default: '' },
  error: { type: String, default: '' },
});

defineEmits(['close', 'change-date']);
</script>

<template>
  <div
    v-if="open"
    class="pointer-events-none absolute inset-0 z-[720] flex items-end px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))]"
  >
    <section
      class="pointer-events-auto w-full rounded-[18px] border border-slate-200 bg-white px-3 py-2.5 shadow-[0_14px_36px_rgba(15,23,42,0.22)]"
    >
      <header class="flex min-w-0 items-center gap-2">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-orange-50 text-xs font-black text-orange-600"
        >
          <img
            v-if="member?.avatar"
            :src="member.avatar"
            class="h-full w-full object-cover"
            alt=""
          />
          <span v-else>{{ member?.name?.slice(0, 1) || '?' }}</span>
        </div>

        <div class="min-w-0 flex-1">
          <div
            class="flex items-center gap-1 text-[9px] font-black leading-none text-orange-600"
          >
            <Route :size="11" :stroke-width="2.7" />
            歷史軌跡
          </div>
          <h2
            class="mt-1 truncate text-xs font-black leading-none text-slate-900"
          >
            {{ member?.name || '成員' }}
          </h2>
        </div>

        <input
          type="date"
          :value="selectedDate"
          aria-label="選擇軌跡日期"
          class="h-9 w-28 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700 outline-none focus:border-orange-400"
          @change="$emit('change-date', $event.target.value)"
        />

        <button
          type="button"
          title="關閉歷史軌跡"
          aria-label="關閉歷史軌跡"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          @click="$emit('close')"
        >
          <X :size="16" :stroke-width="2.6" />
        </button>
      </header>

      <div
        class="mt-2 flex min-h-5 min-w-0 items-center gap-1.5 border-t border-slate-100 pt-2 text-[10px] font-bold"
      >
        <template v-if="isLoading">
          <Loader2 :size="12" class="shrink-0 animate-spin text-orange-500" />
          <span class="text-slate-500">讀取軌跡中</span>
        </template>

        <span v-else-if="error" class="truncate text-red-600" :title="error">
          {{ error }}
        </span>

        <template v-else-if="pointsCount">
          <Route :size="12" class="shrink-0 text-orange-500" />
          <span class="shrink-0 text-slate-700">
            {{ pointsCount.toLocaleString() }} 個定位點
          </span>
          <span class="text-slate-300">·</span>
          <span class="shrink-0 text-slate-700">
            {{ stopsCount.toLocaleString() }} 個停留
          </span>
          <span class="ml-auto truncate text-right text-slate-400">
            {{ firstPointTime }} - {{ lastPointTime }}
          </span>
        </template>

        <span v-else class="text-slate-400">這一天尚無歷史軌跡</span>
      </div>
    </section>
  </div>
</template>
