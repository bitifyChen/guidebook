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
import AdminItineraryJsonAssistant from '@/components/admin/itinerary/AdminItineraryJsonAssistant.vue';
import AdminItineraryGeoAssistant from '@/components/admin/itinerary/AdminItineraryGeoAssistant.vue';
import AdminItineraryToolbar from '@/components/admin/itinerary/AdminItineraryToolbar.vue';
import AdminItineraryDaySection from '@/components/admin/itinerary/AdminItineraryDaySection.vue';
import AdminItineraryItemDrawer from '@/components/admin/itinerary/AdminItineraryItemDrawer.vue';
import AdminItineraryDayStartDrawer from '@/components/admin/itinerary/AdminItineraryDayStartDrawer.vue';
import { getItineraryCategoryLabel } from '@/constants/itineraryOptions';
import { sanitizeItineraryJsonItems } from '@/utils/itineraryJsonAssistant';
import {
  buildItineraryRouteSegments,
  getMissingRouteCoordinateItems,
  validateCoordinateAssistantPayload,
} from '@/utils/itineraryRoute';
import { ChevronLeft, Save } from 'lucide-vue-next';

const router = useRouter();
const travelStore = useTravelStore();
const tripStore = useTripStore();
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

const updateDayItems = (dayGroup, items) => {
  dayGroup.items = items;
  hasChanges.value = true;
};

const updateItemField = ({ item, field, value }) => {
  if (field === 'nextDrive.time') {
    item.nextDrive = { ...(item.nextDrive || {}), time: value };
  } else {
    item[field] = value;
  }
  updateItem(item);
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
      <AdminItineraryToolbar
        :is-checking-images="isCheckingImages"
        @create="openCreateItemDrawer"
        @export="handleExport"
        @import="handleImport"
        @check-images="handleCheckImages"
      >
        <template #json-assistant>
          <AdminItineraryJsonAssistant
            v-model:open="jsonAssistantOpen"
            :items="travelStore.itinerary"
            :day-options="jsonDayOptions"
            :selected-day="travelStore.selectedDay"
            @apply-json="handleApplyJson"
          />
        </template>
      </AdminItineraryToolbar>

      <AdminItineraryDaySection
        v-for="dayGroup in localItinerary"
        :key="dayGroup.day"
        :day-group="dayGroup"
        :start-time="
          travelStore.config.find(
            (entry) => Number(entry.day) === Number(dayGroup.day)
          )?.start || '--:--'
        "
        :calculating="routeCalculatingDay === dayGroup.day"
        :scheduled-items="travelStore.getDayItinerary(Number(dayGroup.day))"
        :image-status="travelStore.imageStatus"
        @update-items="updateDayItems(dayGroup, $event)"
        @reorder="onDragEnd"
        @edit-item="handleEditItem"
        @copy-item="handleCopyItem($event, dayGroup)"
        @update-item="updateItemField"
        @edit-start="openDayStartDrawer(dayGroup.day)"
        @calculate-routes="handleCalculateDayRoutes(dayGroup)"
      />
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

    <AdminItineraryItemDrawer
      v-model:open="itemDrawer.open"
      :session="itemDrawerSession"
      :mode="itemDrawer.mode"
      :item="itemDrawer.item"
      @close="closeItemDrawer"
      @saved="handleItemDrawerDone"
      @deleted="handleItemDrawerDone"
    />

    <AdminItineraryGeoAssistant
      v-model:open="geoAssistant.open"
      :items="geoAssistant.items"
      :is-saving="geoAssistant.isSaving"
      @apply="handleApplyCoordinates"
    />

    <AdminItineraryDayStartDrawer
      v-model:open="dayStartDrawer.open"
      v-model:start="dayStartDrawer.start"
      :day="dayStartDrawer.day"
      :is-saving="dayStartDrawer.isSaving"
      @save="saveDayStart"
    />
  </div>
</template>
