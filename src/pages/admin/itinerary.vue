<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useTravelStore } from '@/store/travelStore';
import { useTripStore } from '@/store/tripStore';
import {
  patchItineraryItem,
  bulkUpdateItinerary,
  bulkUpdateItineraryDay,
  bulkPatchItineraryCoordinates,
  patchDayConfig,
} from '@/api/itinerary';
import { sendItinerarySyncSignal } from '@/api/notifications';
import { getDrivingRouteDistance } from '@/api/routeDistance';
import AdminDrawer from '@/components/admin/AdminDrawer.vue';
import AdminItineraryJsonAssistant from '@/components/admin/AdminItineraryJsonAssistant.vue';
import AdminItineraryGeoAssistant from '@/components/admin/AdminItineraryGeoAssistant.vue';
import AdminItineraryItemForm from '@/components/admin/AdminItineraryItemForm.vue';
import { getItineraryCategoryLabel } from '@/constants/itineraryOptions';
import { sanitizeItineraryJsonItems } from '@/utils/itineraryJsonAssistant';
import {
  buildItineraryRouteSegments,
  getMissingRouteCoordinateItems,
  validateCoordinateAssistantPayload,
} from '@/utils/itineraryRoute';
import draggable from 'vuedraggable';
import {
  Calendar,
  ChevronRight,
  ChevronLeft,
  Clock3,
  Plus,
  Download,
  Upload,
  Save,
  GripVertical,
  MapPin,
  MapPinOff,
  Image,
  ImageOff,
  Copy,
} from 'lucide-vue-next';

const router = useRouter();
const travelStore = useTravelStore();
const tripStore = useTripStore();
const fileInput = ref(null);
const props = defineProps({
  embedded: { type: Boolean, default: false },
});

const localItinerary = ref([]);
const hasChanges = ref(false);
const isCheckingImages = ref(false);
const jsonAssistantOpen = ref(false);
const routeCalculatingDay = ref(null);
const itemDrawerSession = ref(0);
const itemDrawer = ref({
  open: false,
  mode: 'create',
  item: null,
});
const geoAssistant = ref({
  open: false,
  day: null,
  items: [],
  isSaving: false,
});
const dayStartDrawer = ref({
  open: false,
  day: null,
  start: '09:00',
  isSaving: false,
});
const getScheduledItem = (item) =>
  travelStore
    .getDayItinerary(Number(item?.day))
    .find((scheduledItem) => scheduledItem.id === item?.id) || item;
const hasScheduledTimeChange = (item, edge) => {
  const scheduledItem = getScheduledItem(item);
  const scheduledTime = scheduledItem[`scheduled${edge}Time`];
  const effectiveTime = scheduledItem[`${edge.toLowerCase()}Time`];
  return Boolean(scheduledTime && scheduledTime !== effectiveTime);
};

const jsonDayOptions = computed(() =>
  travelStore.config.map((entry) => ({
    day: Number(entry.day),
    title: entry.title || entry.date || '',
  }))
);

const emitItinerarySyncSignal = (item, reason = 'itineraryUpdated') => {
  if (tripStore.currentTrip?.status !== 'active') {
    return Promise.resolve({ skipped: true, reason: 'trip-not-active' });
  }
  return sendItinerarySyncSignal({
    tripId: tripStore.currentTripId,
    day: item?.day || travelStore.selectedDay,
    reason,
  });
};

const openCreateItemDrawer = () => {
  itemDrawerSession.value += 1;
  itemDrawer.value = {
    open: true,
    mode: 'create',
    item: null,
  };
};

const openEditItemDrawer = (item) => {
  itemDrawerSession.value += 1;
  itemDrawer.value = {
    open: true,
    mode: 'edit',
    item,
  };
};

const closeItemDrawer = () => {
  itemDrawer.value = {
    open: false,
    mode: 'create',
    item: null,
  };
};

const handleItemDrawerDone = async (payload = {}) => {
  closeItemDrawer();
  hasChanges.value = false;
  initLocalItinerary();
  if (!payload.item) return;
  try {
    await emitItinerarySyncSignal(
      payload.item,
      payload.action || 'item-updated'
    );
  } catch (syncError) {
    console.error('Itinerary sync signal failed:', syncError);
  }
  ElMessage.success('行程已儲存');
};

