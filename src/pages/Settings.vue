<script setup>
import { appAlert, appConfirm } from '@/services/dialog';
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/store/userStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';
import { useTravelStore } from '@/store/travelStore';
import { useExpensesStore } from '@/store/expensesStore';
import {
  disableParticipantPushForTrip,
  getParticipantByGuestId,
  getParticipantById,
  getParticipantsByUid,
  updateParticipantNotificationPreference,
  upsertParticipantPushToken,
} from '@/api/participants';
import { getTripById } from '@/api/trips';
import {
  deleteTrackingTokensByParticipant,
  ensureParticipantTrackingToken,
  getActiveTrackingTokenByParticipant,
  getTraccarConfigUrl,
} from '@/api/tracking';
import { loginWithGoogle } from '@/api/auth';
import { uploadImage } from '@/api/storage';
import { lockScroll, unlockScroll } from '@/utils/scrollLock';
import app from '@/firebase/index.js';
import { getAuth } from 'firebase/auth';
import PackingList from '@/components/PackingList.vue';
import SettingsRow from '@/components/settings/SettingsRow.vue';
import SettingsDetailDrawer from '@/components/settings/SettingsDetailDrawer.vue';
import {
  ShieldCheck,
  ChevronRight,
  LogOut,
  User,
  Ticket,
  Loader2,
  CheckCircle2,
  Pencil,
  X,
  Upload,
  RefreshCw,
  Download,
  Luggage,
  Bell,
  Copy,
  MapPin,
} from 'lucide-vue-next';
import { getFCMToken } from '@/firebase/index';
import { hasPackingItems } from '@/utils/packingList';
import {
  checkForAppUpdate,
  pwaUpdateState,
  reloadApp,
} from '@/services/pwaUpdate';

const router = useRouter();
const userStore = useUserStore();
const participantsStore = useParticipantsStore();
const tripStore = useTripStore();
const travelStore = useTravelStore();
const expensesStore = useExpensesStore();

const inviteCode = ref('');
const isClaiming = ref(false);
const isRefreshing = ref(false);
const isCheckingVersion = ref(false);
const versionCheckMessage = ref('');
const activeSettingsPanel = ref('');
const userTrips = ref([]);
const isLoadingUserTrips = ref(false);
const isTripPickerOpen = ref(false);
const isGoogleLoggingIn = ref(false);
const pendingTripSelection = ref(null);
const tripPickerHint = ref('');
const isGuestNameModalOpen = ref(false);
const guestNameInput = ref('');
const isTrackingSetupLoading = ref(false);
const trackingSetupToken = ref('');
const trackingSetupHash = ref('');
const trackingSetupTripId = ref('');
const trackingSetupNeedsRebind = ref(false);
const copiedTrackingSetup = ref('');
let resolveGuestName = null;

const displayUserName = computed(() => {
  return (
    userStore.myParticipant?.name ||
    userStore.user?.displayName ||
    userStore.user?.email ||
    '旅程訪客'
  );
});

const tripPickerRows = computed(() => {
  return pendingTripSelection.value?.rows || userTrips.value;
});
const shouldShowMyTripsSection = computed(() =>
  Boolean(
    userStore.user ||
    userStore.myParticipant ||
    tripStore.isPublicTrip ||
    userTrips.value.length ||
    isLoadingUserTrips.value
  )
);
// PWA Install Logic
const deferredPrompt = ref(null);
const isStandalone = ref(false);
const isPackingListOpen = ref(false);
const packingTemplate = computed(
  () => tripStore.currentTrip?.packingList || []
);
const hasTripPackingList = computed(() =>
  hasPackingItems(packingTemplate.value)
);
const packingParticipantId = computed(
  () => userStore.myParticipant?.id || userStore.localParticipantId || 'guest'
);

// FCM 推播相關狀態
const notificationPermission = ref('default');
const fcmToken = ref('');
const isGettingToken = ref(false);
const isIOS = ref(false);
const PUSH_TOKEN_STORAGE_KEY = 'guidebook_fcm_token';
const GUEST_ID_KEY = 'guidebook_guest_id';

const getNotificationPromptKey = () => {
  const participantId =
    userStore.myParticipant?.id || userStore.localParticipantId;
  const tripId = tripStore.currentTripId || 'no-trip';
  return participantId
    ? `guidebook_notification_prompted_${tripId}_${participantId}`
    : '';
};

const getDevicePlatform = () => {
  if (isIOS.value) return 'ios-pwa';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return 'web';
};

const getCurrentTripPushTokens = (participant = userStore.myParticipant) => {
  if (!participant) return [];
  const tokens = Array.isArray(participant.pushTokens)
    ? participant.pushTokens
    : participant.pushToken
      ? [{ token: participant.pushToken }]
      : [];
  return tokens.filter((item) => item?.token && item.permission !== 'denied');
};

const notificationStatus = computed(() => {
  if (!userStore.myParticipant) return 'disabled';
  if (notificationPermission.value === 'denied') return 'denied';
  const tripPreference =
    userStore.myParticipant.notificationPreferences?.[tripStore.currentTripId];
  if (tripPreference === 'denied') {
    return 'denied';
  }
  if (getCurrentTripPushTokens().length > 0) return 'enabled';
  return 'disabled';
});

const notificationStatusLabel = computed(() => {
  if (notificationStatus.value === 'enabled') return '已啟用';
  if (notificationStatus.value === 'denied') return '權限已拒絕';
  return '未啟用';
});

const trackingDeviceId = computed(() => {
  const participantId =
    userStore.myParticipant?.id || userStore.localParticipantId || '';
  return participantId
    ? `guidebook-${participantId.slice(0, 8)}`
    : 'guidebook-device';
});

const trackingSetupStorageKey = computed(() => {
  const participantId =
    userStore.myParticipant?.id || userStore.localParticipantId || '';
  return participantId ? `guidebook_tracking_setup_hash_${participantId}` : '';
});

const trackingSetupStatusText = computed(() => {
  if (trackingSetupNeedsRebind.value) return '定位設定已更新，請重新綁定';
  if (trackingSetupToken.value) return '已建立定位設定';
  return '尚未啟用定位設定';
});

