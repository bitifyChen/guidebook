<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';
import { uploadImage } from '@/api/storage';
import {
  getClipboardImageFiles,
  uploadClipboardImages,
} from '@/utils/clipboardImage';
import {
  deleteTrackingTokensByParticipant,
  ensureParticipantTrackingToken,
  getTrackingTokensByParticipant,
  getTraccarConfigUrl,
} from '@/api/tracking';
import AdminParticipantFormDrawer from '@/components/admin/participant/AdminParticipantFormDrawer.vue';
import AdminParticipantTable from '@/components/admin/participant/AdminParticipantTable.vue';
import AdminParticipantTrackDeleteDialog from '@/components/admin/participant/AdminParticipantTrackDeleteDialog.vue';
import AdminParticipantTrackDrawer from '@/components/admin/participant/AdminParticipantTrackDrawer.vue';
import { sendGuidebookNotification } from '@/api/notifications';
import {
  deleteAdminLocationTracks,
  getAdminParticipantLocationTracks,
  previewAdminLocationTrackDeletion,
} from '@/api/adminLocationTracks';
import {
  formatTrackDateInTimezone,
  getDefaultTrackDateForTrip,
} from '@/utils/locationTrack';

const participantsStore = useParticipantsStore();
const tripStore = useTripStore();

const isDrawerOpen = ref(false);
const isUploading = ref(false);
const isSaving = ref(false);
const isTestPushSending = ref(false);
const isTrackingRemoving = ref(false);
const copiedId = ref(null);
const copiedTrackingUrl = ref('');
const editingId = ref('');
const tripSearch = ref('');
const trackingTokens = ref([]);
const isTrackingLoading = ref(false);
const isTrackingCreating = ref(false);
const isTrackDrawerOpen = ref(false);
const isTrackLoading = ref(false);
const isTrackDeleting = ref(false);
const isTrackDeleteDialogOpen = ref(false);
const trackTripId = ref('');
const trackDate = ref('');
const trackPoints = ref([]);
const trackMeta = ref({});
const trackError = ref('');
const selectedTrackPointId = ref('');
const trackDeleteScope = ref('point');
const trackDeletePointId = ref('');
const trackDeletePreview = ref({});
let trackRequestSequence = 0;
const appliedSearch = ref({
  tripId: '',
  keyword: '',
  role: '',
});

const form = ref({
  name: '',
  avatar: '',
  isAdmin: false,
  isSuperAdmin: false,
  canViewTeamLocationHistory: false,
  tripIds: [],
});

const columns = [
  { key: 'member', label: '成員' },
  { key: 'inviteCode', label: '邀請碼' },
  { key: 'trips', label: '參加旅程' },
  { key: 'notification', label: '通知' },
  { key: 'historyAccess', label: '隊友軌跡' },
  { key: 'role', label: '權限' },
];

const tripNameById = computed(() => {
  return tripStore.trips.reduce((result, trip) => {
    result[trip.id] = trip.title;
    return result;
  }, {});
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
    placeholder: '姓名、邀請碼、Google UID',
  },
  {
    name: 'role',
    label: '權限',
    type: 'select',
    placeholder: '全部權限',
    options: [
      { label: 'Super Admin', value: 'superAdmin' },
      { label: 'Admin', value: 'admin' },
      { label: 'Member', value: 'member' },
    ],
  },
]);

