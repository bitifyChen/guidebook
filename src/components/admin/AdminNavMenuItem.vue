<script setup>
import { computed, ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';

const props = defineProps({
  item: { type: Object, required: true },
  activePath: { type: String, default: '' },
  isSidebarOpen: { type: Boolean, default: true },
  depth: { type: Number, default: 0 },
});

const isOpen = ref(false);

const isChildActive = (item) => {
  if (item.path && props.activePath === item.path) return true;
  if (item.path && item.path !== '/admin' && props.activePath.startsWith(item.path)) {
    return true;
  }
  return item.children?.some((child) => isChildActive(child)) || false;
};

const isActive = computed(() => isChildActive(props.item));

if (isActive.value) {
  isOpen.value = true;
}
</script>

<template>
  <div>
    <button
      v-if="item.children?.length"
      @click="isOpen = !isOpen"
      class="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors group"
      :class="
        isActive
          ? 'bg-slate-800 text-white'
          : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
      "
      :style="{ paddingLeft: `${12 + depth * 12}px` }"
    >
      <component :is="item.icon" class="w-5 h-5 shrink-0" />
      <span v-if="isSidebarOpen" class="flex-1 font-bold text-sm">
        {{ item.label }}
      </span>
      <ChevronDown
        v-if="isSidebarOpen"
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <router-link
      v-else
      :to="item.path"
      class="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors relative group"
      :class="
        isActive
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/30'
          : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
      "
      :style="{ paddingLeft: `${12 + depth * 12}px` }"
    >
      <component :is="item.icon" class="w-5 h-5 shrink-0" />
      <span v-if="isSidebarOpen" class="font-bold text-sm whitespace-nowrap">
        {{ item.label }}
      </span>
      <div
        v-if="!isSidebarOpen"
        class="absolute left-16 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white opacity-0 shadow-xl pointer-events-none group-hover:opacity-100"
      >
        {{ item.label }}
      </div>
    </router-link>

    <div
      v-if="item.children?.length && isOpen && isSidebarOpen"
      class="mt-1 ml-4 border-l border-slate-800 pl-2 space-y-1"
    >
      <AdminNavMenuItem
        v-for="child in item.children"
        :key="child.path"
        :item="child"
        :active-path="activePath"
        :is-sidebar-open="isSidebarOpen"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>
