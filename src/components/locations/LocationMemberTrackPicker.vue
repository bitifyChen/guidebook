<script setup>
import { Check, Route, X } from 'lucide-vue-next';

defineProps({
  open: { type: Boolean, default: false },
  members: { type: Array, default: () => [] },
  selectedParticipantIds: { type: Array, default: () => [] },
  selectedDate: { type: String, default: '' },
});

defineEmits(['close', 'toggle-member', 'change-date', 'apply']);
</script>

<template>
  <div
    v-if="open"
    class="pointer-events-auto absolute inset-0 z-[750] bg-slate-950/40 backdrop-blur-[2px]"
    @click.self="$emit('close')"
  >
    <section
      class="location-member-track-picker absolute inset-x-0 bottom-0 max-h-[78dvh] overflow-hidden rounded-t-[24px] bg-white shadow-2xl"
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
          <h2 class="font-black text-slate-900">多人軌跡</h2>
          <p class="mt-0.5 text-xs font-bold text-slate-400">
            選擇要比較的成員與日期
          </p>
        </div>
        <button
          type="button"
          title="關閉多人軌跡"
          aria-label="關閉多人軌跡"
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          @click="$emit('close')"
        >
          <X :size="17" :stroke-width="2.6" />
        </button>
      </header>

      <div class="max-h-[calc(78dvh-142px)] overflow-y-auto px-4 pb-4">
        <label class="mt-3 block text-[11px] font-black text-slate-400">
          查詢日期
          <input
            type="date"
            :value="selectedDate"
            aria-label="多人軌跡日期"
            class="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-orange-400"
            @change="$emit('change-date', $event.target.value)"
          />
        </label>

        <div class="mt-3 space-y-2">
          <button
            v-for="member in members"
            :key="member.participantId"
            type="button"
            class="flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition"
            :class="
              selectedParticipantIds.includes(member.participantId)
                ? 'border-orange-300 bg-orange-50'
                : 'border-slate-100 bg-slate-50'
            "
            @click="$emit('toggle-member', member.participantId)"
          >
            <div
              class="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-200"
            >
              <img
                v-if="member.avatar"
                :src="member.avatar"
                class="h-full w-full object-cover"
                alt=""
              />
              <span
                v-else
                class="flex h-full w-full items-center justify-center text-sm font-black text-slate-500"
              >
                {{ member.name?.slice(0, 1) || '?' }}
              </span>
            </div>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-black text-slate-800">
                {{ member.name }}
              </span>
              <span class="mt-0.5 block text-[10px] font-bold text-slate-400">
                {{ member.isOnline ? '目前在線' : '可查看歷史軌跡' }}
              </span>
            </span>
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
              :class="
                selectedParticipantIds.includes(member.participantId)
                  ? 'border-orange-500 bg-orange-500 text-white'
                  : 'border-slate-300 bg-white text-transparent'
              "
            >
              <Check :size="15" :stroke-width="3" />
            </span>
          </button>
        </div>

        <p
          v-if="members.length === 0"
          class="py-8 text-center text-sm font-black text-slate-400"
        >
          目前沒有可查看的成員
        </p>
      </div>

      <footer
        class="flex items-center gap-2 border-t border-slate-100 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <span class="text-xs font-black text-slate-400">
          已選 {{ selectedParticipantIds.length }} 人
        </span>
        <button
          type="button"
          class="ml-auto rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-600"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          type="button"
          class="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black text-white disabled:bg-slate-300"
          :disabled="selectedParticipantIds.length === 0"
          @click="$emit('apply')"
        >
          查看軌跡
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.location-member-track-picker {
  animation: track-picker-enter 220ms ease-out;
}

@keyframes track-picker-enter {
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