const selectableTrips = computed(() => {
  const keyword = tripSearch.value.trim().toLowerCase();
  if (!keyword) return tripStore.trips;
  return tripStore.trips.filter((trip) =>
    [trip.title, trip.destination, trip.inviteCode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  );
});

const editingParticipant = computed(() =>
  participantsStore.participants.find(
    (participant) => participant.id === editingId.value
  )
);

const trackTrips = computed(() => {
  const tripIds = new Set(form.value.tripIds || []);
  return tripStore.trips.filter((trip) => tripIds.has(trip.id));
});

const selectedTrackTrip = computed(() =>
  trackTrips.value.find((trip) => trip.id === trackTripId.value)
);

const trackDeletionWarning = computed(() => {
  const trip = selectedTrackTrip.value;
  return (
    trip?.status === 'active' ||
    trackDate.value === formatTrackDateInTimezone(trip?.timezone || 'UTC')
  );
});

const trackTimezone = computed(
  () => trackMeta.value.timezone || selectedTrackTrip.value?.timezone || 'UTC'
);

const getNotificationTripId = () => appliedSearch.value.tripId || '';

const getPushTokens = (participant, tripId = getNotificationTripId()) => {
  if (!participant) return [];
  const tokens = Array.isArray(participant.pushTokens)
    ? participant.pushTokens
    : participant.pushToken
      ? [{ token: participant.pushToken }]
      : [];
  return tokens.filter((item) => item?.token && item.permission !== 'denied');
};

const getNotificationStatus = (
  participant,
  tripId = getNotificationTripId()
) => {
  const preferences = participant?.notificationPreferences || {};
  const tripPreference = tripId ? preferences[tripId] : '';
  const hasDeniedPreference = tripId
    ? tripPreference === 'denied'
    : Object.values(preferences).includes('denied');
  if (hasDeniedPreference) {
    return 'denied';
  }
  if (getPushTokens(participant, tripId).length > 0) return 'enabled';
  return 'disabled';
};

const getNotificationLabel = (participant) => {
  const status = getNotificationStatus(participant);
  if (status === 'enabled') return '已啟用';
  if (status === 'denied') return '拒絕';
  return '未啟用';
};

const getNotificationClass = (participant) => {
  const status = getNotificationStatus(participant);
  if (status === 'enabled') return 'bg-green-100 text-green-700';
  if (status === 'denied') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-500';
};

const hasPushEnabled = (participant) =>
  getNotificationStatus(participant) === 'enabled';

const activeTrackingToken = computed(() =>
  trackingTokens.value.find((item) => item.enabled !== false && item.token)
);

const trackingStatusLabel = computed(() =>
  activeTrackingToken.value ? '已啟用' : '未啟用'
);

const trackingStatusClass = computed(() =>
  activeTrackingToken.value
    ? 'bg-green-100 text-green-700'
    : 'bg-slate-100 text-slate-500'
);

const filteredParticipants = computed(() => {
  const filters = appliedSearch.value;
  const keyword = filters.keyword.trim().toLowerCase();

  return participantsStore.participants.filter((participant) => {
    const tripIds = participant.tripIds || [];
    if (filters.tripId && !tripIds.includes(filters.tripId)) return false;

    if (filters.role === 'superAdmin' && !participant.isSuperAdmin)
      return false;
    if (
      filters.role === 'admin' &&
      (!participant.isAdmin || participant.isSuperAdmin)
    )
      return false;
    if (
      filters.role === 'member' &&
      (participant.isAdmin || participant.isSuperAdmin)
    )
      return false;

    if (!keyword) return true;
    const haystack = [
      participant.name,
      participant.inviteCode,
      participant.uid,
      ...tripIds.map((tripId) => tripNameById.value[tripId] || tripId),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });
});

watch(
  () => tripStore.currentTripId,
  (value) => {
    appliedSearch.value = {
      ...appliedSearch.value,
      tripId: value || '',
    };
  }
);

onMounted(async () => {
  await tripStore.init();
  await tripStore.refreshTrips();
  appliedSearch.value.tripId = tripStore.currentTripId || '';
  await participantsStore.loadAllParticipants();
});

const resetForm = () => {
  editingId.value = '';
  tripSearch.value = '';
  trackingTokens.value = [];
  copiedTrackingUrl.value = '';
  form.value = {
    name: '',
    avatar: '',
    isAdmin: false,
    isSuperAdmin: false,
    canViewTeamLocationHistory: false,
    tripIds: tripStore.currentTripId ? [tripStore.currentTripId] : [],
  };
};

const openCreateDrawer = () => {
  resetForm();
  isDrawerOpen.value = true;
};

const openEditDrawer = (participant) => {
  editingId.value = participant.id;
  tripSearch.value = '';
  form.value = {
    name: participant.name || '',
    avatar: participant.avatar || '',
    isAdmin: participant.isAdmin || false,
    isSuperAdmin: participant.isSuperAdmin || false,
    canViewTeamLocationHistory: participant.canViewTeamLocationHistory === true,
    tripIds: [...(participant.tripIds || [])],
  };
  isDrawerOpen.value = true;
  loadTrackingTokens(participant.id);
};

const closeDrawer = () => {
  isTrackDrawerOpen.value = false;
  isTrackDeleteDialogOpen.value = false;
  isDrawerOpen.value = false;
  resetForm();
};

const resetTrackState = () => {
  trackRequestSequence += 1;
  trackTripId.value = '';
  trackDate.value = '';
  trackPoints.value = [];
  trackMeta.value = {};
  trackError.value = '';
  selectedTrackPointId.value = '';
  trackDeleteScope.value = 'point';
  trackDeletePointId.value = '';
  trackDeletePreview.value = {};
};

const loadTrackPoints = async ({ clear = false } = {}) => {
  if (!editingId.value || !trackTripId.value || !trackDate.value) return;
  const requestSequence = ++trackRequestSequence;
  isTrackLoading.value = true;
  trackError.value = '';
  if (clear) {
    trackPoints.value = [];
    selectedTrackPointId.value = '';
  }

  try {
    const result = await getAdminParticipantLocationTracks({
      tripId: trackTripId.value,
      participantId: editingId.value,
      date: trackDate.value,
    });
    if (requestSequence !== trackRequestSequence) return;
    trackPoints.value = result.points || [];
    trackMeta.value = result;
    if (
      selectedTrackPointId.value &&
      !trackPoints.value.some(
        (point) => point.id === selectedTrackPointId.value
      )
    ) {
      selectedTrackPointId.value = '';
    }
  } catch (error) {
    if (requestSequence !== trackRequestSequence) return;
    trackError.value = error.message || '讀取歷史軌跡失敗。';
  } finally {
    if (requestSequence === trackRequestSequence) {
      isTrackLoading.value = false;
    }
  }
};

const openTrackingHistory = async () => {
  if (!editingParticipant.value) return;
  if (!trackTrips.value.length) {
    ElMessage.warning('此成員尚未加入任何旅程。');
    return;
  }

  const preferredTripId = [
    appliedSearch.value.tripId,
    tripStore.currentTripId,
    trackTrips.value[0]?.id,
  ].find((tripId) => trackTrips.value.some((trip) => trip.id === tripId));
  trackTripId.value = preferredTripId || trackTrips.value[0].id;
  trackDate.value = getDefaultTrackDateForTrip(
    trackTrips.value.find((trip) => trip.id === trackTripId.value)
  );
  trackPoints.value = [];
  trackMeta.value = {};
  trackError.value = '';
  selectedTrackPointId.value = '';
  isTrackDrawerOpen.value = true;
  await loadTrackPoints({ clear: true });
};

const closeTrackDrawer = () => {
  isTrackDrawerOpen.value = false;
  isTrackDeleteDialogOpen.value = false;
  resetTrackState();
};

const updateTrackDrawerOpen = (open) => {
  if (open) isTrackDrawerOpen.value = true;
  else closeTrackDrawer();
};

const changeTrackTrip = async (tripId) => {
  trackTripId.value = tripId;
  const trip = trackTrips.value.find((item) => item.id === tripId);
  trackDate.value = getDefaultTrackDateForTrip(trip);
  await loadTrackPoints({ clear: true });
};

const changeTrackDate = async (date) => {
  trackDate.value = date;
  await loadTrackPoints({ clear: true });
};

const requestTrackDeletion = async (scope, pointId = '') => {
  if (!editingId.value || !trackTripId.value) return;
  const payload = {
    tripId: trackTripId.value,
    participantId: editingId.value,
    scope,
  };
  if (scope === 'point') payload.pointId = pointId;
  if (scope === 'day') payload.date = trackDate.value;

  try {
    trackDeletePreview.value = await previewAdminLocationTrackDeletion(payload);
    trackDeleteScope.value = scope;
    trackDeletePointId.value = pointId;
    isTrackDeleteDialogOpen.value = true;
  } catch (error) {
    ElMessage.error(error.message || '無法確認刪除範圍。');
  }
};

const confirmTrackDeletion = async (confirmation = '') => {
  if (!editingId.value || !trackTripId.value) return;
  const payload = {
    tripId: trackTripId.value,
    participantId: editingId.value,
    scope: trackDeleteScope.value,
  };
  if (trackDeleteScope.value === 'point') {
    payload.pointId = trackDeletePointId.value;
  }
  if (trackDeleteScope.value === 'day') payload.date = trackDate.value;
  if (trackDeleteScope.value === 'all') payload.confirmation = confirmation;

  isTrackDeleting.value = true;
  try {
    const result = await deleteAdminLocationTracks(payload);
    isTrackDeleteDialogOpen.value = false;
    ElMessage.success(`已刪除 ${result.deletedCount || 0} 個定位點。`);
    await loadTrackPoints({ clear: true });
  } catch (error) {
    ElMessage.error(error.message || '刪除歷史軌跡失敗。');
  } finally {
    isTrackDeleting.value = false;
  }
};

const copyInviteCode = (code, id) => {
  navigator.clipboard.writeText(code);
  copiedId.value = id;
  setTimeout(() => {
    copiedId.value = null;
  }, 2000);
};

const getTrackingSetupUrl = (item = activeTrackingToken.value) => {
  if (!item?.token) return '';
  return getTraccarConfigUrl({
    token: item.token,
    deviceId: item.deviceId || `guidebook-${editingId.value.slice(0, 8)}`,
    accuracy: 'highest',
    distance: 0,
    interval: item.minIntervalSeconds || 30,
    wakelock: true,
    buffer: true,
  });
};

const copyTrackingSetupUrl = async () => {
  const url = getTrackingSetupUrl();
  if (!url) return;
  await navigator.clipboard.writeText(url);
  copiedTrackingUrl.value = url;
  setTimeout(() => {
    copiedTrackingUrl.value = '';
  }, 2000);
};

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isUploading.value = true;
  try {
    const url = await uploadImage(file);
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
      setTimeout(() => resolve(), 10000);
    });
    form.value.avatar = url;
  } catch (error) {
    alert('圖片上傳失敗：' + error.message);
  } finally {
    isUploading.value = false;
    event.target.value = '';
  }
};

