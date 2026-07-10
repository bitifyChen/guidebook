<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/store/userStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';
import { useTravelStore } from '@/store/travelStore';
import { useExpensesStore } from '@/store/expensesStore';
import {
  getParticipantsByUid,
  upsertParticipantPushToken,
} from '@/api/participants';
import { getTripById } from '@/api/trips';
import { loginWithGoogle } from '@/api/auth';
import { uploadImage } from '@/api/storage';
import { lockScroll, unlockScroll } from '@/utils/scrollLock';
import PackingList from '@/components/PackingList.vue';
import {
  ShieldCheck,
  ChevronRight,
  Settings as SettingsIcon,
  LogOut,
  User,
  Ticket,
  Loader2,
  CheckCircle2,
  Pencil,
  X,
  Upload,
  RefreshCw,
  LayoutDashboard,
  Download,
  Luggage,
  Bell,
} from 'lucide-vue-next';
import { getFCMToken } from '@/firebase/index';

const router = useRouter();
const userStore = useUserStore();
const participantsStore = useParticipantsStore();
const tripStore = useTripStore();
const travelStore = useTravelStore();
const expensesStore = useExpensesStore();

const inviteCode = ref('');
const isClaiming = ref(false);
const isRefreshing = ref(false);
const userTrips = ref([]);
const isLoadingUserTrips = ref(false);
const isTripPickerOpen = ref(false);
const isGoogleLoggingIn = ref(false);
const pendingTripSelection = ref(null);
const tripPickerHint = ref('');

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

// PWA Install Logic
const deferredPrompt = ref(null);
const isStandalone = ref(false);
const isPackingListOpen = ref(false);

// FCM 推播相關狀態
const notificationPermission = ref('default');
const fcmToken = ref('');
const isGettingToken = ref(false);
const isIOS = ref(false);
const PUSH_TOKEN_STORAGE_KEY = 'guidebook_fcm_token';

const getNotificationPromptKey = () => {
  const participantId = userStore.myParticipant?.id || userStore.localParticipantId;
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

const reloadTripData = async () => {
  await participantsStore.init();
  await travelStore.init();
  await expensesStore.init();
};

const clearTripCaches = () => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith('guidebook_') && key.endsWith('_cache'))
    .forEach((key) => localStorage.removeItem(key));
};

const loadUserTrips = async () => {
  if (!userStore.user?.uid) {
    userTrips.value = [];
    tripPickerHint.value = '';
    return;
  }

  isLoadingUserTrips.value = true;
  try {
    const memberships = await getParticipantsByUid(userStore.user.uid);
    const rows = await Promise.all(
      memberships.flatMap((membership) =>
        (membership.tripIds || (membership.tripId ? [membership.tripId] : []))
          .map(async (tripId) => {
            const trip = await getTripById(tripId);
            return trip ? { trip, participant: membership } : null;
          })
      )
    );
    userTrips.value = rows.filter(Boolean);
    const selectedTrip = userTrips.value.find(
      (row) => row.trip.id === tripStore.currentTripId
    );

    if (!selectedTrip && userTrips.value.length === 1) {
      const message = `只有一個旅程，已自動切換至「${userTrips.value[0].trip.title}」。`;
      await switchUserTrip(userTrips.value[0], { redirect: false });
      alert(message);
      tripPickerHint.value = '';
      return;
    }

    if (!selectedTrip && userTrips.value.length > 1 && !pendingTripSelection.value) {
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
  await reloadTripData();
  isTripPickerOpen.value = false;
  if (options.askNotification !== false) {
    await promptNotificationAfterTripSelection();
  }
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
  await reloadTripData();
  await loadUserTrips();
  isTripPickerOpen.value = false;
  await promptNotificationAfterTripSelection();
  router.push('/');
};

const closeTripPicker = () => {
  isTripPickerOpen.value = false;
  pendingTripSelection.value = null;
  tripPickerHint.value = '';
};

onMounted(async () => {
  if (!userStore.isAuthReady) {
    await userStore.initAuth();
  }
  await loadUserTrips();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt.value = e;
  });

  isStandalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone;

  checkNotificationStatus();
});

