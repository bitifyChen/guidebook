<script setup>
import { computed } from 'vue';
import { X } from 'lucide-vue-next';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  size: { type: String, default: 'md' },
  zIndex: { type: Number, default: 80 },
  bare: { type: Boolean, default: false },
  closeOnClickModal: { type: Boolean, default: true },
});

const emit = defineEmits(['update:modelValue', 'close']);

const drawerVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'admin-drawer-sm';
  if (props.size === 'lg') return 'admin-drawer-lg';
  if (props.size === 'xl') return 'admin-drawer-xl';
  return 'admin-drawer-md';
});

const closeDrawer = () => {
  drawerVisible.value = false;
  emit('close');
};
</script>

<template>
  <el-drawer
    v-model="drawerVisible"
    direction="rtl"
    :append-to-body="true"
    :with-header="false"
    :show-close="false"
    :close-on-click-modal="closeOnClickModal"
    :z-index="zIndex"
    :class="['admin-drawer', sizeClass]"
    @closed="emit('close')"
  >
    <div class="flex h-full min-h-0 flex-col bg-slate-50">
      <header
        v-if="!bare"
        class="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5"
      >
        <div class="min-w-0">
          <h3 class="truncate text-base font-black text-slate-900">{{ title }}</h3>
          <p v-if="subtitle" class="mt-1 truncate text-[11px] font-bold text-slate-400">
            {{ subtitle }}
          </p>
        </div>
        <slot name="actions"></slot>
        <button
          type="button"
          title="關閉"
          aria-label="關閉側邊欄"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-slate-700"
          @click="closeDrawer"
        >
          <X :size="20" />
        </button>
      </header>

      <button
        v-else
        type="button"
        title="關閉"
        aria-label="關閉側邊欄"
        class="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 hover:text-slate-700"
        @click="closeDrawer"
      >
        <X :size="20" />
      </button>

      <div class="min-h-0 flex-1 overflow-hidden">
        <slot></slot>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
:global(.admin-drawer) {
  --el-drawer-padding-primary: 0;
}

:global(.admin-drawer .el-drawer__body) {
  height: 100%;
  padding: 0;
}

:global(.admin-drawer-md) {
  width: min(100vw, 672px) !important;
}

:global(.admin-drawer-sm) {
  width: min(100vw, 448px) !important;
}

:global(.admin-drawer-lg) {
  width: min(100vw, 1024px) !important;
}

:global(.admin-drawer-xl) {
  width: min(100vw, 1280px) !important;
}

@media (max-width: 640px) {
  :global(.admin-drawer) {
    width: 100vw !important;
    max-width: none !important;
  }

  :global(.admin-drawer .el-drawer__body) {
    padding-top: env(safe-area-inset-top);
  }

  :global(.admin-drawer header) {
    min-height: 60px;
    height: auto;
  }

  :global(.admin-drawer .admin-drawer-footer) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 12px;
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }

  :global(.admin-drawer .admin-drawer-footer > button) {
    width: 100%;
    padding-inline: 12px;
  }
}
</style>
