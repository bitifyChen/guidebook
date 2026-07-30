<script setup>
import { computed } from 'vue';
import { Check, Image, Loader2, Send, Users, X } from 'lucide-vue-next';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  form: { type: Object, required: true },
  trips: { type: Array, default: () => [] },
  participants: { type: Array, default: () => [] },
  pushEnabledIds: { type: Array, default: () => [] },
  selectedIds: { type: Array, default: () => [] },
  memberSearch: { type: String, default: '' },
  availablePushCount: { type: Number, default: 0 },
  isSending: { type: Boolean, default: false },
  isImageUploading: { type: Boolean, default: false },
});
const emit = defineEmits([
  'update:open',
  'update:selectedIds',
  'update:memberSearch',
  'close',
  'send',
  'paste-image',
]);
const drawerOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
});
const search = computed({
  get: () => props.memberSearch,
  set: (value) => emit('update:memberSearch', value),
});
const toggleParticipant = (id) => {
  const next = new Set(props.selectedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  emit('update:selectedIds', [...next]);
};
const selectAll = () =>
  emit('update:selectedIds', [
    ...new Set([
      ...props.selectedIds,
      ...props.participants.map(({ id }) => id),
    ]),
  ]);
const hasPushEnabled = (participant) =>
  props.pushEnabledIds.includes(participant.id);
</script>

<template>
  <AdminDrawer
    v-model="drawerOpen"
    title="新增推播"
    size="md"
    :z-index="80"
    @close="emit('close')"
  >
    <div class="flex h-full min-h-0 flex-col bg-white">
      <div class="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        <section class="grid grid-cols-1 gap-4">
          <label class="block space-y-1">
            <span class="admin-label">旅程</span>
            <select v-model="form.tripId" class="admin-input">
              <option value="">請選擇旅程</option>
              <option v-for="trip in trips" :key="trip.id" :value="trip.id">
                {{ trip.title }}
              </option>
            </select>
          </label>
          <label class="block space-y-1">
            <span class="admin-label">標題</span>
            <input
              v-model="form.title"
              class="admin-input"
              placeholder="例如：集合時間提醒"
            />
          </label>
          <label class="block space-y-1">
            <span class="admin-label">內容</span>
            <textarea
              v-model="form.body"
              rows="4"
              class="admin-textarea"
              placeholder="輸入要傳給成員的訊息"
            ></textarea>
          </label>
          <label class="block space-y-1">
            <span class="admin-label">圖片 URL</span>
            <div class="relative">
              <Image
                :size="16"
                class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
              />
              <input
                v-model="form.imageUrl"
                class="admin-input pl-9"
                placeholder="選填，部分手機系統可能不顯示"
                @paste="emit('paste-image', $event)"
              />
              <Loader2
                v-if="isImageUploading"
                :size="16"
                class="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-500"
              />
            </div>
          </label>
          <label class="block space-y-1">
            <span class="admin-label">點擊連結</span>
            <input
              v-model="form.clickUrl"
              class="admin-input"
              placeholder="選填，例如前台頁面網址"
            />
          </label>
        </section>

        <section
          class="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
        >
          <div
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h4 class="font-black text-slate-800">發送對象</h4>
              <p class="mt-1 text-xs font-bold text-slate-400">
                已選 {{ selectedIds.length }} 人，可推播
                {{ availablePushCount }} 人
              </p>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                :disabled="!form.tripId || !participants.length"
                class="h-9 rounded-xl border border-slate-100 bg-white px-3 text-xs font-black text-slate-600 disabled:opacity-50"
                @click="selectAll"
              >
                全選
              </button>
              <button
                type="button"
                class="h-9 rounded-xl border border-slate-100 bg-white px-3 text-xs font-black text-slate-600"
                @click="emit('update:selectedIds', [])"
              >
                清除
              </button>
            </div>
          </div>

          <input
            v-model="search"
            :disabled="!form.tripId"
            class="admin-input"
            placeholder="搜尋成員"
          />

          <div class="max-h-80 space-y-2 overflow-y-auto">
            <button
              v-for="participant in participants"
              :key="participant.id"
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-3 text-left"
              :class="
                selectedIds.includes(participant.id)
                  ? 'border-indigo-200'
                  : 'border-slate-100'
              "
              @click="toggleParticipant(participant.id)"
            >
              <span class="flex min-w-0 items-center gap-3">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300"
                >
                  <img
                    v-if="participant.avatar"
                    :src="participant.avatar"
                    class="h-full w-full object-cover"
                  />
                  <Users v-else :size="18" />
                </span>
                <span class="min-w-0">
                  <strong class="block truncate text-sm text-slate-800">
                    {{ participant.name }}
                  </strong>
                  <span
                    class="block text-[10px] font-bold"
                    :class="
                      hasPushEnabled(participant)
                        ? 'text-green-600'
                        : 'text-slate-400'
                    "
                  >
                    {{
                      hasPushEnabled(participant) ? '推播已啟用' : '推播未啟用'
                    }}
                  </span>
                </span>
              </span>
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border"
                :class="
                  selectedIds.includes(participant.id)
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 text-transparent'
                "
              >
                <Check :size="14" />
              </span>
            </button>
            <div
              v-if="form.tripId && !participants.length"
              class="py-8 text-center text-xs font-black text-slate-400"
            >
              沒有符合條件的成員
            </div>
            <div
              v-if="!form.tripId"
              class="py-8 text-center text-xs font-black text-slate-400"
            >
              請先選擇旅程
            </div>
          </div>
        </section>
      </div>

      <footer class="flex justify-end gap-3 border-t border-slate-200 p-5">
        <button
          type="button"
          class="flex h-11 items-center gap-2 rounded-xl bg-slate-50 px-5 text-sm font-black text-slate-600"
          @click="emit('close')"
        >
          <X :size="16" /> 取消
        </button>
        <button
          type="button"
          :disabled="isSending"
          class="flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white disabled:opacity-50"
          @click="emit('send')"
        >
          <Loader2 v-if="isSending" class="animate-spin" :size="16" />
          <Send v-else :size="16" /> 發送推播
        </button>
      </footer>
    </div>
  </AdminDrawer>
</template>

<style scoped>
.admin-label {
  font-size: 11px;
  font-weight: 900;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.admin-input,
.admin-textarea {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #f8fafc;
  padding: 0 12px;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
  outline: none;
}

.admin-input {
  height: 44px;
}

.admin-textarea {
  padding: 12px;
  resize: vertical;
}
</style>
