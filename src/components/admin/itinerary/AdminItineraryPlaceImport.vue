<script setup>
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Check, Link2, Loader2, MapPin, X } from 'lucide-vue-next';
import { resolveGoogleMapsRouteUrl } from '@/api/googleMapsRoute';
import {
  isGoogleMapsShortUrl,
  parseGoogleMapsPlaceUrl,
} from '@/utils/googleMapsRoute';

const props = defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'apply']);

const placeUrl = ref('');
const resolving = ref(false);
const parsedPlace = ref(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    placeUrl.value = '';
    resolving.value = false;
    parsedPlace.value = null;
  }
);

const resolvePlace = async () => {
  const input = placeUrl.value.trim();
  if (!input || resolving.value) return;

  resolving.value = true;
  try {
    let resolvedUrl = input;
    if (isGoogleMapsShortUrl(input)) {
      const response = await resolveGoogleMapsRouteUrl(input);
      resolvedUrl = response.resolvedUrl;
    }
    parsedPlace.value = parseGoogleMapsPlaceUrl(resolvedUrl, {
      sourceUrl: input,
    });
  } catch (error) {
    parsedPlace.value = null;
    ElMessage.error(error.message || 'Google Maps 景點解析失敗。');
  } finally {
    resolving.value = false;
  }
};

const applyPlace = () => {
  if (!parsedPlace.value?.name?.trim()) {
    ElMessage.warning('請填寫景點名稱。');
    return;
  }
  emit('apply', {
    ...parsedPlace.value,
    name: parsedPlace.value.name.trim(),
  });
};
</script>

<template>
  <section
    v-if="open"
    class="absolute inset-0 z-30 flex min-h-0 flex-col bg-white"
  >
    <header
      class="flex h-14 shrink-0 items-center border-b border-slate-200 px-4"
    >
      <div class="min-w-0 flex-1">
        <p class="text-sm font-black text-slate-900">新增景點</p>
        <p class="text-[11px] font-bold text-slate-400">
          貼上 Google Maps 的景點分享連結
        </p>
      </div>
      <button
        type="button"
        title="關閉新增景點"
        aria-label="關閉新增景點"
        class="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        @click="emit('close')"
      >
        <X :size="18" />
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <div class="flex gap-2">
        <label
          class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3"
        >
          <Link2 :size="16" class="shrink-0 text-slate-400" />
          <input
            v-model="placeUrl"
            type="url"
            class="h-11 min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none"
            placeholder="https://maps.app.goo.gl/..."
            @keydown.enter.prevent="resolvePlace"
          />
        </label>
        <button
          type="button"
          class="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black text-white disabled:opacity-50"
          :disabled="!placeUrl.trim() || resolving"
          @click="resolvePlace"
        >
          <Loader2 v-if="resolving" :size="16" class="animate-spin" />
          解析
        </button>
      </div>

      <div
        v-if="parsedPlace"
        class="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-start gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
          >
            <MapPin :size="19" />
          </span>
          <div class="min-w-0 flex-1">
            <label class="block text-[10px] font-black text-slate-400">
              景點名稱
            </label>
            <input
              v-model="parsedPlace.name"
              aria-label="景點名稱"
              class="mt-1 h-10 w-full rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p class="mt-2 font-mono text-[10px] font-bold text-slate-400">
              {{ parsedPlace.geo.lat }}, {{ parsedPlace.geo.lng }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <footer
      v-if="parsedPlace"
      class="shrink-0 border-t border-slate-200 bg-white p-4"
    >
      <button
        type="button"
        class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-black text-white"
        @click="applyPlace"
      >
        <Check :size="17" /> 新增至草稿
      </button>
    </footer>
  </section>
</template>
