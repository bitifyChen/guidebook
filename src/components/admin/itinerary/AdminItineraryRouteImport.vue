<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Check, Link2, Loader2, MapPin, X } from 'lucide-vue-next';
import { resolveGoogleMapsRouteUrl } from '@/api/googleMapsRoute';
import {
  isGoogleMapsShortUrl,
  parseGoogleMapsDirectionsUrl,
} from '@/utils/googleMapsRoute';

const props = defineProps({
  open: { type: Boolean, default: false },
  existingCount: { type: Number, default: 0 },
});

const emit = defineEmits(['close', 'apply']);

const routeUrl = ref('');
const resolving = ref(false);
const resolvedRoute = ref(null);
const mode = ref('append');

const hasStopCoordinates = (stop) => {
  if (
    stop?.geo?.lat === '' ||
    stop?.geo?.lat === null ||
    stop?.geo?.lat === undefined ||
    stop?.geo?.lng === '' ||
    stop?.geo?.lng === null ||
    stop?.geo?.lng === undefined
  ) {
    return false;
  }
  return (
    Number.isFinite(Number(stop.geo.lat)) &&
    Number.isFinite(Number(stop.geo.lng))
  );
};

const selectedStops = computed(() =>
  (resolvedRoute.value?.stops || []).filter((stop) => stop.selected)
);

const unresolvedCount = computed(
  () => selectedStops.value.filter((stop) => !hasStopCoordinates(stop)).length
);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    routeUrl.value = '';
    resolving.value = false;
    resolvedRoute.value = null;
    mode.value = 'append';
  }
);

const resolveRoute = async () => {
  const input = routeUrl.value.trim();
  if (!input || resolving.value) return;

  resolving.value = true;
  try {
    let resolvedUrl = input;
    if (isGoogleMapsShortUrl(input)) {
      const response = await resolveGoogleMapsRouteUrl(input);
      resolvedUrl = response.resolvedUrl;
    }
    const result = parseGoogleMapsDirectionsUrl(resolvedUrl, {
      sourceUrl: input,
    });
    resolvedRoute.value = {
      ...result,
      stops: result.stops.map((stop) => ({ ...stop, selected: true })),
    };
  } catch (error) {
    resolvedRoute.value = null;
    ElMessage.error(error.message || '路線解析失敗。');
  } finally {
    resolving.value = false;
  }
};

const applyRoute = () => {
  if (selectedStops.value.length < 2) {
    ElMessage.warning('請至少保留兩個路線地點。');
    return;
  }
  emit('apply', {
    mode: mode.value,
    sourceUrl: resolvedRoute.value.sourceUrl,
    stops: selectedStops.value.map(({ selected, ...stop }) => stop),
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
        <p class="text-sm font-black text-slate-900">匯入 Google 路線</p>
        <p class="text-[11px] font-bold text-slate-400">
          貼上多站路線的分享連結
        </p>
      </div>
      <button
        type="button"
        title="關閉匯入"
        aria-label="關閉匯入"
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
            v-model="routeUrl"
            type="url"
            class="h-11 min-w-0 flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none"
            placeholder="https://maps.app.goo.gl/..."
            @keydown.enter.prevent="resolveRoute"
          />
        </label>
        <button
          type="button"
          class="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-black text-white disabled:opacity-50"
          :disabled="!routeUrl.trim() || resolving"
          @click="resolveRoute"
        >
          <Loader2 v-if="resolving" :size="16" class="animate-spin" />
          解析
        </button>
      </div>

      <template v-if="resolvedRoute">
        <div class="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            class="h-9 rounded-lg text-xs font-black transition"
            :class="
              mode === 'append'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500'
            "
            @click="mode = 'append'"
          >
            附加到最後
          </button>
          <button
            type="button"
            class="h-9 rounded-lg text-xs font-black transition"
            :class="
              mode === 'replace'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-slate-500'
            "
            @click="mode = 'replace'"
          >
            取代本日
          </button>
        </div>

        <p
          v-if="mode === 'replace' && existingCount"
          class="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
        >
          儲存時將移除目前 {{ existingCount }} 個景點。
        </p>

        <div class="mt-4 divide-y divide-slate-100 border-y border-slate-100">
          <label
            v-for="(stop, index) in resolvedRoute.stops"
            :key="`${index}-${stop.map}`"
            class="flex gap-3 py-3"
          >
            <input
              v-model="stop.selected"
              type="checkbox"
              class="mt-3 h-4 w-4 accent-indigo-600"
            />
            <span
              class="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white"
            >
              {{ index + 1 }}
            </span>
            <span class="min-w-0 flex-1">
              <input
                v-model="stop.name"
                class="h-9 w-full rounded-lg bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
                aria-label="景點名稱"
              />
              <span
                class="mt-1 flex items-center gap-1 text-[10px] font-bold"
                :class="
                  hasStopCoordinates(stop)
                    ? 'text-emerald-600'
                    : 'text-orange-600'
                "
              >
                <MapPin :size="11" />
                {{
                  hasStopCoordinates(stop) ? '已取得座標' : '待匯入後在地圖定位'
                }}
              </span>
            </span>
          </label>
        </div>
      </template>
    </div>

    <footer
      v-if="resolvedRoute"
      class="shrink-0 border-t border-slate-200 bg-white p-4"
    >
      <div class="mb-3 flex items-center justify-between text-[11px] font-bold">
        <span class="text-slate-500"
          >已選 {{ selectedStops.length }} 個地點</span
        >
        <span v-if="unresolvedCount" class="text-orange-600">
          {{ unresolvedCount }} 個待定位
        </span>
      </div>
      <button
        type="button"
        class="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-black text-white disabled:opacity-40"
        :disabled="selectedStops.length < 2"
        @click="applyRoute"
      >
        <Check :size="17" /> 套用到草稿
      </button>
    </footer>
  </section>
</template>
