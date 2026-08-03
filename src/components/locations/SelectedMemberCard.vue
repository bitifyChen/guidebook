<script setup>
import { Battery, Navigation, NavigationOff, Route, X } from 'lucide-vue-next';

defineProps({
  member: { type: Object, default: null },
  isTracked: { type: Boolean, default: false },
  batteryText: { type: String, default: '--' },
  batteryToneClass: { type: String, default: 'battery-tone--unknown' },
  timeText: { type: String, default: '' },
  canViewHistory: { type: Boolean, default: false },
});

defineEmits(['toggle-track', 'view-history', 'close']);
</script>

<template>
  <div v-if="member" class="flex w-full justify-end gap-2">
    <div
      class="location-member-card pointer-events-auto flex h-16 min-w-0 flex-1 items-center gap-2 rounded-2xl p-2 text-slate-900 shadow-[0_16px_32px_rgba(15,23,42,0.20)] backdrop-blur-md"
      :class="
        isTracked
          ? 'location-member-card--tracked'
          : member.isOnline
            ? 'location-member-card--online'
            : 'location-member-card--offline'
      "
    >
      <div
        class="location-member-card__avatar relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-slate-100"
      >
        <img
          v-if="member.avatar"
          :src="member.avatar"
          class="h-full w-full object-cover"
          alt=""
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center font-black text-slate-500"
        >
          {{ member.name.slice(0, 1) }}
        </div>
      </div>
      <span class="min-w-0 flex-1">
        <span
          class="flex items-center justify-between gap-2 text-[10px] font-bold"
        >
          <span class="location-member-card__status">
            {{ isTracked ? '追蹤中' : member.isOnline ? '在線' : '離線' }}
          </span>
          <span
            class="location-member-card__battery flex shrink-0 items-center gap-1"
            :class="batteryToneClass"
          >
            <Battery :size="13" :stroke-width="2.5" />
            {{ batteryText }}
          </span>
        </span>
        <span class="mt-0.5 block truncate text-sm font-black">
          {{ member.name }}
        </span>
        <span
          class="mt-0.5 block truncate text-[10px] font-bold text-slate-400"
        >
          {{ timeText }}
        </span>
      </span>
      <button
        v-if="canViewHistory"
        type="button"
        title="查看歷史軌跡"
        aria-label="查看歷史軌跡"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
        @click="$emit('view-history')"
      >
        <Route :size="16" :stroke-width="2.5" />
      </button>
      <button
        type="button"
        title="追蹤成員"
        aria-label="追蹤成員"
        class="location-member-card__track flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        @click="$emit('toggle-track')"
      >
        <component
          :is="isTracked ? NavigationOff : Navigation"
          :size="16"
          :stroke-width="2.6"
        />
      </button>
      <button
        type="button"
        title="關閉成員資訊"
        aria-label="關閉成員資訊"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
        @click="$emit('close')"
      >
        <X :size="16" :stroke-width="2.6" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.location-member-card {
  position: relative;
  overflow: hidden;
  background: rgb(255 255 255 / 92%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 16px 32px rgb(15 23 42 / 20%);
}

.location-member-card::before {
  position: absolute;
  top: 50%;
  left: 9px;
  width: 7px;
  height: 7px;
  content: '';
  background: #94a3b8;
  border-radius: 999px;
  transform: translateY(-50%);
}

.location-member-card--online {
  background:
    linear-gradient(90deg, rgb(16 185 129 / 12%), rgb(255 255 255 / 82%) 42%),
    rgb(255 255 255 / 92%);
}

.location-member-card--tracked {
  background:
    linear-gradient(90deg, rgb(249 115 22 / 14%), rgb(255 255 255 / 82%) 42%),
    rgb(255 255 255 / 92%);
}

.location-member-card--online::before {
  background: #10b981;
  box-shadow: 0 0 0 5px rgb(16 185 129 / 13%);
}

.location-member-card--tracked::before {
  background: #f97316;
  box-shadow: 0 0 0 5px rgb(249 115 22 / 15%);
}

.location-member-card__avatar {
  box-shadow: 0 0 0 1px rgb(148 163 184 / 18%);
}

.location-member-card__status {
  color: #64748b;
}

.location-member-card--online .location-member-card__status {
  color: #059669;
}

.location-member-card--tracked .location-member-card__status {
  color: #ea580c;
}

.location-member-card__track {
  color: #64748b;
  background: #f1f5f9;
}

.location-member-card--online .location-member-card__track {
  color: #047857;
  background: rgb(16 185 129 / 12%);
}

.location-member-card--tracked .location-member-card__track {
  color: #ea580c;
  background: rgb(249 115 22 / 14%);
}

.battery-tone--good {
  color: #059669;
}

.battery-tone--medium {
  color: #d97706;
}

.battery-tone--low {
  color: #dc2626;
}

.battery-tone--unknown {
  color: #94a3b8;
}
</style>
