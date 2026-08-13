<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Download,
  Loader2,
  MapPinned,
  Plus,
  Save,
} from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';
import AdminItineraryItemDrawer from './AdminItineraryItemDrawer.vue';
import AdminItineraryPlaceImport from './AdminItineraryPlaceImport.vue';
import AdminItineraryRouteImport from './AdminItineraryRouteImport.vue';
import AdminItineraryRouteItemEditor from './AdminItineraryRouteItemEditor.vue';
import AdminItineraryRouteMap from './AdminItineraryRouteMap.vue';
import AdminItineraryRouteTimeline from './AdminItineraryRouteTimeline.vue';
import { getDrivingRoutes } from '@/api/routeDistance';
import { calculateDayItinerary } from '@/utils/itinerarySchedule';
import { buildItineraryRouteSegments } from '@/utils/itineraryRoute';
import {
  buildGoogleMapsPointUrl,
  createImportedItineraryItems,
} from '@/utils/googleMapsRoute';

const props = defineProps({
  open: { type: Boolean, default: false },
  session: { type: Number, default: 0 },
  day: { type: Number, default: 1 },
  items: { type: Array, default: () => [] },
  startTime: { type: String, default: '09:00' },
  saving: { type: Boolean, default: false },
  selectedItemId: { type: String, default: '' },
});

const emit = defineEmits(['update:open', 'save']);

const draftItems = ref([]);
const selectedId = ref('');
const importOpen = ref(false);
const placeImportOpen = ref(false);
const moveItemId = ref('');
const routeResults = ref([]);
const routeLoading = ref(false);
const dirty = ref(false);
const mobilePanelExpanded = ref(false);
const closeCommitted = ref(false);
const closePromptPending = ref(false);
const itemDrawer = ref({
  open: false,
  session: 0,
  item: null,
});
let routeTimer = null;
let routeRequestSequence = 0;

