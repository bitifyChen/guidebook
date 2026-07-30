<script setup>
import {
  ChevronRight,
  Clock3,
  Copy,
  GripVertical,
  Image,
  ImageOff,
  MapPin,
  MapPinOff,
} from 'lucide-vue-next';

const props = defineProps({
  item: { type: Object, required: true },
  index: { type: Number, required: true },
  scheduledItem: { type: Object, required: true },
  imageStatus: { type: String, default: '' },
});

const emit = defineEmits(['edit', 'copy', 'update-field']);

const timeChanged = (edge) => {
  const scheduled = props.scheduledItem?.[`scheduled${edge}Time`];
  const effective = props.scheduledItem?.[`${edge.toLowerCase()}Time`];
  return Boolean(scheduled && scheduled !== effective);
};

const updateNumber = (field, event) => {
  const value = Number(event.target.value);
  emit('update-field', { field, value: Number.isFinite(value) ? value : 0 });
};
</script>

<template>
  <article
    class="itinerary-admin-row flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4"
  >
    <div class="flex min-w-0 flex-1 items-start gap-3">
      <div
        class="drag-handle flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 active:cursor-grabbing"
      >
        <GripVertical :size="17" class="text-slate-300" />
      </div>
      <div
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-400"
      >
        {{ index + 1 }}
      </div>
      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        @click="emit('edit')"
      >
        <span
          class="flex items-center gap-1.5 font-black leading-tight text-slate-800"
        >
          <component
            :is="item.map ? MapPin : MapPinOff"
            :size="13"
            :class="item.map ? 'text-blue-500' : 'text-slate-300'"
          />
          <component
            :is="item?.images?.[0] || item?.cover ? Image : ImageOff"
            :size="13"
            :class="
              imageStatus === 'error'
                ? 'text-red-500'
                : item?.images?.[0] || item?.cover
                  ? 'text-green-500'
                  : 'text-slate-300'
            "
          />
          <span class="truncate">{{ item.location }}</span>
        </span>
        <div
          class="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium"
        >
          <div
            class="inline-flex flex-col gap-1 rounded-lg border border-slate-200/80 bg-slate-50/80 p-2 font-mono text-[11px] leading-none shadow-xs"
          >
            <div
              class="grid grid-cols-[28px_1fr] items-center gap-1.5 text-slate-400"
            >
              <span class="font-sans text-[10px] font-semibold">預計</span>
              <div class="flex items-center gap-1">
                <Clock3 :size="11" class="shrink-0 text-slate-300" />
                <span
                  :class="{ 'line-through opacity-60': timeChanged('Start') }"
                >
                  {{ scheduledItem.scheduledStartTime || '--:--' }}
                </span>
                <span class="text-slate-300">-</span>
                <span
                  :class="{ 'line-through opacity-60': timeChanged('End') }"
                >
                  {{ scheduledItem.scheduledEndTime || '--:--' }}
                </span>
              </div>
            </div>
            <div
              class="grid grid-cols-[28px_1fr] items-center gap-1.5 text-slate-700"
            >
              <span class="font-sans text-[10px] font-bold text-slate-500"
                >實際</span
              >
              <div class="flex items-center gap-1 font-semibold">
                <Clock3 :size="11" class="shrink-0 text-slate-400" />
                <span
                  :class="{
                    'font-bold text-emerald-600': timeChanged('Start'),
                  }"
                >
                  {{ scheduledItem.startTime || '--:--' }}
                </span>
                <span class="text-slate-300">-</span>
                <span
                  :class="{ 'font-bold text-amber-600': timeChanged('End') }"
                >
                  {{ scheduledItem.endTime || '--:--' }}
                </span>
              </div>
            </div>
          </div>
          <div
            class="flex flex-wrap items-center gap-1.5 text-[11px] font-medium"
          >
            <span
              v-if="item.fixedStartTime"
              class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 ring-1 ring-indigo-700/10 ring-inset"
            >
              固定 {{ item.fixedStartTime }}
            </span>
            <span
              v-if="scheduledItem.waitMinutes"
              class="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-600/10 ring-inset"
            >
              等待 {{ scheduledItem.waitMinutes }} 分
            </span>
            <span
              v-if="scheduledItem.fixedTimeLateMinutes"
              class="inline-flex items-center rounded-md bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-600/10 ring-inset"
            >
              遲到 {{ scheduledItem.fixedTimeLateMinutes }} 分
            </span>
          </div>
        </div>
      </button>
    </div>

    <div
      class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
    >
      <label
        v-for="field in [
          {
            key: 'duration',
            label: '停留',
            tone: 'slate',
            value: item.duration,
          },
          { key: 'delay', label: '延遲', tone: 'orange', value: item.delay },
          {
            key: 'nextDrive.time',
            label: '車程',
            tone: 'blue',
            value: item.nextDrive?.time,
          },
        ]"
        :key="field.key"
        class="flex min-w-[62px] flex-1 flex-col items-center rounded-xl border px-2 py-1 sm:flex-none"
        :class="{
          'border-slate-100 bg-slate-50': field.tone === 'slate',
          'border-orange-100 bg-orange-50': field.tone === 'orange',
          'border-blue-100 bg-blue-50': field.tone === 'blue',
        }"
      >
        <span
          class="text-[9px] font-black"
          :class="{
            'text-slate-400': field.tone === 'slate',
            'text-orange-400': field.tone === 'orange',
            'text-blue-400': field.tone === 'blue',
          }"
          >{{ field.label }}</span
        >
        <input
          :value="field.value ?? 0"
          type="number"
          class="w-full bg-transparent text-center font-mono font-black outline-none sm:w-10"
          :class="{
            'text-slate-600': field.tone === 'slate',
            'text-orange-600': field.tone === 'orange',
            'text-blue-600': field.tone === 'blue',
          }"
          @change="updateNumber(field.key, $event)"
        />
      </label>
      <div class="ml-auto flex items-center gap-1 sm:ml-1">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-blue-500"
          title="複製此行程"
          @click="emit('copy')"
        >
          <Copy :size="16" />
        </button>
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-orange-500"
          title="編輯行程"
          @click="emit('edit')"
        >
          <ChevronRight :size="20" />
        </button>
      </div>
    </div>
  </article>
</template>
