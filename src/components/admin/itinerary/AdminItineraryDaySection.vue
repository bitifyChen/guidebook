<script setup>
import { computed } from 'vue';
import { Calendar, Clock3, MapPin } from 'lucide-vue-next';
import draggable from 'vuedraggable';
import AdminItineraryItemRow from './AdminItineraryItemRow.vue';

const props = defineProps({
  dayGroup: { type: Object, required: true },
  startTime: { type: String, default: '--:--' },
  calculating: { type: Boolean, default: false },
  scheduledItems: { type: Array, default: () => [] },
  imageStatus: { type: Object, default: () => ({}) },
});

const emit = defineEmits([
  'update-items',
  'reorder',
  'edit-item',
  'copy-item',
  'update-item',
  'edit-start',
  'calculate-routes',
]);

const items = computed({
  get: () => props.dayGroup.items,
  set: (value) => emit('update-items', value),
});

const scheduledById = computed(() =>
  Object.fromEntries(props.scheduledItems.map((item) => [item.id, item]))
);
</script>

<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center gap-2 px-2">
      <h3
        class="mr-auto flex items-center gap-2 text-lg font-black text-slate-800"
      >
        <Calendar :size="18" class="text-orange-500" /> Day {{ dayGroup.day }}
      </h3>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm"
        @click="emit('edit-start')"
      >
        <Clock3 :size="14" class="text-orange-500" /> 起始 {{ startTime }}
      </button>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm disabled:opacity-50"
        :disabled="calculating"
        @click="emit('calculate-routes')"
      >
        <MapPin :size="14" class="text-indigo-500" />
        {{ calculating ? '計算中' : '計算本日行車時間' }}
      </button>
    </div>
    <draggable
      v-model="items"
      group="itinerary"
      item-key="id"
      class="grid min-h-[50px] gap-3"
      handle=".drag-handle"
      ghost-class="opacity-50"
      @end="emit('reorder')"
    >
      <template #item="{ element: item, index }">
        <AdminItineraryItemRow
          :item="item"
          :index="index"
          :scheduled-item="scheduledById[item.id] || item"
          :image-status="imageStatus[item.id]"
          @edit="emit('edit-item', item)"
          @copy="emit('copy-item', item)"
          @update-field="emit('update-item', { item, ...$event })"
        />
      </template>
    </draggable>
  </section>
</template>
