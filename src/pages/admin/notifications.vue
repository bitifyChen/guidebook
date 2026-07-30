<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { Check, Image, Loader2, Plus, Send, Users, X } from 'lucide-vue-next';
import AdminDataTable from '@/components/admin/AdminDataTable.vue';
import AdminDrawer from '@/components/admin/AdminDrawer.vue';
import {
  getNotificationLogs,
  sendGuidebookNotification,
  sortNotificationLogs,
} from '@/api/notifications';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';
import {
  getClipboardImageFiles,
  uploadClipboardImages,
} from '@/utils/clipboardImage';

const participantsStore = useParticipantsStore();
const tripStore = useTripStore();

const logs = ref([]);
const isLoading = ref(false);
const isDrawerOpen = ref(false);
const isSending = ref(false);
const memberSearch = ref('');
const selectedParticipantIds = ref([]);
const appliedSearch = ref({
  tripId: '',
  keyword: '',
});
const form = ref({
  title: '',
  body: '',
  imageUrl: '',
  clickUrl: '',
  tripId: '',
});

const columns = [
  { key: 'content', label: '推播內容' },
  { key: 'trip', label: '旅程' },
  { key: 'audience', label: '對象' },
  { key: 'result', label: '結果' },
  { key: 'createdAt', label: '發送時間' },
];

const tripNameById = computed(() =>
  tripStore.trips.reduce((result, trip) => {
    result[trip.id] = trip.title;
    return result;
  }, {})
);

const sortedLogs = computed(() => sortNotificationLogs(logs.value));

