<script setup>
import { computed, ref, watch } from 'vue';
import { LogIn, LogOut } from 'lucide-vue-next';
import { calculateTimingAdjustment } from '@/utils/itineraryTiming';

const props = defineProps({
  open: { type: Boolean, default: false },
  item: { type: Object, default: null },
  mode: { type: String, default: 'arrived' },
  isSaving: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open', 'save']);
const actualTime = ref('');
const arrivalPolicy = ref('');
const drawerOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});
const preview = computed(() =>
  calculateTimingAdjustment({
    item: props.item,
    mode: props.mode,
    actualTime: actualTime.value,
    arrivalPolicy: arrivalPolicy.value,
  })
);
const scheduledStartTime = computed(
  () => props.item?.scheduledStartTime || props.item?.startTime || '--:--'
);
const scheduledEndTime = computed(
  () => props.item?.scheduledEndTime || props.item?.endTime || '--:--'
);
const hasPreviewStartChange = computed(
  () => preview.value.nextStartTime !== scheduledStartTime.value
);
const hasPreviewEndChange = computed(
  () => preview.value.nextEndTime !== scheduledEndTime.value
);
const drawerSize = computed(() =>
  props.mode === 'arrived' ? 'min(640px, 82dvh)' : 'min(500px, 68dvh)'
);
const isSubmitDisabled = computed(
  () =>
    props.isSaving ||
    !actualTime.value ||
    preview.value.stayMinutes === null ||
    (props.mode === 'arrived' &&
      (!arrivalPolicy.value ||
        (arrivalPolicy.value === 'keepDeparture' &&
          !preview.value.canKeepDeparture)))
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      actualTime.value = new Date().toTimeString().slice(0, 5);
      arrivalPolicy.value = '';
    }
  }
);

const submit = () => {
  if (isSubmitDisabled.value) return;
  emit('save', {
    actualTime: actualTime.value,
    arrivalPolicy: props.mode === 'arrived' ? arrivalPolicy.value : '',
  });
};
</script>

