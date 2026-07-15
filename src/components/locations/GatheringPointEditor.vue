<script setup>
import { Flag, Loader2, Save, X } from 'lucide-vue-next';

defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, required: true },
  isSaving: { type: Boolean, default: false },
});

defineEmits(['save', 'cancel']);
</script>

<template>
  <div v-if="open" class="pointer-events-none absolute inset-0 z-[540]">
    <div
      class="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center"
    >
      <div
        class="mb-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white shadow-lg"
      >
        拖動地圖選擇位置
      </div>
      <div class="map-center-pin">
        <Flag :size="20" :stroke-width="2.8" />
      </div>
    </div>

    <section
      class="pointer-events-auto absolute inset-x-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] rounded-[24px] bg-white p-4 shadow-2xl"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-black uppercase tracking-widest text-orange-500">
            {{ form.id ? '編輯集合點' : '新增集合點' }}
          </p>
          <h2 class="mt-1 text-lg font-black text-slate-900">確認集合位置</h2>
        </div>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          @click="$emit('cancel')"
        >
          <X :size="17" :stroke-width="2.5" />
        </button>
      </div>
      <div class="mt-4 space-y-3">
        <input
          :value="form.title"
          type="text"
          class="h-12 w-full rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="集合點名稱"
          @input="form.title = $event.target.value"
        />
        <input
          :value="form.meetAt"
          type="datetime-local"
          class="h-12 w-full rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-400"
          @input="form.meetAt = $event.target.value"
        />
        <button
          type="button"
          :disabled="isSaving"
          class="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white disabled:opacity-60"
          @click="$emit('save')"
        >
          <Loader2 v-if="isSaving" :size="17" class="animate-spin" />
          <Save v-else :size="17" :stroke-width="2.6" />
          儲存集合點
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.map-center-pin {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 56px;
  height: 70px;
  padding-top: 17px;
  color: #fff;
  background: #f97316;
  clip-path: polygon(
    50% 0%,
    70% 4%,
    88% 18%,
    96% 38%,
    88% 58%,
    50% 100%,
    12% 58%,
    4% 38%,
    12% 18%,
    30% 4%
  );
  filter: drop-shadow(0 2px 1px rgb(255 255 255 / 88%))
    drop-shadow(0 10px 18px rgb(124 45 18 / 36%));
}
</style>
