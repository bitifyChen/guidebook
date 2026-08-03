<script setup>
import {
  Eye,
  EyeOff,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Route,
  X,
} from 'lucide-vue-next';

defineProps({
  open: { type: Boolean, default: false },
  tracks: { type: Array, default: () => [] },
  visibleParticipantIds: { type: Array, default: () => [] },
  focusedParticipantId: { type: String, default: '' },
  selectedDate: { type: String, default: '' },
  isLoading: { type: Boolean, default: false },
  isPlaying: { type: Boolean, default: false },
  isPlaybackMode: { type: Boolean, default: false },
  playbackSpeed: { type: String, default: '1' },
  timelineStart: { type: Number, default: 0 },
  timelineEnd: { type: Number, default: 0 },
  currentTimestamp: { type: Number, default: 0 },
  error: { type: String, default: '' },
  formatTime: { type: Function, required: true },
});

defineEmits([
  'close',
  'change-date',
  'edit-members',
  'toggle-visible',
  'focus-member',
  'toggle-playback',
  'show-overview',
  'seek',
  'change-speed',
]);
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
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"
        >
          <Route :size="17" :stroke-width="2.5" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[9px] font-black leading-none text-orange-600">
            多人軌跡
          </div>
          <h2 class="mt-1 truncate text-xs font-black text-slate-900">
            {{ tracks.length }} 位成員 · {{ selectedDate }}
          </h2>
        </div>
        <button
          type="button"
          class="rounded-lg bg-slate-100 px-2 py-1.5 text-[10px] font-black text-slate-600"
          @click="$emit('edit-members')"
        >
          成員
        </button>
        <button
          type="button"
          title="關閉多人軌跡"
          aria-label="關閉多人軌跡"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          @click="$emit('close')"
        >
          <X :size="16" :stroke-width="2.6" />
        </button>
      </header>

      <p
        v-if="error"
        class="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-700"
      >
        {{ error }}
      </p>

      <div
        class="mt-2 flex max-h-24 gap-1.5 overflow-x-auto border-t border-slate-100 pt-2"
      >
        <div
          v-for="track in tracks"
          :key="track.participantId"
          class="flex shrink-0 items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-black"
          :class="
            focusedParticipantId === track.participantId
              ? 'bg-slate-800 text-white'
              : 'bg-slate-50 text-slate-600'
          "
        >
          <button
            type="button"
            class="flex min-w-0 items-center gap-1.5 rounded-lg px-1"
            :title="`聚焦 ${track.member?.name || '成員'}`"
            @click="$emit('focus-member', track.participantId)"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: track.color }"
            ></span>
            <span class="max-w-20 truncate">{{
              track.member?.name || '成員'
            }}</span>
            <span v-if="track.error" class="text-red-500">!</span>
          </button>
          <button
            type="button"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
            :title="
              visibleParticipantIds.includes(track.participantId)
                ? '隱藏路線'
                : '顯示路線'
            "
            :aria-label="
              visibleParticipantIds.includes(track.participantId)
                ? '隱藏路線'
                : '顯示路線'
            "
            @click="$emit('toggle-visible', track.participantId)"
          >
            <component
              :is="
                visibleParticipantIds.includes(track.participantId)
                  ? Eye
                  : EyeOff
              "
              :size="12"
            />
          </button>
        </div>
      </div>

      <div
        class="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2"
      >
        <Loader2
          v-if="isLoading"
          :size="13"
          class="animate-spin text-orange-500"
        />
        <span v-if="isLoading" class="text-[10px] font-bold text-slate-400">
          讀取多人軌跡中
        </span>
        <template v-else-if="timelineEnd > timelineStart">
          <button
            v-if="isPlaybackMode"
            type="button"
            title="顯示完整路線"
            aria-label="顯示完整路線"
            class="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-2 text-[10px] font-black text-slate-600"
            @click="$emit('show-overview')"
          >
            <Maximize2 :size="12" />
            全線
          </button>
          <button
            type="button"
            :title="isPlaying ? '暫停播放' : '播放多人軌跡'"
            :aria-label="isPlaying ? '暫停播放' : '播放多人軌跡'"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500 text-white"
            @click="$emit('toggle-playback')"
          >
            <Pause v-if="isPlaying" :size="13" />
            <Play v-else :size="13" />
          </button>
          <input
            type="range"
            :min="timelineStart"
            :max="timelineEnd"
            :value="currentTimestamp"
            aria-label="多人軌跡時間軸"
            class="min-w-0 flex-1 accent-orange-500"
            @input="$emit('seek', Number($event.target.value))"
          />
          <select
            :value="playbackSpeed"
            aria-label="多人軌跡播放速度"
            class="h-7 w-[4.25rem] shrink-0 rounded-lg border-0 bg-slate-100 px-1 text-[10px] font-black text-slate-600 outline-none"
            @change="$emit('change-speed', $event.target.value)"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="2">2x</option>
          </select>
          <span
            class="w-12 shrink-0 text-right text-[10px] font-black text-slate-500"
          >
            {{ formatTime(currentTimestamp) }}
          </span>
        </template>
        <span v-else class="text-[10px] font-bold text-slate-400">
          尚無可播放的多人軌跡
        </span>
      </div>
    </section>
  </div>
</template>
