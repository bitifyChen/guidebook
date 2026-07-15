<script setup>
import { computed } from 'vue';
import { Save } from 'lucide-vue-next';

const props = defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  modelValue: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  submitText: { type: String, default: '儲存' },
});

const emit = defineEmits(['update:modelValue', 'submit']);

const form = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const updateField = (name, value) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [name]: value,
  });
};
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div v-if="title || description" class="mb-5">
      <h3 v-if="title" class="text-lg font-black text-slate-800">{{ title }}</h3>
      <p v-if="description" class="text-sm font-bold text-slate-400 mt-1">
        {{ description }}
      </p>
    </div>

    <form class="grid grid-cols-1 md:grid-cols-2 gap-4" @submit.prevent="$emit('submit')">
      <label
        v-for="field in fields"
        :key="field.name"
        class="space-y-1"
        :class="field.full ? 'md:col-span-2' : ''"
      >
        <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">
          {{ field.label }}
        </span>
        <input
          v-if="!field.type || ['text', 'date', 'number'].includes(field.type)"
          :type="field.type || 'text'"
          :value="form[field.name]"
          :placeholder="field.placeholder || ''"
          class="w-full h-11 rounded-xl bg-slate-50 border border-slate-100 px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300"
          @input="updateField(field.name, $event.target.value)"
        />
        <textarea
          v-else-if="field.type === 'textarea'"
          :value="form[field.name]"
          :placeholder="field.placeholder || ''"
          :rows="field.rows || 4"
          class="w-full rounded-xl bg-slate-50 border border-slate-100 px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300"
          @input="updateField(field.name, $event.target.value)"
        ></textarea>
        <select
          v-else-if="field.type === 'select'"
          :value="form[field.name]"
          class="w-full h-11 rounded-xl bg-slate-50 border border-slate-100 px-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-300"
          @change="updateField(field.name, $event.target.value)"
        >
          <option value="">{{ field.placeholder || '請選擇' }}</option>
          <option
            v-for="option in field.options || []"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <div class="flex justify-end pt-2 md:col-span-2">
        <button
          type="submit"
          :disabled="loading"
          class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
        >
          <Save :size="16" />
          {{ submitText }}
        </button>
      </div>
    </form>
  </section>
</template>
