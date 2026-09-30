<script setup>
import { ref } from 'vue';
const formRef = ref(null);
const drawerRef = ref(null);
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';
import AdminItineraryItemForm from './AdminItineraryItemForm.vue';

defineProps({
  open: { type: Boolean, default: false },
  session: { type: Number, default: 0 },
  mode: { type: String, default: 'create' },
  item: { type: Object, default: null },
  draft: { type: Boolean, default: false },
  availableItems: { type: Array, default: () => [] },
  defaultDay: { type: Number, default: 1 },
  lockDay: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open', 'close', 'saved', 'deleted']);
</script>

<template>
  <AdminDrawer
    ref="drawerRef"
    :dirty="Boolean(formRef?.dirty)"
    :busy="Boolean(formRef?.busy)"
    :model-value="open"
    bare
    size="md"
    :z-index="90"
    @update:model-value="emit('update:open', $event)"
    @close="emit('close')"
  >
    <AdminItineraryItemForm
      ref="formRef"
      :key="session"
      :mode="mode"
      :item="item"
      :draft="draft"
      :available-items="availableItems"
      :default-day="defaultDay"
      :lock-day="lockDay"
      compact
      @cancel="drawerRef?.requestClose()"
      @saved="emit('saved', $event)"
      @deleted="emit('deleted', $event)"
    />
  </AdminDrawer>
</template>
