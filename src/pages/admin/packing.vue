<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Luggage,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
} from 'lucide-vue-next';
import AdminDataTable from '@/components/admin/AdminDataTable.vue';
import AdminDrawer from '@/components/admin/AdminDrawer.vue';
import { ensurePackingCatalog, savePackingCatalog } from '@/api/packing';
import { useUserStore } from '@/store/userStore';

const userStore = useUserStore();
const catalog = ref([]);
const isLoading = ref(false);
const isSaving = ref(false);
const filters = ref({ keyword: '', categoryId: '' });
const categoryDrawerOpen = ref(false);
const newCategoryName = ref('');
const itemDrawer = reactive({
  open: false,
  mode: 'create',
  categoryId: '',
  itemId: '',
  name: '',
});

const createId = (prefix) =>
  `${prefix}-${
    crypto.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }`;

const columns = [
  { key: 'name', label: '物品', mobilePrimary: true },
  { key: 'category', label: '分類' },
];

const searchFields = computed(() => [
  {
    name: 'keyword',
    label: '關鍵字',
    type: 'text',
    placeholder: '搜尋物品或分類',
  },
  {
    name: 'categoryId',
    label: '分類',
    type: 'select',
    placeholder: '全部分類',
    options: catalog.value.map((category) => ({
      label: category.category,
      value: category.id,
    })),
  },
]);

const rows = computed(() =>
  catalog.value
    .flatMap((category) =>
      category.items.map((item) => ({
        id: item.id,
        categoryId: category.id,
        category: category.category,
        name: item.name,
      }))
    )
    .filter((row) => {
      if (
        filters.value.categoryId &&
        row.categoryId !== filters.value.categoryId
      ) {
        return false;
      }
      const keyword = filters.value.keyword.trim().toLowerCase();
      if (!keyword) return true;
      return `${row.name} ${row.category}`.toLowerCase().includes(keyword);
    })
);

const persistCatalog = async (message = '行李範本已更新') => {
  isSaving.value = true;
  try {
    catalog.value = await savePackingCatalog(catalog.value);
    ElMessage.success(message);
  } catch (error) {
    ElMessage.error(`行李範本儲存失敗：${error.message}`);
    throw error;
  } finally {
    isSaving.value = false;
  }
};