<template>
  <el-drawer
    v-model="drawerOpen"
    direction="btt"
    :size="drawerSize"
    :append-to-body="true"
    :with-header="false"
    class="frontend-contained-drawer itinerary-timing-drawer"
  >
    <form
      class="flex h-full min-h-0 flex-col bg-white"
      @submit.prevent="submit"
    >
      <el-scrollbar class="min-h-0 flex-1">
        <div class="space-y-4 p-5">
          <section class="rounded-3xl bg-slate-900 p-5 text-white shadow-xl">
            <div class="mb-5 flex items-center gap-3">
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10"
                :class="
                  mode === 'arrived' ? 'text-emerald-400' : 'text-orange-400'
                "
              >
                <LogIn v-if="mode === 'arrived'" :size="20" />
                <LogOut v-else :size="20" />
              </span>
              <div class="min-w-0">
                <p class="text-xs font-black text-slate-400">
                  {{ mode === 'arrived' ? '記錄抵達' : '記錄離開' }}
                </p>
                <h3 class="truncate text-xl font-black text-white">
                  {{ item?.location }}
                </h3>
              </div>
            </div>

            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div
                class="rounded-2xl p-3 transition-colors"
                :class="
                  hasPreviewStartChange ? 'bg-emerald-400/15' : 'bg-white/5'
                "
              >
                <p class="text-[11px] font-black text-slate-400">有效抵達</p>
                <strong
                  :key="`arrival-${preview.nextStartTime}`"
                  class="mt-1 block font-mono text-3xl font-black"
                  :class="[
                    hasPreviewStartChange ? 'text-emerald-300' : 'text-white',
                    { 'timing-preview-pulse': hasPreviewStartChange },
                  ]"
                >
                  {{ preview.nextStartTime || '--:--' }}
                </strong>
              </div>
              <span class="text-xl font-black text-slate-600">→</span>
              <div
                class="rounded-2xl p-3 text-right transition-colors"
                :class="hasPreviewEndChange ? 'bg-orange-400/15' : 'bg-white/5'"
              >
                <p class="text-[11px] font-black text-slate-400">有效離開</p>
                <strong
                  :key="`departure-${preview.nextEndTime}`"
                  class="mt-1 block font-mono text-3xl font-black"
                  :class="[
                    hasPreviewEndChange ? 'text-orange-300' : 'text-white',
                    { 'timing-preview-pulse': hasPreviewEndChange },
                  ]"
                >
                  {{ preview.nextEndTime || '--:--' }}
                </strong>
              </div>
            </div>

            <div
              class="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-black"
            >
              <span class="text-slate-400">
                原訂 {{ scheduledStartTime }} - {{ scheduledEndTime }}
              </span>
              <span
                :class="
                  preview.stayMinutes === null
                    ? 'text-red-300'
                    : 'text-slate-200'
                "
              >
                本次停留
                {{
                  preview.stayMinutes === null
                    ? '時間需確認'
                    : `${preview.stayMinutes} 分鐘`
                }}
              </span>
            </div>
          </section>

          <label class="block rounded-2xl bg-slate-50 p-4">
            <span class="text-xs font-black text-slate-500">
              {{ mode === 'arrived' ? '實際抵達時間' : '實際離開時間' }}
            </span>
            <input
              v-model="actualTime"
              type="time"
              required
              class="mt-3 h-14 w-full rounded-xl bg-white px-4 font-mono text-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-orange-200"
            />
          </label>

          <p
            v-if="preview.stayMinutes === null"
            class="rounded-xl bg-red-50 px-4 py-3 text-xs font-black text-red-500"
          >
            離開時間不可早於抵達時間，請重新選擇。
          </p>

          <div v-if="mode === 'arrived'" class="space-y-2">
            <p class="text-xs font-black text-slate-500">
              抵達後如何調整行程？
            </p>
            <label
              class="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors"
              :class="
                arrivalPolicy === 'keepDuration'
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-slate-200 bg-white'
              "
            >
              <input
                v-model="arrivalPolicy"
                type="radio"
                value="keepDuration"
                class="mt-1 accent-orange-500"
              />
              <span>
                <strong class="block text-sm text-slate-800"
                  >維持原停留時間</strong
                >
                <span class="mt-1 block text-xs font-bold text-slate-400">
                  依實際抵達時間重算離開與後續行程
                </span>
              </span>
            </label>
            <label
              class="flex items-start gap-3 rounded-2xl border p-4 transition-colors"
              :class="[
                arrivalPolicy === 'keepDeparture'
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-slate-200 bg-white',
                !preview.canKeepDeparture
                  ? 'cursor-not-allowed opacity-45'
                  : 'cursor-pointer',
              ]"
            >
              <input
                v-model="arrivalPolicy"
                type="radio"
                value="keepDeparture"
                :disabled="!preview.canKeepDeparture"
                class="mt-1 accent-orange-500"
              />
              <span>
                <strong class="block text-sm text-slate-800"
                  >維持原離開時間</strong
                >
                <span class="mt-1 block text-xs font-bold text-slate-400">
                  {{
                    preview.canKeepDeparture
                      ? '縮短停留時間，後續行程不移動'
                      : '實際抵達已晚於原訂離開時間，無法選用'
                  }}
                </span>
              </span>
            </label>
          </div>
        </div>
      </el-scrollbar>

      <footer
        class="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 p-4"
      >
        <button
          type="button"
          class="h-11 rounded-xl bg-slate-100 text-sm font-black text-slate-600"
          @click="drawerOpen = false"
        >
          取消
        </button>
        <button
          type="submit"
          :disabled="isSubmitDisabled"
          class="h-11 rounded-xl bg-orange-500 text-sm font-black text-white disabled:opacity-60"
        >
          {{
            isSaving ? '更新中' : mode === 'arrived' ? '確認抵達' : '確認離開'
          }}
        </button>
      </footer>
    </form>
  </el-drawer>
</template>

<style scoped>
:global(.itinerary-timing-drawer .el-drawer__body) {
  padding: 0;
}

:global(.itinerary-timing-drawer) {
  border-radius: 28px 28px 0 0 !important;
  overflow: hidden;
}

@keyframes timing-preview-pulse {
  0% {
    transform: scale(0.96);
    opacity: 0.65;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.timing-preview-pulse {
  animation: timing-preview-pulse 320ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .timing-preview-pulse {
    animation: none;
  }
}
</style>