const handleAvatarPaste = async (event) => {
  if (!getClipboardImageFiles(event).length) return;

  isUploading.value = true;
  try {
    const { urls } = await uploadClipboardImages(event, { multiple: false });
    if (urls[0]) form.value.avatar = urls[0];
  } catch (error) {
    alert('圖片上傳失敗：' + error.message);
  } finally {
    isUploading.value = false;
  }
};

const toggleTrip = (tripId) => {
  const next = new Set(form.value.tripIds);
  if (next.has(tripId)) next.delete(tripId);
  else next.add(tripId);
  form.value.tripIds = Array.from(next);
};

const refreshParticipants = async () => {
  await participantsStore.loadAllParticipants();
};

const applySearch = (filters) => {
  appliedSearch.value = {
    tripId: filters.tripId || '',
    keyword: filters.keyword || '',
    role: filters.role || '',
  };
};

const resetSearch = () => {
  appliedSearch.value = {
    tripId: '',
    keyword: '',
    role: '',
  };
};

const loadTrackingTokens = async (participantId = editingId.value) => {
  if (!participantId) return;
  isTrackingLoading.value = true;
  try {
    trackingTokens.value = await getTrackingTokensByParticipant(participantId);
  } catch (error) {
    alert('定位資料讀取失敗：' + error.message);
  } finally {
    isTrackingLoading.value = false;
  }
};