const handleCopyItem = (item, dayGroup) => {
  const index = dayGroup.items.findIndex((i) => i.id === item.id);
  const newItem = {
    ...JSON.parse(JSON.stringify(item)),
    id: `temp-${Date.now()}`, // 給予暫時 ID 以供 draggable 辨識
    location: `${item.location} (副本)`,
  };
  dayGroup.items.splice(index + 1, 0, newItem);
  hasChanges.value = true;
};

const checkImageLink = (url) => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
    setTimeout(() => resolve(false), 8000); // 8秒超時
  });
};

const handleCheckImages = async () => {
  if (isCheckingImages.value) return;

  isCheckingImages.value = true;
  const allItems = localItinerary.value.flatMap((day) => day.items);
  let errorCount = 0;

  for (const item of allItems) {
    const urlsToCheck = [];
    if (item.cover) urlsToCheck.push(item.cover);
    if (item.images && item.images.length > 0) {
      urlsToCheck.push(...item.images);
    }

    if (urlsToCheck.length === 0) continue;

    travelStore.setImageStatus(item.id, 'loading');

    try {
      const results = await Promise.all(
        urlsToCheck.map((url) => checkImageLink(url))
      );
      const allOk = results.every((res) => res === true);
      travelStore.setImageStatus(item.id, allOk ? 'ok' : 'error');
      if (!allOk) errorCount++;
    } catch (e) {
      travelStore.setImageStatus(item.id, 'error');
      errorCount++;
    }
  }

  isCheckingImages.value = false;
  if (errorCount > 0) {
    alert(
      `檢查完成！發現 ${errorCount} 個行程的圖片連結異常，請點擊異常項目進行修復。`
    );
  } else {
    alert('檢查完成！所有圖片連結皆正常。');
  }
};

onMounted(async () => {
  await travelStore.init();
  initLocalItinerary();
});

const initLocalItinerary = () => {
  const days = [];
  const daysCount = travelStore.config.length || 5;
  for (let d = 1; d <= daysCount; d++) {
    days.push({
      day: d,
      items: travelStore.itinerary
        .filter((i) => i.day === d)
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          ...item,
          map: item.map || item.geo?.mapUrl || '',
          geo: {
            lat: item.geo?.lat ?? null,
            lng: item.geo?.lng ?? null,
            ...(item.geo?.placeId ? { placeId: item.geo.placeId } : {}),
          },
          nextDrive: item.nextDrive || { time: 0, km: '' },
        })),
    });
  }
  localItinerary.value = days;
  hasChanges.value = false;
};

// 監聽 store 資料變化 (例如匯入後)，如果沒有未儲存的變動就重新初始化
watch(
  () => [travelStore.itinerary, travelStore.config],
  () => {
    if (!hasChanges.value) {
      initLocalItinerary();
    }
  },
  { deep: true }
);

const onDragEnd = () => {
  hasChanges.value = true;
};

const handleSaveOrder = async () => {
  if (!confirm('確定要更新行程排序嗎？')) return;

  const flattened = [];
  localItinerary.value.forEach((dayGroup) => {
    dayGroup.items.forEach((item, index) => {
      const saveItem = { ...item };
      // 如果是副本（暫時 ID），移除 ID 讓 Firebase 自動生成
      if (saveItem.id && saveItem.id.toString().startsWith('temp-')) {
        delete saveItem.id;
      }

      flattened.push({
        ...saveItem,
        day: dayGroup.day,
        order: index + 1,
      });
    });
  });

  try {
    await bulkUpdateItinerary(flattened);
    await travelStore.init();
    hasChanges.value = false;
    initLocalItinerary(); // 明確重新初始化，將 temp ID 替換為真實 ID
    try {
      await emitItinerarySyncSignal(
        { day: travelStore.selectedDay, location: '行程' },
        'order-updated'
      );
    } catch (syncError) {
      console.error('Itinerary sync signal failed:', syncError);
    }
    alert('排序已更新，現在可以編輯複製的行程詳情了。');
  } catch (err) {
    alert('儲存失敗：' + err.message);
  }
};

