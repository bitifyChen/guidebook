<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useTravelStore } from '@/store/travelStore';
import { useTripStore } from '@/store/tripStore';
import { useUserStore } from '@/store/userStore';
import { patchItineraryItem, bulkUpdateItinerary } from '@/api/itinerary';
import { sendGuidebookNotification } from '@/api/notifications';
import AdminDrawer from '@/components/admin/AdminDrawer.vue';
import AdminItineraryItemForm from '@/components/admin/AdminItineraryItemForm.vue';
import { getItineraryCategoryLabel } from '@/constants/itineraryOptions';
import draggable from 'vuedraggable';
import {
  BellRing,
  Calendar,
  CheckCircle2,
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
  LogIn,
  LogOut,
} from 'lucide-vue-next';

const router = useRouter();
const travelStore = useTravelStore();
const tripStore = useTripStore();
const userStore = useUserStore();
const fileInput = ref(null);
const props = defineProps({
  embedded: { type: Boolean, default: false },
});

const localItinerary = ref([]);
const hasChanges = ref(false);
const isCheckingImages = ref(false);
const itemDrawer = ref({
  open: false,
  mode: 'create',
  item: null,
});
const timeAdjustmentDrawer = ref({
  open: false,
  item: null,
  mode: 'arrived',
  actualTime: '',
  isSaving: false,
});

const getScheduledItem = (item) =>
  travelStore
    .getDayItinerary(Number(item?.day))
    .find((scheduledItem) => scheduledItem.id === item?.id) || item;

