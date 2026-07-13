<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';
import { uploadImage } from '@/api/storage';
import AdminDataTable from '@/components/admin/AdminDataTable.vue';
import AdminDrawer from '@/components/admin/AdminDrawer.vue';
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  User,
} from 'lucide-vue-next';

const participantsStore = useParticipantsStore();
const tripStore = useTripStore();

const isDrawerOpen = ref(false);
const isUploading = ref(false);
const isSaving = ref(false);
const copiedId = ref(null);
const copiedToken = ref('');
const editingId = ref('');
const fileInput = ref(null);
const tripSearch = ref('');
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
  tripIds: [],
});

const columns = [
  { key: 'member', label: '成員' },
  { key: 'inviteCode', label: '邀請碼' },
  { key: 'trips', label: '參加旅程' },
  { key: 'notification', label: '通知' },
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
  participantsStore.participants.find((participant) => participant.id === editingId.value)
);

const getNotificationTripId = () => appliedSearch.value.tripId || '';

const getPushTokens = (participant, tripId = getNotificationTripId()) => {
  if (!participant) return [];
  const tokens = Array.isArray(participant.pushTokens)
    ? participant.pushTokens
    : participant.pushToken
      ? [{ token: participant.pushToken, tripId }]
      : [];
  return tokens.filter(
    (item) =>
      item?.token &&
      (!tripId || !item.tripId || item.tripId === tripId) &&
      item.permission !== 'denied'
  );
};

