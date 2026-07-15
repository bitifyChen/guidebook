<script setup>
import { Battery, Clock, MapPin, Navigation, X } from 'lucide-vue-next';

defineProps({
  open: { type: Boolean, default: false },
  locations: { type: Array, default: () => [] },
  onlineCount: { type: Number, default: 0 },
  offlineCount: { type: Number, default: 0 },
  trackedParticipantId: { type: String, default: '' },
  formatTime: { type: Function, required: true },
  formatBattery: { type: Function, required: true },
  getBatteryToneClass: { type: Function, required: true },
});

defineEmits(['close', 'select-member']);
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
          <h2 class="font-black text-slate-900">成員位置</h2>
          <p class="mt-1 text-xs font-bold text-slate-400">
            {{ onlineCount }} 位在線<span v-if="offlineCount"
              >，{{ offlineCount }} 位離線</span
            >
          </p>
        </div>
        <button
          type="button"
          title="關閉"
          aria-label="關閉成員位置"
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
          @click="$emit('close')"
        >
          <X :size="19" :stroke-width="2.4" />
        </button>
      </header>

      <div
        class="max-h-[calc(78dvh-82px)] overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <button
          v-for="item in locations"
          :key="item.participantId"
          type="button"
          class="member-row flex w-full items-center gap-3 border-b border-slate-100 px-1 py-4 text-left last:border-b-0"
          :class="
            trackedParticipantId === item.participantId
              ? 'member-row--tracked'
              : item.isOnline
                ? 'member-row--online'
                : ''
          "
          @click="$emit('select-member', item.participantId)"
        >
          <div
            class="member-row__avatar relative h-12 w-12 shrink-0"
            :class="
              trackedParticipantId === item.participantId
                ? 'member-row__avatar--tracked'
                : item.isOnline
                  ? 'member-row__avatar--online'
                  : 'member-row__avatar--offline'
            "
          >
            <div class="h-full w-full overflow-hidden rounded-2xl bg-slate-100">
              <img
                v-if="item.avatar"
                :src="item.avatar"
                class="h-full w-full object-cover"
                alt=""
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center font-black text-slate-500"
              >
                {{ item.name.slice(0, 1) }}
              </div>
            </div>
            <span
              class="member-row__status-dot absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
            ></span>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <h3 class="truncate font-black text-slate-900">{{ item.name }}</h3>
              <span class="member-row__status-label shrink-0 text-[11px] font-bold">
                {{
                  trackedParticipantId === item.participantId
                    ? '追蹤中'
                    : item.isOnline
                      ? '在線'
                      : '離線'
                }}
              </span>
            </div>
            <div
              class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-400"
            >
              <span class="flex items-center gap-1">
                <Clock :size="13" />{{ formatTime(item.timestamp) }}
              </span>
              <span
                class="flex items-center gap-1"
                :class="getBatteryToneClass(item)"
              >
                <Battery :size="13" />{{ formatBattery(item) }}
              </span>
              <span class="flex items-center gap-1">
                <Navigation :size="13" />{{
                  item.acc || item.acc === 0 ? `${item.acc}m` : '--'
                }}
              </span>
            </div>
          </div>

          <MapPin :size="18" class="member-row__pin shrink-0" :stroke-width="2.4" />
        </button>
        <div
          v-if="locations.length === 0"
          class="py-10 text-center text-sm font-black text-slate-400"
        >
          尚無成員位置
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.member-sheet {
  animation: member-sheet-enter 220ms ease-out;
}

.member-row {
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.member-row:active {
  transform: scale(0.97);
}

.member-row--online {
  background: linear-gradient(
    90deg,
    rgb(16 185 129 / 9%),
    rgb(255 255 255 / 0%) 46%
  );
}

.member-row--tracked {
  background: linear-gradient(
    90deg,
    rgb(249 115 22 / 12%),
    rgb(255 255 255 / 0%) 46%
  );
}

.member-row__avatar {
  border-radius: 16px;
}

.member-row__avatar--online {
  box-shadow: 0 0 0 1px rgb(16 185 129 / 18%);
}

.member-row__avatar--tracked {
  box-shadow: 0 0 0 1px rgb(249 115 22 / 24%);
}

.member-row__status-dot {
  background: #94a3b8;
}

.member-row--online .member-row__status-dot {
  background: #10b981;
  animation: member-avatar-pulse 2s cubic-bezier(0.25, 0, 0, 1) infinite;
  --member-avatar-pulse-color: rgb(16 185 129 / 34%);
}

.member-row--tracked .member-row__status-dot {
  background: #f97316;
  animation: member-avatar-pulse 2s cubic-bezier(0.25, 0, 0, 1) infinite;
  --member-avatar-pulse-color: rgb(249 115 22 / 42%);
}

.member-row__status-label,
.member-row__pin {
  color: #94a3b8;
}

.member-row--online .member-row__status-label,
.member-row--online .member-row__pin {
  color: #059669;
}

.member-row--tracked .member-row__status-label,
.member-row--tracked .member-row__pin {
  color: #ea580c;
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

@keyframes member-avatar-pulse {
  0% {
    box-shadow: 0 0 0 0 var(--member-avatar-pulse-color);
  }

  100% {
    box-shadow: 0 0 0 24px rgb(0 0 0 / 0%);
  }
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
  .member-sheet,
  .member-row__status-dot {
    animation: none;
    transition: none;
  }
}
</style>
