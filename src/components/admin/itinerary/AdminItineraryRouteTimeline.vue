<script setup>
import { computed } from 'vue';
import { Clock3, GripVertical, MapPin } from 'lucide-vue-next';
import draggable from 'vuedraggable';

const props = defineProps({
  items: { type: Array, default: () => [] },
  scheduledItems: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
});

const emit = defineEmits(['update-items', 'select']);

const draggableItems = computed({
  get: () => props.items,
  set: (value) => emit('update-items', value),
});

const scheduledById = computed(() =>
  Object.fromEntries(props.scheduledItems.map((item) => [item.id, item]))
);

const hasCoordinates = (item) =>
  item?.geo?.lat !== '' &&
  item?.geo?.lat !== null &&
  item?.geo?.lat !== undefined &&
  item?.geo?.lng !== '' &&
  item?.geo?.lng !== null &&
  item?.geo?.lng !== undefined &&
  Number.isFinite(Number(item.geo.lat)) &&
  Number.isFinite(Number(item.geo.lng));
</script>

<template>
  <draggable
    v-model="draggableItems"
    item-key="id"
    handle=".route-drag-handle"
    ghost-class="opacity-40"
    class="divide-y divide-slate-100"
  >
    <template #item="{ element: item, index }">
      <article
        class="group flex cursor-pointer gap-2 px-3 py-3 transition"
        :class="
          selectedId === String(item.id)
            ? 'bg-indigo-50'
            : 'bg-white hover:bg-slate-50'
        "
        @click="emit('select', String(item.id))"
      >
        <button
          type="button"
          title="拖曳排序"
          aria-label="拖曳排序"
          class="route-drag-handle flex w-5 shrink-0 cursor-grab items-center justify-center text-slate-300 active:cursor-grabbing"
          @click.stop
        >
          <GripVertical :size="16" />
        </button>
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
          :class="
            selectedId === String(item.id)
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-900 text-white'
          "
        >
          {{ index + 1 }}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <p
              class="truncate text-xs font-black text-slate-800"
              :class="item.parentId ? 'pl-3 text-slate-600' : ''"
            >
              {{ item.location || '未命名地點' }}
            </p>
            <span
              class="shrink-0 font-mono text-[10px] font-black text-slate-500"
            >
              {{ scheduledById[item.id]?.startTime || '--:--' }}
            </span>
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              class="flex items-center gap-1 text-[10px] font-bold text-slate-400"
            >
              <Clock3 :size="11" />
              {{
                Number(item.duration) > 0 ? `${item.duration} 分鐘` : '尚未設定'
              }}
            </span>
            <span
              v-if="item.fixedStartTime"
              class="text-[10px] font-bold text-indigo-600"
            >
              指定 {{ item.fixedStartTime }}
            </span>
            <span
              class="flex items-center gap-1 text-[10px] font-bold"
              :class="
                hasCoordinates(item) ? 'text-emerald-600' : 'text-orange-600'
              "
            >
              <MapPin :size="11" />
              {{ hasCoordinates(item) ? '已定位' : '待定位' }}
            </span>
          </div>
        </div>
      </article>
    </template>
  </draggable>
</template>
