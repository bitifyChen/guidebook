<script setup>
import { computed, ref, watch } from 'vue';
import {
  Check,
  CheckCheck,
  Luggage,
  Plus,
  Save,
  Trash2,
} from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';
import {
  normalizeTripPackingList,
  selectAllPackingCatalogItems,
} from '@/utils/packingList';

const props = defineProps({
  open: { type: Boolean, default: false },
  trip: { type: Object, default: null },
  catalog: { type: Array, default: () => [] },
  isSaving: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open', 'save']);
const mode = ref('catalog');
const selected = ref([]);
const customCategoryId = ref('');
const customName = ref('');

const drawerOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});

const selectedCount = computed(() =>
  selected.value.reduce((total, category) => total + category.items.length, 0)
);

const createId = (prefix) =>
  `${prefix}-${
    crypto.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;

const hydrateSelection = () => {
  const catalogItems = new Map();
  props.catalog.forEach((category) => {
    category.items.forEach((item) => {
      catalogItems.set(item.id, {
        categoryId: category.id,
        category: category.category,
        name: item.name,
      });
    });
  });

  const normalized = normalizeTripPackingList(props.trip?.packingList || []);
  const next = [];
  normalized.forEach((category) => {
    category.items.forEach((item) => {
      const catalogItem = catalogItems.get(item.id);
      const categoryId = catalogItem?.categoryId || category.id;
      const categoryName = catalogItem?.category || category.category;
      let target = next.find((entry) => entry.id === categoryId);
      if (!target) {
        target = { id: categoryId, category: categoryName, items: [] };
        next.push(target);
      }
      target.items.push({
        id: item.id,
        name: item.name || catalogItem?.name,
      });
    });
  });
  selected.value = next;
  customCategoryId.value = props.catalog[0]?.id || '';
  customName.value = '';
  mode.value = 'catalog';
};

watch(
  () => props.open,
  (open) => {
    if (open) hydrateSelection();
  }
);

const isSelected = (itemId) =>
  selected.value.some((category) =>
    category.items.some((item) => item.id === itemId)
  );

const removeItem = (itemId) => {
  selected.value.forEach((category) => {
    category.items = category.items.filter((item) => item.id !== itemId);
  });
  selected.value = selected.value.filter((category) => category.items.length);
};

const toggleCatalogItem = (category, item) => {
  if (isSelected(item.id)) {
    removeItem(item.id);
    return;
  }
  let target = selected.value.find((entry) => entry.id === category.id);
  if (!target) {
    target = { id: category.id, category: category.category, items: [] };
    selected.value.push(target);
  }
  target.items.push({ id: item.id, name: item.name });
};

const addCustomItem = () => {
  const name = customName.value.trim();
  const catalogCategory = props.catalog.find(
    (category) => category.id === customCategoryId.value
  );
  if (!name || !catalogCategory) return;
  let target = selected.value.find(
    (category) => category.id === catalogCategory.id
  );
  if (!target) {
    target = {
      id: catalogCategory.id,
      category: catalogCategory.category,
      items: [],
    };
    selected.value.push(target);
  }
  target.items.push({ id: createId('trip-packing-item'), name });
  customName.value = '';
};

const save = () => emit('save', normalizeTripPackingList(selected.value));
const selectAll = () => {
  selected.value = selectAllPackingCatalogItems({
    selected: selected.value,
    catalog: props.catalog,
  });
};
const removeAll = () => {
  selected.value = [];
};
</script>

<template>
  <AdminDrawer
    v-model="drawerOpen"
    title="旅程行李"
    :subtitle="trip?.title || ''"
    size="md"
    :z-index="90"
  >
    <div class="flex h-full min-h-0 flex-col bg-white">
      <div class="grid grid-cols-2 gap-1 border-b border-slate-200 p-3">
        <button
          type="button"
          class="h-10 rounded-xl text-sm font-black transition-colors"
          :class="
            mode === 'catalog'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-50 text-slate-500'
          "
          @click="mode = 'catalog'"
        >
          從範本選取
        </button>
        <button
          type="button"
          class="h-10 rounded-xl text-sm font-black transition-colors"
          :class="
            mode === 'selected'
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-50 text-slate-500'
          "
          @click="mode = 'selected'"
        >
          本次清單 {{ selectedCount }}
        </button>
      </div>

      <el-scrollbar class="min-h-0 flex-1">
        <div v-if="mode === 'catalog'" class="space-y-5 p-4">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs font-black text-slate-400">
              已選 {{ selectedCount }} 項
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex h-9 items-center gap-1.5 rounded-xl bg-indigo-50 px-3 text-xs font-black text-indigo-600 transition-colors hover:bg-indigo-100"
                @click="selectAll"
              >
                <CheckCheck :size="15" />
                全選
              </button>
              <button
                type="button"
                :disabled="!selectedCount"
                class="flex h-9 items-center gap-1.5 rounded-xl bg-red-50 px-3 text-xs font-black text-red-500 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                @click="removeAll"
              >
                <Trash2 :size="15" />
                全移除
              </button>
            </div>
          </div>
          <section v-for="category in catalog" :key="category.id">
            <h3 class="mb-2 text-xs font-black text-slate-400">
              {{ category.category }}
            </h3>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                v-for="item in category.items"
                :key="item.id"
                type="button"
                class="flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-bold transition-colors"
                :class="
                  isSelected(item.id)
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-100 bg-white text-slate-600'
                "
                @click="toggleCatalogItem(category, item)"
              >
                <span
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border"
                  :class="
                    isSelected(item.id)
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 text-transparent'
                  "
                >
                  <Check :size="14" />
                </span>
                <span>{{ item.name }}</span>
              </button>
            </div>
          </section>
          <div
            v-if="!catalog.length"
            class="py-16 text-center text-sm font-bold text-slate-400"
          >
            尚未建立行李範本
          </div>
        </div>

        <div v-else class="space-y-5 p-4">
          <section
            v-for="category in selected"
            :key="category.id"
            class="space-y-2"
          >
            <h3 class="text-xs font-black text-slate-400">
              {{ category.category }}
            </h3>
            <div
              v-for="item in category.items"
              :key="item.id"
              class="flex items-center gap-2 rounded-xl bg-slate-50 p-2"
            >
              <input
                v-model="item.name"
                class="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm font-bold text-slate-700 outline-none"
              />
              <button
                type="button"
                class="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"
                title="從本次旅程移除"
                @click="removeItem(item.id)"
              >
                <Trash2 :size="15" />
              </button>
            </div>
          </section>

          <section
            class="rounded-2xl border border-dashed border-slate-200 p-3"
          >
            <div
              class="mb-2 flex items-center gap-2 text-xs font-black text-slate-500"
            >
              <Plus :size="15" /> 本次旅程自訂
            </div>
            <div class="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
              <select
                v-model="customCategoryId"
                class="h-10 rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-600 outline-none"
              >
                <option
                  v-for="category in catalog"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.category }}
                </option>
              </select>
              <input
                v-model="customName"
                class="h-10 min-w-0 rounded-xl bg-slate-50 px-3 text-sm font-bold outline-none"
                placeholder="物品名稱"
                @keyup.enter="addCustomItem"
              />
              <button
                type="button"
                class="h-10 rounded-xl bg-slate-900 px-4 text-xs font-black text-white"
                @click="addCustomItem"
              >
                新增
              </button>
            </div>
          </section>

          <div
            v-if="!selectedCount"
            class="py-12 text-center text-sm font-bold text-slate-400"
          >
            本次旅程尚未選擇行李
          </div>
        </div>
      </el-scrollbar>

      <footer
        class="flex items-center justify-between border-t border-slate-200 p-4"
      >
        <div class="flex items-center gap-2 text-xs font-black text-slate-500">
          <Luggage :size="16" class="text-indigo-500" />
          已選 {{ selectedCount }} 項
        </div>
        <button
          type="button"
          :disabled="isSaving"
          class="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white disabled:opacity-50"
          @click="save"
        >
          <Save :size="16" />
          儲存
        </button>
      </footer>
    </div>
  </AdminDrawer>
</template>
