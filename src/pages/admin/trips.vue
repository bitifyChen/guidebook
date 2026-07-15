<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AdminDataTable from '@/components/admin/AdminDataTable.vue';
import AdminDrawer from '@/components/admin/AdminDrawer.vue';
import AdminItinerary from '@/pages/admin/itinerary.vue';
import AdminConfig from '@/pages/admin/config.vue';
import { useTripStore } from '@/store/tripStore';
import { useUserStore } from '@/store/userStore';
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Copy,
  Loader2,
  Pencil,
  Plane,
  Plus,
  Save,
  Settings,
} from 'lucide-vue-next';
import {
  ensureTripDayConfigsForDateRange,
  getTripDayConfigSyncPreview,
} from '@/api/trips';
import {
  COUNTRY_OPTIONS,
  getCountryOption,
  getDefaultWeatherCity,
  getWeatherCitiesByCountry,
} from '@/constants/tripOptions';

const tripStore = useTripStore();
const userStore = useUserStore();

const isDrawerOpen = ref(false);
const toolDrawer = ref({
  open: false,
  type: '',
  title: '',
});
const isSaving = ref(false);
const editingId = ref('');
const originalDateRange = ref({
  startDate: '',
  endDate: '',
});
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
  publicCode: '',
  inviteCode: '',
});

const columns = [
  { key: 'trip', label: '旅程' },
  { key: 'dates', label: '日期' },
  { key: 'status', label: '狀態' },
  { key: 'publicCode', label: '公開碼' },
  { key: 'inviteCode', label: '加入碼' },
  { key: 'weather', label: '天氣座標' },
];

