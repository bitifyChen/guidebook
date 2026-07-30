<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import AdminNotificationFormDrawer from '@/components/admin/notification/AdminNotificationFormDrawer.vue';
import AdminNotificationTable from '@/components/admin/notification/AdminNotificationTable.vue';
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

const pushEnabledParticipantIds = computed(() =>
  tripParticipants.value
    .filter((participant) => hasPushEnabled(participant))
    .map((participant) => participant.id)
);

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
    <AdminNotificationTable
      :rows="filteredLogs"
      :columns="columns"
      :loading="isLoading"
      :search="searchFields"
      :initial-search="appliedSearch"
      :trip-name-by-id="tripNameById"
      :format-date="formatDate"
      @create="openDrawer"
      @search="applySearch"
      @reset="resetSearch"
      @refresh="loadLogs"
    />

    <AdminNotificationFormDrawer
      v-model:open="isDrawerOpen"
      v-model:selected-ids="selectedParticipantIds"
      v-model:member-search="memberSearch"
      :form="form"
      :trips="tripStore.trips"
      :participants="tripParticipants"
      :push-enabled-ids="pushEnabledParticipantIds"
      :available-push-count="availablePushCount"
      :is-sending="isSending"
      :is-image-uploading="isImageUploading"
      @close="closeDrawer"
      @send="sendNotification"
      @paste-image="handleImagePaste"
    />
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
