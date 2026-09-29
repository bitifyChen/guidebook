<script setup>
import { computed, ref, watch } from 'vue';
import { AlertTriangle, Loader2, ShieldCheck, Trash2 } from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  preview: { type: Object, default: () => ({}) },
  isLoading: { type: Boolean, default: false },
  isRunning: { type: Boolean, default: false },
});

const emit = defineEmits(['update:open', 'close', 'refresh', 'run']);
const confirmation = ref('');

const items = computed(() => props.preview.items || []);
const canRun = computed(
  () =>
    !props.isLoading &&
    !props.isRunning &&
    props.preview.status === 'ok' &&
    confirmation.value === '清理'
);

watch(
  () => props.open,
  (open) => {
    if (open) confirmation.value = '';
  }
);

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-TW');
</script>

<template>
  <AdminDrawer
    :model-value="open"
    title="軌跡保留期限"
    subtitle="固定保留每位成員每日軌跡 90 天"
    size="lg"
    :z-index="106"
    @update:model-value="emit('update:open', $event)"
    @close="emit('close')"
  >
    <div class="flex h-full min-h-0 flex-col bg-slate-50">
      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <section class="grid gap-3 sm:grid-cols-5">
          <div class="retention-stat">
            <span>保留期限</span>
            <strong>90 天</strong>
          </div>
          <div class="retention-stat">
            <span>待清理項目</span>
            <strong>{{ formatNumber(preview.candidateCount) }}</strong>
          </div>
          <div class="retention-stat">
            <span>Firestore 文件</span>
            <strong>{{ formatNumber(preview.firestoreDocumentCount) }}</strong>
          </div>
          <div class="retention-stat">
            <span>RTDB 緩衝點</span>
            <strong>{{ formatNumber(preview.rtdbPointCount) }}</strong>
          </div>
          <div class="retention-stat">
            <span>定位點總數</span>
            <strong>{{ formatNumber(preview.pointCount) }}</strong>
          </div>
        </section>

        <div
          class="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-relaxed text-amber-800"
        >
          <AlertTriangle :size="18" class="mt-0.5 shrink-0" />
          只會清理已完成／已封存旅程中，超過 90 天的每日封存軌跡與對應 RTDB
          緩衝點，不會影響即時位置、位置綁定、集合點、成員或其他旅程。
        </div>

        <div
          v-if="isLoading"
          class="flex min-h-36 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-400"
        >
          <Loader2 :size="18" class="animate-spin" /> 正在整理清理範圍
        </div>
        <div
          v-else-if="!items.length"
          class="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white text-center"
        >
          <ShieldCheck :size="28" class="text-emerald-500" />
          <strong class="text-sm font-black text-slate-700"
            >目前沒有超過 90 天的資料</strong
          >
          <span class="text-xs font-bold text-slate-400"
            >預覽不會刪除任何資料。</span
          >
        </div>
        <div
          v-else
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div
            class="border-b border-slate-100 px-4 py-3 text-xs font-black text-slate-500"
          >
            清理預覽
          </div>
          <div class="max-h-80 overflow-y-auto">
            <div
              v-for="item in items"
              :key="`${item.tripId}-${item.participantId}-${item.date}`"
              class="grid gap-2 border-b border-slate-100 px-4 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_120px_120px]"
            >
              <div class="min-w-0">
                <strong class="block truncate font-black text-slate-800">{{
                  item.tripTitle
                }}</strong>
                <span class="mt-1 block truncate font-bold text-slate-400">{{
                  item.participantName || '未命名成員'
                }}</span>
              </div>
              <span class="font-bold text-slate-500">{{ item.date }}</span>
              <span class="font-black text-slate-600"
                >{{ formatNumber(item.pointCount) }} 點</span
              >
            </div>
          </div>
        </div>

        <section v-if="items.length" class="space-y-2">
          <label class="retention-label" for="retention-confirmation"
            >確認執行清理</label
          >
          <input
            id="retention-confirmation"
            v-model="confirmation"
            class="retention-confirmation"
            placeholder="請輸入 清理"
            autocomplete="off"
          />
          <p class="text-[11px] font-bold text-slate-400">
            請輸入「清理」後才能執行，這項操作無法復原。
          </p>
        </section>
      </div>

      <footer
        class="admin-drawer-footer shrink-0 border-t border-slate-200 bg-white"
      >
        <button
          type="button"
          class="h-11 rounded-xl bg-slate-100 px-4 text-sm font-black text-slate-600"
          :disabled="isRunning"
          @click="emit('close')"
        >
          關閉
        </button>
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white disabled:opacity-40"
          :disabled="!canRun"
          @click="emit('run')"
        >
          <Loader2 v-if="isRunning" :size="16" class="animate-spin" />
          <Trash2 v-else :size="16" />
          {{ isRunning ? '清理中' : '執行清理' }}
        </button>
      </footer>
    </div>
  </AdminDrawer>
</template>

<style scoped>
.retention-stat {
  display: flex;
  min-height: 84px;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  padding: 14px;
}

.retention-stat span,
.retention-label {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 900;
}

.retention-stat strong {
  color: #0f172a;
  font-size: 18px;
  font-weight: 950;
}

.retention-confirmation {
  width: 100%;
  height: 44px;
  border: 1px solid #fecaca;
  border-radius: 12px;
  background: #fff;
  padding: 0 12px;
  color: #991b1b;
  font-size: 14px;
  font-weight: 900;
  outline: none;
}

.retention-confirmation:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px #fee2e2;
}
</style>