const handleEditItem = (item) => {
  if (item.id && item.id.toString().startsWith('temp-')) {
    alert(
      '請先點擊下方的「儲存更新排序」按鈕，以完成複製行程的建立，之後才能編輯詳細資訊。'
    );
    return;
  }
  openEditItemDrawer(item);
};

const updateItem = async (item) => {
  // 如果是暫時 ID，只需標記 hasChanges，不呼叫 API (因為還沒存入 Firebase)
  if (item.id && item.id.toString().startsWith('temp-')) {
    hasChanges.value = true;
    return;
  }

  try {
    await patchItineraryItem(item.id, {
      duration: item.duration,
      delay: item.delay,
      nextDrive: {
        ...(item.nextDrive || {}),
        time: Number(item.nextDrive?.time) || 0,
      },
    });
    // 如果沒有在拖拉狀態，同步更新 store 確保資料一致
    if (!hasChanges.value) {
      travelStore.updateLocalItem(item.id, {
        duration: item.duration,
        delay: item.delay,
      });
    }
    try {
      await emitItinerarySyncSignal(item, 'time-updated');
    } catch (syncError) {
      console.error('Itinerary sync signal failed:', syncError);
    }
    ElMessage.success('時間已更新');
  } catch (err) {
    alert('更新失敗：' + err.message);
  }
};