const getNotificationStatus = (participant, tripId = getNotificationTripId()) => {
  if (getPushTokens(participant, tripId).length > 0) return 'enabled';
  const preferences = participant?.notificationPreferences || {};
  const tripPreference = tripId ? preferences[tripId] : '';
  const hasDeniedPreference = tripId
    ? tripPreference === 'denied'
    : Object.values(preferences).includes('denied');
  if (hasDeniedPreference) {
    return 'denied';
  }
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

const hasPushEnabled = (participant) => getNotificationStatus(participant) === 'enabled';

const filteredParticipants = computed(() => {
  const filters = appliedSearch.value;
  const keyword = filters.keyword.trim().toLowerCase();

  return participantsStore.participants.filter((participant) => {
    const tripIds = participant.tripIds || [];
    if (filters.tripId && !tripIds.includes(filters.tripId)) return false;

    if (filters.role === 'superAdmin' && !participant.isSuperAdmin) return false;
    if (filters.role === 'admin' && (!participant.isAdmin || participant.isSuperAdmin)) return false;
    if (filters.role === 'member' && (participant.isAdmin || participant.isSuperAdmin)) return false;

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
  form.value = {
    name: '',
    avatar: '',
    isAdmin: false,
    isSuperAdmin: false,
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
    tripIds: [...(participant.tripIds || [])],
  };
  isDrawerOpen.value = true;
};

const closeDrawer = () => {
  isDrawerOpen.value = false;
  resetForm();
};

const copyInviteCode = (code, id) => {
  navigator.clipboard.writeText(code);
  copiedId.value = id;
  setTimeout(() => {
    copiedId.value = null;
  }, 2000);
};

const copyPushToken = async (token) => {
  if (!token) return;
  await navigator.clipboard.writeText(token);
  copiedToken.value = token;
  setTimeout(() => {
    copiedToken.value = '';
  }, 2000);
};

const triggerFileUpload = () => {
  fileInput.value?.click();
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

const saveParticipant = async () => {
  if (!form.value.name.trim()) return alert('請輸入成員名稱');

  isSaving.value = true;
  try {
    const payload = {
      name: form.value.name.trim(),
      avatar: form.value.avatar || '',
      isAdmin: form.value.isAdmin,
      isSuperAdmin: form.value.isSuperAdmin,
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
  <main class="h-full min-h-[620px]">
    <AdminDataTable
      :rows="filteredParticipants"
      :columns="columns"
      :loading="participantsStore.isLoading"
      :search="searchFields"
      :initial-search="appliedSearch"
      empty-text="沒有符合條件的成員"
      @search="applySearch"
      @reset="resetSearch"
      @refresh="refreshParticipants"
    >
      <template #toolbar>
        <button
          @click="openCreateDrawer"
          class="h-10 px-4 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center gap-2 hover:bg-indigo-700"
        >
          <Plus :size="16" />
          新增
        </button>
      </template>

      <template #member="{ row }">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-300 shrink-0">
            <img
              v-if="row.avatar"
              :src="row.avatar"
              class="w-full h-full object-cover"
            />
            <User v-else :size="22" />
          </div>
          <div class="min-w-0">
            <div class="font-black text-slate-900 truncate">{{ row.name }}</div>
            <div class="text-[10px] font-bold text-slate-400 mt-1 truncate">
              {{ row.uid || '尚未綁定 Google' }}
            </div>
          </div>
        </div>
      </template>

      <template #inviteCode="{ row }">
        <button
          @click="copyInviteCode(row.inviteCode, row.id)"
          class="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1"
        >
          <span class="font-mono text-[11px] font-black text-slate-600">{{ row.inviteCode || 'N/A' }}</span>
          <component
            :is="copiedId === row.id ? Check : Copy"
            :size="12"
            :class="copiedId === row.id ? 'text-green-500' : 'text-slate-300'"
          />
        </button>
      </template>

      <template #trips="{ row }">
        <div class="flex flex-wrap gap-2 min-w-[180px]">
          <span
            v-for="tripId in row.tripIds || []"
            :key="tripId"
            class="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-lg"
          >
            {{ tripNameById[tripId] || tripId }}
          </span>
          <span
            v-if="!(row.tripIds || []).length"
            class="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-lg"
          >
            未加入旅程
          </span>
        </div>
      </template>

      <template #notification="{ row }">
        <span
          class="inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-black"
          :class="getNotificationClass(row)"
        >
          {{ getNotificationLabel(row) }}
        </span>
      </template>

      <template #role="{ row }">
        <div class="flex flex-wrap gap-2">
          <span
            v-if="row.isSuperAdmin"
            class="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg"
          >
            Super Admin
          </span>
          <span
            v-else-if="row.isAdmin"
            class="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-lg"
          >
            Admin
          </span>
          <span
            v-else
            class="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg"
          >
            Member
          </span>
        </div>
      </template>

      <template #actions="{ row }">
        <button
          @click="openEditDrawer(row)"
          class="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 inline-flex items-center justify-center"
          title="編輯"
        >
          <Pencil :size="18" />
        </button>
      </template>
    </AdminDataTable>

    <AdminDrawer
      v-model="isDrawerOpen"
      :title="editingId ? '編輯成員' : '新增成員'"
      size="sm"
      :z-index="80"
      @close="closeDrawer"
    >
      <div class="flex h-full min-h-0 flex-col bg-white">
        <div class="flex-1 overflow-y-auto p-5 space-y-6">
            <section class="flex flex-col items-center">
              <div class="w-24 h-24 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-300 relative">
                <img
                  v-if="form.avatar"
                  :src="form.avatar"
                  class="w-full h-full object-cover"
                />
                <User v-else :size="34" />
                <div
                  v-if="isUploading"
                  class="absolute inset-0 bg-white/80 flex items-center justify-center"
                >
                  <Loader2 class="animate-spin text-indigo-500" :size="24" />
                </div>
              </div>
              <input
                ref="fileInput"
                type="file"
                class="hidden"
                accept="image/*"
                @change="handleFileUpload"
              />
              <div class="flex gap-4 mt-3">
                <button @click="triggerFileUpload" class="text-xs font-black text-indigo-600">
                  <Upload :size="14" class="inline mr-1" />
                  {{ form.avatar ? '更換照片' : '上傳照片' }}
                </button>
                <button
                  v-if="form.avatar"
                  @click="form.avatar = ''"
                  class="text-xs font-black text-red-500"
                >
                  移除
                </button>
              </div>
            </section>

            <label class="space-y-1 block">
              <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">成員名稱</span>
              <input v-model="form.name" class="admin-input" placeholder="例如：陳陳" />
            </label>

            <section class="space-y-2">
              <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest">參加旅程</div>
              <input
                v-model="tripSearch"
                class="admin-input"
                placeholder="搜尋旅程名稱、目的地、邀請碼"
              />
              <div class="max-h-72 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-2 space-y-2">
                <button
                  v-for="trip in selectableTrips"
                  :key="trip.id"
                  @click="toggleTrip(trip.id)"
                  class="w-full rounded-xl border p-3 text-left flex items-center justify-between gap-3"
                  :class="form.tripIds.includes(trip.id) ? 'border-indigo-200 bg-indigo-50' : 'border-slate-100 bg-white'"
                >
                  <span class="min-w-0">
                    <span class="block font-black text-sm text-slate-700 truncate">{{ trip.title }}</span>
                    <span class="block text-[10px] font-bold text-slate-400 truncate">
                      {{ trip.destination || '未設定目的地' }} · {{ trip.inviteCode || '未設定邀請碼' }}
                    </span>
                  </span>
                  <span
                    class="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                    :class="form.tripIds.includes(trip.id) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'"
                  >
                    {{ form.tripIds.includes(trip.id) ? '已加入' : '未加入' }}
                  </span>
                </button>
                <div
                  v-if="selectableTrips.length === 0"
                  class="py-8 text-center text-xs font-bold text-slate-400"
                >
                  沒有符合條件的旅程
                </div>
              </div>
            </section>

            <section class="grid grid-cols-2 gap-3">
              <button
                @click="form.isAdmin = !form.isAdmin"
                class="rounded-xl border-2 p-4 text-left"
                :class="form.isAdmin ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-slate-50'"
              >
                <span class="block text-[11px] font-black" :class="form.isAdmin ? 'text-blue-600' : 'text-slate-400'">Admin</span>
                <span class="block text-[10px] font-bold text-slate-400 mt-1">可管理旅程資料</span>
              </button>
              <button
                @click="form.isSuperAdmin = !form.isSuperAdmin"
                class="rounded-xl border-2 p-4 text-left"
                :class="form.isSuperAdmin ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-slate-50'"
              >
                <span class="block text-[11px] font-black" :class="form.isSuperAdmin ? 'text-indigo-600' : 'text-slate-400'">Super Admin</span>
                <span class="block text-[10px] font-bold text-slate-400 mt-1">可管理旅程與成員</span>
              </button>
            </section>

            <section v-if="editingId" class="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h4 class="font-black text-slate-800">推播通知</h4>
                  <p class="text-xs font-bold text-slate-400 mt-1">
                    {{
                      getNotificationStatus(editingParticipant) === 'enabled'
                        ? '此成員已綁定推播 Token'
                        : getNotificationStatus(editingParticipant) === 'denied'
                          ? '此成員已拒絕接收通知'
                          : '此成員尚未啟用推播'
                    }}
                  </p>
                </div>
                <span
                  class="rounded-lg px-2 py-1 text-[10px] font-black"
                  :class="getNotificationClass(editingParticipant)"
                >
                  {{ getNotificationLabel(editingParticipant) }}
                </span>
              </div>

              <div v-if="hasPushEnabled(editingParticipant)" class="space-y-2">
                <div
                  v-for="item in getPushTokens(editingParticipant)"
                  :key="item.token"
                  class="rounded-xl border border-slate-200 bg-white p-3 space-y-2"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-black text-slate-400">
                      {{ item.platform || 'web' }}
                      <span v-if="item.updatedAt"> · {{ new Date(item.updatedAt).toLocaleString() }}</span>
                    </span>
                    <button
                      @click="copyPushToken(item.token)"
                      class="h-8 px-3 rounded-lg bg-slate-50 text-slate-600 text-xs font-black inline-flex items-center gap-1"
                    >
                      <component
                        :is="copiedToken === item.token ? Check : Copy"
                        :size="13"
                        :class="copiedToken === item.token ? 'text-green-500' : 'text-slate-400'"
                      />
                      複製
                    </button>
                  </div>
                  <textarea
                    :value="item.token"
                    readonly
                    rows="3"
                    class="w-full resize-none rounded-lg border border-slate-100 bg-slate-50 p-2 font-mono text-[11px] font-bold text-slate-500 outline-none"
                  ></textarea>
                </div>
              </div>
            </section>

            <section v-if="editingId" class="rounded-2xl border border-red-100 bg-red-50 p-4">
              <h4 class="font-black text-red-700 mb-2">刪除成員</h4>
              <p class="text-xs font-bold text-red-400 leading-relaxed mb-3">
                刪除後這位成員不能再用原邀請碼登入，既有錢包資料不會自動刪除。
              </p>
              <button
                @click="deleteCurrentParticipant"
                class="h-11 w-full rounded-xl bg-white text-red-600 font-black text-sm flex items-center justify-center gap-2"
              >
                <Trash2 :size="16" />
                刪除成員
              </button>
            </section>
        </div>

        <footer class="p-5 border-t border-slate-200 flex justify-end gap-3">
          <button @click="closeDrawer" class="h-11 px-5 rounded-xl bg-slate-50 text-slate-600 font-black text-sm">
            取消
          </button>
          <button
            @click="saveParticipant"
            :disabled="isSaving || isUploading"
            class="h-11 px-5 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50 hover:bg-indigo-700"
          >
            <Loader2 v-if="isSaving" class="animate-spin" :size="16" />
            <Save v-else :size="16" />
            儲存
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

.admin-input:focus {
  border-color: #a5b4fc;
  background: white;
}
</style>

<route>
{
  meta: { layout: "admin" }
}
</route>
