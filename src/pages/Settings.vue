<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/store/userStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { claimParticipantByCode } from '@/api/participants';
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
} from 'lucide-vue-next';

const router = useRouter();
const userStore = useUserStore();
const participantsStore = useParticipantsStore();

const inviteCode = ref('');
const isClaiming = ref(false);
const isRefreshing = ref(false);

// PWA Install Logic
const deferredPrompt = ref(null);
const isStandalone = ref(false);
const isPackingListOpen = ref(false);

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

onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt.value = e;
  });

  isStandalone.value =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone;
});

const handleForceRefresh = () => {
  isRefreshing.value = true;
  // 清除所有快取
  const caches = [
    'jeju_participants_cache',
    'jeju_weather_cache',
    'jeju_travel_cache', // 預留可能有的行程快取
  ];
  caches.forEach((key) => localStorage.removeItem(key));

  // 延遲一下讓使用者看到轉圈動畫，然後重新整理
  setTimeout(() => {
    window.location.reload();
  }, 800);
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

const handleClaim = async (force = false) => {
  if (!inviteCode.value.trim()) return alert('請輸入邀請碼');

  isClaiming.value = true;
  try {
    const res = await claimParticipantByCode(
      inviteCode.value.trim(),
      userStore.user?.uid || null,
      force
    );

    // 處理重複認領的確認
    if (res.status === 409) {
      if (confirm(res.message)) {
        return handleClaim(true); // 使用者確認後，再次呼叫並帶入 force = true
      } else {
        return;
      }
    }

    if (res.status === 200) {
      // 將認領成功的 ID 存入本地持久化
      userStore.setLocalParticipant(res.data.id);

      alert('認領成功！');
      inviteCode.value = '';
      await participantsStore.init();
    }
  } catch (error) {
    alert(error.message);
  } finally {
    isClaiming.value = false;
  }
};

const handleLogout = async () => {
  await userStore.logout();
  router.push('/');
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
        {{ userStore.myParticipant?.name || userStore.user?.email || '旅客' }}
      </h2>
      <p
        class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1"
      >
        {{ userStore.myParticipant ? '已認領旅客身份' : '個人設定與管理' }}
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

    <!-- Invitation Claim Section (Conditional) -->
    <section v-if="!userStore.myParticipant" class="space-y-3">
      <h3
        class="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]"
      >
        認領旅客身份
      </h3>
      <div
        class="bg-white p-6 rounded-[32px] border border-slate-100 space-y-4"
      >
        <p class="text-xs font-bold text-slate-500 leading-relaxed px-1">
          請輸入 6 位邀請碼，以綁定你的旅遊手冊個人資料。
        </p>
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
          {{ isClaiming ? '驗證中...' : '確認認領' }}
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

        <!-- Logout Button -->
        <button
          v-if="userStore.myParticipant"
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
      </div>
    </section>

    <!-- App Info -->
    <div class="text-center pt-8">
      <p
        class="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]"
      >
        濟州小幫手 v1.0.0
      </p>
    </div>

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
