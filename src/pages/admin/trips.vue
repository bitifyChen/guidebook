<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AdminDataTable from '@/components/admin/AdminDataTable.vue';
import { useTripStore } from '@/store/tripStore';
import { useUserStore } from '@/store/userStore';
import {
  Archive,
  CheckCircle2,
  Copy,
  Loader2,
  Pencil,
  Plane,
  Plus,
  Save,
  X,
} from 'lucide-vue-next';
import { lockScroll, unlockScroll } from '@/utils/scrollLock';
import {
  COUNTRY_OPTIONS,
  getCountryOption,
  getDefaultWeatherCity,
  getWeatherCitiesByCountry,
} from '@/constants/tripOptions';

const tripStore = useTripStore();
const userStore = useUserStore();

const isDrawerOpen = ref(false);
const isSaving = ref(false);
const editingId = ref('');
const appliedSearch = ref({
  keyword: '',
  status: '',
  countryCode: '',
});

const form = reactive({
  title: '',
  destination: '',
  countryCode: 'KR',
  latitude: '',
  longitude: '',
  weatherCity: '',
  startDate: '',
  endDate: '',
  inviteCode: '',
});

const columns = [
  { key: 'trip', label: '旅程' },
  { key: 'dates', label: '日期' },
  { key: 'status', label: '狀態' },
  { key: 'inviteCode', label: '邀請碼' },
  { key: 'weather', label: '天氣座標' },
];

const isEditing = computed(() => Boolean(editingId.value));
const selectedCountry = computed(() => getCountryOption(form.countryCode));
const weatherCityOptions = computed(() => getWeatherCitiesByCountry(form.countryCode));
const selectedWeatherCity = computed(() =>
  weatherCityOptions.value.find((item) => item.name === form.weatherCity)
);
const hasUnknownWeatherCity = computed(
  () => form.weatherCity && !selectedWeatherCity.value
);

const searchFields = computed(() => [
  {
    name: 'keyword',
    label: '關鍵字',
    type: 'text',
    placeholder: '旅程、目的地、邀請碼',
  },
  {
    name: 'status',
    label: '狀態',
    type: 'select',
    placeholder: '全部狀態',
    options: [
      { label: '進行中', value: 'active' },
      { label: '已完成', value: 'completed' },
      { label: '已封存', value: 'archived' },
    ],
  },
  {
    name: 'countryCode',
    label: '國家',
    type: 'select',
    placeholder: '全部國家',
    options: COUNTRY_OPTIONS.map((country) => ({
      label: `${country.code} · ${country.name}`,
      value: country.code,
    })),
  },
]);

