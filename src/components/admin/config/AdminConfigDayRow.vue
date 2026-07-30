<script setup>
import { CalendarDays, Clock, Type } from 'lucide-vue-next';

defineProps({
  config: { type: Object, required: true },
  isFirst: { type: Boolean, default: false },
});

const emit = defineEmits(['first-date-change']);

const formatDateForInput = (value) => String(value || '').replace(/\//g, '-');

const updateDate = (config, value, isFirst) => {
  config.date = value;
  if (isFirst) emit('first-date-change', value);
};
</script>

<template>
  <section
    class="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
  >
    <div class="flex items-center gap-4 border-b border-slate-50 pb-4">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-sm font-black text-white"
      >
        {{ config.day }}
      </div>
      <h3 class="font-black text-slate-800">Day {{ config.day }} 配置</h3>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label class="space-y-1">
        <span
          class="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400"
        >
          <Type :size="10" /> 行程標題
        </span>
        <input
          v-model="config.title"
          type="text"
          placeholder="例如：東部海岸之旅"
          class="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-700 outline-none transition-all focus:border-orange-500"
        />
      </label>

      <label class="space-y-1">
        <span
          class="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400"
        >
          <CalendarDays :size="10" /> 日期
        </span>
        <input
          :value="formatDateForInput(config.date)"
          type="date"
          class="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 font-mono text-sm font-bold text-slate-700 outline-none transition-all focus:border-orange-500"
          @input="updateDate(config, $event.target.value, isFirst)"
        />
      </label>

      <label class="space-y-1">
        <span
          class="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400"
        >
          <Clock :size="10" /> 起始出發時間
        </span>
        <input
          v-model="config.start"
          type="time"
          class="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 font-mono text-sm font-bold text-slate-700 outline-none transition-all focus:border-orange-500"
        />
      </label>
    </div>
  </section>
</template>
