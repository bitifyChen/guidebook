<script setup>
import { computed } from 'vue';
import { Save, Trash2 } from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  model: { type: Object, required: true },
  categories: { type: Array, default: () => [] },
  isSaving: { type: Boolean, default: false },
});
const emit = defineEmits(['update:open', 'save', 'delete']);
const drawerOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});
</script>

<template>
  <AdminDrawer
    v-model="drawerOpen"
    :title="model.mode === 'edit' ? '編輯物品' : '新增物品'"
    subtitle="行李範本"
    size="sm"
  >
    <div class="flex h-full min-h-0 flex-col bg-white">
      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <label class="block space-y-2">
          <span class="text-[11px] font-black text-slate-400">分類</span>
          <select
            v-model="model.categoryId"
            class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
          >
            <option
              v-for="category in categories"
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
            v-model="model.name"
            class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none"
            placeholder="輸入物品名稱"
            @keyup.enter="emit('save')"
          />
        </label>
      </div>
      <footer
        class="flex items-center justify-between border-t border-slate-200 p-4"
      >
        <button
          v-if="model.mode === 'edit'"
          type="button"
          class="flex h-11 items-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-black text-red-600"
          @click="emit('delete')"
        >
          <Trash2 :size="16" /> 刪除
        </button>
        <span v-else></span>
        <button
          type="button"
          :disabled="isSaving"
          class="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white disabled:opacity-50"
          @click="emit('save')"
        >
          <Save :size="16" /> 儲存
        </button>
      </footer>
    </div>
  </AdminDrawer>
</template>
