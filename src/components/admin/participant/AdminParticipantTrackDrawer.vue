<script setup>
import { computed } from 'vue';
import {
  AlertTriangle,
  Battery,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Loader2,
  LocateFixed,
  RefreshCw,
  Route,
  Trash2,
} from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';
import { shiftTrackDate } from '@/utils/locationTrack';
import AdminParticipantTrackMap from './AdminParticipantTrackMap.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  participant: { type: Object, default: null },
  trips: { type: Array, default: () => [] },
  selectedTripId: { type: String, default: '' },
  selectedDate: { type: String, default: '' },
  points: { type: Array, default: () => [] },
  selectedPointId: { type: String, default: '' },
  meta: { type: Object, default: () => ({}) },
  isLoading: { type: Boolean, default: false },
  error: { type: String, default: '' },
});

const emit = defineEmits([
  'update:open',
  'close',
  'change-trip',
  'change-date',
  'refresh',
  'select-point',
  'delete-point',
  'delete-day',
  'delete-all',
]);

const selectedTrip = computed(() =>
  props.trips.find((trip) => trip.id === props.selectedTripId)
);

const timezone = computed(
  () => props.meta.timezone || selectedTrip.value?.timezone || 'UTC'
);

const formatDateInTimezone = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone.value,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
};

const shouldWarnOngoingTracking = computed(
  () =>
    selectedTrip.value?.status === 'active' ||
    props.meta.tripStatus === 'active' ||
    props.selectedDate === formatDateInTimezone()
);

const changeDateBy = (days) => {
  const nextDate = shiftTrackDate(props.selectedDate, days);
  if (nextDate) emit('change-date', nextDate);
};

const formatTime = (timestamp) => {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: timezone.value,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(Number(timestamp)));
};

const formatCoordinate = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(6) : '—';
};
</script>

