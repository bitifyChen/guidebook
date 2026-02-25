<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useParticipantsStore } from '@/store/participantsStore';
import { uploadImage } from '@/api/storage';
import {
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Upload,
  X,
  Loader2,
  User,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-vue-next';

const router = useRouter();
const participantsStore = useParticipantsStore();

const isModalOpen = ref(false);
const isUploading = ref(false);
const isSaving = ref(false);
const isSyncing = ref(false);
const copiedId = ref(null);
const editingId = ref(null);
const form = ref({
  name: '',
  avatar: '',
  isAdmin: false,
  isSuperAdmin: false,
});

onMounted(() => {
  participantsStore.init();
});

const copyInviteCode = (code, id) => {
  navigator.clipboard.writeText(code);
  copiedId.value = id;
  setTimeout(() => {
    copiedId.value = null;
  }, 2000);
};

const handleSync = async () => {
  if (!confirm('將檢查所有記帳資料並移除無效的旅客 ID，確定要執行嗎？')) return;
  
  isSyncing.value = true;
  try {
    const result = await participantsStore.syncWalletParticipants();
    alert(`同步完成！\n刪除無效支出：${result.deleteCount} 筆\n更新分帳名單：${result.updateCount} 筆`);
  } catch (error) {
    alert('同步失敗：' + error.message);
  } finally {
    isSyncing.value = false;
  }
};

const openAddModal = () => {
  editingId.value = null;
  form.value = { name: '', avatar: '', isAdmin: false, isSuperAdmin: false };
  isModalOpen.value = true;
};

const openEditModal = (participant) => {
  editingId.value = participant.id;
  form.value = { 
    name: participant.name,
    avatar: participant.avatar,
    isAdmin: participant.isAdmin || false,
    isSuperAdmin: participant.isSuperAdmin || false,
  };
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
};

const fileInput = ref(null);
const triggerFileUpload = () => {
  fileInput.value.click();
};

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isUploading.value = true;
  try {
    const url = await uploadImage(file);
    form.value.avatar = url;
  } catch (error) {
    alert('圖片上傳失敗：' + error.message);
  } finally {
    isUploading.value = false;
    // 重置 input 讓同一個檔案可以再次觸發 change
    event.target.value = '';
  }
};

