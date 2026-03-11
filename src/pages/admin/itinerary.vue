<script setup>
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTravelStore } from '@/store/travelStore';
import { patchItineraryItem, bulkUpdateItinerary } from '@/api/itinerary';
import draggable from 'vuedraggable';
import {
  Calendar,
  ChevronRight,
  ChevronLeft,
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
const fileInput = ref(null);

const localItinerary = ref([]);
const hasChanges = ref(false);
const isCheckingImages = ref(false);

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
  router.push(`/admin/item/${item.id}`);
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
    } catch (err) {
      alert('匯入失敗：' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // 清空 input
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-32">
    <nav
      class="p-6 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between"
    >
      <button
        @click="router.push('/admin')"
        class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"
      >
        <ChevronLeft :size="20" />
      </button>
      <h2 class="font-black text-slate-800 text-lg">行程進度管理</h2>
      <button
        @click="router.push('/admin/item/add')"
        class="w-10 h-10 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-sm"
      >
        <Plus :size="20" />
      </button>
    </nav>

    <main class="max-w-4xl mx-auto p-6 space-y-8">
      <!-- 工具列 -->
      <div class="flex gap-2 px-2">
        <button
          @click="handleExport"
          class="flex-1 bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-center gap-2 font-bold text-slate-500 text-xs shadow-sm active:scale-95 transition-transform"
        >
          <Download :size="14" /> 匯出
        </button>
        <button
          @click="fileInput.click()"
          class="flex-1 bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-center gap-2 font-bold text-slate-500 text-xs shadow-sm active:scale-95 transition-transform"
        >
          <Upload :size="14" /> 匯入
        </button>
        <button
          @click="handleCheckImages"
          :disabled="isCheckingImages"
          class="flex-1 bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-center gap-2 font-bold text-slate-500 text-xs shadow-sm active:scale-95 transition-transform disabled:opacity-50"
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
              class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4 group"
            >
              <div
                class="drag-handle w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-slate-100 transition-colors"
              >
                <GripVertical :size="16" class="text-slate-300" />
              </div>

              <div
                class="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 text-xs shrink-0"
              >
                {{ index + 1 }}
              </div>

              <div
                class="flex-1"
                @click="handleEditItem(item)"
              >
                <div
                  class="font-black text-slate-700 leading-tight flex items-center gap-1.5"
                >
                  <component
                    :is="item.map ? MapPin : MapPinOff"
                    :size="12"
                    :class="
                      item.map
                        ? 'text-blue-500 fill-blue-50'
                        : 'text-slate-300 fill-slate-100'
                    "
                  />
                  <div class="relative flex items-center gap-1.5">
                    <component
                      :is="item?.images[0] ? Image : ImageOff"
                      :size="12"
                      :class="[
                        item?.images[0] || item?.cover
                          ? 'text-green-500 fill-green-50'
                          : 'text-slate-300 fill-slate-100',
                        travelStore.imageStatus[item.id] === 'error'
                          ? 'text-red-500 fill-red-50 animate-pulse'
                          : '',
                      ]"
                    />
                    <!-- 狀態小點 -->
                    <div
                      v-if="travelStore.imageStatus[item.id]"
                      class="absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white shadow-sm"
                      :class="{
                        'bg-green-500':
                          travelStore.imageStatus[item.id] === 'ok',
                        'bg-red-500 animate-bounce':
                          travelStore.imageStatus[item.id] === 'error',
                        'bg-blue-400 animate-spin':
                          travelStore.imageStatus[item.id] === 'loading',
                      }"
                    ></div>
                  </div>
                  {{ item.location }}
                </div>
                <div class="text-[10px] font-bold text-slate-400">
                  {{ item.category }}
                </div>
              </div>

              <div class="flex gap-2 items-center">
                <div
                  class="flex flex-col items-center bg-slate-50 rounded-xl p-1 px-2 border border-slate-100"
                >
                  <span class="text-[8px] font-black text-slate-400">STAY</span>
                  <input
                    v-model.number="item.duration"
                    type="number"
                    @change="updateItem(item)"
                    class="w-10 bg-transparent text-center font-mono font-black text-slate-600 outline-none"
                  />
                </div>
                <div
                  class="flex flex-col items-center bg-orange-50 rounded-xl p-1 px-2 border border-orange-100"
                >
                  <span class="text-[8px] font-black text-orange-400"
                    >DELAY</span
                  >
                  <input
                    v-model.number="item.delay"
                    type="number"
                    @change="updateItem(item)"
                    class="w-10 bg-transparent text-center font-mono font-black text-orange-600 outline-none"
                  />
                </div>
                <div class="flex items-center gap-1 ml-2">
                  <button
                    @click="handleCopyItem(item, dayGroup)"
                    class="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                    title="複製此行程"
                  >
                    <Copy :size="16" />
                  </button>
                  <button
                    @click="handleEditItem(item)"
                    class="p-2 text-slate-300 hover:text-orange-500 transition-colors"
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
  </div>
</template>

<route>
{
  meta: { layout: "empty" }
}
</route>
