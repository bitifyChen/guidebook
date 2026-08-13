<script setup>
import { computed } from 'vue';
import { Calendar, ChevronRight, Clock3, MapPin } from 'lucide-vue-next';
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
  'drag-start',
  'edit-item',
  'edit-start',
  'calculate-routes',
  'open-route-planner',
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
    <div
      role="button"
      tabindex="0"
      class="flex cursor-pointer flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/40"
      @click="emit('open-route-planner')"
      @keydown.enter.prevent="emit('open-route-planner')"
      @keydown.space.prevent="emit('open-route-planner')"
    >
      <h3
        class="mr-auto flex items-center gap-2 text-lg font-black text-slate-800"
      >
        <Calendar :size="18" class="text-orange-500" /> Day {{ dayGroup.day }}
        <span class="text-xs font-bold text-slate-400">
          {{ dayGroup.items.length }} 個景點
        </span>
      </h3>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm"
        @click.stop="emit('edit-start')"
      >
        <Clock3 :size="14" class="text-orange-500" /> 起始 {{ startTime }}
      </button>
      <button
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 shadow-sm disabled:opacity-50"
        :disabled="calculating"
        @click.stop="emit('calculate-routes')"
      >
        <MapPin :size="14" class="text-indigo-500" />
        {{ calculating ? '計算中' : '計算本日行車時間' }}
      </button>
      <span
        class="inline-flex h-9 items-center gap-1 px-2 text-xs font-black text-indigo-600"
      >
        開啟編排 <ChevronRight :size="16" />
      </span>
    </div>
    <draggable
      v-model="items"
      group="itinerary"
      item-key="id"
      class="grid min-h-[50px] gap-3"
      handle=".drag-handle"
      ghost-class="opacity-50"
      @start="
        emit('drag-start', {
          item: items[$event.oldIndex],
          oldIndex: $event.oldIndex,
        })
      "
      @end="emit('reorder', $event)"
    >
      <template #item="{ element: item, index }">
        <AdminItineraryItemRow
          :item="item"
          :index="index"
          :scheduled-item="scheduledById[item.id] || item"
          :image-status="imageStatus[item.id]"
          @edit="emit('edit-item', item)"
        />
      </template>
    </draggable>
  </section>
</template>