const handleForceRefresh = () => {
  isRefreshing.value = true;
  // 清除所有快取
  const caches = [
    'guidebook_participants_cache',
    'guidebook_weather_cache',
    'guidebook_travel_cache',
  ];
  caches.forEach((key) => localStorage.removeItem(key));
  Object.keys(localStorage)
    .filter((key) => key.startsWith('guidebook_') && key.endsWith('_cache'))
    .forEach((key) => localStorage.removeItem(key));

  // 延遲一下讓使用者看到轉圈動畫，然後重新整理
  setTimeout(() => {
    window.location.reload();
  }, 800);
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
        avatar: userStore.myParticipant?.avatar || userStore.user.photoURL || '',
      });
      userStore.setLocalParticipant(userStore.localParticipantId);
    }
    await loadUserTrips();
    if (inviteCode.value.trim()) {
      await handleClaim();
    }
  } catch (error) {
    alert(error.message);
  } finally {
    isGoogleLoggingIn.value = false;
  }
};

// Edit Profile State
const isEditModalOpen = ref(false);
const isUploading = ref(false);
const isSaving = ref(false);

watch(isEditModalOpen, (val) => {
  if (val) {
    lockScroll();
  } else {
    unlockScroll();
  }
});

watch(isTripPickerOpen, (val) => {
  if (val) {
    lockScroll();
  } else {
    unlockScroll();
  }
});
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
    alert('圖片處理失敗：' + error.message);
  } finally {
    isUploading.value = false;
    // 重置 input 讓同一個檔案可以再次觸發 change
    event.target.value = '';
  }
};

const handleUpdateProfile = async () => {
  if (!editForm.value.name.trim()) return alert('請輸入姓名');
  isSaving.value = true;
  try {
    await participantsStore.updateParticipant(
      userStore.myParticipant.id,
      editForm.value
    );
    isEditModalOpen.value = false;
    alert('更新成功！');
  } catch (error) {
    alert('更新失敗：' + error.message);
  } finally {
    isSaving.value = false;
  }
};

const handleClaim = async () => {
  if (!inviteCode.value.trim()) return alert('請輸入邀請碼');

  isClaiming.value = true;
  try {
    const profile = {
      uid: userStore.user?.uid || null,
      name: userStore.user?.displayName || userStore.user?.email || '',
      email: userStore.user?.email || '',
      avatar: userStore.user?.photoURL || '',
    };
    const res = await tripStore.joinByInviteCode(inviteCode.value.trim(), profile);

    if (res.status === 200) {
      if (res.mode === 'guest') {
        userStore.clearLocalParticipant();
        alert('已進入訪客瀏覽模式。');
      } else if (res.participant?.id) {
        userStore.setLocalParticipant(res.participant.id);
        alert('認領成功！');
      }

      inviteCode.value = '';
      clearTripCaches();
      await reloadTripData();
      await loadUserTrips();
      await promptNotificationAfterTripSelection();
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
    alert(error.message);
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
  if (!confirm('確定要離開目前旅程？之後需要重新輸入 6 碼才能瀏覽。')) return;
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
  isIOS.value = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const bindPushTokenToCurrentParticipant = async (token, { silent = false } = {}) => {
  if (!token || !userStore.myParticipant?.id) return false;

  const previousToken = localStorage.getItem(PUSH_TOKEN_STORAGE_KEY) || '';
  const participantTokens = Array.isArray(userStore.myParticipant.pushTokens)
    ? userStore.myParticipant.pushTokens
    : [];
  const alreadyBound = participantTokens.some((item) => item.token === token);

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
    alert('偵測到此裝置的推播 Token 已更新，已重新綁定目前成員。');
  }

  return true;
};

const requestNotificationPermission = async ({ silent = false } = {}) => {
  if (!('Notification' in window)) {
    if (!silent) alert('此瀏覽器不支援通知功能。');
    return;
  }

  if (isIOS.value && !isStandalone.value) {
    if (!silent) {
      alert('iOS 需要先加入主畫面，並從桌面圖示開啟 App 後才能啟用推播。');
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
          alert('推播通知已啟用，並綁定到目前成員。');
        }
      } else {
        if (!silent) {
          alert('取得推播 Token 失敗，請確認 Firebase 設定（特別是 VAPID 金鑰）是否正確。');
        }
      }
    } else if (permission === 'denied') {
      if (!silent) {
        alert('已拒絕通知權限。若要接收推播，請到系統或瀏覽器設定重新開啟通知。');
      }
    }
  } catch (error) {
    console.error('設定通知失敗:', error);
    if (!silent) alert('設定通知失敗: ' + error.message);
  } finally {
    isGettingToken.value = false;
  }
};

