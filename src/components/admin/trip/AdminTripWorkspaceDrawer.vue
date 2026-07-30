<script setup>
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  component: { type: [Object, Function], default: null },
});

const emit = defineEmits(['update:open', 'close']);
</script>

<template>
  <AdminDrawer
    :model-value="open"
    :title="title"
    :subtitle="subtitle"
    size="lg"
    :z-index="80"
    @update:model-value="emit('update:open', $event)"
    @close="emit('close')"
  >
    <div class="h-full min-h-0 overflow-y-auto">
      <component :is="component" v-if="component" embedded />
    </div>
  </AdminDrawer>
</template>