const isEditing = computed(() => Boolean(editingId.value));
const activeToolComponent = computed(() => {
  if (toolDrawer.value.type === 'itinerary') return AdminItinerary;
  if (toolDrawer.value.type === 'config') return AdminConfig;
  return null;
});
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
    placeholder: '旅程、目的地、公開碼、加入碼',
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
      trip.publicCode,
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
  originalDateRange.value = {
    startDate: '',
    endDate: '',
  };
  Object.assign(form, {
    title: '',
    destination: '',
    countryCode: defaultCountry.code,
    latitude: defaultCity.latitude,
    longitude: defaultCity.longitude,
    weatherCity: defaultCity.name,
    startDate: '',
    endDate: '',
    publicCode: '',
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
  originalDateRange.value = {
    startDate: trip.startDate || '',
    endDate: trip.endDate || '',
  };
  Object.assign(form, {
    title: trip.title || '',
    destination: trip.destination || '',
    countryCode,
    latitude: trip.latitude ?? defaultCity.latitude,
    longitude: trip.longitude ?? defaultCity.longitude,
    weatherCity: trip.weatherCity || defaultCity.name,
    startDate: trip.startDate || '',
    endDate: trip.endDate || '',
    publicCode: trip.publicCode || '',
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

const maybeSyncDayConfigs = async (tripId, payload) => {
  const dateChanged =
    payload.startDate !== originalDateRange.value.startDate ||
    payload.endDate !== originalDateRange.value.endDate;
  if (!tripId || !dateChanged) return;

  const preview = await getTripDayConfigSyncPreview(tripId, {
    startDate: payload.startDate,
    endDate: payload.endDate,
  });
  if (!preview?.changed) return;

  const details = [
    `目前每日設定：${preview.currentDays} 天`,
    `旅程日期區間：${preview.targetDays} 天`,
  ];
  if (preview.addCount > 0) details.push(`將補足：${preview.addCount} 天`);
  if (preview.removeCount > 0) details.push(`將刪除超出：${preview.removeCount} 天`);

  const shouldSync = confirm(
    `旅程起訖日期已變更，是否同步調整每日設定？\n\n${details.join('\n')}`
  );
  if (!shouldSync) return;

  await ensureTripDayConfigsForDateRange(
    tripId,
    {
      startDate: payload.startDate,
      endDate: payload.endDate,
    },
    { pruneExcess: true }
  );
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
    const publicCode = form.publicCode.trim().toUpperCase();
    if (publicCode) {
      if (publicCode.length !== 6) return alert('公開瀏覽碼必須為 6 碼');
      payload.publicCode = publicCode;
    }
    const inviteCode = form.inviteCode.trim().toUpperCase();
    if (inviteCode) {
      if (inviteCode.length !== 6) return alert('邀請碼必須為 6 碼');
      payload.inviteCode = inviteCode;
    }

    if (editingId.value) {
      await tripStore.updateTrip(editingId.value, payload);
      await maybeSyncDayConfigs(editingId.value, payload);
      await tripStore.refreshTrips();
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

const openTripToolDrawer = async (trip, type) => {
  if (trip?.id && trip.id !== tripStore.currentTripId) {
    await tripStore.switchTrip(trip.id);
  }
  toolDrawer.value = {
    open: true,
    type,
    title: type === 'itinerary' ? '行程管理' : '每日設定',
  };
};

const closeToolDrawer = () => {
  toolDrawer.value = {
    open: false,
    type: '',
    title: '',
  };
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
  <main class="h-full min-h-[calc(100dvh-180px)] md:min-h-[620px]">
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
        <div class="min-w-0 sm:min-w-[220px]">
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

      <template #publicCode="{ row }">
        <button
          v-if="row.publicCode"
          @click="copyCode(row.publicCode)"
          class="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1"
        >
          <span class="font-mono text-[11px] font-black text-slate-600">{{ row.publicCode }}</span>
          <Copy :size="12" class="text-slate-300" />
        </button>
        <span v-else class="text-xs font-bold text-slate-300">未建立</span>
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
        <div class="min-w-0 sm:min-w-[180px]">
          <div class="text-sm font-black text-slate-700">{{ row.weatherCity || '未設定' }}</div>
          <div class="text-[10px] font-bold text-slate-400 mt-1">
            {{ row.latitude || '-' }}, {{ row.longitude || '-' }}
          </div>
        </div>
      </template>

      <template #actions="{ row }">
        <div class="inline-flex items-center justify-end gap-2">
          <button
            @click="openTripToolDrawer(row, 'itinerary')"
            class="h-10 px-3 rounded-xl bg-slate-50 text-slate-600 inline-flex items-center justify-center gap-1.5 text-xs font-black hover:bg-indigo-50 hover:text-indigo-600"
            title="行程管理"
          >
            <CalendarDays :size="16" />
            行程
          </button>
          <button
            @click="openTripToolDrawer(row, 'config')"
            class="h-10 px-3 rounded-xl bg-slate-50 text-slate-600 inline-flex items-center justify-center gap-1.5 text-xs font-black hover:bg-indigo-50 hover:text-indigo-600"
            title="每日設定"
          >
            <Settings :size="16" />
            每日
          </button>
          <button
            @click="openEditDrawer(row)"
            class="h-10 px-3 rounded-xl bg-slate-50 text-slate-600 inline-flex items-center justify-center gap-1.5 text-xs font-black hover:bg-indigo-50 hover:text-indigo-600"
            title="基本資料"
          >
            <Pencil :size="16" />
            基本
          </button>
        </div>
      </template>
    </AdminDataTable>

    <AdminDrawer
      v-model="toolDrawer.open"
      :title="toolDrawer.title"
      :subtitle="tripStore.currentTrip?.title || '目前旅程'"
      size="lg"
      :z-index="80"
      @close="closeToolDrawer"
    >
      <div class="h-full min-h-0 overflow-y-auto">
        <component
          :is="activeToolComponent"
          v-if="activeToolComponent"
          embedded
        />
      </div>
    </AdminDrawer>

    <AdminDrawer
      v-model="isDrawerOpen"
      :title="isEditing ? '編輯旅程' : '新增旅程'"
      size="md"
      :z-index="80"
      @close="closeDrawer"
    >
      <div class="flex h-full min-h-0 flex-col bg-white">
        <div class="flex-1 overflow-y-auto p-4 space-y-4 sm:p-5">
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
              <label class="space-y-1">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">公開瀏覽碼</span>
                <input v-model="form.publicCode" maxlength="6" class="admin-input font-mono uppercase" placeholder="空白時自動產生 6 碼" />
              </label>
              <label class="space-y-1">
                <span class="text-[11px] font-black text-slate-400 uppercase tracking-widest">加入旅程碼</span>
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

        <footer class="admin-drawer-footer flex justify-end gap-3 border-t border-slate-200 p-5">
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
