<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AdminItinerary from '@/components/admin/itinerary/AdminItineraryWorkspace.vue';
import AdminConfig from '@/components/admin/config/AdminConfigWorkspace.vue';
import AdminTripPackingDrawer from '@/components/admin/trip/AdminTripPackingDrawer.vue';
import AdminTripTable from '@/components/admin/trip/AdminTripTable.vue';
import AdminTripWorkspaceDrawer from '@/components/admin/trip/AdminTripWorkspaceDrawer.vue';
import AdminTripManagerDrawer from '@/components/admin/trip/AdminTripManagerDrawer.vue';
import AdminTripFormDrawer from '@/components/admin/trip/AdminTripFormDrawer.vue';
import { ensurePackingCatalog } from '@/api/packing';
import { useTripStore } from '@/store/tripStore';
import { useUserStore } from '@/store/userStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { Plane } from 'lucide-vue-next';
import {
  ensureTripDayConfigsForDateRange,
  getTripDayConfigSyncPreview,
} from '@/api/trips';
import { sendItinerarySyncSignal } from '@/api/notifications';
import {
  COUNTRY_OPTIONS,
  getCountryOption,
  getDefaultWeatherCity,
  getWeatherCitiesByCountry,
} from '@/constants/tripOptions';

const tripStore = useTripStore();
const userStore = useUserStore();
const participantsStore = useParticipantsStore();

const isDrawerOpen = ref(false);
const toolDrawer = ref({
  open: false,
  type: '',
  title: '',
});
const isSaving = ref(false);
const managerDrawer = ref({
  open: false,
  trip: null,
  selectedIds: [],
  keyword: '',
  isSaving: false,
});
const packingCatalog = ref([]);
const packingDrawer = ref({
  open: false,
  trip: null,
  isSaving: false,
});
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
  status: 'draft',
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
const weatherCityOptions = computed(() =>
  getWeatherCitiesByCountry(form.countryCode)
);
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
      { label: '草稿中', value: 'draft' },
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
    if (filters.status && (trip.status || 'active') !== filters.status)
      return false;
    if (filters.countryCode && trip.countryCode !== filters.countryCode)
      return false;
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