const filteredTrips = computed(() => {
  const filters = appliedSearch.value;
  const keyword = filters.keyword.trim().toLowerCase();

  return tripStore.trips.filter((trip) => {
    if (filters.status && (trip.status || 'active') !== filters.status) return false;
    if (filters.countryCode && trip.countryCode !== filters.countryCode) return false;
    if (!keyword) return true;

    return [
      trip.title,
      trip.destination,
      trip.country,
      trip.countryCode,
      trip.inviteCode,
      trip.weatherCity,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
});

const applyWeatherCity = (city) => {
  if (!city) return;
  form.weatherCity = city.name;
  form.latitude = city.latitude;
  form.longitude = city.longitude;
};

watch(isDrawerOpen, (value) => {
  if (value) lockScroll();
  else unlockScroll();
});

watch(
  () => form.countryCode,
  (code, oldCode) => {
    if (!oldCode || code === oldCode) return;
    applyWeatherCity(getDefaultWeatherCity(code));
  }
);

watch(
  () => form.weatherCity,
  (cityName) => {
    const city = weatherCityOptions.value.find((item) => item.name === cityName);
    if (city) {
      form.latitude = city.latitude;
      form.longitude = city.longitude;
    }
  }
);

onMounted(async () => {
  await tripStore.init();
  await tripStore.refreshTrips();
});

const resetForm = () => {
  const defaultCountry = COUNTRY_OPTIONS[0];
  const defaultCity = getDefaultWeatherCity(defaultCountry.code);
  editingId.value = '';
  Object.assign(form, {
    title: '',
    destination: '',
    countryCode: defaultCountry.code,
    latitude: defaultCity.latitude,
    longitude: defaultCity.longitude,
    weatherCity: defaultCity.name,
    startDate: '',
    endDate: '',
    inviteCode: '',
  });
};

const openCreateDrawer = () => {
  resetForm();
  isDrawerOpen.value = true;
};

const openEditDrawer = (trip) => {
  const countryCode = trip.countryCode || 'KR';
  const defaultCity = getDefaultWeatherCity(countryCode);
  editingId.value = trip.id;
  Object.assign(form, {
    title: trip.title || '',
    destination: trip.destination || '',
    countryCode,
    latitude: trip.latitude ?? defaultCity.latitude,
    longitude: trip.longitude ?? defaultCity.longitude,
    weatherCity: trip.weatherCity || defaultCity.name,
    startDate: trip.startDate || '',
    endDate: trip.endDate || '',
    inviteCode: trip.inviteCode || '',
  });
  isDrawerOpen.value = true;
};

const closeDrawer = () => {
  isDrawerOpen.value = false;
  resetForm();
};

const buildTripPayload = () => {
  const country = selectedCountry.value;
  return {
    title: form.title.trim(),
    destination: form.destination.trim(),
    country: country.name,
    countryCode: country.code,
    timezone: country.timezone,
    currencyCode: country.currencyCode,
    currencySymbol: country.currencySymbol,
    latitude: form.latitude,
    longitude: form.longitude,
    weatherCity: form.weatherCity,
    startDate: form.startDate,
    endDate: form.endDate,
  };
};

const refreshTrips = async () => {
  await tripStore.refreshTrips();
};

const applySearch = (filters) => {
  appliedSearch.value = {
    keyword: filters.keyword || '',
    status: filters.status || '',
    countryCode: filters.countryCode || '',
  };
};

const resetSearch = () => {
  appliedSearch.value = {
    keyword: '',
    status: '',
    countryCode: '',
  };
};

const saveTrip = async () => {
  if (!form.title.trim()) return alert('請輸入旅程名稱');
  if (!form.weatherCity) return alert('請選擇天氣城市');

  isSaving.value = true;
  try {
    const payload = buildTripPayload();
    const inviteCode = form.inviteCode.trim().toUpperCase();
    if (inviteCode) {
      if (inviteCode.length !== 6) return alert('邀請碼必須為 6 碼');
      payload.inviteCode = inviteCode;
    }

    if (editingId.value) {
      await tripStore.updateTrip(editingId.value, payload);
    } else {
      await tripStore.createTrip({ ...payload, setActive: true });
    }
    closeDrawer();
  } catch (error) {
    alert(error.message);
  } finally {
    isSaving.value = false;
  }
};

const copyCode = async (code) => {
  await navigator.clipboard.writeText(code);
  alert('已複製邀請碼');
};

const getStatusLabel = (status) => {
  if (status === 'completed') return '已完成';
  if (status === 'archived') return '已封存';
  return '進行中';
};

const completeCurrent = async () => {
  if (!editingId.value) return;
  if (!confirm('確定要完成這趟旅程？完成後前台不會再依照當地時間自動切換 Day。')) return;
  await tripStore.complete(editingId.value);
  closeDrawer();
};

const archiveCurrent = async () => {
  if (!editingId.value) return;
  if (!confirm('確定要封存這趟旅程？封存後仍可瀏覽，但不可再編輯。')) return;
  await tripStore.archive(editingId.value);
  closeDrawer();
};
</script>

<template>
  <main class="h-full min-h-[620px]">
    <section
      v-if="!userStore.isSuperAdmin"
      class="bg-white rounded-2xl p-8 text-center border border-slate-200"
    >
      <Plane class="mx-auto text-slate-300 mb-3" :size="40" />
      <p class="font-black text-slate-700">只有 Super Admin 可以管理旅程</p>
    </section>

    <AdminDataTable
      v-else
      :rows="filteredTrips"
      :columns="columns"
      :loading="tripStore.isLoading"
      :search="searchFields"
      :initial-search="appliedSearch"
      empty-text="沒有符合條件的旅程"
      @search="applySearch"
      @reset="resetSearch"
      @refresh="refreshTrips"
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

      <template #trip="{ row }">
        <div class="min-w-[220px]">
          <div class="font-black text-slate-900 truncate">{{ row.title }}</div>
          <div class="text-xs font-bold text-slate-400 mt-1 truncate">
            {{ row.destination || '未設定目的地' }} · {{ row.country || '未設定國家' }}
          </div>
        </div>
      </template>

      <template #dates="{ row }">
        <span class="text-sm font-bold text-slate-500">
          {{ row.startDate || '未設定' }} - {{ row.endDate || '未設定' }}
        </span>
      </template>

      <template #status="{ row }">
        <span
          class="text-[10px] font-black px-2 py-1 rounded-lg"
          :class="{
            'bg-green-100 text-green-700': (row.status || 'active') === 'active',
            'bg-blue-100 text-blue-700': row.status === 'completed',
            'bg-slate-100 text-slate-600': row.status === 'archived',
          }"
        >
          {{ getStatusLabel(row.status || 'active') }}
        </span>
      </template>

      <template #inviteCode="{ row }">
        <button
          @click="copyCode(row.inviteCode)"
          class="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1"
        >
          <span class="font-mono text-[11px] font-black text-slate-600">{{ row.inviteCode }}</span>
          <Copy :size="12" class="text-slate-300" />
        </button>
      </template>

      <template #weather="{ row }">
        <div class="min-w-[180px]">
          <div class="text-sm font-black text-slate-700">{{ row.weatherCity || '未設定' }}</div>
          <div class="text-[10px] font-bold text-slate-400 mt-1">
            {{ row.latitude || '-' }}, {{ row.longitude || '-' }}
          </div>
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

    <Teleport to="body">
      <div v-if="isDrawerOpen" class="fixed inset-0 z-[80] flex justify-end">
        <div class="absolute inset-0 bg-slate-950/40" @click="closeDrawer"></div>
        <aside class="relative h-full w-full max-w-xl bg-white shadow-2xl flex flex-col">
          <header class="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <h3 class="font-black text-slate-900">{{ isEditing ? '編輯旅程' : '新增旅程' }}</h3>
            <button @click="closeDrawer" class="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center">
              <X :size="20" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label class="space-y-1 md:col-span-2">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">旅程名稱</span>
                <input v-model="form.title" class="admin-input" placeholder="例如：北海道之旅" />
              </label>
              <label class="space-y-1">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">目的地</span>
                <input v-model="form.destination" class="admin-input" placeholder="例如：Hokkaido" />
              </label>
              <label class="space-y-1">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">國家代碼</span>
                <select v-model="form.countryCode" class="admin-input">
                  <option
                    v-for="country in COUNTRY_OPTIONS"
                    :key="country.code"
                    :value="country.code"
                  >
                    {{ country.code }} · {{ country.name }}
                  </option>
                </select>
              </label>
              <label class="space-y-1 md:col-span-2">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">天氣城市</span>
                <select v-model="form.weatherCity" class="admin-input">
                  <option
                    v-if="hasUnknownWeatherCity"
                    :value="form.weatherCity"
                  >
                    既有設定 · {{ form.weatherCity }}
                  </option>
                  <option
                    v-for="city in weatherCityOptions"
                    :key="city.name"
                    :value="city.name"
                  >
                    {{ city.label }} · {{ city.name }}
                  </option>
                </select>
              </label>
              <div class="md:col-span-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs font-bold text-slate-500">
                {{ selectedCountry.name }} 會自動寫入時區 {{ selectedCountry.timezone }}、幣別 {{ selectedCountry.currencyCode }} {{ selectedCountry.currencySymbol }}。選擇天氣城市會同步帶入經緯度。
              </div>
              <label class="space-y-1">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">緯度</span>
                <input v-model="form.latitude" type="number" class="admin-input" placeholder="33.5097" />
              </label>
              <label class="space-y-1">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">經度</span>
                <input v-model="form.longitude" type="number" class="admin-input" placeholder="126.5219" />
              </label>
              <label class="space-y-1">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">開始日期</span>
                <input v-model="form.startDate" type="date" class="admin-input" />
              </label>
              <label class="space-y-1">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">結束日期</span>
                <input v-model="form.endDate" type="date" class="admin-input" />
              </label>
              <label class="space-y-1 md:col-span-2">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">旅程邀請碼</span>
                <input v-model="form.inviteCode" maxlength="6" class="admin-input font-mono uppercase" placeholder="空白時自動產生 6 碼" />
              </label>
            </div>

            <section v-if="isEditing" class="rounded-2xl border border-red-100 bg-red-50 p-4 space-y-3">
              <h4 class="font-black text-red-700">旅程狀態</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button @click="completeCurrent" class="h-11 rounded-xl bg-white text-indigo-700 font-black text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 :size="16" />
                  完成旅程
                </button>
                <button @click="archiveCurrent" class="h-11 rounded-xl bg-white text-red-600 font-black text-sm flex items-center justify-center gap-2">
                  <Archive :size="16" />
                  封存旅程
                </button>
              </div>
            </section>
          </div>

          <footer class="p-5 border-t border-slate-200 flex justify-end gap-3">
            <button @click="closeDrawer" class="h-11 px-5 rounded-xl bg-slate-50 text-slate-600 font-black text-sm">
              取消
            </button>
            <button
              @click="saveTrip"
              :disabled="isSaving"
              class="h-11 px-5 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50 hover:bg-indigo-700"
            >
              <Loader2 v-if="isSaving" class="animate-spin" :size="16" />
              <Save v-else :size="16" />
              儲存
            </button>
          </footer>
        </aside>
      </div>
    </Teleport>
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
