<script setup>
import { computed, ref, watch } from 'vue';
import { Check, Download, Loader2, Users } from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  participants: { type: Array, default: () => [] },
  trips: { type: Array, default: () => [] },
  initialTripId: { type: String, default: '' },
  initialParticipantId: { type: String, default: '' },
  isExporting: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open', 'close', 'export']);

const selectedTripId = ref('');
const selectedParticipantIds = ref([]);
const startDate = ref('');
const endDate = ref('');
const outputFormat = ref('geojson');

const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const getTripDate = (trip, keys, fallback) => {
  for (const key of keys) {
    if (trip?.[key]) return String(trip[key]).slice(0, 10);
  }
  return fallback;
};

const selectedTrip = computed(() =>
  props.trips.find((trip) => trip.id === selectedTripId.value)
);

const availableParticipants = computed(() =>
  props.participants
    .filter((participant) =>
      (participant.tripIds || []).includes(selectedTripId.value)
    )
    .sort((left, right) =>
      String(left.name || '').localeCompare(String(right.name || ''), 'zh-Hant')
    )
);

const selectedCount = computed(() => selectedParticipantIds.value.length);
const isDateRangeValid = computed(() =>
  Boolean(startDate.value && endDate.value && startDate.value <= endDate.value)
);
const canSubmit = computed(
  () =>
    !props.isExporting &&
    Boolean(selectedTripId.value) &&
    selectedCount.value > 0 &&
    isDateRangeValid.value
);

const resetForm = () => {
  const fallback = localDate();
  const preferredTrip =
    props.trips.find((trip) => trip.id === props.initialTripId) ||
    props.trips[0];
  selectedTripId.value = preferredTrip?.id || '';
  const tripStart = getTripDate(
    preferredTrip,
    ['startDate', 'start', 'departureDate'],
    fallback
  );
  const tripEnd = getTripDate(
    preferredTrip,
    ['endDate', 'end', 'returnDate'],
    tripStart
  );
  startDate.value = tripStart;
  endDate.value = tripEnd >= tripStart ? tripEnd : tripStart;
  outputFormat.value = 'geojson';

  const preferredParticipant = availableParticipants.value.find(
    (participant) => participant.id === props.initialParticipantId
  );
  selectedParticipantIds.value = preferredParticipant
    ? [preferredParticipant.id]
    : [];
};

const updateDatesForTrip = () => {
  const fallback = localDate();
  const tripStart = getTripDate(
    selectedTrip.value,
    ['startDate', 'start', 'departureDate'],
    fallback
  );
  const tripEnd = getTripDate(
    selectedTrip.value,
    ['endDate', 'end', 'returnDate'],
    tripStart
  );
  startDate.value = tripStart;
  endDate.value = tripEnd >= tripStart ? tripEnd : tripStart;
  selectedParticipantIds.value = selectedParticipantIds.value.filter((id) =>
    availableParticipants.value.some((participant) => participant.id === id)
  );
};

watch(
  () => props.open,
  (open) => {
    if (open) resetForm();
  },
  { immediate: true }
);

watch(selectedTripId, (value, previousValue) => {
  if (value && value !== previousValue) updateDatesForTrip();
});

const isSelected = (participantId) =>
  selectedParticipantIds.value.includes(participantId);

const toggleParticipant = (participantId) => {
  const next = new Set(selectedParticipantIds.value);
  if (next.has(participantId)) next.delete(participantId);
  else next.add(participantId);
  selectedParticipantIds.value = Array.from(next);
};

const selectAllParticipants = () => {
  selectedParticipantIds.value = availableParticipants.value.map(
    (participant) => participant.id
  );
};

const clearParticipants = () => {
  selectedParticipantIds.value = [];
};

const submit = () => {
  if (!canSubmit.value) return;
  emit('export', {
    tripIds: [selectedTripId.value],
    participantIds: selectedParticipantIds.value,
    startDate: startDate.value,
    endDate: endDate.value,
    format: outputFormat.value,
  });
};
</script>

