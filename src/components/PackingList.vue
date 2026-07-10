<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import {
  X,
  Luggage,
  CircleCheck,
  Circle,
  RotateCcw,
  Plus,
  Trash2,
  MoreVertical,
} from 'lucide-vue-next';
import defaultList from '@/data/packingList.json';

const props = defineProps({
  visible: Boolean,
});

const emit = defineEmits(['update:visible']);

const STORAGE_KEY = 'guidebook_packing_list_v2';
const LEGACY_STORAGE_KEY = ['jeju', 'packing', 'list', 'v2'].join('_');

const list = ref([]);

// 初始化資料
onMounted(() => {
  const saved =
    localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (saved) {
    list.value = JSON.parse(saved);
  } else {
    list.value = JSON.parse(JSON.stringify(defaultList));
  }
});

// 監聽變動即時儲存
watch(
  list,
  (newVal) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newVal));
  },
  { deep: true }
);

// 計算總進度
const progress = computed(() => {
  let total = 0;
  let checked = 0;
  list.value.forEach((cat) => {
    cat.items.forEach((item) => {
      total++;
      if (item.checked) checked++;
    });
  });
  return total === 0 ? 0 : Math.round((checked / total) * 100);
});

const toggleItem = (catIndex, itemIndex) => {
  list.value[catIndex].items[itemIndex].checked =
    !list.value[catIndex].items[itemIndex].checked;
};

// --- 自定義功能 ---

const newCategoryName = ref('');
const addCategory = () => {
  if (!newCategoryName.value.trim()) return;
  list.value.push({
    category: newCategoryName.value.trim(),
    items: [],
  });
  newCategoryName.value = '';
};

const newItemNames = ref({}); // 用於存放每個分類對應的新增項目輸入值
const addItem = (catIdx) => {
  const name = newItemNames.value[catIdx];
  if (!name || !name.trim()) return;
  list.value[catIdx].items.push({
    name: name.trim(),
    checked: false,
  });
  newItemNames.value[catIdx] = '';
};

const removeItem = (catIdx, itemIdx) => {
  list.value[catIdx].items.splice(itemIdx, 1);
};

const clearAllChecked = () => {
  if (confirm('確定要清空所有勾選狀態嗎？這會保留您新增的項目。')) {
    list.value.forEach((cat) => {
      cat.items.forEach((item) => {
        item.checked = false;
      });
    });
  }
};

const resetList = () => {
  if (confirm('確定要還原為預設清單嗎？這將覆蓋您目前的先前新增的項目。')) {
    list.value = JSON.parse(JSON.stringify(defaultList));
  }
};

const close = () => emit('update:visible', false);
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="(val) => emit('update:visible', val)"
    direction="btt"
    size="100%"
    :with-header="false"
    :append-to-body="true"
    class="full-screen-drawer"
  >
    <div class="h-full bg-[#fdfaf6] flex flex-col">
      <!-- 導覽列 -->
      <nav
        class="p-6 shrink-0 bg-white/80 backdrop-blur-md z-40 flex items-center justify-between border-b border-orange-100"
      >
        <button
          @click="close"
          class="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100"
        >
          <X :size="20" class="text-slate-400" />
        </button>
        <h2 class="font-black text-slate-800 text-lg flex items-center gap-2">
          <Luggage :size="20" class="text-orange-500" /> 行李準備清單
        </h2>
        <el-dropdown trigger="click">
          <button
            class="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100"
          >
            <MoreVertical :size="18" class="text-slate-400" />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="clearAllChecked"
                >重置勾選</el-dropdown-item
              >
              <el-dropdown-item @click="resetList" divided
                >還原預設</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </nav>

      <!-- 進度條 -->
      <div class="px-6 py-4 bg-white border-b border-orange-50">
        <div class="flex justify-between items-end mb-2">
          <span
            class="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em]"
            >準備進度</span
          >
          <span class="text-xl font-black text-orange-500"
            >{{ progress }}%</span
          >
        </div>
        <div
          class="h-3 bg-orange-50 rounded-full overflow-hidden border border-orange-100 p-0.5"
        >
          <div
            class="h-full bg-orange-500 rounded-full transition-all duration-500 ease-out"
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
      </div>

      <el-scrollbar class="flex-1">
        <main class="max-w-xl mx-auto p-4 space-y-3 pb-32">
          <div v-for="(cat, catIdx) in list" :key="catIdx" class="space-y-4">
            <div class="flex justify-between items-center px-2">
              <h3
                class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"
              >
                <div class="w-1.5 h-3 bg-orange-300 rounded-full"></div>
                {{ cat.category }}
              </h3>
            </div>

            <div class="grid gap-3">
              <!-- 現有項目 -->
              <div
                v-for="(item, itemIdx) in cat.items"
                :key="itemIdx"
                class="group relative flex items-center"
              >
                <div
                  @click="toggleItem(catIdx, itemIdx)"
                  :class="[
                    'flex-1 p-3 rounded-[24px] border transition-all flex items-center gap-4 active:scale-[0.98] cursor-pointer',
                    item.checked
                      ? 'bg-orange-50/50 border-orange-200 text-slate-400'
                      : 'bg-white border-slate-100 text-slate-700 shadow-sm',
                  ]"
                >
                  <div
                    :class="[
                      'shrink-0',
                      item.checked ? 'text-orange-500' : 'text-slate-200',
                    ]"
                  >
                    <component
                      :is="item.checked ? CircleCheck : Circle"
                      :size="24"
                    ></component>
                  </div>
                  <span
                    :class="[
                      'font-bold text-sm flex-1 break-words pr-6',
                      { 'line-through opacity-50': item.checked },
                    ]"
                  >
                    {{ item.name }}
                  </span>
                </div>
                <!-- 刪除按鈕：改為絕對定位，避免擠壓空間 -->
                <button
                  @click.stop="removeItem(catIdx, itemIdx)"
                  class="absolute right-4 w-8 h-8 flex items-center justify-center text-slate-200 transition-all"
                >
                  <X :size="16" />
                </button>
              </div>

              <!-- 新增項目輸入框 -->
              <div class="px-2">
                <div class="relative">
                  <input
                    v-model="newItemNames[catIdx]"
                    @keyup.enter="addItem(catIdx)"
                    type="text"
                    placeholder="新增項目..."
                    class="w-full bg-slate-100/50 border-none rounded-2xl p-3 text-xs font-bold text-slate-600 placeholder:text-slate-300 outline-none focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                  <button
                    @click="addItem(catIdx)"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-orange-400 p-1"
                  >
                    <Plus :size="16" strokeWidth="3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </el-scrollbar>
    </div>
  </el-drawer>
</template>

<style scoped>
:deep(.full-screen-drawer) {
  --el-drawer-padding-primary: 10px;
}
:deep(.el-drawer__body) {
  padding: 10px !important;
}
input::placeholder {
  font-weight: bold;
  opacity: 0.5;
}
</style>
