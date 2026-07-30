<script setup>
import { Users } from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

defineProps({
  open: { type: Boolean, default: false },
  tripTitle: { type: String, default: '' },
  keyword: { type: String, default: '' },
  selectedIds: { type: Array, default: () => [] },
  candidates: { type: Array, default: () => [] },
  isSaving: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open', 'update:keyword', 'toggle', 'save']);
</script>

<template>
  <AdminDrawer
    :model-value="open"
    title="旅程管理員"
    :subtitle="tripTitle"
    size="sm"
    :z-index="90"
    @update:model-value="emit('update:open', $event)"
  >
    <div class="flex h-full min-h-0 flex-col bg-white">
      <div class="border-b border-slate-200 p-4">
        <input
          :value="keyword"
          class="admin-input"
          placeholder="搜尋成員"
          @input="emit('update:keyword', $event.target.value)"
        />
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <button
          v-for="participant in candidates"
          :key="participant.id"
          type="button"
          class="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
          @click="emit('toggle', participant.id)"
        >
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100"
          >
            <img
              v-if="participant.avatar"
              :src="participant.avatar"
              class="h-full w-full object-cover"
            />
            <Users v-else :size="17" class="text-slate-400" />
          </span>
          <span class="min-w-0 flex-1">
            <strong class="block truncate text-sm text-slate-800">{{
              participant.name || '未命名成員'
            }}</strong>
            <span
              class="mt-1 block truncate text-[11px] font-bold text-slate-400"
            >
              {{ participant.inviteCode || participant.uid || participant.id }}
            </span>
          </span>
          <span
            class="flex h-6 w-6 items-center justify-center rounded-lg border"
            :class="
              selectedIds.includes(participant.id)
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 text-transparent'
            "
            >✓</span
          >
        </button>
        <p
          v-if="!candidates.length"
          class="p-8 text-center text-sm font-bold text-slate-400"
        >
          此旅程沒有符合條件的成員
        </p>
      </div>
      <footer class="border-t border-slate-200 p-4">
        <button
          type="button"
          :disabled="isSaving"
          class="h-11 w-full rounded-xl bg-indigo-600 text-sm font-black text-white disabled:opacity-60"
          @click="emit('save')"
        >
          {{ isSaving ? '儲存中' : `儲存 ${selectedIds.length} 位管理員` }}
        </button>
      </footer>
    </div>
  </AdminDrawer>
</template>

<style scoped>
.admin-input {
  width: 100%;
  height: 44px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 0 12px;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
  outline: none;
}
</style>