const traccarConfigUrl = computed(() =>
  trackingSetupToken.value
    ? getTraccarConfigUrl({
        token: trackingSetupToken.value,
        deviceId: trackingDeviceId.value,
        accuracy: 'highest',
        distance: 0,
        interval: 30,
        wakelock: true,
        buffer: true,
      })
    : ''
);

const rememberTrackingSetupHash = () => {
  if (!trackingSetupStorageKey.value || !trackingSetupHash.value) return;
  localStorage.setItem(trackingSetupStorageKey.value, trackingSetupHash.value);
  trackingSetupNeedsRebind.value = false;
};

const loadCurrentTrackingSetup = async () => {
  if (!userStore.myParticipant?.id) return;
  isTrackingSetupLoading.value = true;
  try {
    let activeToken = await getActiveTrackingTokenByParticipant(
      userStore.myParticipant.id
    );
    if (
      activeToken?.token &&
      tripStore.currentTripId &&
      activeToken.tripId !== tripStore.currentTripId
    ) {
      await ensureParticipantTrackingToken({
        participantId: userStore.myParticipant.id,
        tripId: tripStore.currentTripId,
        deviceId: trackingDeviceId.value,
        minIntervalSeconds: 30,
      });
      activeToken = {
        ...activeToken,
        tripId: tripStore.currentTripId,
      };
    }
    const savedHash = trackingSetupStorageKey.value
      ? localStorage.getItem(trackingSetupStorageKey.value) || ''
      : '';
    trackingSetupToken.value = activeToken?.token || '';
    trackingSetupHash.value = activeToken?.id || '';
    trackingSetupTripId.value = activeToken?.tripId || '';
    trackingSetupNeedsRebind.value = Boolean(
      savedHash && savedHash !== trackingSetupHash.value
    );
  } catch (error) {
    console.error('定位設定讀取失敗:', error);
  } finally {
    isTrackingSetupLoading.value = false;
  }
};

const ensureCurrentTrackingSetup = async () => {
  if (!userStore.myParticipant?.id) return;
  if (
    trackingSetupToken.value &&
    trackingSetupHash.value &&
    trackingSetupTripId.value === tripStore.currentTripId
  ) {
    return;
  }

  isTrackingSetupLoading.value = true;
  try {
    const result = await ensureParticipantTrackingToken({
      participantId: userStore.myParticipant.id,
      tripId: tripStore.currentTripId,
      deviceId: trackingDeviceId.value,
      minIntervalSeconds: 30,
    });
    trackingSetupToken.value = result.token || '';
    trackingSetupHash.value = result.tokenHash || '';
    trackingSetupTripId.value = tripStore.currentTripId || '';
    const savedHash = trackingSetupStorageKey.value
      ? localStorage.getItem(trackingSetupStorageKey.value) || ''
      : '';
    trackingSetupNeedsRebind.value = Boolean(
      savedHash && savedHash !== trackingSetupHash.value
    );
  } catch (error) {
    console.error('定位設定讀取失敗:', error);
  } finally {
    isTrackingSetupLoading.value = false;
  }
};

const openTraccarSetup = async () => {
  await ensureCurrentTrackingSetup();
  if (!traccarConfigUrl.value)
    return await appAlert('目前無法建立定位設定，請稍後再試。');
  rememberTrackingSetupHash();
  window.location.href = traccarConfigUrl.value;
};

const copyTrackingSetup = async (value, label = '設定') => {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  if (label === 'app') rememberTrackingSetupHash();
  copiedTrackingSetup.value = label;
  setTimeout(() => {
    copiedTrackingSetup.value = '';
  }, 2000);
};

const removeCurrentTrackingSetup = async () => {
  if (!userStore.myParticipant?.id) return;
  if (!(await appConfirm('確定要移除目前的手機定位設定？之後可重新建立。')))
    return;

  isTrackingSetupLoading.value = true;
  try {
    await deleteTrackingTokensByParticipant(userStore.myParticipant.id);
    trackingSetupToken.value = '';
    trackingSetupHash.value = '';
    trackingSetupTripId.value = '';
    trackingSetupNeedsRebind.value = false;
    if (trackingSetupStorageKey.value) {
      localStorage.removeItem(trackingSetupStorageKey.value);
    }
    await appAlert('已移除手機定位設定。');
  } catch (error) {
    await appAlert('移除定位設定失敗：' + error.message);
  } finally {
    isTrackingSetupLoading.value = false;
  }
};

const handleInstallClick = async () => {
  if (deferredPrompt.value) {
    // Android / Chrome
    deferredPrompt.value.prompt();
    const { outcome } = await deferredPrompt.value.userChoice;
    if (outcome === 'accepted') deferredPrompt.value = null;
  } else {
    // iOS or already installed
    // 發送事件給 IOSInstallPrompt.vue
    window.dispatchEvent(new CustomEvent('show-ios-install-prompt'));
  }
};

const reloadTripData = async (force = false) => {
  await tripStore.init();
  await participantsStore.init({ force });
  await travelStore.init({ force });
  await expensesStore.init({ force });
};

const clearTripCaches = () => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('guidebook_') && key.endsWith('_cache'))
    .forEach((key) => localStorage.removeItem(key));
};

const getParticipantTripIds = (participant) => [
  ...new Set(
    (Array.isArray(participant?.tripIds)
      ? participant.tripIds
      : participant?.tripId
        ? [participant.tripId]
        : []
    ).filter(Boolean)
  ),
];

const buildUserTripRows = async (memberships) => {
  const rows = [];
  const seenTripIds = new Set();
  for (const membership of memberships.filter(Boolean)) {
    for (const tripId of getParticipantTripIds(membership)) {
      if (seenTripIds.has(tripId)) continue;
      seenTripIds.add(tripId);
      const trip = await getTripById(tripId);
      if (trip) rows.push({ trip, participant: membership });
    }
  }
  return rows;
};

