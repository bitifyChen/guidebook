<script setup>
import { computed, reactive, ref, useSlots, watch } from 'vue';
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-vue-next';

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  search: { type: Array, default: () => [] },
  emptyText: { type: String, default: '尚無資料' },
  rowKey: { type: String, default: 'id' },
  initialSearch: { type: Object, default: () => ({}) },
  pageSizeOptions: { type: Array, default: () => [20, 50, 100] },
  defaultPageSize: { type: Number, default: 20 },
});

const emit = defineEmits(['search', 'reset', 'refresh']);
const slots = useSlots();
const searchForm = reactive({});
const currentPage = ref(1);
const pageSize = ref(props.defaultPageSize);

const hasSearch = computed(() => props.search.length > 0);
const totalRows = computed(() => props.rows.length);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalRows.value / Number(pageSize.value || 1)))
);
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return props.rows.slice(start, start + pageSize.value);
});

const syncInitialSearch = () => {
  props.search.forEach((field) => {
    searchForm[field.name] = props.initialSearch[field.name] || '';
  });
};

watch(
  () => props.initialSearch,
  () => syncInitialSearch(),
  { deep: true, immediate: true }
);

watch(
  () => props.rows,
  () => {
    currentPage.value = 1;
  }
);

watch(pageSize, () => {
  currentPage.value = 1;
});

const runSearch = () => {
  currentPage.value = 1;
  emit('search', { ...searchForm });
};

const resetSearch = () => {
  props.search.forEach((field) => {
    searchForm[field.name] = '';
  });
  currentPage.value = 1;
  emit('reset');
};

const goToPage = (page) => {
  currentPage.value = Math.min(Math.max(page, 1), totalPages.value);
};
</script>

<template>
  <section class="bg-white border border-slate-200 rounded-2xl overflow-hidden min-h-[520px] h-full flex flex-col">
    <div
      v-if="hasSearch || slots.toolbar"
      class="p-4 border-b border-slate-100 space-y-3 shrink-0"
    >
      <div class="flex justify-end">
        <slot name="toolbar" />
      </div>

      <div
        v-if="hasSearch"
        class="flex flex-col lg:flex-row lg:items-end gap-3"
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 flex-1">
          <label v-for="field in search" :key="field.name" class="space-y-1">
            <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              {{ field.label }}
            </span>
            <input
              v-if="!field.type || field.type === 'text'"
              v-model="searchForm[field.name]"
              :placeholder="field.placeholder || ''"
              class="admin-search-control"
              @keyup.enter="runSearch"
            />
            <select
              v-else-if="field.type === 'select'"
              v-model="searchForm[field.name]"
              class="admin-search-control"
            >
              <option value="">{{ field.placeholder || '全部' }}</option>
              <option
                v-for="option in field.options || []"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <div class="flex gap-2 justify-end">
          <button
            @click="resetSearch"
            class="h-10 px-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 font-black text-sm flex items-center gap-2"
          >
            <X :size="16" />
            清除
          </button>
          <button
            @click="runSearch"
            class="h-10 px-4 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center gap-2 hover:bg-indigo-700"
          >
            <Search :size="16" />
            搜尋
          </button>
          <button
            @click="$emit('refresh')"
            class="h-10 px-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-500"
            title="重新整理"
          >
            <RefreshCw :size="16" :class="{ 'animate-spin': loading }" />
          </button>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto flex-1 min-h-0">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-slate-400 sticky top-0 z-10">
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest whitespace-nowrap"
              :class="column.align === 'right' ? 'text-right' : ''"
            >
              {{ column.label }}
            </th>
            <th
              v-if="slots.actions"
              class="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in pagedRows"
            :key="row[rowKey]"
            class="border-t border-slate-100 hover:bg-slate-50/70"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-3 font-bold text-slate-700 align-middle"
              :class="column.align === 'right' ? 'text-right' : ''"
            >
              <slot
                v-if="$slots[column.key]"
                :name="column.key"
                :row="row"
                :value="row[column.key]"
              />
              <span v-else>{{ row[column.key] }}</span>
            </td>
            <td v-if="slots.actions" class="px-4 py-3 text-right whitespace-nowrap">
              <slot name="actions" :row="row" />
            </td>
          </tr>
          <tr v-if="!loading && rows.length === 0">
            <td
              :colspan="columns.length + (slots.actions ? 1 : 0)"
              class="px-4 py-12 text-center text-sm font-bold text-slate-400"
            >
              {{ emptyText }}
            </td>
          </tr>
          <tr v-if="loading">
            <td
              :colspan="columns.length + (slots.actions ? 1 : 0)"
              class="px-4 py-12 text-center text-sm font-bold text-slate-400"
            >
              載入中
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="px-4 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
      <div class="text-xs font-bold text-slate-400">
        共 {{ totalRows }} 筆
      </div>
      <div class="flex items-center justify-end gap-2">
        <select v-model.number="pageSize" class="h-9 rounded-xl bg-slate-50 border border-slate-100 px-2 text-xs font-bold text-slate-600">
          <option v-for="option in pageSizeOptions" :key="option" :value="option">
            {{ option }} / 頁
          </option>
        </select>
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage <= 1"
          class="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 disabled:opacity-40 inline-flex items-center justify-center"
        >
          <ChevronLeft :size="16" />
        </button>
        <span class="text-xs font-black text-slate-500 min-w-16 text-center">
          {{ currentPage }} / {{ totalPages }}
        </span>
        <button
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage >= totalPages"
          class="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 disabled:opacity-40 inline-flex items-center justify-center"
        >
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-search-control {
  width: 100%;
  height: 40px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
  padding: 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  outline: none;
}

.admin-search-control:focus {
  border-color: #a5b4fc;
  background: white;
}
</style>