const promptNotificationAfterTripSelection = async () => {
  checkNotificationStatus();
  if (!userStore.myParticipant) return;
  if (!('Notification' in window)) return;

  if (notificationPermission.value === 'granted') {
    await requestNotificationPermission({ silent: true });
    return;
  }

  if (notificationPermission.value !== 'default') return;
  if (isIOS.value && !isStandalone.value) return;

  const promptKey = getNotificationPromptKey();
  if (!promptKey || localStorage.getItem(promptKey)) return;

  localStorage.setItem(promptKey, '1');
  if (confirm('是否允許接收此旅程的推播通知？')) {
    await requestNotificationPermission();
  }
};

const copyFCMToken = async () => {
  try {
    await navigator.clipboard.writeText(fcmToken.value);
    alert('FCM Token 已複製到剪貼簿！');
  } catch (err) {
    const input = document.createElement('input');
    input.value = fcmToken.value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    alert('FCM Token 已複製到剪貼簿！');
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
        {{ userStore.myParticipant ? '已綁定旅客身份' : userStore.user ? '已登入 Google' : '旅程設定與登入' }}
      </p>
      <p
        v-if="tripStore.currentTrip"
        class="text-xs font-bold text-indigo-500 mt-2"
      >
        目前旅程：{{ tripStore.currentTrip.title }}
      </p>

      <!-- Edit Profile Button -->
      <button
        v-if="userStore.myParticipant"
        @click="openEditModal"
        class="absolute top-6 right-6 w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-purple-50 hover:text-purple-500 transition-colors border border-slate-100"
      >
        <Pencil :size="18" />
      </button>
    </header>

    <section v-if="userTrips.length || isLoadingUserTrips" class="space-y-3">
      <h3
        class="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"
      >
        我的旅程
      </h3>
      <div class="bg-white rounded-[32px] border border-slate-100 overflow-hidden">
        <button
          @click="isTripPickerOpen = true"
          class="w-full p-5 flex items-center gap-4 hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-b-0 text-left"
        >
          <div
            class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center font-black"
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
          v-if="isLoadingUserTrips"
          class="p-5 flex items-center justify-center text-slate-300"
        >
          <Loader2 class="animate-spin" :size="18" />
        </div>
      </div>
    </section>

    <!-- Trip Access Section -->
    <section class="space-y-3">
      <h3
        class="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"
      >
        {{ userStore.user ? '加入旅程' : '選擇登入方式' }}
      </h3>
      <div
        class="bg-white p-6 rounded-[32px] border border-slate-100 space-y-4"
      >
        <p class="text-xs font-bold text-slate-500 leading-relaxed px-1">
          可用 Google 登入管理自己的旅程，也可輸入旅程邀請碼以訪客模式瀏覽；輸入旅客邀請碼會綁定個人資料與角色。
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
            placeholder="輸入 6 位邀請碼"
            class="w-full bg-slate-50 border-none rounded-2xl p-4 pr-12 font-mono font-black text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
            maxlength="6"
          />
          <div class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
            <Ticket :size="20" />
          </div>
        </div>
        <button
          @click="handleClaim"
          :disabled="isClaiming || !inviteCode"
          class="w-full bg-purple-500 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 hover:bg-purple-600 disabled:opacity-50 transition-all shadow-lg shadow-purple-100"
        >
          <Loader2 v-if="isClaiming" class="animate-spin" :size="18" />
          {{ isClaiming ? '驗證中...' : userStore.user ? '綁定 / 加入旅程' : '以邀請碼進入' }}
        </button>
      </div>
    </section>

    <!-- General Settings -->
    <section class="space-y-3">
      <h3
        class="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"
      >
        一般設定
      </h3>
      <div
        class="bg-white rounded-[40px] border border-slate-100 overflow-hidden"
      >
        <!-- Admin Access (Visible only to Super Admin) -->
        <button
          v-if="
            userStore?.myParticipant?.isSuperAdmin ||
            userStore?.myParticipant?.isAdmin
          "
          @click="router.push('/admin')"
          class="w-full p-6 flex items-center gap-4 hover:bg-indigo-50 transition-colors group border-b border-slate-50"
        >
          <div
            class="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform"
          >
            <ShieldCheck :size="20" />
          </div>
          <span class="font-bold text-slate-700 flex-1 text-left"
            >管理後台</span
          >
          <ChevronRight :size="20" class="text-slate-200" />
        </button>

        <!-- Packing List Button -->
        <button
          @click="isPackingListOpen = true"
          class="w-full p-6 flex items-center gap-4 hover:bg-lime-50 transition-colors group border-b border-slate-50"
        >
          <div
            class="w-10 h-10 bg-lime-50 rounded-xl flex items-center justify-center text-lime-600 group-hover:scale-110 transition-transform"
          >
            <Luggage :size="20" />
          </div>
          <div class="flex-1 text-left">
            <span class="block font-bold text-slate-700">行李準備清單</span>
            <span
              class="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5"
              >檢查必備物品與證件</span
            >
          </div>
          <ChevronRight :size="20" class="text-slate-200" />
        </button>

        <!-- Force Refresh Button -->
        <button
          @click="handleForceRefresh"
          :disabled="isRefreshing"
          class="w-full p-6 flex items-center gap-4 hover:bg-blue-50 transition-colors group border-b border-slate-50 disabled:opacity-50"
        >
          <div
            class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"
          >
            <RefreshCw :size="20" :class="{ 'animate-spin': isRefreshing }" />
          </div>
          <div class="flex-1 text-left">
            <span class="block font-bold text-slate-700">強制刷新資料</span>
            <span
              class="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5"
              >清除快取並重新載入</span
            >
          </div>
          <ChevronRight :size="20" class="text-slate-200" />
        </button>

        <!-- Install PWA Button (Only show if not in standalone mode) -->
        <button
          v-if="!isStandalone"
          @click="handleInstallClick"
          class="w-full p-6 flex items-center gap-4 hover:bg-orange-50 transition-colors group border-b border-slate-50"
        >
          <div
            class="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform"
          >
            <Download :size="20" />
          </div>
          <div class="flex-1 text-left">
            <span class="block font-bold text-slate-700">安裝到手機桌面</span>
            <span
              class="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5"
              >像 App 一樣快速開啟</span
            >
          </div>
          <ChevronRight :size="20" class="text-slate-200" />
        </button>

        <!-- Push Notification Settings -->
        <div v-if="userStore.myParticipant" class="w-full p-6 border-b border-slate-50">
          <div class="flex items-center gap-4 text-left">
            <div
              class="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500"
            >
              <Bell :size="20" />
            </div>
            <div class="flex-1 min-w-0">
              <span class="block font-bold text-slate-700">推播通知</span>
              <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                權限狀態: 
                <span :class="{
                  'text-green-500': notificationPermission === 'granted',
                  'text-red-500': notificationPermission === 'denied',
                  'text-amber-500': notificationPermission === 'default'
                }">
                  {{ notificationPermission === 'granted' ? '已允許' : notificationPermission === 'denied' ? '已拒絕' : '未設定' }}
                </span>
              </span>
            </div>
            
            <button
              v-if="notificationPermission !== 'granted'"
              @click="requestNotificationPermission"
              :disabled="isGettingToken"
              class="bg-purple-500 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-purple-600 disabled:opacity-50 transition-colors flex items-center shrink-0"
            >
              <Loader2 v-if="isGettingToken" class="animate-spin mr-1" :size="12" />
              啟用通知
            </button>
            <button
              v-else-if="!fcmToken"
              @click="requestNotificationPermission"
              :disabled="isGettingToken"
              class="bg-indigo-500 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-colors flex items-center shrink-0"
            >
              <Loader2 v-if="isGettingToken" class="animate-spin mr-1" :size="12" />
              取得 Token
            </button>
            <button
              v-else
              @click="copyFCMToken"
              class="bg-green-500 text-white text-xs font-black px-4 py-2 rounded-xl hover:bg-green-600 transition-colors shrink-0"
            >
              複製 Token
            </button>
          </div>
          
          <!-- iOS Standalone 警告說明 -->
          <div v-if="isIOS && !isStandalone" class="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] text-amber-800 font-bold leading-relaxed text-left">
            💡 iOS 系統限制：請先點擊 Safari 下方的「分享」圖示，選擇「加入主畫面」，然後從手機桌面啟動此 PWA 應用程式，才能啟用並接收推播通知。
          </div>
          
          <!-- Token 顯示與手動發送提示 -->
          <div v-if="fcmToken" class="mt-4 p-4 bg-slate-50 rounded-2xl text-xs space-y-2 border border-slate-100 text-left">
            <div class="font-black text-slate-700">您的推播 Token：</div>
            <div class="font-mono bg-white p-2 rounded-xl border border-slate-200 break-all select-all text-slate-500">
              {{ fcmToken }}
            </div>
            <div class="text-[10px] text-slate-400 leading-normal">
              提示：您可以複製上述 Token，搭配你的 Firebase 專案憑證，從電腦執行手動推送測試。
            </div>
          </div>
        </div>

        <!-- Logout Button -->
        <button
          v-if="userStore.user || userStore.myParticipant"
          @click="handleLogout"
          class="w-full p-6 flex items-center gap-4 hover:bg-red-50 transition-colors group"
        >
          <div
            class="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform"
          >
            <LogOut :size="20" />
          </div>
          <span class="font-bold text-red-500 flex-1 text-left">登出帳號</span>
          <ChevronRight :size="20" class="text-red-200" />
        </button>

        <button
          v-else-if="tripStore.currentTripId"
          @click="leaveCurrentTrip"
          class="w-full p-6 flex items-center gap-4 hover:bg-red-50 transition-colors group"
        >
          <div
            class="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform"
          >
            <LogOut :size="20" />
          </div>
          <span class="font-bold text-red-500 flex-1 text-left">離開目前旅程</span>
          <ChevronRight :size="20" class="text-red-200" />
        </button>
      </div>
    </section>

    <!-- App Info -->
    <div class="text-center pt-8">
      <p
        class="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]"
      >
        Guidebook v1.0.0
      </p>
    </div>

    <Teleport to="body">
      <div
        v-if="isTripPickerOpen"
        class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          @click="closeTripPicker"
        ></div>
        <div
          class="relative w-full max-w-md bg-white rounded-[36px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
        >
          <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 class="text-lg font-black text-slate-800">
                {{ pendingTripSelection ? '選擇要綁定的旅程' : '選擇旅程' }}
              </h3>
              <p class="text-[10px] font-bold text-slate-400 mt-1">
                {{
                  tripPickerHint ||
                  (pendingTripSelection
                    ? '這個旅客碼可加入多趟旅程'
                    : '切換後會重新載入本次旅程資料')
                }}
              </p>
            </div>
            <button
              @click="closeTripPicker"
              class="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"
            >
              <X :size="18" />
            </button>
          </div>

          <div class="max-h-[60vh] overflow-y-auto p-3">
            <button
              v-for="row in tripPickerRows"
              :key="`${row.participant.id}-${row.trip.id}`"
              @click="selectTripFromPicker(row)"
              class="w-full p-4 rounded-2xl flex items-center gap-4 hover:bg-indigo-50 transition-colors text-left"
              :class="row.trip.id === tripStore.currentTripId ? 'bg-indigo-50' : ''"
            >
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center font-black"
                :class="
                  row.trip.id === tripStore.currentTripId
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-50 text-slate-400'
                "
              >
                {{ row.trip.title?.slice(0, 1) || '旅' }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-black text-slate-800 truncate">
                  {{ row.trip.title }}
                </div>
                <div class="text-[10px] font-bold text-slate-400 mt-0.5">
                  {{ row.trip.inviteCode }} · {{ row.participant.name }}
                </div>
              </div>
              <CheckCircle2
                v-if="row.trip.id === tripStore.currentTripId"
                :size="18"
                class="text-indigo-500"
              />
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Packing List Drawer -->
    <PackingList v-model:visible="isPackingListOpen" />

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
                  <Loader2 class="animate-spin text-purple-500" :size="24" />
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
                  class="text-xs font-black text-purple-500 uppercase tracking-widest"
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
                class="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
              />
            </div>

            <!-- Submit Button -->
            <button
              @click="handleUpdateProfile"
              :disabled="isSaving || isUploading"
              class="w-full bg-slate-800 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-200"
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