// 匯出 JSON
const handleExport = () => {
  // 複製一份並排序，同時移除不需要手動編輯的欄位
  const cleanData = [...travelStore.itinerary]
    .sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.order - b.order;
    })
    .map(({ updatedAt, startTime, endTime, ...rest }) => rest);

  const data = JSON.stringify(cleanData, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `itinerary_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

// 匯入 JSON
const handleImport = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      if (!Array.isArray(json)) throw new Error('格式錯誤：必須是陣列');

      if (
        !confirm(
          `即將同步 ${json.length} 個行程。這將會根據 ID 更新現有項目，並刪除不在列表中的項目。確定嗎？`
        )
      )
        return;

      const res = await bulkUpdateItinerary(json);
      alert(
        `同步成功！更新/新增了 ${res.updated} 個項目，刪除了 ${res.deleted} 個項目。`
      );
      await travelStore.init(); // 重新整理資料
      try {
        await emitItinerarySyncSignal(
          { day: travelStore.selectedDay, location: '行程' },
          'json-import'
        );
      } catch (syncError) {
        console.error('Itinerary sync signal failed:', syncError);
      }
    } catch (err) {
      alert('匯入失敗：' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // 清空 input
};

const handleApplyJson = async ({ mode, day, payload }) => {
  try {
    const { items, warnings } = sanitizeItineraryJsonItems(payload, {
      mode,
      day,
    });
    if (warnings.length) {
      ElMessage.warning(warnings.join('；'));
    }

    const confirmed =
      mode === 'full'
        ? confirm(
            `這會同步整份行程，JSON 內不存在的項目會被刪除。確定要套用 ${items.length} 筆資料嗎？`
          )
        : confirm(
            `這只會同步 Day ${day}，該日 JSON 內不存在的項目會被刪除。確定要套用 ${items.length} 筆資料嗎？`
          );
    if (!confirmed) return;

    const result =
      mode === 'full'
        ? await bulkUpdateItinerary(items)
        : await bulkUpdateItineraryDay(day, items);

    await travelStore.init();
    initLocalItinerary();
    hasChanges.value = false;
    jsonAssistantOpen.value = false;

    try {
      await emitItinerarySyncSignal(
        {
          day: mode === 'day' ? day : travelStore.selectedDay,
          location: '行程',
        },
        mode === 'day' ? 'json-day-applied' : 'json-full-applied'
      );
    } catch (syncError) {
      console.error('Itinerary sync signal failed:', syncError);
    }

    ElMessage.success(
      `JSON 已套用，更新 ${result.updated} 筆，刪除 ${result.deleted} 筆。`
    );
  } catch (error) {
    ElMessage.error(`JSON 套用失敗：${error.message}`);
  }
};

const calculateDayRoutes = async (dayGroup) => {
  const segments = buildItineraryRouteSegments(dayGroup.items).filter(
    (segment) =>
      segment.item?.id && !segment.item.id.toString().startsWith('temp-')
  );
  routeCalculatingDay.value = dayGroup.day;
  let updatedCount = 0;
  try {
    for (const segment of segments) {
      const distance = await getDrivingRouteDistance(
        segment.origin,
        segment.destination
      );
      const nextDrive = {
        ...(segment.item.nextDrive || {}),
        time: distance.minutes,
        km: distance.km,
      };
      await patchItineraryItem(segment.item.id, { nextDrive });
      segment.item.nextDrive = nextDrive;
      updatedCount += 1;
    }

    await travelStore.init();
    initLocalItinerary();
    await emitItinerarySyncSignal(
      { day: dayGroup.day },
      'route-distance-updated'
    ).catch((error) => console.error('Itinerary sync signal failed:', error));
    ElMessage.success(`本日行車時間已更新 ${updatedCount} 段。`);
  } catch (error) {
    ElMessage.error(`OSRM 計算失敗，既有行車時間已保留：${error.message}`);
  } finally {
    routeCalculatingDay.value = null;
  }
};

const handleCalculateDayRoutes = async (dayGroup) => {
  if (!dayGroup?.items?.length || routeCalculatingDay.value) return;
  const missingItems = getMissingRouteCoordinateItems(dayGroup.items);
  if (missingItems.length) {
    geoAssistant.value = {
      open: true,
      day: dayGroup.day,
      items: missingItems,
      isSaving: false,
    };
    return;
  }
  await calculateDayRoutes(dayGroup);
};

const handleApplyCoordinates = async (payload) => {
  geoAssistant.value.isSaving = true;
  try {
    const updates = validateCoordinateAssistantPayload(
      payload,
      geoAssistant.value.items
    );
    await bulkPatchItineraryCoordinates(updates);
    await travelStore.init();
    initLocalItinerary();
    const dayGroup = localItinerary.value.find(
      (entry) => Number(entry.day) === Number(geoAssistant.value.day)
    );
    geoAssistant.value.open = false;
    if (dayGroup) await calculateDayRoutes(dayGroup);
  } catch (error) {
    ElMessage.error(`座標套用失敗：${error.message}`);
  } finally {
    geoAssistant.value.isSaving = false;
  }
};

const openDayStartDrawer = (day) => {
  const config = travelStore.config.find(
    (entry) => Number(entry.day) === Number(day)
  );
  dayStartDrawer.value = {
    open: true,
    day,
    start: config?.start || '09:00',
    isSaving: false,
  };
};

const saveDayStart = async () => {
  if (!dayStartDrawer.value.start) return;
  dayStartDrawer.value.isSaving = true;
  try {
    const list = travelStore.config.map((entry) =>
      Number(entry.day) === Number(dayStartDrawer.value.day)
        ? { ...entry, start: dayStartDrawer.value.start }
        : { ...entry }
    );
    await patchDayConfig('dayConfigs', { list });
    await travelStore.init();
    initLocalItinerary();
    await emitItinerarySyncSignal(
      { day: dayStartDrawer.value.day },
      'day-start-updated'
    ).catch((error) => console.error('Itinerary sync signal failed:', error));
    dayStartDrawer.value.open = false;
    ElMessage.success('本日起始時間已更新');
  } catch (error) {
    ElMessage.error(`起始時間更新失敗：${error.message}`);
  } finally {
    dayStartDrawer.value.isSaving = false;
  }
};
</script>

<template>
  <div
    :class="
      props.embedded ? 'bg-slate-50 pb-24' : 'min-h-screen bg-slate-50 pb-32'
    "
  >
    <nav
      v-if="!props.embedded"
      class="p-6 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between"
    >
      <button
        @click="router.push('/admin')"
        class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"
      >
        <ChevronLeft :size="20" />
      </button>
      <h2 class="font-black text-slate-800 text-lg">行程進度管理</h2>
      <div class="w-10"></div>
    </nav>

    <main
      :class="
        props.embedded
          ? 'p-3 space-y-6 sm:p-5'
          : 'max-w-5xl mx-auto p-3 space-y-8 sm:p-6'
      "
    >
      <!-- 工具列 -->
      <div class="flex flex-wrap gap-2 px-2">
        <AdminItineraryJsonAssistant
          v-model:open="jsonAssistantOpen"
          :items="travelStore.itinerary"
          :day-options="jsonDayOptions"
          :selected-day="travelStore.selectedDay"
          @apply-json="handleApplyJson"
        />
        <button
          @click="openCreateItemDrawer"
          class="h-10 w-full px-4 bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 font-black text-sm shadow-sm hover:bg-indigo-700 active:scale-95 transition-transform sm:w-auto"
        >
          <Plus :size="16" />
          新增景點
        </button>
        <button
          @click="handleExport"
          class="h-10 px-4 bg-white rounded-xl border border-slate-100 flex items-center justify-center gap-2 font-bold text-slate-500 text-xs shadow-sm active:scale-95 transition-transform"
        >
          <Download :size="14" /> 匯出
        </button>
        <button
          @click="fileInput.click()"
          class="h-10 px-4 bg-white rounded-xl border border-slate-100 flex items-center justify-center gap-2 font-bold text-slate-500 text-xs shadow-sm active:scale-95 transition-transform"
        >
          <Upload :size="14" /> 匯入
        </button>
        <button
          @click="handleCheckImages"
          :disabled="isCheckingImages"
          class="h-10 px-4 bg-white rounded-xl border border-slate-100 flex items-center justify-center gap-2 font-bold text-slate-500 text-xs shadow-sm active:scale-95 transition-transform disabled:opacity-50"
        >
          <Image
            :size="14"
            :class="[
              isCheckingImages
                ? 'animate-spin text-slate-400'
                : 'text-blue-500',
            ]"
          />
          {{ isCheckingImages ? '檢查中...' : '圖片檢查' }}
        </button>
        <input
          type="file"
          ref="fileInput"
          accept=".json"
          @change="handleImport"
          class="hidden"
        />
      </div>

      <div
        v-for="dayGroup in localItinerary"
        :key="dayGroup.day"
        class="space-y-4"
      >
        <div class="flex flex-wrap items-center gap-2 px-2">
          <h3
            class="mr-auto flex items-center gap-2 text-lg font-black text-slate-800"
          >
            <Calendar :size="18" class="text-orange-500" /> Day
            {{ dayGroup.day }}
          </h3>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm"
            @click="openDayStartDrawer(dayGroup.day)"
          >
            <Clock3 :size="14" class="text-orange-500" />
            起始
            {{
              travelStore.config.find(
                (entry) => Number(entry.day) === Number(dayGroup.day)
              )?.start || '--:--'
            }}
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm disabled:opacity-50"
            :disabled="routeCalculatingDay === dayGroup.day"
            @click="handleCalculateDayRoutes(dayGroup)"
          >
            <MapPin :size="14" class="text-indigo-500" />
            {{
              routeCalculatingDay === dayGroup.day
                ? '計算中'
                : '計算本日行車時間'
            }}
          </button>
        </div>

        <draggable
          v-model="dayGroup.items"
          group="itinerary"
          item-key="id"
          @end="onDragEnd"
          class="grid gap-3 min-h-[50px]"
          handle=".drag-handle"
          ghost-class="opacity-50"
        >
          <template #item="{ element: item, index }">
            <div
              class="itinerary-admin-row flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4"
            >
              <div class="flex min-w-0 flex-1 items-start gap-3">
                <div
                  class="drag-handle flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-xl bg-slate-50 active:cursor-grabbing hover:bg-slate-100"
                >
                  <GripVertical :size="17" class="text-slate-300" />
                </div>

                <div
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-400"
                >
                  {{ index + 1 }}
                </div>

                <button
                  type="button"
                  class="min-w-0 flex-1 text-left"
                  @click="handleEditItem(item)"
                >
                  <span
                    class="flex items-center gap-1.5 font-black leading-tight text-slate-800"
                  >
                    <component
                      :is="item.map ? MapPin : MapPinOff"
                      :size="13"
                      :class="item.map ? 'text-blue-500' : 'text-slate-300'"
                    />

                    <component
                      :is="item?.images?.[0] || item?.cover ? Image : ImageOff"
                      :size="13"
                      :class="
                        travelStore.imageStatus[item.id] === 'error'
                          ? 'text-red-500'
                          : item?.images?.[0] || item?.cover
                            ? 'text-green-500'
                            : 'text-slate-300'
                      "
                    />
                    <span class="truncate">{{ item.location }}</span>
                  </span>
                  <div
                    class="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium"
                  >
                    <!-- 時間對比卡片 (預計 vs 實際) -->
                    <div
                      class="inline-flex flex-col gap-1 rounded-lg border border-slate-200/80 bg-slate-50/80 p-2 font-mono text-[11px] leading-none shadow-xs"
                    >
                      <!-- 1. 預計時間 (次要資訊：字體較淡、加上刪除線條件) -->
                      <div
                        class="grid grid-cols-[28px_1fr] items-center gap-1.5 text-slate-400"
                      >
                        <span
                          class="font-sans text-[10px] font-semibold text-slate-400"
                          >預計</span
                        >
                        <div class="flex items-center gap-1">
                          <Clock3 :size="11" class="shrink-0 text-slate-300" />
                          <span
                            :class="{
                              'line-through opacity-60': hasScheduledTimeChange(
                                item,
                                'Start'
                              ),
                            }"
                          >
                            {{
                              getScheduledItem(item).scheduledStartTime ||
                              '--:--'
                            }}
                          </span>
                          <span class="text-slate-300">-</span>
                          <span
                            :class="{
                              'line-through opacity-60': hasScheduledTimeChange(
                                item,
                                'End'
                              ),
                            }"
                          >
                            {{
                              getScheduledItem(item).scheduledEndTime || '--:--'
                            }}
                          </span>
                        </div>
                      </div>

                      <!-- 2. 實際時間 (主要資訊：字體加粗、高亮顯示變更狀態) -->
                      <div
                        class="grid grid-cols-[28px_1fr] items-center gap-1.5 text-slate-700"
                      >
                        <span
                          class="font-sans text-[10px] font-bold text-slate-500"
                          >實際</span
                        >
                        <div class="flex items-center gap-1 font-semibold">
                          <Clock3 :size="11" class="shrink-0 text-slate-400" />
                          <span
                            :class="{
                              'text-emerald-600 font-bold':
                                hasScheduledTimeChange(item, 'Start'),
                            }"
                          >
                            {{ getScheduledItem(item).startTime || '--:--' }}
                          </span>
                          <span class="text-slate-300">-</span>
                          <span
                            :class="{
                              'text-amber-600 font-bold':
                                hasScheduledTimeChange(item, 'End'),
                            }"
                          >
                            {{ getScheduledItem(item).endTime || '--:--' }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- 狀態標籤區塊 (Badges) -->
                    <div
                      class="flex flex-wrap items-center gap-1.5 text-[11px] font-medium"
                    >
                      <!-- 固定時間 -->
                      <span
                        v-if="item.fixedStartTime"
                        class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 ring-1 ring-indigo-700/10 ring-inset"
                      >
                        固定 {{ item.fixedStartTime }}
                      </span>

                      <!-- 等待時間 -->
                      <span
                        v-if="getScheduledItem(item).waitMinutes"
                        class="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-600/10 ring-inset"
                      >
                        等待 {{ getScheduledItem(item).waitMinutes }} 分
                      </span>

                      <!-- 遲到時間 -->
                      <span
                        v-if="getScheduledItem(item).fixedTimeLateMinutes"
                        class="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-600/10 ring-inset"
                      >
                        遲到
                        {{ getScheduledItem(item).fixedTimeLateMinutes }} 分
                      </span>
                    </div>
                  </div>
                </button>
              </div>

              <div
                class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
              >
                <div
                  class="flex min-w-[62px] flex-1 flex-col items-center rounded-xl border border-slate-100 bg-slate-50 px-2 py-1 sm:flex-none"
                >
                  <span class="text-[9px] font-black text-slate-400">停留</span>
                  <input
                    v-model.number="item.duration"
                    type="number"
                    @change="updateItem(item)"
                    class="w-full bg-transparent text-center font-mono font-black text-slate-600 outline-none sm:w-10"
                  />
                </div>
                <div
                  class="flex min-w-[62px] flex-1 flex-col items-center rounded-xl border border-orange-100 bg-orange-50 px-2 py-1 sm:flex-none"
                >
                  <span class="text-[9px] font-black text-orange-400"
                    >延遲</span
                  >
                  <input
                    v-model.number="item.delay"
                    type="number"
                    @change="updateItem(item)"
                    class="w-full bg-transparent text-center font-mono font-black text-orange-600 outline-none sm:w-10"
                  />
                </div>
                <div
                  class="flex min-w-[62px] flex-1 flex-col items-center rounded-xl border border-blue-100 bg-blue-50 px-2 py-1 sm:flex-none"
                >
                  <span class="text-[9px] font-black text-blue-400">車程</span>
                  <input
                    v-model.number="item.nextDrive.time"
                    type="number"
                    @change="updateItem(item)"
                    class="w-full bg-transparent text-center font-mono font-black text-blue-600 outline-none sm:w-10"
                  />
                </div>

                <div class="ml-auto flex items-center gap-1 sm:ml-1">
                  <button
                    @click="handleCopyItem(item, dayGroup)"
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-blue-500"
                    title="複製此行程"
                  >
                    <Copy :size="16" />
                  </button>
                  <button
                    @click="handleEditItem(item)"
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-orange-500"
                    title="編輯行程"
                  >
                    <ChevronRight :size="20" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </draggable>
      </div>
    </main>

    <!-- 浮動儲存按鈕 -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-y-20 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-20 opacity-0"
    >
      <div
        v-if="hasChanges"
        class="fixed bottom-10 left-0 right-0 flex justify-center z-50 px-6"
      >
        <button
          @click="handleSaveOrder"
          class="bg-orange-600 text-white px-8 py-4 rounded-full shadow-2xl font-black flex items-center gap-3 hover:bg-orange-700 active:scale-95 transition-all w-full max-w-xs justify-center"
        >
          <Save :size="20" />
          <span>儲存更新排序</span>
        </button>
      </div>
    </Transition>

    <AdminDrawer
      v-model="itemDrawer.open"
      bare
      size="md"
      :z-index="90"
      @close="closeItemDrawer"
    >
      <AdminItineraryItemForm
        :key="itemDrawerSession"
        :mode="itemDrawer.mode"
        :item="itemDrawer.item"
        compact
        @cancel="closeItemDrawer"
        @saved="handleItemDrawerDone"
        @deleted="handleItemDrawerDone"
      />
    </AdminDrawer>

    <AdminItineraryGeoAssistant
      v-model:open="geoAssistant.open"
      :items="geoAssistant.items"
      :is-saving="geoAssistant.isSaving"
      @apply="handleApplyCoordinates"
    />

    <AdminDrawer
      v-model="dayStartDrawer.open"
      size="sm"
      :z-index="125"
      title="設定起始時間"
      :subtitle="`Day ${dayStartDrawer.day || '-'}`"
      :close-on-click-modal="false"
    >
      <form class="flex h-full flex-col" @submit.prevent="saveDayStart">
        <div class="flex-1 p-5">
          <label class="block rounded-2xl border border-slate-200 bg-white p-4">
            <span class="text-xs font-black text-slate-500">本日出發時間</span>
            <input
              v-model="dayStartDrawer.start"
              type="time"
              required
              class="mt-3 h-14 w-full rounded-xl bg-slate-50 px-4 font-mono text-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </label>
        </div>
        <footer class="border-t border-slate-200 bg-white p-4">
          <button
            type="submit"
            :disabled="dayStartDrawer.isSaving"
            class="h-11 w-full rounded-xl bg-indigo-600 text-sm font-black text-white disabled:opacity-60"
          >
            {{ dayStartDrawer.isSaving ? '儲存中' : '儲存起始時間' }}
          </button>
        </footer>
      </form>
    </AdminDrawer>
  </div>
</template>

<route>
{
  meta: { layout: "admin" }
}
</route>
