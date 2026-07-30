<script setup>
import { Plus, Users } from 'lucide-vue-next';
import AdminDataTable from '@/components/admin/shared/AdminDataTable.vue';

defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  search: { type: Array, default: () => [] },
  initialSearch: { type: Object, default: () => ({}) },
  tripNameById: { type: Object, default: () => ({}) },
  formatDate: { type: Function, required: true },
});
const emit = defineEmits(['create', 'search', 'reset', 'refresh']);
</script>

<template>
  <AdminDataTable
    :rows="rows"
    :columns="columns"
    :loading="loading"
    :search="search"
    :initial-search="initialSearch"
    empty-text="尚未建立推播紀錄"
    @search="emit('search', $event)"
    @reset="emit('reset')"
    @refresh="emit('refresh')"
  >
    <template #toolbar>
      <button
        type="button"
        class="flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white hover:bg-indigo-700"
        @click="emit('create')"
      >
        <Plus :size="16" /> 新增
      </button>
    </template>
    <template #content="{ row }">
      <div class="min-w-0 sm:min-w-[240px]">
        <div class="truncate font-black text-slate-900">{{ row.title }}</div>
        <div class="mt-1 line-clamp-2 text-xs font-bold text-slate-400">
          {{ row.body }}
        </div>
      </div>
    </template>
    <template #trip="{ row }"
      ><span class="text-xs font-black text-slate-600">{{
        tripNameById[row.tripId] || row.tripId || '-'
      }}</span></template
    >
    <template #audience="{ row }"
      ><span
        class="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600"
        ><Users :size="12" /> {{ row.participantIds?.length || 0 }} 人</span
      ></template
    >
    <template #result="{ row }">
      <div class="flex flex-wrap gap-2">
        <span
          class="rounded-lg bg-green-100 px-2 py-1 text-[10px] font-black text-green-700"
          >成功 {{ row.successCount || 0 }}</span
        >
        <span
          v-if="row.failureCount"
          class="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-black text-red-700"
          >失敗 {{ row.failureCount }}</span
        >
      </div>
    </template>
    <template #createdAt="{ row }"
      ><span class="text-xs font-bold text-slate-400">{{
        formatDate(row.createdAt)
      }}</span></template
    >
  </AdminDataTable>
</template>