<template>
  <AdminDrawer
    :model-value="open"
    title="歷史軌跡"
    :subtitle="participant?.name || '成員'"
    size="xl"
    :z-index="95"
    @update:model-value="emit('update:open', $event)"
    @close="emit('close')"
  >
    <div class="flex h-full min-h-0 flex-col bg-slate-100">
      <section class="shrink-0 border-b border-slate-200 bg-white p-4">
        <div class="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_286px_auto]">
          <label class="space-y-1">
            <span class="track-label">旅程</span>
            <select
              :value="selectedTripId"
              class="track-control"
              @change="emit('change-trip', $event.target.value)"
            >
              <option v-for="trip in trips" :key="trip.id" :value="trip.id">
                {{ trip.title }}
              </option>
            </select>
          </label>
          <div class="space-y-1">
            <span class="track-label">日期</span>
            <div class="flex gap-2">
              <button
                type="button"
                class="track-icon-button"
                :disabled="isLoading || !selectedDate"
                title="前一天"
                @click="changeDateBy(-1)"
              >
                <ChevronLeft :size="17" />
              </button>
              <input
                type="date"
                :value="selectedDate"
                class="track-control min-w-0"
                @change="emit('change-date', $event.target.value)"
              />
              <button
                type="button"
                class="track-icon-button"
                :disabled="isLoading || !selectedDate"
                title="後一天"
                @click="changeDateBy(1)"
              >
                <ChevronRight :size="17" />
              </button>
            </div>
          </div>
          <div class="flex items-end gap-2">
            <button
              type="button"
              :disabled="isLoading || !selectedTripId || !selectedDate"
              class="track-icon-button"
              title="重新整理"
              @click="emit('refresh')"
            >
              <RefreshCw :size="17" :class="{ 'animate-spin': isLoading }" />
            </button>
            <button
              type="button"
              :disabled="isLoading || !points.length"
              class="track-danger-button"
              @click="emit('delete-day')"
            >
              <CalendarDays :size="16" /> 清除當日
            </button>
            <button
              type="button"
              :disabled="isLoading || !selectedTripId"
              class="track-danger-button"
              @click="emit('delete-all')"
            >
              <Trash2 :size="16" /> 全部清除
            </button>
          </div>
        </div>

        <div
          v-if="shouldWarnOngoingTracking"
          class="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-relaxed text-amber-700"
        >
          <AlertTriangle :size="16" class="mt-0.5 shrink-0" />
          位置分享仍可能持續寫入資料；清除歷史不會停止定位。
        </div>
      </section>

      <div class="grid min-h-0 flex-1 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside
          class="order-2 flex min-h-0 flex-col border-r border-slate-200 bg-white lg:order-1"
        >
          <div
            class="grid shrink-0 grid-cols-3 border-b border-slate-100 px-4 py-3"
          >
            <div>
              <span class="track-label">定位點</span>
              <strong class="mt-1 block text-lg font-black text-slate-900">
                {{ meta.pointCount ?? points.length }}
              </strong>
            </div>
            <div>
              <span class="track-label">開始</span>
              <strong class="mt-1 block text-sm font-black text-slate-700">
                {{ formatTime(points[0]?.ts) }}
              </strong>
            </div>
            <div>
              <span class="track-label">結束</span>
              <strong class="mt-1 block text-sm font-black text-slate-700">
                {{ formatTime(points[points.length - 1]?.ts) }}
              </strong>
            </div>
          </div>

          <div
            v-if="meta.truncated"
            class="shrink-0 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700"
          >
            資料超過顯示上限，目前顯示前 10,000 個定位點。
          </div>

          <div
            v-if="isLoading"
            class="flex flex-1 items-center justify-center gap-2 text-sm font-black text-slate-400"
          >
            <Loader2 :size="18" class="animate-spin" /> 讀取軌跡中
          </div>
          <div
            v-else-if="error"
            class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <AlertTriangle :size="24" class="text-red-400" />
            <p class="text-sm font-bold leading-relaxed text-red-500">
              {{ error }}
            </p>
            <button
              type="button"
              class="h-9 rounded-xl bg-slate-900 px-4 text-xs font-black text-white"
              @click="emit('refresh')"
            >
              重新讀取
            </button>
          </div>
          <div
            v-else-if="!points.length"
            class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
          >
            <Route :size="30" class="text-slate-300" />
            <p class="text-sm font-black text-slate-500">此日期沒有軌跡資料</p>
          </div>
          <div v-else class="min-h-0 flex-1 overflow-y-auto">
            <article
              v-for="point in points"
              :key="point.id"
              class="group flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 transition-colors"
              :class="
                point.id === selectedPointId
                  ? 'bg-indigo-50'
                  : 'bg-white hover:bg-slate-50'
              "
              @click="emit('select-point', point.id)"
            >
              <span
                class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                :class="
                  point.id === selectedPointId
                    ? 'bg-orange-500 ring-4 ring-orange-100'
                    : 'bg-indigo-500'
                "
              ></span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <strong class="text-sm font-black text-slate-800">{{
                    formatTime(point.ts)
                  }}</strong>
                  <span class="truncate text-[10px] font-bold text-slate-400">{{
                    point.source || 'unknown'
                  }}</span>
                </div>
                <p class="mt-1 font-mono text-[11px] font-bold text-slate-500">
                  {{ formatCoordinate(point.lat) }},
                  {{ formatCoordinate(point.lng) }}
                </p>
                <div
                  class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400"
                >
                  <span
                    v-if="point.acc != null"
                    class="inline-flex items-center gap-1"
                    ><LocateFixed :size="11" /> ±{{
                      Math.round(point.acc)
                    }}m</span
                  >
                  <span
                    v-if="point.spd != null"
                    class="inline-flex items-center gap-1"
                    ><Gauge :size="11" />
                    {{ Number(point.spd).toFixed(1) }}</span
                  >
                  <span
                    v-if="point.bat != null"
                    class="inline-flex items-center gap-1"
                    ><Battery :size="11" /> {{ Math.round(point.bat) }}%</span
                  >
                </div>
              </div>
              <button
                type="button"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                title="刪除此定位點"
                @click.stop="emit('delete-point', point.id)"
              >
                <Trash2 :size="14" />
              </button>
            </article>
          </div>
        </aside>

        <main class="order-1 min-h-[42dvh] bg-slate-100 lg:order-2 lg:min-h-0">
          <AdminParticipantTrackMap
            :points="points"
            :selected-point-id="selectedPointId"
            @select-point="emit('select-point', $event)"
          />
        </main>
      </div>
    </div>
  </AdminDrawer>
</template>

<style scoped>
.track-label {
  display: block;
  font-size: 10px;
  font-weight: 900;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0;
}

.track-control {
  height: 42px;
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 0 12px;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
  outline: none;
}

.track-control:focus {
  border-color: #a5b4fc;
  background: white;
}

.track-icon-button,
.track-danger-button {
  display: inline-flex;
  height: 42px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 900;
}

.track-icon-button {
  width: 42px;
  background: #f1f5f9;
  color: #475569;
}

.track-danger-button {
  border: 1px solid #fecaca;
  background: #fff;
  padding: 0 12px;
  color: #dc2626;
}

.track-icon-button:disabled,
.track-danger-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@media (max-width: 640px) {
  .track-danger-button {
    flex: 1;
    padding-inline: 8px;
  }
}
</style>