const loadUserTrips = async () => {
  if (!userStore.user?.uid) {
    const localParticipantId =
      userStore.localParticipantId ||
      localStorage.getItem(`claimedParticipantId_${tripStore.currentTripId}`) ||
      localStorage.getItem('claimedParticipantId');
    const guestId = localStorage.getItem(GUEST_ID_KEY);
    const localParticipant = localParticipantId
      ? await getParticipantById(localParticipantId)
      : null;
    if (!localParticipant && !guestId && !tripStore.currentTripId) {
      userTrips.value = [];
      tripPickerHint.value = '';
      return;
    }

    const guestParticipant = guestId
      ? await getParticipantByGuestId(guestId)
      : null;
    const rows = await buildUserTripRows([
      localParticipant || guestParticipant,
    ]);

    if (!rows.filter(Boolean).length && tripStore.currentTripId) {
      if (!tripStore.currentTrip) await tripStore.init();
      if (participantsStore.participants.length === 0)
        await participantsStore.init();
      userTrips.value =
        tripStore.currentTrip && userStore.myParticipant
          ? [
              {
                trip: tripStore.currentTrip,
                participant: userStore.myParticipant,
              },
            ]
          : [];
    } else {
      userTrips.value = rows.filter(Boolean);
    }
    tripPickerHint.value = '';
    return;
  }

  isLoadingUserTrips.value = true;
  try {
    const memberships = await getParticipantsByUid(userStore.user.uid);
    userTrips.value = await buildUserTripRows(memberships);
    const selectedTrip = userTrips.value.find(
      (row) => row.trip.id === tripStore.currentTripId
    );

    if (!selectedTrip && userTrips.value.length === 1) {
      const message = `只有一個旅程，已自動切換至「${userTrips.value[0].trip.title}」。`;
      await switchUserTrip(userTrips.value[0], { redirect: false });
      await appAlert(message);
      tripPickerHint.value = '';
      return;
    }

    if (
      !selectedTrip &&
      userTrips.value.length > 1 &&
      !pendingTripSelection.value
    ) {
      tripPickerHint.value = `你有 ${userTrips.value.length} 個旅程，請先選擇要進入的旅程。`;
      isTripPickerOpen.value = true;
      return;
    }

    tripPickerHint.value = '';
  } finally {
    isLoadingUserTrips.value = false;
  }
};

const switchUserTrip = async (row, options = {}) => {
  await tripStore.switchTrip(row.trip.id);
  userStore.setLocalParticipant(row.participant.id);
  clearTripCaches();
  await reloadTripData(true);
  isTripPickerOpen.value = false;
  if (options.redirect !== false) {
    router.push('/');
  }
};

const selectTripFromPicker = async (row) => {
  if (!pendingTripSelection.value) {
    await switchUserTrip(row);
    return;
  }

  const { participant, profile } = pendingTripSelection.value;
  await tripStore.switchTrip(row.trip.id);
  await participantsStore.updateParticipant(participant.id, {
    isClaimed: true,
    uid: profile.uid || participant.uid || null,
    name: participant.name || profile.name || profile.email || '旅伴',
    avatar: participant.avatar || profile.avatar || '',
  });
  userStore.setLocalParticipant(participant.id);
  pendingTripSelection.value = null;
  tripPickerHint.value = '';
  inviteCode.value = '';
  clearTripCaches();
  await reloadTripData(true);
  await loadUserTrips();
  await loadCurrentTrackingSetup();
  isTripPickerOpen.value = false;
  router.push('/');
};

const closeTripPicker = () => {
  isTripPickerOpen.value = false;
  pendingTripSelection.value = null;
  tripPickerHint.value = '';
};

onMounted(async () => {
  checkNotificationStatus();
  if (!userStore.isAuthReady) {
    await userStore.initAuth();
  }
  await loadUserTrips();
  await loadCurrentTrackingSetup();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt.value = e;
  });

  isStandalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone;
});

watch(
  () => [userStore.myParticipant?.id, tripStore.currentTripId],
  () => {
    trackingSetupToken.value = '';
    trackingSetupHash.value = '';
    trackingSetupTripId.value = '';
    trackingSetupNeedsRebind.value = false;
    loadCurrentTrackingSetup();
  }
);

const handleReload = () => {
  isRefreshing.value = true;
  reloadApp();
};

const handleCheckVersion = async () => {
  if (isCheckingVersion.value) return;
  isCheckingVersion.value = true;
  versionCheckMessage.value = '';
  try {
    if (!navigator.onLine) {
      versionCheckMessage.value = '目前沒有網路連線，連線後再試一次。';
      return;
    }
    const result = await checkForAppUpdate({ ignoreDismissal: true });
    if (result?.type === 'optional' || result?.type === 'required') {
      versionCheckMessage.value = `找到新版本 v${result.manifest.version}，請依提示更新。`;
    } else if (result?.type === 'none') {
      versionCheckMessage.value = `目前已是最新版本 v${pwaUpdateState.currentVersion}。`;
    } else {
      versionCheckMessage.value =
        pwaUpdateState.error || '目前無法檢查新版本，請稍後再試。';
    }
  } finally {
    isCheckingVersion.value = false;
  }
};

const handleGoogleLogin = async () => {
  isGoogleLoggingIn.value = true;
  try {
    await loginWithGoogle();
    await userStore.initAuth();
    if (userStore.localParticipantId && userStore.user) {
      await participantsStore.updateParticipant(userStore.localParticipantId, {
        uid: userStore.user.uid,
        name:
          userStore.myParticipant?.name ||
          userStore.user.displayName ||
          userStore.user.email ||
          '旅伴',
        avatar:
          userStore.myParticipant?.avatar || userStore.user.photoURL || '',
      });
      userStore.setLocalParticipant(userStore.localParticipantId);
    }
    await loadUserTrips();
    if (inviteCode.value.trim()) {
      await handleClaim();
    }
  } catch (error) {
    await appAlert(error.message);
  } finally {
    isGoogleLoggingIn.value = false;
  }
};

// Edit Profile State
const isEditModalOpen = ref(false);
const isUploading = ref(false);
const isSaving = ref(false);

watch([isEditModalOpen, isGuestNameModalOpen], (values) => {
  if (values.some(Boolean)) {
    lockScroll();
  } else {
    unlockScroll();
  }
});

