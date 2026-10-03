<script setup>
import FrontendBottomDrawer from '@/components/FrontendBottomDrawer.vue';

defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <FrontendBottomDrawer
    :model-value="modelValue"
    :title="title"
    :description="description"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <slot />
  </FrontendBottomDrawer>
</template>
