<script setup>
import { List, Loader2, Pause, Play, X } from 'lucide-vue-next';

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
  currentIndex: { type: Number, default: 0 },
  maxIndex: { type: Number, default: 0 },
  isPlaying: { type: Boolean, default: false },
  playbackSpeed: { type: String, default: '1' },
  currentTimeText: { type: String, default: '' },
  showFullRoute: { type: Boolean, default: true },
});

defineEmits([
  'close',
  'change-date',
  'toggle-playback',
  'seek',
  'change-speed',
  'open-stops',
  'toggle-full-route',
]);
</script>

<template>
  <div
    v-if="open"
    class="pointer-events-none absolute inset-0 z-[720] flex items-end px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))]"
  >
    <section
      class="pointer-events-auto w-full rounded-[20px] border border-slate-200 bg-white p-1 shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
      aria-label="歷史軌跡控制"
    >
      <header class="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          :title="`查看 ${stopsCount} 個停留點`"
          :aria-label="`查看 ${stopsCount} 個停留點`"
          class="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-xl pl-1 text-left active:bg-slate-100"
          @click="$emit('open-stops')"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-xs font-black text-slate-900">
              {{ member?.name || '成員' }}的軌跡
            </span>
            <span class="block truncate text-[10px] font-bold text-slate-500">
              <template v-if="pointsCount > 1">
                {{ firstPointTime }}–{{ lastPointTime }} · {{ pointsCount }} 點
              </template>
              <template v-else-if="pointsCount === 1">
                {{ firstPointTime }} · 1 個定位點
              </template>
              <template v-else>歷史軌跡</template>
            </span>
          </span>
          <List :size="16" class="shrink-0 text-slate-500" />
        </button>
        <input
          type="date"
          :value="selectedDate"
          aria-label="選擇軌跡日期"
          class="h-11 w-[6.9rem] min-w-0 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-bold text-slate-700 outline-none focus:border-orange-400"
          @change="$emit('change-date', $event.target.value)"
        />
        <button
          type="button"
          title="關閉歷史軌跡"
          aria-label="關閉歷史軌跡"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
          @click="$emit('close')"
        >
          <X :size="18" />
        </button>
      </header>

      <div v-if="pointsCount > 1 && !isLoading && !error" class="mt-0.5">
        <input
          type="range"
          min="0"
          :max="maxIndex"
          :value="currentIndex"
          :aria-valuetext="currentTimeText"
          aria-label="軌跡播放位置"
          class="block h-5 w-full accent-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
          @input="$emit('seek', Number($event.target.value))"
        />
        <div class="mt-1 flex min-w-0 items-center gap-1">
          <button
            type="button"
            :title="isPlaying ? '暫停播放' : '播放軌跡'"
            :aria-label="isPlaying ? '暫停播放' : '播放軌跡'"
            class="-my-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            @click="$emit('toggle-playback')"
          >
            <span
              class="flex h-7 w-7 items-center justify-center rounded-[9px] bg-orange-500 transition-colors active:bg-orange-600"
            >
              <Pause v-if="isPlaying" :size="14" fill="currentColor" />
              <Play v-else :size="14" fill="currentColor" />
            </span>
          </button>
          <time
            class="shrink-0 text-[11px] font-black tabular-nums text-slate-700"
          >
            {{ currentTimeText }}
          </time>
          <span class="min-w-0 flex-1"></span>
          <select
            :value="playbackSpeed"
            aria-label="播放速度"
            class="h-9 w-12 shrink-0 rounded-lg border-0 bg-slate-50 px-0.5 text-[11px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-orange-400"
            @change="$emit('change-speed', $event.target.value)"
          >
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="2">2×</option>
          </select>
          <button
            type="button"
            role="switch"
            :aria-checked="showFullRoute"
            aria-label="顯示全線"
            class="flex h-9 shrink-0 items-center gap-1 rounded-lg px-0.5 text-[10px] font-black text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
            @click="$emit('toggle-full-route')"
          >
            <span>全線</span>
            <span
              class="flex h-4 w-7 items-center rounded-full p-0.5 transition-colors"
              :class="showFullRoute ? 'bg-orange-500' : 'bg-slate-300'"
            >
              <span
                class="h-3 w-3 rounded-full bg-white shadow-sm transition-transform"
                :class="showFullRoute ? 'translate-x-3' : ''"
              ></span>
            </span>
          </button>
        </div>
      </div>

      <p
        v-else
        class="mt-1.5 flex min-h-8 items-center gap-1.5 border-t border-slate-100 px-1 pt-1.5 text-xs font-bold"
        :class="error ? 'text-red-600' : 'text-slate-500'"
        role="status"
      >
        <Loader2
          v-if="isLoading"
          :size="14"
          class="animate-spin text-orange-500"
        />
        {{
          isLoading
            ? '讀取軌跡中'
            : error ||
              (pointsCount === 1 ? '當日僅有一個定位點' : '這一天尚無歷史軌跡')
        }}
      </p>
    </section>
  </div>
</template>
