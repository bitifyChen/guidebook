<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Luggage } from 'lucide-vue-next';
import AdminPackingItemDrawer from '@/components/admin/packing/AdminPackingItemDrawer.vue';
import AdminPackingCategoryDrawer from '@/components/admin/packing/AdminPackingCategoryDrawer.vue';
import AdminPackingTable from '@/components/admin/packing/AdminPackingTable.vue';
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

    <AdminPackingTable
      v-else
      :rows="rows"
      :columns="columns"
      :loading="isLoading"
      :search="searchFields"
      :initial-search="filters"
      @search="filters = $event"
      @reset="filters = { keyword: '', categoryId: '' }"
      @refresh="loadCatalog"
      @open-categories="categoryDrawerOpen = true"
      @create="openCreateItem"
      @edit="openEditItem"
    />

    <AdminPackingItemDrawer
      v-model:open="itemDrawer.open"
      :model="itemDrawer"
      :categories="catalog"
      :is-saving="isSaving"
      @save="saveItem"
      @delete="deleteItem"
    />

    <AdminPackingCategoryDrawer
      v-model:open="categoryDrawerOpen"
      v-model:new-category-name="newCategoryName"
      :catalog="catalog"
      :is-saving="isSaving"
      @add="addCategory"
      @delete="deleteCategory"
      @save="persistCatalog('分類已更新')"
    />
  </main>
</template>

<route>
{
  meta: { layout: "admin" }
}
</route>
