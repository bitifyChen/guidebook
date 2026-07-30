<script setup>
import { Check, Copy, Pencil, Plus, User } from 'lucide-vue-next';
import AdminDataTable from '@/components/admin/shared/AdminDataTable.vue';

defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  search: { type: Array, default: () => [] },
  initialSearch: { type: Object, default: () => ({}) },
  copiedId: { type: String, default: '' },
  tripNameById: { type: Object, default: () => ({}) },
  getNotificationClass: { type: Function, required: true },
  getNotificationLabel: { type: Function, required: true },
});

const emit = defineEmits([
  'create',
  'search',
  'reset',
  'refresh',
  'copy-code',
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
    empty-text="沒有符合條件的成員"
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
    <template #member="{ row }">
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300"
        >
          <img
            v-if="row.avatar"
            :src="row.avatar"
            class="h-full w-full object-cover"
          />
          <User v-else :size="22" />
        </div>
        <div class="min-w-0">
          <div class="truncate font-black text-slate-900">{{ row.name }}</div>
          <div class="mt-1 truncate text-[10px] font-bold text-slate-400">
            {{ row.uid || '尚未綁定 Google' }}
          </div>
        </div>
      </div>
    </template>
    <template #inviteCode="{ row }">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1"
        @click="emit('copy-code', row)"
      >
        <span class="font-mono text-[11px] font-black text-slate-600">{{
          row.inviteCode || 'N/A'
        }}</span>
        <component
          :is="copiedId === row.id ? Check : Copy"
          :size="12"
          :class="copiedId === row.id ? 'text-green-500' : 'text-slate-300'"
        />
      </button>
    </template>
    <template #trips="{ row }">
      <div class="flex min-w-0 flex-wrap gap-2 sm:min-w-[180px]">
        <span
          v-for="tripId in row.tripIds || []"
          :key="tripId"
          class="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600"
          >{{ tripNameById[tripId] || tripId }}</span
        >
        <span
          v-if="!(row.tripIds || []).length"
          class="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700"
          >未加入旅程</span
        >
      </div>
    </template>
    <template #notification="{ row }"
      ><span
        class="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-black"
        :class="getNotificationClass(row)"
        >{{ getNotificationLabel(row) }}</span
      ></template
    >
    <template #historyAccess="{ row }"
      ><span
        class="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-black"
        :class="
          row.canViewTeamLocationHistory
            ? 'bg-green-100 text-green-700'
            : 'bg-slate-100 text-slate-500'
        "
        >{{ row.canViewTeamLocationHistory ? '可查看' : '未開放' }}</span
      ></template
    >
    <template #role="{ row }">
      <span
        v-if="row.isSuperAdmin"
        class="rounded-lg bg-indigo-100 px-2 py-1 text-[10px] font-black text-indigo-700"
        >Super Admin</span
      >
      <span
        v-else-if="row.isAdmin"
        class="rounded-lg bg-blue-100 px-2 py-1 text-[10px] font-black text-blue-700"
        >Admin</span
      >
      <span
        v-else
        class="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500"
        >Member</span
      >
    </template>
    <template #actions="{ row }">
      <button
        type="button"
        class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500"
        title="編輯"
        @click="emit('edit', row)"
      >
        <Pencil :size="18" />
      </button>
    </template>
  </AdminDataTable>
</template>