<template>
  <AdminDrawer
    :model-value="open"
    title="匯出歷史軌跡"
    subtitle="僅限全域管理員；匯出內容不包含電量或內部識別資料。"
    size="md"
    :z-index="105"
    @update:model-value="emit('update:open', $event)"
    @close="emit('close')"
  >
    <div class="flex h-full min-h-0 flex-col bg-slate-50">
      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <section class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
            >
              <Download :size="19" />
            </div>
            <div>
              <h4 class="text-sm font-black text-slate-900">選擇匯出範圍</h4>
              <p class="mt-1 text-xs font-bold leading-relaxed text-slate-400">
                單一成員與單日會直接下載；跨成員或跨日期會自動打包成 ZIP。
              </p>
            </div>
          </div>
        </section>

        <label class="block space-y-2">
          <span class="admin-track-export-label">旅程</span>
          <select v-model="selectedTripId" class="admin-track-export-control">
            <option value="" disabled>請選擇旅程</option>
            <option v-for="trip in trips" :key="trip.id" :value="trip.id">
              {{ trip.title }}
            </option>
          </select>
        </label>

        <section class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <span class="admin-track-export-label">成員</span>
            <div class="flex gap-2">
              <button
                type="button"
                class="admin-track-export-link"
                :disabled="!availableParticipants.length"
                @click="selectAllParticipants"
              >
                全選
              </button>
              <button
                type="button"
                class="admin-track-export-link"
                :disabled="!selectedCount"
                @click="clearParticipants"
              >
                清除
              </button>
            </div>
          </div>
          <div
            v-if="availableParticipants.length"
            class="grid max-h-56 gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-2"
          >
            <label
              v-for="participant in availableParticipants"
              :key="participant.id"
              class="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-700"
            >
              <input
                type="checkbox"
                :checked="isSelected(participant.id)"
                class="h-4 w-4 accent-indigo-600"
                @change="toggleParticipant(participant.id)"
              />
              <span class="truncate">{{
                participant.name || '未命名成員'
              }}</span>
            </label>
          </div>
          <div
            v-else
            class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs font-bold text-slate-400"
          >
            此旅程目前沒有可匯出的成員。
          </div>
          <p class="text-[11px] font-bold text-slate-400">
            已選 {{ selectedCount }} 位
          </p>
        </section>

        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block space-y-2">
            <span class="admin-track-export-label">開始日期</span>
            <input
              v-model="startDate"
              type="date"
              class="admin-track-export-control"
            />
          </label>
          <label class="block space-y-2">
            <span class="admin-track-export-label">結束日期</span>
            <input
              v-model="endDate"
              type="date"
              class="admin-track-export-control"
            />
          </label>
        </div>
        <p
          v-if="!isDateRangeValid"
          class="-mt-3 text-xs font-bold text-red-500"
        >
          請確認日期範圍。
        </p>

        <section class="space-y-2">
          <span class="admin-track-export-label">格式</span>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="admin-track-export-format"
              :class="outputFormat === 'geojson' ? 'is-active' : ''"
              @click="outputFormat = 'geojson'"
            >
              <Check v-if="outputFormat === 'geojson'" :size="15" />
              GeoJSON
            </button>
            <button
              type="button"
              class="admin-track-export-format"
              :class="outputFormat === 'gpx' ? 'is-active' : ''"
              @click="outputFormat = 'gpx'"
            >
              <Check v-if="outputFormat === 'gpx'" :size="15" />
              GPX
            </button>
          </div>
        </section>

        <div
          class="flex items-start gap-2 rounded-xl bg-indigo-50 px-3 py-3 text-xs font-bold leading-relaxed text-indigo-700"
        >
          <Users :size="16" class="mt-0.5 shrink-0" />
          匯出資料只保留時間、座標與可用的精度、速度、高度、方向；不含電量、定位
          token、邀請碼或 Firebase ID。
        </div>
      </div>

      <footer
        class="admin-drawer-footer shrink-0 border-t border-slate-200 bg-white"
      >
        <button
          type="button"
          class="h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-600"
          :disabled="isExporting"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white disabled:opacity-40"
          :disabled="!canSubmit"
          @click="submit"
        >
          <Loader2 v-if="isExporting" :size="16" class="animate-spin" />
          <Download v-else :size="16" />
          {{ isExporting ? '匯出中' : '開始匯出' }}
        </button>
      </footer>
    </div>
  </AdminDrawer>
</template>

<style scoped>
.admin-track-export-label {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.admin-track-export-control {
  width: 100%;
  height: 42px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 0 12px;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
  outline: none;
}

.admin-track-export-control:focus {
  border-color: #a5b4fc;
  background: #fff;
}

.admin-track-export-link {
  color: #4f46e5;
  font-size: 11px;
  font-weight: 900;
}

.admin-track-export-link:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.admin-track-export-format {
  display: inline-flex;
  height: 42px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
}

.admin-track-export-format.is-active {
  border-color: #818cf8;
  background: #eef2ff;
  color: #4338ca;
}
</style>