const enableTrackingForParticipant = async () => {
  if (!editingId.value) return;
  isTrackingCreating.value = true;
  try {
    await ensureParticipantTrackingToken({
      participantId: editingId.value,
      tripId:
        appliedSearch.value.tripId ||
        form.value.tripIds[0] ||
        tripStore.currentTripId ||
        '',
      deviceId:
        form.value.name?.trim() || `guidebook-${editingId.value.slice(0, 8)}`,
      minIntervalSeconds: 30,
    });
    await loadTrackingTokens(editingId.value);
  } catch (error) {
    alert('定位設定建立失敗：' + error.message);
  } finally {
    isTrackingCreating.value = false;
  }
};

const removeTrackingForParticipant = async () => {
  if (!editingId.value) return;
  if (!confirm('確定要移除此成員目前的位置分享設定？成員需要重新綁定手機。'))
    return;

  isTrackingRemoving.value = true;
  try {
    await deleteTrackingTokensByParticipant(editingId.value);
    trackingTokens.value = [];
    copiedTrackingUrl.value = '';
  } catch (error) {
    alert('移除位置分享失敗：' + error.message);
  } finally {
    isTrackingRemoving.value = false;
  }
};

const sendTestPush = async () => {
  if (!editingId.value) return;
  isTestPushSending.value = true;
  try {
    const result = await sendGuidebookNotification({
      title: '測試推播',
      body: `${form.value.name || '成員'}，這是一則後台測試通知。`,
      tripId:
        appliedSearch.value.tripId ||
        form.value.tripIds[0] ||
        tripStore.currentTripId ||
        '',
      participantIds: [editingId.value],
    });
    alert(
      `測試推播已送出：成功 ${result.successCount}，失敗 ${result.failureCount}`
    );
  } catch (error) {
    alert('測試推播失敗：' + error.message);
  } finally {
    isTestPushSending.value = false;
  }
};