const timeToMinutes = (value) => {
  const [hours, minutes] = String(value || '00:00')
    .split(':')
    .map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const formatMinutes = (value) => {
  if (!Number.isFinite(value)) return '--:--';
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const nearestMinuteDelta = (target, reference) => {
  let delta = target - reference;
  if (delta > 720) delta -= 1440;
  if (delta < -720) delta += 1440;
  return Math.round(delta);
};

const adjustmentScheduledItem = computed(() =>
  getScheduledItem(timeAdjustmentDrawer.value.item)
);

const adjustmentPreview = computed(() => {
  const item = adjustmentScheduledItem.value;
  const actualMinutes = timeToMinutes(timeAdjustmentDrawer.value.actualTime);
  const startMinutes = timeToMinutes(item?.startTime);
  const duration = Number(item?.duration) || 0;
  const previousDelay = Number(item?.delay) || 0;
  if (!Number.isFinite(actualMinutes) || !Number.isFinite(startMinutes)) {
    return {
      previousDelay,
      nextDelay: previousDelay,
      change: 0,
      nextEndTime: item?.endTime || '--:--',
    };
  }

  const referenceMinutes =
    timeAdjustmentDrawer.value.mode === 'arrived'
      ? startMinutes
      : startMinutes + duration;
  const nextDelay = Math.max(
    -duration,
    nearestMinuteDelta(actualMinutes, referenceMinutes)
  );
  return {
    previousDelay,
    nextDelay,
    change: nextDelay - previousDelay,
    nextEndTime: formatMinutes(startMinutes + duration + nextDelay),
  };
});

const adjustmentDayLabel = computed(() => {
  const item = timeAdjustmentDrawer.value.item;
  const config = travelStore.config.find(
    (entry) => Number(entry.day) === Number(item?.day)
  );
  return config?.date ? `Day ${item.day}，${config.date}` : `Day ${item?.day || '-'}`;
});

const formatDelay = (value) => {
  const number = Number(value) || 0;
  return number > 0 ? `+${number}` : String(number);
};

const openTimeAdjustment = (item, mode) => {
  if (!item?.id || item.id.toString().startsWith('temp-')) {
    ElMessage.warning('請先儲存這筆行程，再調整實際時間。');
    return;
  }
  timeAdjustmentDrawer.value = {
    open: true,
    item,
    mode,
    actualTime: new Date().toTimeString().slice(0, 5),
    isSaving: false,
  };
};

const closeTimeAdjustment = () => {
  timeAdjustmentDrawer.value = {
    open: false,
    item: null,
    mode: 'arrived',
    actualTime: '',
    isSaving: false,
  };
};

const notifyScheduleChange = (item, body) =>
  sendGuidebookNotification({
    title: `${tripStore.currentTrip?.title || '旅程'}行程時間更新`,
    body:
      body || `${item.location}時間已調整，請重新查看當日行程。`,
    clickUrl: `${window.location.origin}/itinerary?day=${item.day}`,
    tripId: tripStore.currentTripId,
  });

const getNotificationResultText = (result) =>
  Number(result?.successCount || 0) > 0
    ? `已通知 ${result.successCount} 個裝置`
    : '目前沒有已啟用通知的裝置';

const saveTimeAdjustment = async () => {
  const item = timeAdjustmentDrawer.value.item;
  if (!item?.id || !timeAdjustmentDrawer.value.actualTime) return;

  const mode = timeAdjustmentDrawer.value.mode;
  const nextDelay = adjustmentPreview.value.nextDelay;
  const timingRecord = {
    mode,
    actualTime: timeAdjustmentDrawer.value.actualTime,
    previousDelay: adjustmentPreview.value.previousDelay,
    delay: nextDelay,
    adjustedAt: Date.now(),
    adjustedBy: userStore.myParticipant?.id || userStore.user?.uid || '',
  };
  timeAdjustmentDrawer.value.isSaving = true;
  try {
    await patchItineraryItem(item.id, {
      delay: nextDelay,
      timingStatus: mode,
      lastTimingAdjustment: timingRecord,
    });
    travelStore.updateLocalItem(item.id, {
      delay: nextDelay,
      timingStatus: mode,
      lastTimingAdjustment: timingRecord,
    });
    await travelStore.init();
    initLocalItinerary();

    let notificationMessage = '';
    let notificationFailed = false;
    try {
      const actionLabel = mode === 'arrived' ? '抵達' : '離開';
      const result = await notifyScheduleChange(
        item,
        `${item.location}已${actionLabel}，後續行程時間已更新。`
      );
      notificationMessage = `，${getNotificationResultText(result)}`;
    } catch (notificationError) {
      notificationMessage = '，但推播通知未送出';
      notificationFailed = true;
      console.error('Schedule notification failed:', notificationError);
    }

    if (notificationFailed) {
      ElMessage.warning(`行程時間已更新${notificationMessage}`);
    } else {
      ElMessage.success(`行程時間已更新${notificationMessage}`);
    }
    closeTimeAdjustment();
  } catch (error) {
    ElMessage.error(`時間更新失敗：${error.message}`);
    timeAdjustmentDrawer.value.isSaving = false;
  }
};

const openCreateItemDrawer = () => {
  itemDrawer.value = {
    open: true,
    mode: 'create',
    item: null,
  };
};

const openEditItemDrawer = (item) => {
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
  if (!payload.timeChanged || !payload.item) return;
  try {
    const body =
      payload.action === 'created'
        ? `${payload.item.location}已加入行程，請重新查看當日安排。`
        : payload.action === 'deleted'
          ? `${payload.item.location}已從行程移除，請重新查看當日安排。`
          : '';
    const result = await notifyScheduleChange(payload.item, body);
    ElMessage.success(`行程已儲存，${getNotificationResultText(result)}`);
  } catch (notificationError) {
    ElMessage.warning('行程已儲存，但推播通知未送出。');
    console.error('Schedule notification failed:', notificationError);
  }
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
        .map((item) => ({ ...item })), // 淺拷貝以供編輯
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
      await notifyScheduleChange(
        { day: travelStore.selectedDay, location: '行程' },
        '行程順序已更新，請重新查看當日安排。'
      );
    } catch (notificationError) {
      console.error('Schedule notification failed:', notificationError);
    }
    alert('排序已更新，現在可以編輯複製的行程詳情了。');
  } catch (err) {
    alert('儲存失敗：' + err.message);
  }
};