const loadCatalog = async () => {
  isLoading.value = true;
  try {
    catalog.value = await ensurePackingCatalog();
  } catch (error) {
    ElMessage.error(`行李範本載入失敗：${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const openCreateItem = () => {
  itemDrawer.open = true;
  itemDrawer.mode = 'create';
  itemDrawer.categoryId = catalog.value[0]?.id || '';
  itemDrawer.itemId = '';
  itemDrawer.name = '';
};

const openEditItem = (row) => {
  itemDrawer.open = true;
  itemDrawer.mode = 'edit';
  itemDrawer.categoryId = row.categoryId;
  itemDrawer.itemId = row.id;
  itemDrawer.name = row.name;
};

const saveItem = async () => {
  const name = itemDrawer.name.trim();
  const category = catalog.value.find(
    (entry) => entry.id === itemDrawer.categoryId
  );
  if (!category || !name) {
    ElMessage.warning('請選擇分類並輸入物品名稱');
    return;
  }

  if (itemDrawer.mode === 'edit') {
    catalog.value.forEach((entry) => {
      entry.items = entry.items.filter((item) => item.id !== itemDrawer.itemId);
    });
    category.items.push({ id: itemDrawer.itemId, name });
  } else {
    category.items.push({ id: createId('packing-item'), name });
  }
  await persistCatalog();
  itemDrawer.open = false;
};

const deleteItem = async () => {
  try {
    await ElMessageBox.confirm('確定要從行李範本刪除這個物品？', '刪除物品', {
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  catalog.value.forEach((category) => {
    category.items = category.items.filter(
      (item) => item.id !== itemDrawer.itemId
    );
  });
  await persistCatalog('物品已刪除');
  itemDrawer.open = false;
};

const addCategory = async () => {
  const name = newCategoryName.value.trim();
  if (!name) return;
  catalog.value.push({
    id: createId('packing-category'),
    category: name,
    items: [],
  });
  newCategoryName.value = '';
  await persistCatalog('分類已新增');
};

const deleteCategory = async (category) => {
  try {
    await ElMessageBox.confirm(
      `刪除「${category.category}」會一併刪除其中物品。`,
      '刪除分類',
      {
        confirmButtonText: '刪除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
  } catch {
    return;
  }
  catalog.value = catalog.value.filter((entry) => entry.id !== category.id);
  await persistCatalog('分類已刪除');
};

onMounted(loadCatalog);
</script>

<template>
  <main class="h-full min-h-[calc(100dvh-180px)] md:min-h-[620px]">
    <section
      v-if="!userStore.isSuperAdmin"
      class="rounded-2xl border border-slate-200 bg-white p-8 text-center"
    >
      <Luggage class="mx-auto mb-3 text-slate-300" :size="40" />
      <p class="font-black text-slate-700">只有 Super Admin 可以管理行李範本</p>
    </section>

    <AdminDataTable
      v-else
      :rows="rows"
      :columns="columns"
      :loading="isLoading"
      :search="searchFields"
      :initial-search="filters"
      empty-text="尚未建立行李物品"
      @search="filters = $event"
      @reset="filters = { keyword: '', categoryId: '' }"
      @refresh="loadCatalog"
    >
      <template #toolbar>
        <div class="flex w-full justify-end gap-2">
          <button
            type="button"
            class="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-600"
            @click="categoryDrawerOpen = true"
          >
            <Settings2 :size="16" />
            分類
          </button>
          <button
            type="button"
            class="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white"
            @click="openCreateItem"
          >
            <Plus :size="16" />
            新增
          </button>
        </div>
      </template>

      <template #name="{ row }">
        <strong class="text-sm text-slate-800">{{ row.name }}</strong>
      </template>

      <template #category="{ row }">
        <span
          class="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500"
        >
          {{ row.category }}
        </span>
      </template>

      <template #actions="{ row }">
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:text-indigo-600"
          title="編輯物品"
          @click="openEditItem(row)"
        >
          <Pencil :size="15" />
        </button>
      </template>
    </AdminDataTable>

    <AdminDrawer
      v-model="itemDrawer.open"
      :title="itemDrawer.mode === 'edit' ? '編輯物品' : '新增物品'"
      subtitle="行李範本"
      size="sm"
    >
      <div class="flex h-full min-h-0 flex-col bg-white">
        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <label class="block space-y-2">
            <span class="text-[11px] font-black text-slate-400">分類</span>
            <select
              v-model="itemDrawer.categoryId"
              class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
            >
              <option
                v-for="category in catalog"
                :key="category.id"
                :value="category.id"
              >
                {{ category.category }}
              </option>
            </select>
          </label>
          <label class="block space-y-2">
            <span class="text-[11px] font-black text-slate-400">物品名稱</span>
            <input
              v-model="itemDrawer.name"
              class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
              placeholder="輸入物品名稱"
              @keyup.enter="saveItem"
            />
          </label>
        </div>
        <footer
          class="flex items-center justify-between border-t border-slate-200 p-4"
        >
          <button
            v-if="itemDrawer.mode === 'edit'"
            type="button"
            class="flex h-11 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-black text-red-600"
            @click="deleteItem"
          >
            <Trash2 :size="16" />
            刪除
          </button>
          <span v-else></span>
          <button
            type="button"
            :disabled="isSaving"
            class="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white disabled:opacity-50"
            @click="saveItem"
          >
            <Save :size="16" />
            儲存
          </button>
        </footer>
      </div>
    </AdminDrawer>

    <AdminDrawer
      v-model="categoryDrawerOpen"
      title="行李分類"
      subtitle="新增、重新命名或移除分類"
      size="sm"
    >
      <div class="flex h-full min-h-0 flex-col bg-white">
        <div class="flex gap-2 border-b border-slate-200 p-4">
          <input
            v-model="newCategoryName"
            class="h-11 min-w-0 flex-1 rounded-xl bg-slate-50 px-3 text-sm font-bold outline-none"
            placeholder="新增分類"
            @keyup.enter="addCategory"
          />
          <button
            type="button"
            class="flex h-11 items-center gap-1 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white"
            @click="addCategory"
          >
            <Plus :size="16" /> 新增
          </button>
        </div>
        <div class="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          <div
            v-for="category in catalog"
            :key="category.id"
            class="flex items-center gap-2 rounded-xl bg-slate-50 p-2"
          >
            <input
              v-model="category.category"
              class="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm font-black text-slate-700 outline-none"
            />
            <span class="text-[10px] font-bold text-slate-400">
              {{ category.items.length }} 項
            </span>
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"
              title="刪除分類"
              @click="deleteCategory(category)"
            >
              <Trash2 :size="15" />
            </button>
          </div>
        </div>
        <footer class="flex justify-end border-t border-slate-200 p-4">
          <button
            type="button"
            :disabled="isSaving"
            class="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white disabled:opacity-50"
            @click="persistCatalog('分類已更新')"
          >
            <Save :size="16" />
            儲存分類
          </button>
        </footer>
      </div>
    </AdminDrawer>
  </main>
</template>

<route>
{
  meta: { layout: "admin" }
}
</route>