const saveParticipant = async () => {
  if (!form.value.name.trim()) return alert('請輸入成員名稱');

  isSaving.value = true;
  try {
    const payload = {
      name: form.value.name.trim(),
      avatar: form.value.avatar || '',
      isAdmin: form.value.isAdmin,
      isSuperAdmin: form.value.isSuperAdmin,
      canViewTeamLocationHistory: form.value.canViewTeamLocationHistory,
      tripIds: form.value.tripIds,
      tripId: form.value.tripIds[0] || '',
    };
    if (editingId.value) {
      await participantsStore.updateParticipant(editingId.value, payload);
    } else {
      await participantsStore.addParticipant(payload);
    }
    await refreshParticipants();
    closeDrawer();
  } catch (error) {
    alert('儲存失敗：' + error.message);
  } finally {
    isSaving.value = false;
  }
};

const deleteCurrentParticipant = async () => {
  if (!editingId.value) return;
  if (!confirm('確定要刪除這位成員？這個動作不會刪除既有錢包資料。')) return;
  try {
    await participantsStore.removeParticipant(editingId.value);
    await refreshParticipants();
    closeDrawer();
  } catch (error) {
    alert('刪除失敗：' + error.message);
  }
};
</script>

<template>
  <main class="h-full min-h-[calc(100dvh-180px)] md:min-h-[620px]">
    <AdminParticipantTable
      :rows="filteredParticipants"
      :columns="columns"
      :loading="participantsStore.isLoading"
      :search="searchFields"
      :initial-search="appliedSearch"
      :copied-id="copiedId"
      :trip-name-by-id="tripNameById"
      :get-notification-class="getNotificationClass"
      :get-notification-label="getNotificationLabel"
      @create="openCreateDrawer"
      @search="applySearch"
      @reset="resetSearch"
      @refresh="refreshParticipants"
      @copy-code="copyInviteCode($event.inviteCode, $event.id)"
      @edit="openEditDrawer"
    />

    <AdminParticipantFormDrawer
      v-model:open="isDrawerOpen"
      v-model:trip-search="tripSearch"
      :editing-id="editingId"
      :form="form"
      :is-saving="isSaving"
      :is-uploading="isUploading"
      :selectable-trips="selectableTrips"
      :notification-status-label="getNotificationLabel(editingParticipant)"
      :notification-status-class="getNotificationClass(editingParticipant)"
      :push-tokens="getPushTokens(editingParticipant)"
      :push-enabled="hasPushEnabled(editingParticipant)"
      :is-test-push-sending="isTestPushSending"
      :active-tracking-token="activeTrackingToken"
      :is-tracking-loading="isTrackingLoading"
      :is-tracking-creating="isTrackingCreating"
      :is-tracking-removing="isTrackingRemoving"
      :tracking-copied="Boolean(copiedTrackingUrl)"
      @close="closeDrawer"
      @save="saveParticipant"
      @delete="deleteCurrentParticipant"
      @toggle-trip="toggleTrip"
      @avatar-paste="handleAvatarPaste"
      @avatar-file="handleFileUpload"
      @send-test="sendTestPush"
      @copy-tracking="copyTrackingSetupUrl"
      @remove-tracking="removeTrackingForParticipant"
      @enable-tracking="enableTrackingForParticipant"
      @view-tracking-history="openTrackingHistory"
    />

    <AdminParticipantTrackDrawer
      :open="isTrackDrawerOpen"
      :participant="editingParticipant"
      :trips="trackTrips"
      :selected-trip-id="trackTripId"
      :selected-date="trackDate"
      :points="trackPoints"
      :selected-point-id="selectedTrackPointId"
      :meta="trackMeta"
      :is-loading="isTrackLoading"
      :error="trackError"
      @update:open="updateTrackDrawerOpen"
      @close="closeTrackDrawer"
      @change-trip="changeTrackTrip"
      @change-date="changeTrackDate"
      @refresh="loadTrackPoints()"
      @select-point="selectedTrackPointId = $event"
      @delete-point="requestTrackDeletion('point', $event)"
      @delete-day="requestTrackDeletion('day')"
      @delete-all="requestTrackDeletion('all')"
    />

    <AdminParticipantTrackDeleteDialog
      v-model:open="isTrackDeleteDialogOpen"
      :scope="trackDeleteScope"
      :preview="trackDeletePreview"
      :participant-name="editingParticipant?.name || ''"
      :warning="trackDeletionWarning"
      :is-deleting="isTrackDeleting"
      :timezone="trackTimezone"
      @confirm="confirmTrackDeletion"
    />
  </main>
</template>

<route>
{
  meta: { layout: "admin" }
}
</route>