const handleEditItem = (item) => {
  if (item.id && item.id.toString().startsWith('temp-')) {
    alert('請先點擊下方的「儲存更新排序」按鈕，以完成複製行程的建立，之後才能編輯詳細資訊。');
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
    });
    // 如果沒有在拖拉狀態，同步更新 store 確保資料一致
    if (!hasChanges.value) {
      travelStore.updateLocalItem(item.id, {
        duration: item.duration,
        delay: item.delay,
      });
    }
    try {
      const result = await notifyScheduleChange(item);
      ElMessage.success(`時間已更新，${getNotificationResultText(result)}`);
    } catch (notificationError) {
      ElMessage.warning('時間已更新，但推播通知未送出。');
      console.error('Schedule notification failed:', notificationError);
    }
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
        await notifyScheduleChange(
          { day: travelStore.selectedDay, location: '行程' },
          '行程內容已更新，請重新查看最新安排。'
        );
      } catch (notificationError) {
        console.error('Schedule notification failed:', notificationError);
      }
    } catch (err) {
      alert('匯入失敗：' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // 清空 input
};
</script>

<template>
  <div :class="props.embedded ? 'bg-slate-50 pb-24' : 'min-h-screen bg-slate-50 pb-32'">
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

    <main :class="props.embedded ? 'p-3 space-y-6 sm:p-5' : 'max-w-5xl mx-auto p-3 space-y-8 sm:p-6'">
      <!-- 工具列 -->
      <div class="flex flex-wrap gap-2 px-2">
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
        <h3
          class="text-lg font-black text-slate-800 px-2 flex items-center gap-2"
        >
          <Calendar :size="18" class="text-orange-500" /> Day {{ dayGroup.day }}
        </h3>

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
                  <span class="flex items-center gap-1.5 font-black leading-tight text-slate-800">
                    <component
                      :is="item.map ? MapPin : MapPinOff"
                      :size="13"
                      :class="item.map ? 'text-blue-500' : 'text-slate-300'"
                    />
                    <span class="truncate">{{ item.location }}</span>
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
                  </span>
                  <span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-400">
                    <span class="flex items-center gap-1 text-slate-500">
                      <Clock3 :size="13" />
                      {{ getScheduledItem(item).startTime || '--:--' }} -
                      {{ getScheduledItem(item).endTime || '--:--' }}
                    </span>
                    <span>{{ getItineraryCategoryLabel(item.category, item.type) }}</span>
                    <span
                      v-if="item.timingStatus"
                      class="flex items-center gap-1"
                      :class="
                        item.timingStatus === 'arrived'
                          ? 'text-emerald-600'
                          : 'text-orange-600'
                      "
                    >
                      <CheckCircle2 :size="12" />
                      {{ item.timingStatus === 'arrived' ? '已抵達' : '已離開' }}
                      {{ item.lastTimingAdjustment?.actualTime || '' }}
                    </span>
                  </span>
                </button>
              </div>

              <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
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
                  <span class="text-[9px] font-black text-orange-400">延遲</span>
                  <input
                    v-model.number="item.delay"
                    type="number"
                    @change="updateItem(item)"
                    class="w-full bg-transparent text-center font-mono font-black text-orange-600 outline-none sm:w-10"
                  />
                </div>

                <button
                  type="button"
                  class="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-700"
                  @click.stop="openTimeAdjustment(item, 'arrived')"
                >
                  <LogIn :size="15" />
                  抵達
                </button>
                <button
                  type="button"
                  class="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-orange-50 px-3 text-xs font-black text-orange-700"
                  @click.stop="openTimeAdjustment(item, 'departed')"
                >
                  <LogOut :size="15" />
                  離開
                </button>

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
        :mode="itemDrawer.mode"
        :item="itemDrawer.item"
        compact
        @cancel="closeItemDrawer"
        @saved="handleItemDrawerDone"
        @deleted="handleItemDrawerDone"
      />
    </AdminDrawer>

    <AdminDrawer
      v-model="timeAdjustmentDrawer.open"
      size="sm"
      :z-index="120"
      :title="
        timeAdjustmentDrawer.mode === 'arrived'
          ? '記錄抵達時間'
          : '記錄離開時間'
      "
      :subtitle="timeAdjustmentDrawer.item?.location || ''"
      :close-on-click-modal="false"
      @close="closeTimeAdjustment"
    >
      <form
        class="flex h-full min-h-0 flex-col"
        @submit.prevent="saveTimeAdjustment"
      >
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <section class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="flex items-start gap-3">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                :class="
                  timeAdjustmentDrawer.mode === 'arrived'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-orange-50 text-orange-600'
                "
              >
                <LogIn
                  v-if="timeAdjustmentDrawer.mode === 'arrived'"
                  :size="20"
                />
                <LogOut v-else :size="20" />
              </div>
              <div class="min-w-0">
                <h3 class="truncate font-black text-slate-900">
                  {{ timeAdjustmentDrawer.item?.location }}
                </h3>
                <p class="mt-1 text-xs font-bold text-slate-400">
                  {{ adjustmentDayLabel }}，原訂
                  {{ adjustmentScheduledItem?.startTime || '--:--' }} -
                  {{ adjustmentScheduledItem?.endTime || '--:--' }}
                </p>
              </div>
            </div>
          </section>

          <label class="block rounded-2xl border border-slate-200 bg-white p-4">
            <span class="text-xs font-black text-slate-500">
              {{
                timeAdjustmentDrawer.mode === 'arrived'
                  ? '實際抵達時間'
                  : '實際離開時間'
              }}
            </span>
            <input
              v-model="timeAdjustmentDrawer.actualTime"
              type="time"
              required
              class="mt-3 h-14 w-full rounded-xl bg-slate-50 px-4 font-mono text-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p class="mt-2 text-xs font-bold leading-relaxed text-slate-400">
              {{
                timeAdjustmentDrawer.mode === 'arrived'
                  ? '抵達時間會與原訂開始時間比對，停留分鐘維持不變。'
                  : '離開時間會與原訂開始時間及停留分鐘比對。'
              }}
            </p>
          </label>

          <section class="grid grid-cols-2 gap-3">
            <div class="rounded-2xl bg-slate-100 p-4">
              <span class="text-[11px] font-black text-slate-400">目前延遲</span>
              <strong class="mt-2 block font-mono text-xl text-slate-700">
                {{ formatDelay(adjustmentPreview.previousDelay) }} 分
              </strong>
            </div>
            <div class="rounded-2xl bg-orange-50 p-4">
              <span class="text-[11px] font-black text-orange-400">更新後延遲</span>
              <strong class="mt-2 block font-mono text-xl text-orange-700">
                {{ formatDelay(adjustmentPreview.nextDelay) }} 分
              </strong>
            </div>
          </section>

          <section
            class="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"
          >
            <CheckCircle2 :size="21" class="shrink-0 text-indigo-600" />
            <div class="min-w-0">
              <p class="text-xs font-black text-indigo-700">更新後預計離開</p>
              <p class="mt-1 font-mono text-lg font-black text-slate-900">
                {{ adjustmentPreview.nextEndTime }}
              </p>
            </div>
            <div class="ml-auto text-right">
              <BellRing :size="16" class="ml-auto text-indigo-500" />
              <p class="mt-1 text-[10px] font-bold text-indigo-500">
                儲存後通知本旅程
              </p>
            </div>
          </section>
        </div>

        <footer
          class="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            class="h-11 rounded-xl bg-slate-100 text-sm font-black text-slate-600"
            @click="closeTimeAdjustment"
          >
            取消
          </button>
          <button
            type="submit"
            :disabled="timeAdjustmentDrawer.isSaving"
            class="h-11 rounded-xl bg-indigo-600 text-sm font-black text-white disabled:opacity-60"
          >
            {{ timeAdjustmentDrawer.isSaving ? '更新中' : '更新並通知' }}
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