const requestGuestName = () => {
  guestNameInput.value = '';
  isGuestNameModalOpen.value = true;
  return new Promise((resolve) => {
    resolveGuestName = resolve;
  });
};

const submitGuestName = () => {
  const name = guestNameInput.value.trim();
  if (!name) return;
  isGuestNameModalOpen.value = false;
  resolveGuestName?.(name);
  resolveGuestName = null;
};

const cancelGuestName = () => {
  isGuestNameModalOpen.value = false;
  resolveGuestName?.('');
  resolveGuestName = null;
};

const editForm = ref({
  name: '',
  avatar: '',
});

const openEditModal = () => {
  if (!userStore.myParticipant) return;
  editForm.value = {
    name: userStore.myParticipant.name,
    avatar: userStore.myParticipant.avatar || '',
  };
  isEditModalOpen.value = true;
};

const fileInput = ref(null);
const triggerFileUpload = () => fileInput.value.click();

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  isUploading.value = true;
  try {
    const url = await uploadImage(file);

    // 建立 Image 物件來預載圖片，確保瀏覽器已經快取並準備好顯示
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('圖片預載失敗'));
      img.src = url;
      // 設定 10 秒逾時，避免卡死
      setTimeout(() => resolve(), 10000);
    });

    editForm.value.avatar = url;
  } catch (error) {
    await appAlert('圖片處理失敗：' + error.message);
  } finally {
    isUploading.value = false;
    // 重置 input 讓同一個檔案可以再次觸發 change
    event.target.value = '';
  }
};

const handleUpdateProfile = async () => {
  if (!editForm.value.name.trim()) return await appAlert('請輸入姓名');
  isSaving.value = true;
  try {
    await participantsStore.updateParticipant(
      userStore.myParticipant.id,
      editForm.value
    );
    isEditModalOpen.value = false;
    await appAlert('更新成功！');
  } catch (error) {
    await appAlert('更新失敗：' + error.message);
  } finally {
    isSaving.value = false;
  }
};

const handleClaim = async () => {
  if (!inviteCode.value.trim()) return await appAlert('請輸入邀請碼');

  isClaiming.value = true;
  try {
    const firebaseUser = userStore.user || getAuth(app).currentUser;
    if (firebaseUser && !userStore.user) {
      userStore.user = firebaseUser;
    }
    const profile = {
      uid: firebaseUser?.uid || null,
      participantId: userStore.localParticipantId || '',
      name: firebaseUser?.displayName || firebaseUser?.email || '',
      email: firebaseUser?.email || '',
      avatar: firebaseUser?.photoURL || '',
    };
    let res = await tripStore.joinByInviteCode(
      inviteCode.value.trim(),
      profile
    );
    if (res.status === 301 && res.mode === 'guestNameRequired') {
      const guestName = await requestGuestName();
      if (!guestName?.trim()) return;
      res = await tripStore.joinByInviteCode(inviteCode.value.trim(), {
        ...profile,
        name: guestName.trim(),
      });
    }

    if (res.status === 200) {
      if (res.mode === 'publicTrip') {
        await appAlert('已進入行程瀏覽。');
      } else if (res.participant?.id) {
        userStore.setLocalParticipant(res.participant.id);
        const message =
          res.mode === 'existingParticipantTrip'
            ? '已切換至此旅程。'
            : res.mode === 'participantJoinedTrip'
              ? '已加入此旅程。'
              : res.mode === 'guestParticipant'
                ? '已加入旅程。'
                : '已綁定身份。';
        await appAlert(message);
      }

      inviteCode.value = '';
      clearTripCaches();
      await reloadTripData(true);
      await loadUserTrips();
      if (res.mode === 'guestParticipant' && res.isNewParticipant) {
        await promptNotificationAfterNewParticipant();
      }
      router.push('/');
    } else if (res.status === 300 && res.mode === 'participantTripSelection') {
      pendingTripSelection.value = {
        participant: res.participant,
        profile,
        rows: res.trips.map((trip) => ({
          trip,
          participant: res.participant,
        })),
      };
      isTripPickerOpen.value = true;
    }
  } catch (error) {
    await appAlert(error.message);
  } finally {
    isClaiming.value = false;
  }
};

const handleLogout = async () => {
  await userStore.logout();
  userTrips.value = [];
  pendingTripSelection.value = null;
  tripPickerHint.value = '';
  isTripPickerOpen.value = false;
  router.push('/settings');
};

const leaveCurrentTrip = async () => {
  if (
    !(await appConfirm('確定要離開目前旅程？之後需要重新輸入 6 碼才能瀏覽。'))
  )
    return;
  userStore.clearLocalParticipant();
  tripStore.clearCurrentTrip();
  clearTripCaches();
  travelStore.clear();
  expensesStore.clear();
  participantsStore.clear();
  pendingTripSelection.value = null;
  tripPickerHint.value = '';
  isTripPickerOpen.value = false;
  router.push('/settings');
};

const checkNotificationStatus = () => {
  if ('Notification' in window) {
    notificationPermission.value = Notification.permission;
  }
  const ua = window.navigator.userAgent;
  isIOS.value =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const bindPushTokenToCurrentParticipant = async (
  token,
  { silent = false } = {}
) => {
  if (!token || !userStore.myParticipant?.id) return false;

  const previousToken = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY) || '';
  const participantTokens = Array.isArray(userStore.myParticipant.pushTokens)
    ? userStore.myParticipant.pushTokens
    : [];
  const alreadyBound = participantTokens.some(
    (item) => item.token === token && item.permission !== 'denied'
  );

  if (alreadyBound && previousToken === token) return false;

  await upsertParticipantPushToken(userStore.myParticipant.id, token, {
    previousToken,
    tripId: tripStore.currentTripId,
    userAgent: navigator.userAgent,
    platform: getDevicePlatform(),
  });
  localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
  await participantsStore.init();

  if (previousToken && previousToken !== token) {
    await appAlert('偵測到此裝置的推播設定已更新，已重新綁定目前成員。');
  }

  return true;
};

