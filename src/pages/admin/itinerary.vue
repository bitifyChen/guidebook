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
} from 'lucide-vue-next';

const router = useRouter();
const travelStore = useTravelStore();
const fileInput = ref(null);

const localItinerary = ref([]);
const hasChanges = ref(false);

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
      flattened.push({
        ...item,
        day: dayGroup.day,
        order: index + 1,
      });
    });
  });

  try {
    await bulkUpdateItinerary(flattened);
    await travelStore.init();
    hasChanges.value = false;
    alert('排序已更新');
  } catch (err) {
    alert('儲存失敗：' + err.message);
  }
};

const updateItem = async (item) => {
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
          <Download :size="14" /> 匯出備份
        </button>
        <button
          @click="fileInput.click()"
          class="flex-1 bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-center gap-2 font-bold text-slate-500 text-xs shadow-sm active:scale-95 transition-transform"
        >
          <Upload :size="14" /> 匯入同步
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
                @click="router.push(`/admin/item/${item.id}`)"
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
                  <component
                    :is="item?.images[0] ? Image : ImageOff"
                    :size="12"
                    :class="
                      item?.images[0]
                        ? 'text-green-500 fill-blue-50'
                        : 'text-slate-300 fill-slate-100'
                    "
                  />
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
                <button
                  @click="router.push(`/admin/item/${item.id}`)"
                  class="p-2 text-slate-300 hover:text-orange-500"
                >
                  <ChevronRight :size="20" />
                </button>
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
