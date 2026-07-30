<script setup>
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';
import AdminItineraryItemForm from './AdminItineraryItemForm.vue';

defineProps({
  open: { type: Boolean, default: false },
  session: { type: Number, default: 0 },
  mode: { type: String, default: 'create' },
  item: { type: Object, default: null },
});

const emit = defineEmits(['update:open', 'close', 'saved', 'deleted']);
</script>

<template>
  <AdminDrawer
    :model-value="open"
    bare
    size="md"
    :z-index="90"
    @update:model-value="emit('update:open', $event)"
    @close="emit('close')"
  >
    <AdminItineraryItemForm
      :key="session"
      :mode="mode"
      :item="item"
      compact
      @cancel="emit('close')"
      @saved="emit('saved', $event)"
      @deleted="emit('deleted', $event)"
    />
  </AdminDrawer>
</template>