const requestNotificationPermission = async ({ silent = false } = {}) => {
  if (!('Notification' in window)) {
    if (!silent) await appAlert('此瀏覽器不支援通知功能。');
    return;
  }

  if (isIOS.value && !isStandalone.value) {
    if (!silent) {
      await appAlert(
        'iOS 需要先加入主畫面，並從桌面圖示開啟 App 後才能啟用推播。'
      );
    }
    return;
  }

  isGettingToken.value = true;
  try {
    const permission = await Notification.requestPermission();
    notificationPermission.value = permission;

    if (permission === 'granted') {
      const token = await getFCMToken();
      if (token) {
        fcmToken.value = token;
        const wasBound = await bindPushTokenToCurrentParticipant(token, {
          silent,
        });
        if (wasBound && !silent) {
          await appAlert('推播通知已啟用，並綁定到目前成員。');
        }
      } else {
        if (!silent) {
          await appAlert('目前無法啟用通知，請稍後再試或聯絡旅程管理員。');
        }
      }
    } else if (permission === 'denied') {
      if (userStore.myParticipant?.id) {
        await updateParticipantNotificationPreference(
          userStore.myParticipant.id,
          {
            tripId: tripStore.currentTripId,
            permission: 'denied',
          }
        );
        await participantsStore.init();
      }
      if (!silent) {
        await appAlert(
          '已拒絕通知權限。若要接收推播，請到系統或瀏覽器設定重新開啟通知。'
        );
      }
    }
  } catch (error) {
    console.error('設定通知失敗:', error);
    if (!silent) await appAlert('設定通知失敗: ' + error.message);
  } finally {
    isGettingToken.value = false;
  }
};

const promptNotificationAfterNewParticipant = async () => {
  checkNotificationStatus();
  if (!userStore.myParticipant) return;
  if (!('Notification' in window)) return;

  if (notificationPermission.value === 'denied') return;
  if (
    notificationPermission.value === 'default' &&
    isIOS.value &&
    !isStandalone.value
  )
    return;

  const promptKey = getNotificationPromptKey();
  if (!promptKey || localStorage.getItem(promptKey)) return;

  localStorage.setItem(promptKey, '1');
  if (await appConfirm('是否允許接收此旅程的推播通知？')) {
    await requestNotificationPermission();
  } else {
    await updateParticipantNotificationPreference(userStore.myParticipant.id, {
      tripId: tripStore.currentTripId,
      permission: 'denied',
    });
    await participantsStore.init();
  }
};

const disableNotificationForCurrentTrip = async () => {
  if (!userStore.myParticipant?.id) return;
  if (!(await appConfirm('確定要關閉此旅程在目前裝置的推播通知？'))) return;

  isGettingToken.value = true;
  try {
    const currentToken =
      fcmToken.value || localStorage.getItem(PUSH_TOKEN_STORAGE_KEY) || '';
    await disableParticipantPushForTrip(userStore.myParticipant.id, {
      tripId: tripStore.currentTripId,
      token: currentToken,
    });
    if (currentToken) {
      localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    }
    fcmToken.value = '';
    await participantsStore.init();
    await appAlert('已關閉此旅程的推播通知。');
  } catch (error) {
    await appAlert('關閉通知失敗: ' + error.message);
  } finally {
    isGettingToken.value = false;
  }
};
</script>

