<script setup>
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

defineProps({
  open: { type: Boolean, default: false },
  day: { type: Number, default: null },
  start: { type: String, default: '09:00' },
  isSaving: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open', 'update:start', 'save']);
</script>

<template>
  <AdminDrawer
    :model-value="open"
    size="sm"
    :z-index="125"
    title="設定起始時間"
    :subtitle="`Day ${day || '-'}`"
    :close-on-click-modal="false"
    @update:model-value="emit('update:open', $event)"
  >
    <form class="flex h-full flex-col" @submit.prevent="emit('save')">
      <div class="flex-1 p-5">
        <label class="block rounded-2xl border border-slate-200 bg-white p-4">
          <span class="text-xs font-black text-slate-500">本日出發時間</span>
          <input
            :value="start"
            type="time"
            required
            class="mt-3 h-14 w-full rounded-xl bg-slate-50 px-4 font-mono text-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200"
            @input="emit('update:start', $event.target.value)"
          />
        </label>
      </div>
      <footer class="border-t border-slate-200 bg-white p-4">
        <button
          type="submit"
          :disabled="isSaving"
          class="h-11 w-full rounded-xl bg-indigo-600 text-sm font-black text-white disabled:opacity-60"
        >
          {{ isSaving ? '儲存中' : '儲存起始時間' }}
        </button>
      </footer>
    </form>
  </AdminDrawer>
</template>
