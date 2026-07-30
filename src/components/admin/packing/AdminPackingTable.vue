<script setup>
import { Pencil, Plus, Settings2 } from 'lucide-vue-next';
import AdminDataTable from '@/components/admin/shared/AdminDataTable.vue';

defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  search: { type: Array, default: () => [] },
  initialSearch: { type: Object, default: () => ({}) },
});
const emit = defineEmits([
  'create',
  'open-categories',
  'search',
  'reset',
  'refresh',
  'edit',
]);
</script>

<template>
  <AdminDataTable
    :rows="rows"
    :columns="columns"
    :loading="loading"
    :search="search"
    :initial-search="initialSearch"
    empty-text="尚未建立行李物品"
    @search="emit('search', $event)"
    @reset="emit('reset')"
    @refresh="emit('refresh')"
  >
    <template #toolbar>
      <div class="flex w-full justify-end gap-2">
        <button
          type="button"
          class="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-600"
          @click="emit('open-categories')"
        >
          <Settings2 :size="16" /> 分類
        </button>
        <button
          type="button"
          class="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white"
          @click="emit('create')"
        >
          <Plus :size="16" /> 新增
        </button>
      </div>
    </template>
    <template #name="{ row }"
      ><strong class="text-sm text-slate-800">{{ row.name }}</strong></template
    >
    <template #category="{ row }"
      ><span
        class="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500"
        >{{ row.category }}</span
      ></template
    >
    <template #actions="{ row }"
      ><button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:text-indigo-600"
        title="編輯物品"
        @click="emit('edit', row)"
      >
        <Pencil :size="15" /></button
    ></template>
  </AdminDataTable>
</template>