<template>
  <div class="space-y-6 pb-20">
    <!-- Profile Header -->
    <header
      class="bg-white p-8 rounded-[40px] border border-slate-100 flex flex-col items-center text-center relative group"
    >
      <div
        class="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-4 border border-slate-100 overflow-hidden"
      >
        <img
          v-if="userStore.myParticipant?.avatar"
          :src="userStore.myParticipant.avatar"
          class="w-full h-full object-cover"
        />
        <User v-else :size="40" />
      </div>
      <h2 class="text-xl font-black text-slate-800">
        {{ displayUserName }}
      </h2>
      <p
        class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1"
      >
        {{
          userStore.myParticipant
            ? '已綁定旅客身份'
            : userStore.user
              ? '已登入 Google'
              : '旅程設定與登入'
        }}
      </p>
      <p
        v-if="tripStore.currentTrip"
        class="text-xs font-bold text-[var(--travel-teal)] mt-2"
      >
        目前旅程：{{ tripStore.currentTrip.title }}
      </p>

      <!-- Edit Profile Button -->
      <button
        v-if="userStore.myParticipant"
        @click="openEditModal"
        class="absolute top-6 right-6 w-10 h-10 bg-[var(--travel-mist)] text-[var(--travel-teal)] rounded-2xl flex items-center justify-center hover:bg-[#d7e8e2] transition-colors border border-[#d7e8e2]"
      >
        <Pencil :size="18" />
      </button>
    </header>

    <section v-if="shouldShowMyTripsSection" class="space-y-3">
      <h3
        class="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"
      >
        我的旅程
      </h3>
      <div
        class="bg-white rounded-[32px] border border-slate-100 overflow-hidden"
      >
        <button
          v-if="userTrips.length"
          @click="isTripPickerOpen = true"
          class="w-full p-5 flex items-center gap-4 hover:bg-[var(--travel-paper)] transition-colors border-b border-slate-50 last:border-b-0 text-left"
        >
          <div
            class="w-10 h-10 rounded-xl bg-[var(--travel-mist)] text-[var(--travel-teal)] flex items-center justify-center font-black"
          >
            {{ tripStore.currentTrip?.title?.slice(0, 1) || userTrips.length }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-black text-slate-800 truncate">
              {{ tripStore.currentTrip?.title || '選擇旅程' }}
            </div>
            <div class="text-[10px] font-bold text-slate-400 mt-0.5">
              共 {{ userTrips.length }} 趟旅程可切換
            </div>
          </div>
          <ChevronRight :size="20" class="text-slate-200" />
        </button>
        <div
          v-else-if="!isLoadingUserTrips"
          class="p-5 border-b border-slate-50 text-sm font-bold text-slate-400"
        >
          <template v-if="tripStore.isPublicTrip && tripStore.currentTrip">
            正在瀏覽「{{ tripStore.currentTrip.title }}」
          </template>
          <template v-else> 目前尚未加入任何旅程。 </template>
        </div>
        <div
          v-if="isLoadingUserTrips"
          class="p-5 flex items-center justify-center text-slate-300"
        >
          <Loader2 class="animate-spin" :size="18" />
        </div>
        <div class="p-5 space-y-3">
          <div class="text-xs font-bold text-slate-500">
            有新的 6 位代碼時，可在這裡加入或切換旅程。
          </div>
          <div class="relative">
            <input
              v-model="inviteCode"
              type="text"
              placeholder="輸入 6 位代碼"
              class="settings-accent-focus w-full bg-slate-50 border-none rounded-2xl p-4 pr-12 font-mono font-black text-slate-700 placeholder:text-slate-300 transition-all outline-none"
              maxlength="6"
            />
            <div
              class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"
            >
              <Ticket :size="20" />
            </div>
          </div>
          <button
            @click="handleClaim"
            :disabled="isClaiming || !inviteCode"
            class="settings-brand-action w-full text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
          >
            <Loader2 v-if="isClaiming" class="animate-spin" :size="18" />
            {{ isClaiming ? '驗證中...' : '加入旅程' }}
          </button>
        </div>
      </div>
    </section>

    <!-- Trip Access Section -->
    <section v-if="!shouldShowMyTripsSection" class="space-y-3">
      <h3
        class="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"
      >
        {{ userStore.user ? '加入旅程' : '選擇登入方式' }}
      </h3>
      <div
        class="bg-white p-6 rounded-[32px] border border-slate-100 space-y-4"
      >
        <p class="text-xs font-bold text-slate-500 leading-relaxed px-1">
          輸入你拿到的 6
          碼即可加入旅程。登入後可在不同裝置同步你的旅程與個人資料。
        </p>
        <button
          v-if="!userStore.user"
          @click="handleGoogleLogin"
          :disabled="isGoogleLoggingIn"
          class="w-full bg-slate-900 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-100"
        >
          <Loader2 v-if="isGoogleLoggingIn" class="animate-spin" :size="18" />
          使用 Google 登入
        </button>
        <div class="relative">
          <input
            v-model="inviteCode"
            type="text"
            placeholder="輸入 6 位代碼"
            class="settings-accent-focus w-full bg-slate-50 border-none rounded-2xl p-4 pr-12 font-mono font-black text-slate-700 placeholder:text-slate-300 transition-all outline-none"
            maxlength="6"
          />
          <div class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
            <Ticket :size="20" />
          </div>
        </div>
        <button
          @click="handleClaim"
          :disabled="isClaiming || !inviteCode"
          class="settings-brand-action w-full text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
        >
          <Loader2 v-if="isClaiming" class="animate-spin" :size="18" />
          {{
            isClaiming
              ? '驗證中...'
              : userStore.user
                ? '綁定 / 加入旅程'
                : '以邀請碼進入'
          }}
        </button>
      </div>
    </section>

    <section class="space-y-3" aria-labelledby="settings-device-heading">
      <h2
        id="settings-device-heading"
        class="px-1 text-xs font-bold tracking-widest text-slate-500"
      >
        一般設定
      </h2>
      <div class="overflow-hidden rounded-3xl border border-slate-100 bg-white">
        <SettingsRow
          v-if="
            userStore?.myParticipant?.isSuperAdmin ||
            userStore?.myParticipant?.isAdmin
          "
          :icon="ShieldCheck"
          title="管理後台"
          detail="管理旅程與成員"
          @click="router.push('/admin')"
        />
        <SettingsRow
          v-if="!tripStore.isPublicTrip && hasTripPackingList"
          :icon="Luggage"
          title="行李準備清單"
          detail="檢查必備物品與證件"
          @click="isPackingListOpen = true"
        />
        <SettingsRow
          v-if="userStore.myParticipant"
          :icon="Bell"
          title="推播通知"
          detail="管理此旅程的通知"
          :status="notificationStatusLabel"
          :status-tone="
            notificationStatus === 'enabled'
              ? 'success'
              : notificationStatus === 'denied'
                ? 'warning'
                : 'neutral'
          "
          @click="activeSettingsPanel = 'notifications'"
        />
        <SettingsRow
          v-if="userStore.myParticipant && !tripStore.isPublicTrip"
          :icon="MapPin"
          title="手機定位"
          detail="分享此裝置的位置"
          :status="
            isTrackingSetupLoading
              ? '讀取中'
              : trackingSetupNeedsRebind
                ? '需更新'
                : trackingSetupToken
                  ? '已設定'
                  : '未設定'
          "
          :status-tone="
            trackingSetupNeedsRebind
              ? 'warning'
              : trackingSetupToken
                ? 'success'
                : 'neutral'
          "
          @click="activeSettingsPanel = 'tracking'"
        />
        <p
          v-if="!hasTripPackingList && !userStore.myParticipant"
          class="px-5 py-5 text-sm text-slate-500"
        >
          加入旅程後，可在這裡管理旅途工具。
        </p>
      </div>
    </section>

    <section class="space-y-3" aria-labelledby="settings-app-heading">
      <h2
        id="settings-app-heading"
        class="px-1 text-xs font-bold tracking-widest text-slate-500"
      >
        應用程式
      </h2>
      <div class="overflow-hidden rounded-3xl border border-slate-100 bg-white">
        <SettingsRow
          v-if="!isStandalone"
          :icon="Download"
          title="安裝到手機桌面"
          detail="從桌面快速開啟旅程"
          @click="handleInstallClick"
        />
        <SettingsRow
          :icon="RefreshCw"
          title="檢查新版本"
          :detail="`目前版本 v${pwaUpdateState.currentVersion}`"
          @click="activeSettingsPanel = 'version'"
        />
        <SettingsRow
          :icon="RefreshCw"
          title="重新載入"
          detail="重新開啟目前頁面"
          :busy="isRefreshing"
          @click="handleReload"
        />
        <SettingsRow
          v-if="userStore.user || userStore.myParticipant"
          :icon="LogOut"
          title="登出帳號"
          detail="結束目前登入狀態"
          tone="danger"
          @click="handleLogout"
        />
        <SettingsRow
          v-else-if="tripStore.currentTripId"
          :icon="LogOut"
          title="離開目前旅程"
          detail="之後可用邀請碼再次加入"
          tone="danger"
          @click="leaveCurrentTrip"
        />
      </div>
    </section>

    <p class="pt-1 text-center text-xs font-medium text-slate-400">
      Guidebook v{{ pwaUpdateState.currentVersion }}
    </p>

    <SettingsDetailDrawer
      :model-value="activeSettingsPanel === 'notifications'"
      title="推播通知"
      description="接收目前旅程的重要通知。"
      @update:model-value="activeSettingsPanel = $event ? 'notifications' : ''"
    >
      <div class="settings-status-box">
        <span>目前狀態</span><strong>{{ notificationStatusLabel }}</strong>
      </div>
      <p
        v-if="notificationStatus === 'denied'"
        class="mt-3 text-xs leading-5 text-slate-500"
      >
        此裝置曾拒絕通知。如要重新開啟，請先到系統或瀏覽器設定允許通知。
      </p>
      <p
        v-if="isIOS && !isStandalone"
        class="mt-3 rounded-2xl bg-[var(--travel-mist)] p-4 text-xs leading-5 text-[var(--travel-ink)]"
      >
        iPhone 或 iPad 請先將網站加入主畫面，再從桌面開啟，才能接收推播。
      </p>
      <button
        v-if="notificationStatus !== 'enabled'"
        type="button"
        class="settings-primary-action mt-5"
        :disabled="isGettingToken"
        @click="requestNotificationPermission"
      >
        <Loader2 v-if="isGettingToken" class="animate-spin" :size="17" /><Bell
          v-else
          :size="17"
        />啟用通知
      </button>
      <template v-else>
        <button
          type="button"
          class="settings-primary-action mt-5"
          :disabled="isGettingToken"
          @click="requestNotificationPermission"
        >
          <Loader2
            v-if="isGettingToken"
            class="animate-spin"
            :size="17"
          /><RefreshCw v-else :size="17" />重新綁定此裝置
        </button>
        <button
          type="button"
          class="settings-danger-action mt-3"
          :disabled="isGettingToken"
          @click="disableNotificationForCurrentTrip"
        >
          關閉此旅程通知
        </button>
      </template>
    </SettingsDetailDrawer>

    <SettingsDetailDrawer
      :model-value="activeSettingsPanel === 'tracking'"
      title="手機定位"
      description="使用 Traccar 分享此裝置的位置。"
      @update:model-value="activeSettingsPanel = $event ? 'tracking' : ''"
    >
      <div class="settings-status-box">
        <span>目前狀態</span
        ><strong>{{
          isTrackingSetupLoading ? '正在讀取設定' : trackingSetupStatusText
        }}</strong>
      </div>
      <button
        type="button"
        class="settings-primary-action mt-5"
        :disabled="isTrackingSetupLoading"
        @click="openTraccarSetup"
      >
        <Loader2
          v-if="isTrackingSetupLoading"
          class="animate-spin"
          :size="17"
        /><MapPin v-else :size="17" />{{
          trackingSetupNeedsRebind
            ? '重新綁定 Traccar'
            : trackingSetupToken
              ? '重新開啟 Traccar'
              : '開啟 Traccar 設定'
        }}
      </button>
      <button
        type="button"
        class="settings-secondary-action mt-3"
        :disabled="!traccarConfigUrl"
        @click="copyTrackingSetup(traccarConfigUrl, 'app')"
      >
        <Copy :size="17" />{{
          copiedTrackingSetup === 'app' ? '已複製連結' : '複製 App 連結'
        }}
      </button>
      <button
        v-if="trackingSetupToken"
        type="button"
        class="settings-danger-action mt-5"
        :disabled="isTrackingSetupLoading"
        @click="removeCurrentTrackingSetup"
      >
        移除定位設定
      </button>
    </SettingsDetailDrawer>

    <SettingsDetailDrawer
      :model-value="activeSettingsPanel === 'version'"
      title="檢查新版本"
      description="確認是否有新版 Guidebook 可用。"
      @update:model-value="activeSettingsPanel = $event ? 'version' : ''"
    >
      <div class="settings-status-box">
        <span>目前版本</span
        ><strong>v{{ pwaUpdateState.currentVersion }}</strong>
      </div>
      <button
        type="button"
        class="settings-primary-action mt-5"
        :disabled="isCheckingVersion || pwaUpdateState.status === 'updating'"
        @click="handleCheckVersion"
      >
        <Loader2
          v-if="isCheckingVersion"
          class="animate-spin"
          :size="17"
        /><RefreshCw v-else :size="17" />{{
          isCheckingVersion ? '正在檢查' : '檢查新版本'
        }}
      </button>
      <p
        v-if="versionCheckMessage"
        class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"
        role="status"
      >
        {{ versionCheckMessage }}
      </p>
      <p class="mt-4 text-xs leading-5 text-slate-500">
        找到新版本時，畫面會顯示更新提示。重新載入是另一個獨立操作。
      </p>
    </SettingsDetailDrawer>

    <SettingsDetailDrawer
      :model-value="isTripPickerOpen"
      :title="pendingTripSelection ? '選擇要綁定的旅程' : '選擇旅程'"
      :description="
        tripPickerHint ||
        (pendingTripSelection
          ? '這個旅客碼可加入多趟旅程'
          : '切換後會重新載入本次旅程資料')
      "
      @update:model-value="!$event && closeTripPicker()"
    >
      <div class="max-h-[60dvh] space-y-2 overflow-y-auto pb-1">
        <button
          v-for="row in tripPickerRows"
          :key="`${row.participant.id}-${row.trip.id}`"
          type="button"
          class="flex min-h-[72px] w-full items-center gap-4 rounded-2xl p-4 text-left transition-colors hover:bg-[var(--travel-mist)]"
          :class="
            row.trip.id === tripStore.currentTripId
              ? 'bg-[var(--travel-mist)]'
              : 'bg-slate-50/70'
          "
          :aria-current="
            row.trip.id === tripStore.currentTripId ? 'true' : undefined
          "
          @click="selectTripFromPicker(row)"
        >
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black"
            :class="
              row.trip.id === tripStore.currentTripId
                ? 'bg-[var(--travel-teal)] text-white'
                : 'bg-white text-slate-400'
            "
          >
            {{ row.trip.title?.slice(0, 1) || '旅' }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate font-black text-slate-800">
              {{ row.trip.title }}
            </div>
            <div class="mt-0.5 text-[10px] font-bold text-slate-400">
              {{ row.trip.inviteCode }} · {{ row.participant.name }}
            </div>
          </div>
          <span
            v-if="row.trip.id === tripStore.currentTripId"
            class="shrink-0 text-xs font-bold text-[var(--travel-teal)]"
          >
            目前旅程
          </span>
          <CheckCircle2
            v-if="row.trip.id === tripStore.currentTripId"
            :size="18"
            class="shrink-0 text-[var(--travel-teal)]"
          />
        </button>
      </div>
    </SettingsDetailDrawer>

    <Teleport to="body">
      <div
        v-if="isGuestNameModalOpen"
        class="fixed inset-0 z-[75] flex items-end sm:items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          @click="cancelGuestName"
        ></div>
        <div
          class="relative w-full max-w-md bg-white rounded-[36px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
        >
          <div
            class="p-6 border-b border-slate-100 flex items-center justify-between"
          >
            <div>
              <h3 class="text-lg font-black text-slate-800">加入旅程</h3>
              <p class="text-[10px] font-bold text-slate-400 mt-1">
                請留下旅程中使用的姓名。
              </p>
            </div>
            <button
              @click="cancelGuestName"
              class="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"
            >
              <X :size="18" />
            </button>
          </div>
          <form class="p-6 space-y-4" @submit.prevent="submitGuestName">
            <input
              v-model="guestNameInput"
              type="text"
              class="settings-accent-focus w-full bg-slate-50 border-none rounded-2xl p-4 font-black text-slate-700 placeholder:text-slate-300 transition-all outline-none"
              placeholder="輸入姓名"
              autocomplete="name"
              autofocus
            />
            <button
              type="submit"
              :disabled="!guestNameInput.trim()"
              class="settings-brand-action w-full text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              加入旅程
            </button>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Packing List Drawer -->
    <PackingList
      v-model:visible="isPackingListOpen"
      :template="packingTemplate"
      :trip-id="tripStore.currentTripId"
      :participant-id="packingParticipantId"
    />

    <!-- Edit Profile Modal -->
    <div
      v-if="isEditModalOpen"
      class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        @click="isEditModalOpen = false"
      ></div>

      <div
        class="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
      >
        <div class="p-8">
          <div class="flex justify-between items-center mb-8">
            <h3 class="text-xl font-black text-slate-800">編輯個人資料</h3>
            <button
              @click="isEditModalOpen = false"
              class="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"
            >
              <X :size="18" />
            </button>
          </div>

          <div class="space-y-6">
            <!-- Avatar Upload -->
            <div class="flex flex-col items-center">
              <div
                class="w-24 h-24 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 relative overflow-hidden group mb-2"
              >
                <img
                  v-if="editForm.avatar"
                  :src="editForm.avatar"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center text-slate-300"
                >
                  <User :size="32" />
                </div>

                <div
                  v-if="isUploading"
                  class="absolute inset-0 bg-white/80 flex items-center justify-center"
                >
                  <Loader2
                    class="animate-spin text-[var(--travel-teal)]"
                    :size="24"
                  />
                </div>

                <button
                  @click="triggerFileUpload"
                  class="absolute inset-0 bg-slate-900/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Upload :size="20" />
                </button>
              </div>
              <input
                type="file"
                ref="fileInput"
                class="hidden"
                accept="image/*"
                @change="handleFileUpload"
              />
              <div class="flex gap-4">
                <button
                  @click="triggerFileUpload"
                  class="text-xs font-black text-[var(--travel-teal)] uppercase tracking-widest"
                >
                  {{ editForm.avatar ? '更換頭像' : '上傳頭像' }}
                </button>
                <button
                  v-if="editForm.avatar"
                  @click="editForm.avatar = ''"
                  class="text-xs font-black text-red-400 uppercase tracking-widest"
                >
                  移除
                </button>
              </div>
            </div>

            <!-- Name Input -->
            <div class="space-y-2">
              <label
                class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"
                >顯示名稱</label
              >
              <input
                v-model="editForm.name"
                type="text"
                placeholder="旅客姓名"
                class="settings-accent-focus w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 placeholder:text-slate-300 transition-all outline-none"
              />
            </div>

            <!-- Submit Button -->
            <button
              @click="handleUpdateProfile"
              :disabled="isSaving || isUploading"
              class="settings-brand-action w-full text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Loader2 v-if="isSaving" class="animate-spin" :size="18" />
              確認儲存
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<route>
  {
    name: "SettingPage",
  }
</route>

<style scoped>
.settings-primary-action,
.settings-secondary-action,
.settings-danger-action {
  display: flex;
  min-height: 48px;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 16px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 800;
  text-align: center;
}

.settings-primary-action {
  background: var(--travel-teal);
  color: white;
}

.settings-brand-action {
  background: var(--travel-teal);
}

.settings-brand-action:hover:not(:disabled),
.settings-primary-action:hover:not(:disabled) {
  background: var(--travel-ink);
}

.settings-accent-focus:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--travel-coral) 35%, transparent);
}

.settings-secondary-action {
  background: #f1f5f9;
  color: #334155;
}

.settings-danger-action {
  background: #fef2f2;
  color: #dc2626;
}

.settings-primary-action:disabled,
.settings-secondary-action:disabled,
.settings-danger-action:disabled {
  opacity: 0.5;
}

.settings-status-box {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-radius: 16px;
  background: var(--travel-mist);
  padding: 14px 16px;
  font-size: 14px;
  color: #64748b;
}

.settings-status-box strong {
  color: var(--travel-ink);
  text-align: right;
}
</style>