const handleSubmit = async () => {
  if (!form.value.name.trim()) return alert('請輸入姓名');

  isSaving.value = true;
  try {
    const data = {
      name: form.value.name,
      avatar: form.value.avatar || '',
      isAdmin: form.value.isAdmin,
      isSuperAdmin: form.value.isSuperAdmin,
    };
    if (editingId.value) {
      await participantsStore.updateParticipant(editingId.value, data);
    } else {
      await participantsStore.addParticipant(data);
    }
    closeModal();
  } catch (error) {
    alert('儲存失敗：' + error.message);
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = async (id) => {
  if (!confirm('確定要刪除這位旅客嗎？')) return;
  try {
    await participantsStore.removeParticipant(id);
  } catch (error) {
    alert('刪除失敗：' + error.message);
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
    <!-- Header -->
    <nav
      class="p-6 sticky top-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between"
    >
      <button
        @click="router.push('/admin')"
        class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"
      >
        <ChevronLeft :size="20" />
      </button>
      <h2 class="font-black text-slate-800 text-lg">旅客名單管理</h2>
      <div class="flex gap-2">
        <button
          @click="handleSync"
          :disabled="isSyncing"
          class="w-10 h-10 bg-white text-slate-400 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 hover:text-blue-500 disabled:opacity-50"
          title="同步記帳資料"
        >
          <RefreshCw :size="20" :class="{ 'animate-spin': isSyncing }" />
        </button>
        <button
          @click="openAddModal"
          class="w-10 h-10 bg-purple-500 text-white rounded-2xl flex items-center justify-center shadow-sm"
        >
          <Plus :size="20" />
        </button>
      </div>
    </nav>

    <!-- Content -->
    <main class="max-w-4xl mx-auto p-6">
      <div v-if="participantsStore.isLoading" class="flex justify-center py-12">
        <Loader2 class="animate-spin text-slate-300" :size="32" />
      </div>

      <div v-else class="grid gap-4">
        <div
          v-for="p in participantsStore.participants"
          :key="p.id"
          class="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4"
        >
          <div
            class="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden border border-slate-50 flex-shrink-0"
          >
            <img
              v-if="p.avatar"
              :src="p.avatar"
              class="w-full h-full object-cover"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center text-slate-300"
            >
              <User :size="24" />
            </div>
          </div>

          <div class="flex-1">
            <div class="flex items-center gap-2">
              <div class="font-black text-slate-800 text-lg">{{ p.name }}</div>
              <div v-if="p.isSuperAdmin" class="bg-indigo-500 text-[8px] font-black text-white px-1.5 py-0.5 rounded-md uppercase tracking-tighter">Super Admin</div>
              <div v-else-if="p.isAdmin" class="bg-blue-500 text-[8px] font-black text-white px-1.5 py-0.5 rounded-md uppercase tracking-tighter">Admin</div>
            </div>
            <div 
              @click="copyInviteCode(p.inviteCode, p.id)"
              class="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors mt-1"
            >
              <span class="text-[10px] font-mono font-bold text-slate-400">INVITE:</span>
              <span class="text-[10px] font-mono font-black text-slate-600">{{ p.inviteCode || 'N/A' }}</span>
              <component :is="copiedId === p.id ? Check : Copy" :size="10" :class="copiedId === p.id ? 'text-green-500' : 'text-slate-300'" />
            </div>
          </div>

          <div class="flex gap-2">
            <button
              @click="openEditModal(p)"
              class="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-purple-50 hover:text-purple-500 transition-colors"
            >
              <Pencil :size="18" />
            </button>
            <button
              @click="handleDelete(p.id)"
              class="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <Trash2 :size="18" />
            </button>
          </div>
        </div>

        <div
          v-if="participantsStore.participants.length === 0"
          class="text-center py-20 bg-white rounded-[40px] border border-dashed border-slate-200"
        >
          <div
            class="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto text-slate-200 mb-4"
          >
            <User :size="32" />
          </div>
          <p class="text-sm font-bold text-slate-400">目前還沒有旅客名單</p>
        </div>
      </div>
    </main>

    <!-- Modal -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
    >
      <div
        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        @click="closeModal"
      ></div>

      <div
        class="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300"
      >
        <div class="p-8">
          <div class="flex justify-between items-center mb-8">
            <h3 class="text-xl font-black text-slate-800">
              {{ editingId ? '編輯旅客' : '新增旅客' }}
            </h3>
            <button
              @click="closeModal"
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
                  v-if="form.avatar"
                  :src="form.avatar"
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
                  {{ form.avatar ? '更換頭像' : '上傳頭像' }}
                </button>
                <button
                  v-if="form.avatar"
                  @click="form.avatar = ''"
                  class="text-xs font-black text-red-400 uppercase tracking-widest"
                >
                  移除
                </button>
              </div>
            </div>

            <!-- Name Input -->
            <div class="space-y-2">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">旅客姓名</label>
              <input
                v-model="form.name"
                type="text"
                placeholder="例如：小明"
                class="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none"
              />
            </div>

            <!-- Permissions -->
            <div class="grid grid-cols-2 gap-4">
              <div 
                @click="form.isAdmin = !form.isAdmin"
                class="p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-1"
                :class="form.isAdmin ? 'border-blue-500 bg-blue-50' : 'border-slate-50 bg-slate-50'"
              >
                <span class="text-[10px] font-black uppercase tracking-widest" :class="form.isAdmin ? 'text-blue-500' : 'text-slate-400'">Admin</span>
                <span class="text-[8px] font-bold" :class="form.isAdmin ? 'text-blue-400' : 'text-slate-300'">擁有管理權限</span>
              </div>
              <div 
                @click="form.isSuperAdmin = !form.isSuperAdmin"
                class="p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-1"
                :class="form.isSuperAdmin ? 'border-indigo-500 bg-indigo-50' : 'border-slate-50 bg-slate-50'"
              >
                <span class="text-[10px] font-black uppercase tracking-widest" :class="form.isSuperAdmin ? 'text-indigo-500' : 'text-slate-400'">Super Admin</span>
                <span class="text-[8px] font-bold" :class="form.isSuperAdmin ? 'text-indigo-400' : 'text-slate-300'">擁有系統權限</span>
              </div>
            </div>

            <!-- Submit Button -->
            <button
              @click="handleSubmit"
              :disabled="isSaving || isUploading"
              class="w-full bg-slate-800 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-200"
            >
              <Loader2 v-if="isSaving" class="animate-spin" :size="18" />
              {{ editingId ? '儲存變更' : '確認新增' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<route>
{
  meta: { layout: "empty" }
}
</route>
