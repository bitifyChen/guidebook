<script setup>
import { computed } from 'vue';
import {
  Clock3,
  Copy,
  MapPin,
  Navigation,
  Pencil,
  Trash2,
} from 'lucide-vue-next';

const props = defineProps({
  item: { type: Object, default: null },
  scheduledItem: { type: Object, default: null },
  moving: { type: Boolean, default: false },
});

const emit = defineEmits(['update', 'move', 'remove', 'details', 'duplicate']);

const updateField = (field, value) => emit('update', { field, value });
const hasCoordinates = computed(() => {
  if (
    props.item?.geo?.lat === '' ||
    props.item?.geo?.lat === null ||
    props.item?.geo?.lat === undefined ||
    props.item?.geo?.lng === '' ||
    props.item?.geo?.lng === null ||
    props.item?.geo?.lng === undefined
  ) {
    return false;
  }
  return (
    Number.isFinite(Number(props.item.geo.lat)) &&
    Number.isFinite(Number(props.item.geo.lng))
  );
});
</script>

<template>
  <section v-if="item" class="border-t border-slate-200 bg-white p-4">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-black text-slate-900">編輯景點</p>
        <p class="mt-1 font-mono text-[10px] font-bold text-slate-400">
          {{ scheduledItem?.startTime || '--:--' }} -
          {{ scheduledItem?.endTime || '--:--' }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          title="完整編輯"
          aria-label="完整編輯"
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
          @click="emit('details')"
        >
          <Pencil :size="16" />
        </button>
        <button
          type="button"
          title="複製景點"
          aria-label="複製景點"
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"
          @click="emit('duplicate')"
        >
          <Copy :size="16" />
        </button>
        <button
          type="button"
          title="從本日移除"
          aria-label="從本日移除"
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100"
          @click="emit('remove')"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <label class="block">
      <span class="text-[10px] font-black text-slate-400">景點名稱</span>
      <input
        :value="item.location"
        class="mt-1 h-10 w-full rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
        placeholder="輸入景點名稱"
        @input="updateField('location', $event.target.value)"
      />
    </label>

    <div class="mt-3 grid grid-cols-2 gap-2">
      <label class="rounded-xl bg-slate-50 p-3">
        <span
          class="flex items-center gap-1 text-[10px] font-black text-slate-400"
        >
          <Clock3 :size="12" /> 停留分鐘
        </span>
        <input
          :value="item.duration"
          type="number"
          min="0"
          :disabled="Boolean(item.parentId)"
          class="mt-1 w-full bg-transparent font-mono text-sm font-black text-slate-800 outline-none disabled:opacity-40"
          @input="updateField('duration', Number($event.target.value) || 0)"
        />
      </label>
      <label class="rounded-xl bg-indigo-50 p-3">
        <span class="text-[10px] font-black text-indigo-400">指定抵達</span>
        <input
          :value="item.fixedStartTime"
          type="time"
          class="mt-1 w-full bg-transparent font-mono text-sm font-black text-indigo-800 outline-none"
          @input="updateField('fixedStartTime', $event.target.value)"
        />
      </label>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2">
      <label class="rounded-xl border border-slate-200 px-3 py-2">
        <span class="text-[10px] font-black text-slate-400">緯度</span>
        <input
          :value="item.geo?.lat ?? ''"
          type="number"
          step="any"
          class="mt-1 w-full bg-transparent font-mono text-xs font-bold text-slate-700 outline-none"
          @change="updateField('geo.lat', $event.target.value)"
        />
      </label>
      <label class="rounded-xl border border-slate-200 px-3 py-2">
        <span class="text-[10px] font-black text-slate-400">經度</span>
        <input
          :value="item.geo?.lng ?? ''"
          type="number"
          step="any"
          class="mt-1 w-full bg-transparent font-mono text-xs font-bold text-slate-700 outline-none"
          @change="updateField('geo.lng', $event.target.value)"
        />
      </label>
    </div>

    <button
      type="button"
      class="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-black transition"
      :class="
        moving
          ? 'bg-orange-500 text-white'
          : 'bg-slate-900 text-white hover:bg-slate-800'
      "
      @click="emit('move')"
    >
      <Navigation v-if="moving" :size="15" />
      <MapPin v-else :size="15" />
      {{
        moving
          ? '請在地圖點選新位置'
          : hasCoordinates
            ? '調整位置'
            : '在地圖設定位置'
      }}
    </button>
  </section>
</template>