const managerCandidates = computed(() => {
  const tripId = managerDrawer.value.trip?.id;
  const keyword = managerDrawer.value.keyword.trim().toLowerCase();
  return participantsStore.participants
    .filter((participant) => (participant.tripIds || []).includes(tripId))
    .filter((participant) => {
      if (!keyword) return true;
      return [participant.name, participant.inviteCode, participant.uid]
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
    const city = weatherCityOptions.value.find(
      (item) => item.name === cityName
    );
    if (city) {
      form.latitude = city.latitude;
      form.longitude = city.longitude;
    }
  }
);

onMounted(async () => {
  await Promise.all([
    tripStore.init(),
    participantsStore.loadAllParticipants(),
    ensurePackingCatalog().then((list) => {
      packingCatalog.value = list;
    }),
  ]);
  await tripStore.refreshTrips();
});

const openPackingDrawer = (trip) => {
  packingDrawer.value = {
    open: true,
    trip,
    isSaving: false,
  };
};

const saveTripPackingList = async (packingList) => {
  const trip = packingDrawer.value.trip;
  if (!trip?.id) return;
  packingDrawer.value.isSaving = true;
  try {
    await tripStore.updateTrip(trip.id, { packingList });
    if (trip.status === 'active') {
      await sendItinerarySyncSignal({
        tripId: trip.id,
        reason: 'packing-list-updated',
      }).catch((error) =>
        console.error('Packing list sync signal failed:', error)
      );
    }
    packingDrawer.value.open = false;
  } catch (error) {
    alert(error.message);
  } finally {
    packingDrawer.value.isSaving = false;
  }
};

const openManagerDrawer = (trip) => {
  const eligibleIds = new Set(
    participantsStore.participants
      .filter((participant) => (participant.tripIds || []).includes(trip.id))
      .map((participant) => participant.id)
  );
  managerDrawer.value = {
    open: true,
    trip,
    selectedIds: (trip.managerParticipantIds || []).filter((id) =>
      eligibleIds.has(id)
    ),
    keyword: '',
    isSaving: false,
  };
};

const toggleManager = (participantId) => {
  const selected = new Set(managerDrawer.value.selectedIds);
  if (selected.has(participantId)) selected.delete(participantId);
  else selected.add(participantId);
  managerDrawer.value.selectedIds = [...selected];
};

const saveTripManagers = async () => {
  const tripId = managerDrawer.value.trip?.id;
  if (!tripId) return;
  managerDrawer.value.isSaving = true;
  try {
    await tripStore.updateTrip(tripId, {
      managerParticipantIds: managerDrawer.value.selectedIds,
    });
    if (managerDrawer.value.trip?.status === 'active') {
      await sendItinerarySyncSignal({
        tripId,
        reason: 'trip-managers-updated',
      }).catch((error) =>
        console.error('Trip manager sync signal failed:', error)
      );
    }
    managerDrawer.value.open = false;
  } catch (error) {
    alert(error.message);
  } finally {
    managerDrawer.value.isSaving = false;
  }
};

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
    status: 'draft',
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
    status: trip.status || 'active',
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
    status: form.status || 'draft',
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
  if (preview.removeCount > 0)
    details.push(`將刪除超出：${preview.removeCount} 天`);

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
      const previousStatus =
        tripStore.trips.find((trip) => trip.id === editingId.value)?.status ||
        'active';
      await tripStore.updateTrip(editingId.value, payload);
      await maybeSyncDayConfigs(editingId.value, payload);
      if (previousStatus !== 'active' && payload.status === 'active') {
        await tripStore.makeActive(editingId.value);
        try {
          await sendItinerarySyncSignal({
            tripId: editingId.value,
            reason: 'trip-activated',
          });
        } catch (error) {
          console.error('Itinerary sync signal failed:', error);
        }
      }
      await tripStore.refreshTrips();
    } else {
      await tripStore.createTrip({ ...payload, setActive: false });
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
  if (status === 'draft') return '草稿中';
  if (status === 'completed') return '已完成';
  if (status === 'archived') return '已封存';
  return '進行中';
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

    <AdminTripTable
      v-else
      :rows="filteredTrips"
      :columns="columns"
      :loading="tripStore.isLoading"
      :search="searchFields"
      :initial-search="appliedSearch"
      :get-status-label="getStatusLabel"
      @create="openCreateDrawer"
      @search="applySearch"
      @reset="resetSearch"
      @refresh="refreshTrips"
      @copy-code="copyCode"
      @open-itinerary="openTripToolDrawer($event, 'itinerary')"
      @open-config="openTripToolDrawer($event, 'config')"
      @open-managers="openManagerDrawer"
      @open-packing="openPackingDrawer"
      @edit="openEditDrawer"
    />

    <AdminTripWorkspaceDrawer
      v-model:open="toolDrawer.open"
      :title="toolDrawer.title"
      :subtitle="tripStore.currentTrip?.title || '目前旅程'"
      :component="activeToolComponent"
      @close="closeToolDrawer"
    />

    <AdminTripPackingDrawer
      v-model:open="packingDrawer.open"
      :trip="packingDrawer.trip"
      :catalog="packingCatalog"
      :is-saving="packingDrawer.isSaving"
      @save="saveTripPackingList"
    />

    <AdminTripManagerDrawer
      v-model:open="managerDrawer.open"
      v-model:keyword="managerDrawer.keyword"
      :trip-title="managerDrawer.trip?.title || ''"
      :selected-ids="managerDrawer.selectedIds"
      :candidates="managerCandidates"
      :is-saving="managerDrawer.isSaving"
      @toggle="toggleManager"
      @save="saveTripManagers"
    />

    <AdminTripFormDrawer
      v-model:open="isDrawerOpen"
      :is-editing="isEditing"
      :is-saving="isSaving"
      :form="form"
      :country-options="COUNTRY_OPTIONS"
      :weather-city-options="weatherCityOptions"
      :has-unknown-weather-city="hasUnknownWeatherCity"
      :selected-country="selectedCountry"
      @close="closeDrawer"
      @save="saveTrip"
    />
  </main>
</template>

<route>
{
  meta: { layout: "admin" }
}
</route>
