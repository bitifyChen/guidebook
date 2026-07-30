<script setup>
import { computed } from 'vue';
import { Plus, Save, Trash2 } from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  catalog: { type: Array, default: () => [] },
  newCategoryName: { type: String, default: '' },
  isSaving: { type: Boolean, default: false },
});
const emit = defineEmits([
  'update:open',
  'update:newCategoryName',
  'add',
  'delete',
  'save',
]);
const drawerOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});
const categoryName = computed({
  get: () => props.newCategoryName,
  set: (value) => emit('update:newCategoryName', value),
});
</script>

<template>
  <AdminDrawer
    v-model="drawerOpen"
    title="行李分類"
    subtitle="新增、重新命名或移除分類"
    size="sm"
  >
    <div class="flex h-full min-h-0 flex-col bg-white">
      <div class="flex gap-2 border-b border-slate-200 p-4">
        <input
          v-model="categoryName"
          class="h-11 min-w-0 flex-1 rounded-xl bg-slate-50 px-3 text-sm font-bold outline-none"
          placeholder="新增分類"
          @keyup.enter="emit('add')"
        />
        <button
          type="button"
          class="flex h-11 items-center gap-1 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white"
          @click="emit('add')"
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
            @click="emit('delete', category)"
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
          @click="emit('save')"
        >
          <Save :size="16" /> 儲存分類
        </button>
      </footer>
    </div>
  </AdminDrawer>
</template>
