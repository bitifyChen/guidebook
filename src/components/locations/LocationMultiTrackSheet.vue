<script setup>
import { ref, watch } from 'vue';
import { Eye, EyeOff, Loader2, Pause, Play, Users, X } from 'lucide-vue-next';

const props = defineProps({
  open: { type: Boolean, default: false },
  tracks: { type: Array, default: () => [] },
  visibleParticipantIds: { type: Array, default: () => [] },
  focusedParticipantId: { type: String, default: '' },
  selectedDate: { type: String, default: '' },
  isLoading: { type: Boolean, default: false },
  isPlaying: { type: Boolean, default: false },
  playbackSpeed: { type: String, default: '1' },
  timelineStart: { type: Number, default: 0 },
  timelineEnd: { type: Number, default: 0 },
  currentTimestamp: { type: Number, default: 0 },
  showFullRoute: { type: Boolean, default: true },
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
  'toggle-full-route',
  'seek',
  'change-speed',
]);

const showMembers = ref(false);
watch(
  () => props.open,
  (open) => {
    if (!open) showMembers.value = false;
  }
);
</script>

<template>
  <div
    v-if="open"
    class="pointer-events-none absolute inset-0 z-[720] flex items-end px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))]"
  >
    <section
      class="pointer-events-auto w-full rounded-[20px] border border-slate-200 bg-white p-1 shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
      aria-label="多人軌跡控制"
    >
      <header class="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          :aria-expanded="showMembers"
          aria-label="成員軌跡選項"
          class="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-xl pl-1 text-left active:bg-slate-100"
          @click="showMembers = !showMembers"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-xs font-black text-slate-900"
              >多人軌跡</span
            >
            <span class="block truncate text-[10px] font-bold text-slate-500">
              {{ tracks.length }} 位成員 · {{ formatTime(currentTimestamp) }}
            </span>
          </span>
          <Users :size="16" class="shrink-0 text-slate-500" />
        </button>
        <input
          type="date"
          :value="selectedDate"
          aria-label="多人軌跡日期"
          class="h-11 w-[6.9rem] min-w-0 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-bold text-slate-700 outline-none focus:border-orange-400"
          @change="$emit('change-date', $event.target.value)"
        />
        <button
          type="button"
          title="關閉多人軌跡"
          aria-label="關閉多人軌跡"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
          @click="$emit('close')"
        >
          <X :size="18" />
        </button>
      </header>

      <div
        v-if="showMembers"
        class="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto border-t border-slate-100 pt-1.5"
      >
        <div
          v-for="track in tracks"
          :key="track.participantId"
          class="flex min-w-0 items-center gap-1"
        >
          <button
            type="button"
            class="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left text-xs font-bold"
            :class="
              focusedParticipantId === track.participantId
                ? 'bg-orange-50 text-orange-700'
                : 'text-slate-700'
            "
            :aria-label="`聚焦 ${track.member?.name || '成員'}`"
            :disabled="!track.points?.length"
            @click="$emit('focus-member', track.participantId)"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: track.color }"
            ></span>
            <span class="truncate">{{ track.member?.name || '成員' }}</span>
            <span v-if="track.error" class="text-red-600">讀取失敗</span>
            <span v-else-if="!track.points?.length" class="text-slate-400"
              >當日無軌跡</span
            >
          </button>
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600"
            :aria-label="`${visibleParticipantIds.includes(track.participantId) ? '隱藏' : '顯示'} ${track.member?.name || '成員'}的路線`"
            :disabled="!track.points?.length"
            @click="$emit('toggle-visible', track.participantId)"
          >
            <Eye
              v-if="visibleParticipantIds.includes(track.participantId)"
              :size="18"
            />
            <EyeOff v-else :size="18" />
          </button>
        </div>
        <button
          type="button"
          class="min-h-11 self-start rounded-xl px-3 text-xs font-black text-orange-700"
          @click="$emit('edit-members')"
        >
          調整成員
        </button>
      </div>

      <p
        v-if="error"
        class="mt-1.5 border-t border-slate-100 px-1 pt-1.5 text-xs font-bold text-amber-700"
        role="status"
      >
        {{ error }}
      </p>

      <div v-if="!isLoading && timelineEnd > timelineStart" class="mt-0.5">
        <input
          type="range"
          :min="timelineStart"
          :max="timelineEnd"
          :value="currentTimestamp"
          :aria-valuetext="formatTime(currentTimestamp)"
          aria-label="多人軌跡時間軸"
          class="block h-5 w-full accent-orange-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
          @input="$emit('seek', Number($event.target.value))"
        />
        <div class="mt-1 flex min-w-0 items-center gap-1">
          <button
            type="button"
            :title="isPlaying ? '暫停播放' : '播放多人軌跡'"
            :aria-label="isPlaying ? '暫停播放' : '播放多人軌跡'"
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
            {{ formatTime(currentTimestamp) }}
          </time>
          <span class="min-w-0 flex-1"></span>
          <select
            :value="playbackSpeed"
            aria-label="多人軌跡播放速度"
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
        class="mt-1.5 flex min-h-8 items-center gap-1.5 border-t border-slate-100 px-1 pt-1.5 text-xs font-bold text-slate-500"
        role="status"
      >
        <Loader2
          v-if="isLoading"
          :size="14"
          class="animate-spin text-orange-500"
        />
        {{ isLoading ? '讀取多人軌跡中' : '尚無可播放的多人軌跡' }}
      </p>
    </section>
  </div>
</template>