const hasCoordinates = (item) => {
  if (
    item?.geo?.lat === '' ||
    item?.geo?.lat === null ||
    item?.geo?.lat === undefined ||
    item?.geo?.lng === '' ||
    item?.geo?.lng === null ||
    item?.geo?.lng === undefined
  ) {
    return false;
  }
  const lat = Number(item?.geo?.lat);
  const lng = Number(item?.geo?.lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
};

const createTemporaryId = () =>
  `route-temp-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

const normalizeDraftItems = (items) =>
  (Array.isArray(items) ? items : []).map((item, index) => ({
    ...item,
    id: item.id || createTemporaryId(),
    day: Number(props.day),
    order: index + 1,
    map: item.map || item.geo?.mapUrl || '',
    geo: {
      lat: item.geo?.lat ?? null,
      lng: item.geo?.lng ?? null,
      ...(item.geo?.placeId ? { placeId: item.geo.placeId } : {}),
    },
    duration: Number(item.duration) || 0,
    fixedStartTime: item.fixedStartTime || '',
    nextDrive: {
      time: Number(item.nextDrive?.time) || 0,
      km: item.nextDrive?.km ?? '',
    },
    images: Array.isArray(item.images) ? [...item.images] : [],
  }));

const scheduledItems = computed(() =>
  calculateDayItinerary(draftItems.value, props.startTime || '09:00')
);

const scheduledById = computed(() =>
  Object.fromEntries(scheduledItems.value.map((item) => [item.id, item]))
);

const selectedItem = computed(() =>
  draftItems.value.find((item) => String(item.id) === selectedId.value)
);

const routeErrorCount = computed(
  () => routeResults.value.filter((result) => result.error).length
);

const unresolvedNewItems = computed(() =>
  draftItems.value.filter(
    (item) => String(item.id).startsWith('route-temp-') && !hasCoordinates(item)
  )
);

const resetDraft = () => {
  draftItems.value = normalizeDraftItems(props.items);
  selectedId.value = String(
    draftItems.value.some(
      (item) => String(item.id) === String(props.selectedItemId)
    )
      ? props.selectedItemId
      : draftItems.value[0]?.id || ''
  );
  importOpen.value = false;
  placeImportOpen.value = false;
  moveItemId.value = '';
  routeResults.value = [];
  dirty.value = false;
  mobilePanelExpanded.value = false;
  closeCommitted.value = false;
  closePromptPending.value = false;
  itemDrawer.value = {
    open: false,
    session: itemDrawer.value.session,
    item: null,
  };
};

watch(
  () => [props.open, props.session],
  ([open]) => {
    if (open) {
      resetDraft();
      clearTimeout(routeTimer);
      routeTimer = setTimeout(() => calculateRoutes(), 0);
    }
  },
  { immediate: true }
);

const calculateRoutes = async () => {
  const requestSequence = ++routeRequestSequence;
  const segments = buildItineraryRouteSegments(draftItems.value);
  if (!segments.length) {
    routeResults.value = [];
    routeLoading.value = false;
    return;
  }

  routeLoading.value = true;
  const validSegments = segments.filter(
    (segment) => segment.origin && segment.destination
  );
  const validResults = await getDrivingRoutes(validSegments, {
    concurrency: 3,
  });
  if (requestSequence !== routeRequestSequence) return;

  const resultsByItemId = new Map(
    validResults.map((result) => [String(result.item?.id), result])
  );
  routeResults.value = segments.map(
    (segment) =>
      resultsByItemId.get(String(segment.item?.id)) || {
        ...segment,
        route: null,
        error: new Error('缺少有效座標。'),
      }
  );

  routeResults.value.forEach((result) => {
    if (!result.route || !result.item) return;
    const currentTime = Number(result.item.nextDrive?.time) || 0;
    const currentKm = String(result.item.nextDrive?.km ?? '');
    if (
      currentTime !== result.route.minutes ||
      currentKm !== String(result.route.km)
    ) {
      result.item.nextDrive = {
        ...(result.item.nextDrive || {}),
        time: result.route.minutes,
        km: result.route.km,
      };
      dirty.value = true;
    }
  });
  routeLoading.value = false;
};

const routeSignature = computed(() =>
  draftItems.value
    .map(
      (item, index) =>
        `${item.id}:${index}:${item.parentId || ''}:${item.geo?.lat ?? ''}:${item.geo?.lng ?? ''}`
    )
    .join('|')
);

watch(routeSignature, () => {
  clearTimeout(routeTimer);
  routeTimer = setTimeout(calculateRoutes, 450);
});

onBeforeUnmount(() => {
  clearTimeout(routeTimer);
  routeRequestSequence += 1;
});

const renumberItems = () => {
  draftItems.value.forEach((item, index) => {
    item.day = Number(props.day);
    item.order = index + 1;
  });
};

const updateItems = (items) => {
  draftItems.value = items;
  renumberItems();
  dirty.value = true;
};

const selectItem = (id) => {
  selectedId.value = String(id || '');
  mobilePanelExpanded.value = true;
};

const openImport = () => {
  importOpen.value = true;
  placeImportOpen.value = false;
  mobilePanelExpanded.value = true;
};

const openPlaceImport = () => {
  placeImportOpen.value = true;
  importOpen.value = false;
  moveItemId.value = '';
  mobilePanelExpanded.value = true;
};

const updateSelectedItem = ({ field, value }) => {
  const item = selectedItem.value;
  if (!item) return;
  if (field === 'geo.lat' || field === 'geo.lng') {
    const key = field.endsWith('lat') ? 'lat' : 'lng';
    const coordinate = value === '' ? null : Number(value);
    item.geo = {
      ...(item.geo || {}),
      [key]: Number.isFinite(coordinate) ? coordinate : null,
    };
    if (hasCoordinates(item)) {
      item.map = buildGoogleMapsPointUrl({
        name: item.location,
        lat: item.geo.lat,
        lng: item.geo.lng,
      });
    }
  } else {
    item[field] = value;
    if (field === 'location' && !hasCoordinates(item)) {
      item.map = buildGoogleMapsPointUrl({ name: value });
    }
  }
  dirty.value = true;
};

const toggleMoveMode = () => {
  if (!selectedItem.value) return;
  moveItemId.value =
    moveItemId.value === String(selectedItem.value.id)
      ? ''
      : String(selectedItem.value.id);
};

const handleMapClick = ({ lat, lng }) => {
  if (moveItemId.value) {
    const item = draftItems.value.find(
      (entry) => String(entry.id) === moveItemId.value
    );
    if (item) {
      item.geo = { ...(item.geo || {}), lat, lng };
      item.map = buildGoogleMapsPointUrl({ name: item.location, lat, lng });
      selectedId.value = String(item.id);
      dirty.value = true;
    }
    moveItemId.value = '';
  }
};

const openSelectedDetails = () => {
  if (!selectedItem.value) return;
  itemDrawer.value = {
    open: true,
    session: itemDrawer.value.session + 1,
    item: selectedItem.value,
  };
};

const closeItemDrawer = () => {
  itemDrawer.value = {
    ...itemDrawer.value,
    open: false,
    item: null,
  };
};

const handleDraftItemSaved = ({ item }) => {
  const index = draftItems.value.findIndex(
    (entry) => String(entry.id) === String(item.id)
  );
  if (index >= 0)
    draftItems.value.splice(index, 1, normalizeDraftItems([item])[0]);
  draftItems.value.sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
  );
  renumberItems();
  selectedId.value = String(item.id);
  dirty.value = true;
  closeItemDrawer();
};

const handleDraftItemDeleted = ({ item }) => {
  draftItems.value = draftItems.value.filter(
    (entry) => entry.id !== item.id && entry.parentId !== item.id
  );
  renumberItems();
  selectedId.value = String(draftItems.value[0]?.id || '');
  dirty.value = true;
  closeItemDrawer();
};

const duplicateSelectedItem = () => {
  const item = selectedItem.value;
  if (!item) return;
  const index = draftItems.value.findIndex((entry) => entry.id === item.id);
  const duplicate = {
    ...JSON.parse(JSON.stringify(item)),
    id: createTemporaryId(),
    parentId: item.parentId || '',
    location: `${item.location}（副本）`,
  };
  draftItems.value.splice(index + 1, 0, duplicate);
  renumberItems();
  selectedId.value = duplicate.id;
  dirty.value = true;
  openSelectedDetails();
};

const applyPlace = (place) => {
  const [item] = createImportedItineraryItems([place], {
    day: props.day,
    startOrder: draftItems.value.length + 1,
    idFactory: () => createTemporaryId(),
  });
  draftItems.value.push(item);
  renumberItems();
  selectedId.value = String(item.id);
  placeImportOpen.value = false;
  dirty.value = true;
  openSelectedDetails();
};

const applyImport = ({ mode, stops }) => {
  const startOrder = mode === 'append' ? draftItems.value.length + 1 : 1;
  const importedItems = createImportedItineraryItems(
    stops.map((stop) => ({
      ...stop,
      map: buildGoogleMapsPointUrl({ name: stop.name, ...stop.geo }),
    })),
    {
      day: props.day,
      startOrder,
      idFactory: () => createTemporaryId(),
    }
  );
  draftItems.value =
    mode === 'replace'
      ? importedItems
      : [...draftItems.value, ...importedItems];
  renumberItems();
  selectedId.value = String(importedItems[0]?.id || '');
  importOpen.value = false;
  mobilePanelExpanded.value = false;
  dirty.value = true;
};

const removeSelectedItem = async () => {
  const item = selectedItem.value;
  if (!item) return;
  const childrenCount = draftItems.value.filter(
    (candidate) => candidate.parentId === item.id
  ).length;
  try {
    await ElMessageBox.confirm(
      childrenCount
        ? `此景點包含 ${childrenCount} 個子景點，將一併從本日草稿移除。`
        : '確定要從本日草稿移除這個景點嗎？',
      '移除景點',
      {
        confirmButtonText: '移除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
  } catch (error) {
    return;
  }
  draftItems.value = draftItems.value.filter(
    (candidate) => candidate.id !== item.id && candidate.parentId !== item.id
  );
  renumberItems();
  selectedId.value = String(draftItems.value[0]?.id || '');
  dirty.value = true;
};

const requestClose = async () => {
  if (closeCommitted.value || closePromptPending.value || props.saving) return;
  if (dirty.value && !props.saving) {
    closePromptPending.value = true;
    try {
      await ElMessageBox.confirm(
        '尚未儲存的地圖編排內容將會消失。',
        '離開地圖編排',
        {
          confirmButtonText: '放棄修改',
          cancelButtonText: '繼續編輯',
          type: 'warning',
        }
      );
    } catch (error) {
      return;
    } finally {
      closePromptPending.value = false;
    }
  }
  closeCommitted.value = true;
  dirty.value = false;
  emit('update:open', false);
};

const saveDraft = () => {
  const unnamed = draftItems.value.filter((item) => !item.location?.trim());
  if (unnamed.length) {
    ElMessage.warning(`仍有 ${unnamed.length} 個景點尚未命名。`);
    selectedId.value = String(unnamed[0].id);
    return;
  }
  if (unresolvedNewItems.value.length) {
    ElMessage.warning(
      `仍有 ${unresolvedNewItems.value.length} 個新景點尚未在地圖定位。`
    );
    selectedId.value = String(unresolvedNewItems.value[0].id);
    return;
  }

  emit('save', {
    day: Number(props.day),
    items: draftItems.value.map((item, index) => ({
      ...item,
      day: Number(props.day),
      order: index + 1,
      map: String(item.map || '').trim(),
      geo: {
        lat: item.geo?.lat ?? null,
        lng: item.geo?.lng ?? null,
        ...(item.geo?.placeId ? { placeId: item.geo.placeId } : {}),
      },
      duration: Number(item.duration) || 0,
      fixedStartTime: item.fixedStartTime || '',
      nextDrive: {
        time: Number(item.nextDrive?.time) || 0,
        km: item.nextDrive?.km ?? '',
      },
    })),
  });
};
</script>

<template>
  <AdminDrawer
    :model-value="open"
    size="xl"
    :title="`Day ${day} 地圖編排`"
    :subtitle="`起始時間 ${startTime}`"
    :close-on-click-modal="true"
    @update:model-value="(value) => (value ? null : requestClose())"
  >
    <template #actions>
      <span
        v-if="routeLoading"
        class="mr-2 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600"
      >
        <Loader2 :size="13" class="animate-spin" /> 計算路線
      </span>
      <span
        v-else-if="routeErrorCount"
        class="mr-2 inline-flex items-center gap-1 text-[11px] font-bold text-orange-600"
      >
        <CircleAlert :size="13" /> {{ routeErrorCount }} 段待確認
      </span>
    </template>

    <div class="flex h-full min-h-0 flex-col">
      <div class="route-planner-layout min-h-0 flex-1">
        <aside
          class="route-planner-panel relative z-10 flex min-h-0 min-w-0 flex-col border-r border-slate-200 bg-white"
          :class="{
            'route-planner-panel--expanded': mobilePanelExpanded,
          }"
        >
          <button
            type="button"
            class="route-planner-sheet-toggle"
            :aria-expanded="mobilePanelExpanded"
            @click="mobilePanelExpanded = !mobilePanelExpanded"
          >
            <span />
            <ChevronDown v-if="mobilePanelExpanded" :size="15" />
            <ChevronUp v-else :size="15" />
          </button>
          <div
            class="grid shrink-0 grid-cols-2 gap-2 border-b border-slate-200 p-3"
          >
            <button
              type="button"
              class="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-xs font-black text-white"
              @click="openImport"
            >
              <Download :size="15" /> Google 路線
            </button>
            <button
              type="button"
              class="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 text-xs font-black text-white transition hover:bg-slate-800"
              @click="openPlaceImport"
            >
              <Plus :size="15" /> 新增景點
            </button>
          </div>

          <div class="min-h-[120px] flex-1 overflow-y-auto">
            <div
              v-if="!draftItems.length"
              class="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center"
            >
              <MapPinned :size="30" class="text-slate-300" />
              <p class="mt-3 text-sm font-black text-slate-500">本日尚無景點</p>
              <p class="mt-1 text-xs font-bold text-slate-400">
                貼上 Google Maps 景點連結，或匯入多站路線。
              </p>
            </div>
            <AdminItineraryRouteTimeline
              v-else
              :items="draftItems"
              :scheduled-items="scheduledItems"
              :selected-id="selectedId"
              @update-items="updateItems"
              @select="selectItem"
            />
          </div>

          <AdminItineraryRouteItemEditor
            class="route-planner-editor"
            :item="selectedItem"
            :scheduled-item="scheduledById[selectedItem?.id]"
            :moving="moveItemId === String(selectedItem?.id || '')"
            @update="updateSelectedItem"
            @move="toggleMoveMode"
            @remove="removeSelectedItem"
            @details="openSelectedDetails"
            @duplicate="duplicateSelectedItem"
          />

          <AdminItineraryPlaceImport
            :open="placeImportOpen"
            @close="placeImportOpen = false"
            @apply="applyPlace"
          />

          <AdminItineraryRouteImport
            :open="importOpen"
            :existing-count="draftItems.length"
            @close="importOpen = false"
            @apply="applyImport"
          />
        </aside>

        <main class="route-planner-map min-h-0">
          <AdminItineraryRouteMap
            :items="draftItems"
            :route-results="routeResults"
            :selected-id="selectedId"
            :move-item-id="moveItemId"
            @select="selectItem"
            @map-click="handleMapClick"
          />
        </main>
      </div>

      <div
        class="admin-drawer-footer flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-3"
      >
        <p class="mr-auto hidden text-[11px] font-bold text-slate-400 sm:block">
          {{ draftItems.length }} 個景點 · 變更只會影響 Day {{ day }}
        </p>
        <button
          type="button"
          class="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-600"
          :disabled="saving || routeLoading"
          @click="requestClose"
        >
          取消
        </button>
        <button
          type="button"
          class="flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white disabled:opacity-50"
          :disabled="saving || routeLoading"
          @click="saveDraft"
        >
          <Loader2 v-if="saving" :size="17" class="animate-spin" />
          <Save v-else :size="17" />
          儲存本日行程
        </button>
      </div>
    </div>
  </AdminDrawer>

  <AdminItineraryItemDrawer
    v-model:open="itemDrawer.open"
    :session="itemDrawer.session"
    mode="edit"
    :item="itemDrawer.item"
    draft
    lock-day
    :available-items="draftItems"
    :default-day="day"
    @close="closeItemDrawer"
    @saved="handleDraftItemSaved"
    @deleted="handleDraftItemDeleted"
  />
</template>

<style scoped>
.route-planner-layout {
  display: grid;
  grid-template-columns: minmax(340px, 410px) minmax(0, 1fr);
}

@media (max-width: 900px) {
  .route-planner-layout {
    position: relative;
    display: block;
    overflow: hidden;
  }

  .route-planner-map {
    position: absolute;
    inset: 0;
  }

  .route-planner-panel {
    position: absolute;
    right: 8px;
    bottom: 8px;
    left: 8px;
    z-index: 500;
    height: min(24vh, 190px);
    border-right: 0;
    border: 1px solid rgb(226 232 240 / 90%);
    border-radius: 18px;
    box-shadow: 0 18px 48px rgb(15 23 42 / 22%);
    transition: height 180ms ease;
  }

  .route-planner-panel--expanded {
    height: min(62vh, 520px);
  }

  .route-planner-panel:not(.route-planner-panel--expanded)
    :deep(.route-planner-editor) {
    display: none;
  }

  .route-planner-sheet-toggle {
    display: flex;
    height: 24px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #64748b;
  }

  .route-planner-sheet-toggle span {
    width: 36px;
    height: 4px;
    border-radius: 999px;
    background: #cbd5e1;
  }
}

@media (min-width: 901px) {
  .route-planner-sheet-toggle {
    display: none;
  }
}
</style>