const filteredLogs = computed(() => {
  const keyword = appliedSearch.value.keyword.trim().toLowerCase();
  return sortedLogs.value.filter((item) => {
    if (
      appliedSearch.value.tripId &&
      item.tripId !== appliedSearch.value.tripId
    ) {
      return false;
    }
    if (!keyword) return true;
    return [item.title, item.body, tripNameById.value[item.tripId]]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
});

const searchFields = computed(() => [
  {
    name: 'tripId',
    label: 'TRIP',
    type: 'select',
    placeholder: '全部旅程',
    options: tripStore.trips.map((trip) => ({
      label: trip.title,
      value: trip.id,
    })),
  },
  {
    name: 'keyword',
    label: '關鍵字',
    type: 'text',
    placeholder: '標題、內容、旅程名稱',
  },
]);

const tripParticipants = computed(() => {
  if (!form.value.tripId) return [];
  const keyword = memberSearch.value.trim().toLowerCase();
  return participantsStore.participants
    .filter((participant) =>
      (participant.tripIds || []).includes(form.value.tripId)
    )
    .filter((participant) => {
      if (!keyword) return true;
      return [participant.name, participant.inviteCode, participant.uid]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
});

const selectedParticipants = computed(() => {
  const selected = new Set(selectedParticipantIds.value);
  return participantsStore.participants.filter((participant) =>
    selected.has(participant.id)
  );
});

const availablePushCount = computed(
  () =>
    selectedParticipants.value.filter((participant) =>
      hasPushEnabled(participant)
    ).length
);

const hasPushEnabled = (participant) => {
  const tokens = Array.isArray(participant?.pushTokens)
    ? participant.pushTokens
    : participant?.pushToken
      ? [{ token: participant.pushToken }]
      : [];
  return tokens.some((item) => item?.token && item.permission !== 'denied');
};

const formatDate = (value) => {
  if (!value) return '-';
  const date =
    typeof value.toDate === 'function'
      ? value.toDate()
      : new Date(typeof value === 'number' ? value : Date.parse(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const resetForm = () => {
  form.value = {
    title: '',
    body: '',
    imageUrl: '',
    clickUrl: '',
    tripId: tripStore.currentTripId || '',
  };
  memberSearch.value = '';
  selectedParticipantIds.value = [];
};

const openDrawer = () => {
  resetForm();
  isDrawerOpen.value = true;
};

const closeDrawer = () => {
  isDrawerOpen.value = false;
  resetForm();
};

const loadLogs = async () => {
  isLoading.value = true;
  try {
    logs.value = await getNotificationLogs({ limitCount: 100 });
  } catch (error) {
    alert('推播紀錄讀取失敗：' + error.message);
  } finally {
    isLoading.value = false;
  }
};

const applySearch = (filters) => {
  appliedSearch.value = {
    tripId: filters.tripId || '',
    keyword: filters.keyword || '',
  };
};

const resetSearch = () => {
  appliedSearch.value = {
    tripId: '',
    keyword: '',
  };
};

const toggleParticipant = (participantId) => {
  const next = new Set(selectedParticipantIds.value);
  if (next.has(participantId)) next.delete(participantId);
  else next.add(participantId);
  selectedParticipantIds.value = Array.from(next);
};

const selectAllVisible = () => {
  selectedParticipantIds.value = Array.from(
    new Set([
      ...selectedParticipantIds.value,
      ...tripParticipants.value.map((participant) => participant.id),
    ])
  );
};

const clearSelected = () => {
  selectedParticipantIds.value = [];
};

const isImageUploading = ref(false);

const handleImagePaste = async (event) => {
  if (!getClipboardImageFiles(event).length) return;

  isImageUploading.value = true;
  try {
    const { urls } = await uploadClipboardImages(event, { multiple: false });
    if (urls[0]) form.value.imageUrl = urls[0];
  } catch (error) {
    alert('圖片上傳失敗：' + error.message);
  } finally {
    isImageUploading.value = false;
  }
};

const sendNotification = async () => {
  if (!form.value.title.trim()) return alert('請輸入推播標題。');
  if (!form.value.body.trim()) return alert('請輸入推播內容。');
  if (!form.value.tripId) return alert('請先選擇旅程。');
  if (selectedParticipantIds.value.length === 0)
    return alert('請至少選擇一位成員。');

  isSending.value = true;
  try {
    const result = await sendGuidebookNotification({
      title: form.value.title.trim(),
      body: form.value.body.trim(),
      imageUrl: form.value.imageUrl.trim(),
      clickUrl: form.value.clickUrl.trim(),
      tripId: form.value.tripId,
      participantIds: selectedParticipantIds.value,
    });
    await loadLogs();
    closeDrawer();
    alert(
      `推播已送出：成功 ${result.successCount}，失敗 ${result.failureCount}`
    );
  } catch (error) {
    alert('推播發送失敗：' + error.message);
  } finally {
    isSending.value = false;
  }
};

watch(
  () => form.value.tripId,
  () => {
    selectedParticipantIds.value = [];
    memberSearch.value = '';
  }
);

onMounted(async () => {
  await tripStore.init();
  await tripStore.refreshTrips();
  await participantsStore.loadAllParticipants();
  await loadLogs();
});
</script>

<template>
  <main class="h-full min-h-[calc(100dvh-180px)] md:min-h-[620px]">
    <AdminDataTable
      :rows="filteredLogs"
      :columns="columns"
      :loading="isLoading"
      :search="searchFields"
      :initial-search="appliedSearch"
      empty-text="尚未建立推播紀錄"
      @search="applySearch"
      @reset="resetSearch"
      @refresh="loadLogs"
    >
      <template #toolbar>
        <button
          @click="openDrawer"
          class="h-10 px-4 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-indigo-700"
        >
          <Plus :size="16" />
          新增
        </button>
      </template>

      <template #content="{ row }">
        <div class="min-w-0 sm:min-w-[240px]">
          <div class="font-black text-slate-900 truncate">{{ row.title }}</div>
          <div class="text-xs font-bold text-slate-400 mt-1 line-clamp-2">
            {{ row.body }}
          </div>
        </div>
      </template>

      <template #trip="{ row }">
        <span class="text-xs font-black text-slate-600">
          {{ tripNameById[row.tripId] || row.tripId || '-' }}
        </span>
      </template>

      <template #audience="{ row }">
        <span
          class="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600"
        >
          <Users :size="12" />
          {{ row.participantIds?.length || 0 }} 人
        </span>
      </template>

      <template #result="{ row }">
        <div class="flex flex-wrap gap-2">
          <span
            class="rounded-lg bg-green-100 px-2 py-1 text-[10px] font-black text-green-700"
          >
            成功 {{ row.successCount || 0 }}
          </span>
          <span
            v-if="row.failureCount"
            class="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-black text-red-700"
          >
            失敗 {{ row.failureCount }}
          </span>
        </div>
      </template>

      <template #createdAt="{ row }">
        <span class="text-xs font-bold text-slate-400">
          {{ formatDate(row.createdAt) }}
        </span>
      </template>
    </AdminDataTable>

    <AdminDrawer
      v-model="isDrawerOpen"
      title="新增推播"
      size="md"
      :z-index="80"
      @close="closeDrawer"
    >
      <div class="flex h-full min-h-0 flex-col bg-white">
        <div class="flex-1 overflow-y-auto p-4 space-y-5 sm:p-5">
          <section class="grid grid-cols-1 gap-4">
            <label class="space-y-1 block">
              <span
                class="text-[11px] font-black text-slate-400 uppercase tracking-widest"
                >旅程</span
              >
              <select v-model="form.tripId" class="admin-input">
                <option value="">請選擇旅程</option>
                <option
                  v-for="trip in tripStore.trips"
                  :key="trip.id"
                  :value="trip.id"
                >
                  {{ trip.title }}
                </option>
              </select>
            </label>

            <label class="space-y-1 block">
              <span
                class="text-[11px] font-black text-slate-400 uppercase tracking-widest"
                >標題</span
              >
              <input
                v-model="form.title"
                class="admin-input"
                placeholder="例如：集合時間提醒"
              />
            </label>

            <label class="space-y-1 block">
              <span
                class="text-[11px] font-black text-slate-400 uppercase tracking-widest"
                >內容</span
              >
              <textarea
                v-model="form.body"
                rows="4"
                class="admin-textarea"
                placeholder="輸入要傳給成員的訊息"
              ></textarea>
            </label>

            <label class="space-y-1 block">
              <span
                class="text-[11px] font-black text-slate-400 uppercase tracking-widest"
                >圖片 URL</span
              >
              <div class="relative">
                <Image
                  :size="16"
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
                />
                <input
                  v-model="form.imageUrl"
                  class="admin-input pl-9"
                  placeholder="選填，部分手機系統可能不顯示"
                  @paste="handleImagePaste"
                />
                <Loader2
                  v-if="isImageUploading"
                  :size="16"
                  class="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-indigo-500"
                />
              </div>
            </label>

            <label class="space-y-1 block">
              <span
                class="text-[11px] font-black text-slate-400 uppercase tracking-widest"
                >點擊連結</span
              >
              <input
                v-model="form.clickUrl"
                class="admin-input"
                placeholder="選填，例如前台頁面網址"
              />
            </label>
          </section>

          <section
            class="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3"
          >
            <div
              class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <h4 class="font-black text-slate-800">發送對象</h4>
                <p class="text-xs font-bold text-slate-400 mt-1">
                  已選 {{ selectedParticipantIds.length }} 人，可推播
                  {{ availablePushCount }} 人
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  @click="selectAllVisible"
                  :disabled="!form.tripId || tripParticipants.length === 0"
                  class="h-9 px-3 rounded-xl bg-white border border-slate-100 text-xs font-black text-slate-600 disabled:opacity-50"
                >
                  全選
                </button>
                <button
                  @click="clearSelected"
                  class="h-9 px-3 rounded-xl bg-white border border-slate-100 text-xs font-black text-slate-600"
                >
                  清除
                </button>
              </div>
            </div>

            <input
              v-model="memberSearch"
              :disabled="!form.tripId"
              class="admin-input"
              placeholder="搜尋成員"
            />

            <div class="max-h-80 overflow-y-auto space-y-2">
              <button
                v-for="participant in tripParticipants"
                :key="participant.id"
                @click="toggleParticipant(participant.id)"
                class="w-full rounded-xl border bg-white p-3 text-left flex items-center justify-between gap-3"
                :class="
                  selectedParticipantIds.includes(participant.id)
                    ? 'border-indigo-200'
                    : 'border-slate-100'
                "
              >
                <span class="flex items-center gap-3 min-w-0">
                  <span
                    class="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-300 shrink-0"
                  >
                    <img
                      v-if="participant.avatar"
                      :src="participant.avatar"
                      class="w-full h-full object-cover"
                    />
                    <Users v-else :size="18" />
                  </span>
                  <span class="min-w-0">
                    <span
                      class="block font-black text-sm text-slate-800 truncate"
                    >
                      {{ participant.name }}
                    </span>
                    <span
                      class="block text-[10px] font-bold"
                      :class="
                        hasPushEnabled(participant)
                          ? 'text-green-600'
                          : 'text-slate-400'
                      "
                    >
                      {{
                        hasPushEnabled(participant)
                          ? '推播已啟用'
                          : '推播未啟用'
                      }}
                    </span>
                  </span>
                </span>
                <span
                  class="w-6 h-6 rounded-lg border flex items-center justify-center shrink-0"
                  :class="
                    selectedParticipantIds.includes(participant.id)
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-slate-200 text-transparent'
                  "
                >
                  <Check :size="14" />
                </span>
              </button>

              <div
                v-if="form.tripId && tripParticipants.length === 0"
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

        <footer
          class="admin-drawer-footer flex justify-end gap-3 border-t border-slate-200 p-5"
        >
          <button
            @click="closeDrawer"
            class="h-11 px-5 rounded-xl bg-slate-50 text-slate-600 font-black text-sm inline-flex items-center gap-2"
          >
            <X :size="16" />
            取消
          </button>
          <button
            @click="sendNotification"
            :disabled="isSending"
            class="h-11 px-5 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50 hover:bg-indigo-700"
          >
            <Loader2 v-if="isSending" class="animate-spin" :size="16" />
            <Send v-else :size="16" />
            發送推播
          </button>
        </footer>
      </div>
    </AdminDrawer>
  </main>
</template>

<style scoped>
.admin-input {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 0 12px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  outline: none;
}

.admin-textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 12px;
  font-size: 14px;
  font-weight: 700;
  color: #334155;
  outline: none;
  resize: vertical;
}

.admin-input:focus,
.admin-textarea:focus {
  border-color: #a5b4fc;
  background: white;
}
</style>

<route>
{
  meta: { layout: "admin" }
}
</route>
