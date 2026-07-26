<script setup>
import { CalendarDays, Loader2, Route, X } from 'lucide-vue-next';

defineProps({
  open: { type: Boolean, default: false },
  member: { type: Object, default: null },
  selectedDate: { type: String, default: '' },
  isLoading: { type: Boolean, default: false },
  pointsCount: { type: Number, default: 0 },
  firstPointTime: { type: String, default: '' },
  lastPointTime: { type: String, default: '' },
  error: { type: String, default: '' },
});

defineEmits(['close', 'update:selected-date', 'load']);
</script>

<template>
  <div
    v-if="open"
    class="pointer-events-none absolute inset-0 z-[720] flex items-end px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))]"
  >
    <section
      class="pointer-events-auto w-full rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.24)]"
    >
      <header class="flex items-center gap-3">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-orange-50 font-black text-orange-600"
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
            class="flex items-center gap-1.5 text-[10px] font-black text-orange-600"
          >
            <Route :size="13" :stroke-width="2.6" />
            歷史軌跡
          </div>
          <h2 class="mt-0.5 truncate text-sm font-black text-slate-900">
            {{ member?.name || '成員' }}
          </h2>
        </div>
        <button
          type="button"
          title="關閉歷史軌跡"
          aria-label="關閉歷史軌跡"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          @click="$emit('close')"
        >
          <X :size="17" :stroke-width="2.6" />
        </button>
      </header>

      <div class="mt-4 flex items-end gap-2">
        <label class="min-w-0 flex-1 space-y-1">
          <span
            class="flex items-center gap-1 text-[10px] font-black text-slate-400"
          >
            <CalendarDays :size="12" />日期
          </span>
          <input
            type="date"
            :value="selectedDate"
            class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-orange-400"
            @input="$emit('update:selected-date', $event.target.value)"
          />
        </label>
        <button
          type="button"
          :disabled="isLoading || !selectedDate"
          class="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 text-xs font-black text-white disabled:opacity-50"
          @click="$emit('load')"
        >
          <Loader2 v-if="isLoading" :size="14" class="animate-spin" />
          <Route v-else :size="14" :stroke-width="2.6" />
          顯示
        </button>
      </div>

      <div
        v-if="error"
        class="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600"
      >
        {{ error }}
      </div>
      <div
        v-else-if="isLoading"
        class="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-400"
      >
        讀取軌跡中...
      </div>
      <div
        v-else-if="pointsCount"
        class="mt-3 flex items-center justify-between gap-3 rounded-xl bg-orange-50 px-3 py-2.5"
      >
        <span class="text-xs font-black text-orange-700">
          {{ pointsCount.toLocaleString() }} 個定位點
        </span>
        <span class="text-[10px] font-bold text-orange-500">
          {{ firstPointTime }} - {{ lastPointTime }}
        </span>
      </div>
      <div
        v-else
        class="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-400"
      >
        這一天尚無歷史軌跡
      </div>
    </section>
  </div>
</template>
