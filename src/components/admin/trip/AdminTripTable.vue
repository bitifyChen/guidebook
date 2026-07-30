<script setup>
import {
  CalendarDays,
  Copy,
  Luggage,
  Pencil,
  Plus,
  Settings,
  Users,
} from 'lucide-vue-next';
import AdminDataTable from '@/components/admin/shared/AdminDataTable.vue';

defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  search: { type: Array, default: () => [] },
  initialSearch: { type: Object, default: () => ({}) },
  getStatusLabel: { type: Function, required: true },
});

const emit = defineEmits([
  'create',
  'search',
  'reset',
  'refresh',
  'copy-code',
  'open-itinerary',
  'open-config',
  'open-managers',
  'open-packing',
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
    empty-text="沒有符合條件的旅程"
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
    <template #trip="{ row }">
      <div class="min-w-0 sm:min-w-[220px]">
        <div class="truncate font-black text-slate-900">{{ row.title }}</div>
        <div class="mt-1 truncate text-xs font-bold text-slate-400">
          {{ row.destination || '未設定目的地' }} ·
          {{ row.country || '未設定國家' }}
        </div>
      </div>
    </template>
    <template #dates="{ row }">
      <span class="text-sm font-bold text-slate-500">
        {{ row.startDate || '未設定' }} - {{ row.endDate || '未設定' }}
      </span>
    </template>
    <template #status="{ row }">
      <span
        class="rounded-lg px-2 py-1 text-[10px] font-black"
        :class="{
          'bg-amber-100 text-amber-700': row.status === 'draft',
          'bg-green-100 text-green-700': (row.status || 'active') === 'active',
          'bg-blue-100 text-blue-700': row.status === 'completed',
          'bg-slate-100 text-slate-600': row.status === 'archived',
        }"
      >
        {{ getStatusLabel(row.status || 'active') }}
      </span>
    </template>
    <template #publicCode="{ row }">
      <button
        v-if="row.publicCode"
        type="button"
        class="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1"
        @click="emit('copy-code', row.publicCode)"
      >
        <span class="font-mono text-[11px] font-black text-slate-600">{{
          row.publicCode
        }}</span>
        <Copy :size="12" class="text-slate-300" />
      </button>
      <span v-else class="text-xs font-bold text-slate-300">未建立</span>
    </template>
    <template #inviteCode="{ row }">
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1"
        @click="emit('copy-code', row.inviteCode)"
      >
        <span class="font-mono text-[11px] font-black text-slate-600">{{
          row.inviteCode
        }}</span>
        <Copy :size="12" class="text-slate-300" />
      </button>
    </template>
    <template #weather="{ row }">
      <div class="min-w-0 sm:min-w-[180px]">
        <div class="text-sm font-black text-slate-700">
          {{ row.weatherCity || '未設定' }}
        </div>
        <div class="mt-1 text-[10px] font-bold text-slate-400">
          {{ row.latitude || '-' }}, {{ row.longitude || '-' }}
        </div>
      </div>
    </template>
    <template #actions="{ row }">
      <div class="inline-flex items-center justify-end gap-2">
        <button
          v-for="action in [
            {
              key: 'open-itinerary',
              label: '行程',
              title: '行程管理',
              icon: CalendarDays,
            },
            {
              key: 'open-config',
              label: '每日',
              title: '每日設定',
              icon: Settings,
            },
            {
              key: 'open-managers',
              label: '成員',
              title: '旅程管理員',
              icon: Users,
            },
            {
              key: 'open-packing',
              label: '行李',
              title: '旅程行李',
              icon: Luggage,
            },
            { key: 'edit', label: '基本', title: '基本資料', icon: Pencil },
          ]"
          :key="action.key"
          type="button"
          class="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-50 px-3 text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
          :title="action.title"
          @click="emit(action.key, row)"
        >
          <component :is="action.icon" :size="16" /> {{ action.label }}
        </button>
      </div>
    </template>
  </AdminDataTable>
</template>
