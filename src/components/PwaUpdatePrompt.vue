<script setup>
import { computed } from 'vue';
import { Download, Loader2, RefreshCw } from 'lucide-vue-next';
import {
  applyAppUpdate,
  dismissAppUpdate,
  pwaUpdateState,
} from '@/services/pwaUpdate';

const isVisible = computed(() =>
  ['optional', 'required', 'updating'].includes(pwaUpdateState.status)
);
const isRequired = computed(() => pwaUpdateState.promptType === 'required');
const isUpdating = computed(() => pwaUpdateState.status === 'updating');

const update = async () => {
  try {
    await applyAppUpdate();
  } catch {
    // The shared state displays the recoverable error in the prompt.
  }
};
</script>

<template>
  <Transition name="pwa-update-fade">
    <div
      v-if="isVisible"
      class="fixed inset-0 z-[12000] flex items-end justify-center bg-slate-950/45 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
    >
      <section
        class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-slate-950/25"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--travel-mist)] text-[var(--travel-teal)]"
          >
            <RefreshCw v-if="isRequired" :size="22" />
            <Download v-else :size="22" />
          </div>
          <div class="min-w-0 flex-1">
            <h2 id="pwa-update-title" class="text-lg font-black text-slate-900">
              {{ isRequired ? '需要更新應用程式' : '有新版可以使用' }}
            </h2>
            <p class="mt-2 text-sm font-bold leading-6 text-slate-500">
              {{
                isRequired
                  ? '請更新至最新版本後繼續使用。'
                  : '更新後即可使用最新功能與修正。'
              }}
            </p>
            <p class="mt-2 text-xs font-bold text-slate-400">
              目前 v{{ pwaUpdateState.currentVersion }} · 新版 v{{
                pwaUpdateState.targetVersion
              }}
            </p>
          </div>
        </div>

        <p
          class="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold leading-5 text-slate-500"
        >
          更新不會登出帳號，也不會刪除旅程或此裝置上的資料。
        </p>
        <p
          v-if="pwaUpdateState.error"
          class="mt-3 text-xs font-bold text-red-500"
        >
          {{ pwaUpdateState.error }}
        </p>

        <div class="mt-6 grid gap-3" :class="isRequired ? '' : 'grid-cols-2'">
          <button
            v-if="!isRequired"
            type="button"
            class="h-12 rounded-2xl bg-slate-100 text-sm font-black text-slate-600"
            :disabled="isUpdating"
            @click="dismissAppUpdate"
          >
            稍後再說
          </button>
          <button
            type="button"
            class="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--travel-teal)] text-sm font-black text-white disabled:opacity-60"
            :disabled="isUpdating"
            @click="update"
          >
            <Loader2 v-if="isUpdating" :size="17" class="animate-spin" />
            <RefreshCw v-else :size="17" />
            {{ isUpdating ? '正在更新' : '立即更新' }}
          </button>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-update-fade-enter-active,
.pwa-update-fade-leave-active {
  transition: opacity 0.2s ease;
}

.pwa-update-fade-enter-from,
.pwa-update-fade-leave-to {
  opacity: 0;
}
</style>
