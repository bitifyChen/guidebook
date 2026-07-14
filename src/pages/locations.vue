<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Battery,
  Clock,
  LocateFixed,
  MapPin,
  Navigation,
  NavigationOff,
  RefreshCw,
  ShieldAlert,
  Users,
  X,
} from 'lucide-vue-next';
import { subscribeTripLocations } from '@/api/locations';
import { createMemberMapPinHtml } from '@/components/locations/memberMapPin';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';

const tripStore = useTripStore();
const participantsStore = useParticipantsStore();

const mapRef = ref(null);
const rawLocations = ref([]);
const isLoading = ref(true);
const isMemberPanelOpen = ref(false);
const lastSyncedAt = ref('');
const selectedParticipantId = ref('');
const trackedParticipantId = ref('');
let unsubscribeLocations = null;
let mapInstance = null;
let markerLayer = null;
let hasAutoFit = false;
const markersByParticipantId = new Map();
const markerAnimationsByParticipantId = new Map();

const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

const participantById = computed(() =>
  participantsStore.participants.reduce((result, participant) => {
    result[participant.id] = participant;
    return result;
  }, {})
);

const getTimestamp = (item) => Number(item.updatedAt || item.ts || 0);

const formatTime = (value) => {
  const time = Number(value || 0);
  if (!time) return '尚未同步';
  return new Date(time).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getBatteryPercent = (item) => {
  const value = Number(item?.bat);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const formatBattery = (item) => {
  const battery = getBatteryPercent(item);
  return battery === null ? '--' : `${battery}%`;
};

const getBatteryToneClass = (item) => {
  const battery = getBatteryPercent(item);
  if (battery === null) return 'battery-tone--unknown';
  if (battery <= 20) return 'battery-tone--low';
  if (battery <= 50) return 'battery-tone--medium';
  return 'battery-tone--good';
};

const isValidCoordinate = (item) => {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
};

const locations = computed(() =>
  rawLocations.value
    .filter(isValidCoordinate)
    .map((item) => {
      const participant = participantById.value[item.participantId] || {};
      const timestamp = getTimestamp(item);
      return {
        ...item,
        lat: Number(item.lat),
        lng: Number(item.lng),
        name: participant.name || '未命名成員',
        avatar: participant.avatar || '',
        timestamp,
        isOnline: timestamp && Date.now() - timestamp < 5 * 60 * 1000,
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp)
);

const onlineCount = computed(
  () => locations.value.filter((item) => item.isOnline).length
);

const offlineCount = computed(() => locations.value.length - onlineCount.value);

const memberButtonLabel = computed(() =>
  locations.value.length
    ? `${onlineCount.value}/${locations.value.length}`
    : '0'
);

const selectedMember = computed(() =>
  locations.value.find(
    (item) => item.participantId === selectedParticipantId.value
  )
);

const tripName = computed(() => tripStore.currentTrip?.name || '目前旅程');

const mapCenter = computed(() => {
  const tripLat = Number(tripStore.currentTrip?.latitude);
  const tripLng = Number(tripStore.currentTrip?.longitude);
  if (Number.isFinite(tripLat) && Number.isFinite(tripLng))
    return [tripLat, tripLng];
  return [35.6812, 139.7671];
});

const createMemberIcon = (item) => {
  return L.divIcon({
    className: '',
    iconSize: [64, 76],
    iconAnchor: [32, 72],
    popupAnchor: [0, -66],
    html: createMemberMapPinHtml({
      name: item.name,
      avatar: item.avatar,
      isOnline: item.isOnline,
      isSelected: selectedParticipantId.value === item.participantId,
      isTracked: trackedParticipantId.value === item.participantId,
    }),
  });
};

const fitAllLocations = ({ animate = true } = {}) => {
  if (!mapInstance) return;
  if (!locations.value.length) {
    mapInstance.setView(mapCenter.value, 11, { animate });
    return;
  }

  const bounds = locations.value.map((item) => [item.lat, item.lng]);
  if (bounds.length === 1) {
    mapInstance.setView(bounds[0], 16, { animate });
  } else {
    mapInstance.fitBounds(bounds, {
      animate,
      paddingTopLeft: [28, 92],
      paddingBottomRight: [28, 150],
      maxZoom: 16,
    });
  }
};

const stopMarkerAnimation = (participantId) => {
  const animationId = markerAnimationsByParticipantId.get(participantId);
  if (animationId) {
    window.cancelAnimationFrame(animationId);
    markerAnimationsByParticipantId.delete(participantId);
  }
};

const animateMarkerTo = (participantId, marker, nextLatLng) => {
  const currentLatLng = marker.getLatLng();
  const fromLat = Number(currentLatLng.lat);
  const fromLng = Number(currentLatLng.lng);
  const toLat = Number(nextLatLng[0]);
  const toLng = Number(nextLatLng[1]);

  if (
    !Number.isFinite(fromLat) ||
    !Number.isFinite(fromLng) ||
    (Math.abs(fromLat - toLat) < 0.000001 &&
      Math.abs(fromLng - toLng) < 0.000001)
  ) {
    marker.setLatLng(nextLatLng);
    if (trackedParticipantId.value === participantId) {
      mapInstance?.panTo(nextLatLng, { animate: false });
    }
    return;
  }

  stopMarkerAnimation(participantId);

  const duration = 720;
  const startedAt = performance.now();

  const step = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = easeOutCubic(progress);
    marker.setLatLng([
      fromLat + (toLat - fromLat) * eased,
      fromLng + (toLng - fromLng) * eased,
    ]);
    if (trackedParticipantId.value === participantId) {
      mapInstance?.panTo(marker.getLatLng(), { animate: false });
    }

    if (progress < 1) {
      markerAnimationsByParticipantId.set(
        participantId,
        window.requestAnimationFrame(step)
      );
      return;
    }

    marker.setLatLng(nextLatLng);
    markerAnimationsByParticipantId.delete(participantId);
  };

  markerAnimationsByParticipantId.set(
    participantId,
    window.requestAnimationFrame(step)
  );
};

const selectParticipant = (participantId, { closePanel = false } = {}) => {
  if (!mapInstance) return;
  const item = locations.value.find(
    (location) => location.participantId === participantId
  );
  if (!item) return;
  selectedParticipantId.value = item.participantId;
  renderMapMarkers();
  mapInstance.flyTo([item.lat, item.lng], Math.max(mapInstance.getZoom(), 17), {
    duration: 0.65,
  });
  if (closePanel) isMemberPanelOpen.value = false;
};

const toggleSelectedMemberTracking = () => {
  if (!selectedMember.value) return;
  if (trackedParticipantId.value === selectedMember.value.participantId) {
    trackedParticipantId.value = '';
    renderMapMarkers();
    return;
  }

  trackedParticipantId.value = selectedMember.value.participantId;
  renderMapMarkers();
  mapInstance?.flyTo(
    [selectedMember.value.lat, selectedMember.value.lng],
    Math.max(mapInstance.getZoom(), 17),
    { duration: 0.55 }
  );
};

const stopTracking = ({ clearSelection = true } = {}) => {
  trackedParticipantId.value = '';
  if (clearSelection) selectedParticipantId.value = '';
  renderMapMarkers();
};

const showAllMembers = () => {
  trackedParticipantId.value = '';
  selectedParticipantId.value = '';
  renderMapMarkers();
  fitAllLocations();
};

const renderMapMarkers = ({ fit = false } = {}) => {
  if (!mapInstance || !markerLayer) return;
  const activeParticipantIds = new Set();

  locations.value.forEach((item) => {
    activeParticipantIds.add(item.participantId);
    const nextLatLng = [item.lat, item.lng];
    const currentMarker = markersByParticipantId.get(item.participantId);

    if (currentMarker) {
      currentMarker.setIcon(createMemberIcon(item));
      animateMarkerTo(item.participantId, currentMarker, nextLatLng);
      return;
    }

    const marker = L.marker(nextLatLng, {
      icon: createMemberIcon(item),
      title: item.name,
    });
    marker.addTo(markerLayer);
    marker.on('click', () => {
      selectParticipant(item.participantId);
    });
    markersByParticipantId.set(item.participantId, marker);
  });

  markersByParticipantId.forEach((marker, participantId) => {
    if (activeParticipantIds.has(participantId)) return;
    stopMarkerAnimation(participantId);
    markerLayer.removeLayer(marker);
    markersByParticipantId.delete(participantId);
  });

  if (fit || !hasAutoFit) {
    fitAllLocations({ animate: hasAutoFit });
    hasAutoFit = true;
  }
};

const initMap = async () => {
  if (mapInstance || !mapRef.value || tripStore.isPublicTrip) return;
  await nextTick();
  mapInstance = L.map(mapRef.value, {
    zoomControl: false,
    attributionControl: false,
  }).setView(mapCenter.value, 11);
  L.control.zoom({ position: 'topright' }).addTo(mapInstance);
  L.control
    .attribution({
      position: 'bottomleft',
      prefix: '',
    })
    .addAttribution('&copy; OpenStreetMap')
    .addTo(mapInstance);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(mapInstance);
  markerLayer = L.layerGroup().addTo(mapInstance);
  setTimeout(() => mapInstance?.invalidateSize(), 120);
  renderMapMarkers();
};

const destroyMap = () => {
  markerLayer = null;
  markerAnimationsByParticipantId.forEach((animationId) => {
    window.cancelAnimationFrame(animationId);
  });
  markerAnimationsByParticipantId.clear();
  markersByParticipantId.clear();
  hasAutoFit = false;
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
};

const stopSubscription = () => {
  if (unsubscribeLocations) {
    unsubscribeLocations();
    unsubscribeLocations = null;
  }
};

const startSubscription = () => {
  stopSubscription();
  rawLocations.value = [];
  selectedParticipantId.value = '';
  trackedParticipantId.value = '';
  hasAutoFit = false;
  if (!tripStore.currentTripId || tripStore.isPublicTrip) {
    isLoading.value = false;
    destroyMap();
    return;
  }
  isLoading.value = true;
  unsubscribeLocations = subscribeTripLocations(
    tripStore.currentTripId,
    (rows) => {
      rawLocations.value = rows;
      lastSyncedAt.value = new Date().toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      isLoading.value = false;
    }
  );
};

onMounted(async () => {
  await tripStore.init();
  await participantsStore.init();
  startSubscription();
});

watch(
  () => [tripStore.currentTripId, tripStore.accessMode],
  async () => {
    if (!tripStore.isPublicTrip) await participantsStore.init();
    startSubscription();
  }
);

watch(
  () => [isLoading.value, tripStore.isPublicTrip, locations.value.length],
  async () => {
    if (!isLoading.value && !tripStore.isPublicTrip) await initMap();
  }
);

watch(locations, (currentLocations, previousLocations = []) => {
  if (
    trackedParticipantId.value &&
    !currentLocations.some(
      (item) => item.participantId === trackedParticipantId.value
    )
  ) {
    trackedParticipantId.value = '';
  }
  if (
    selectedParticipantId.value &&
    !currentLocations.some(
      (item) => item.participantId === selectedParticipantId.value
    )
  ) {
    selectedParticipantId.value = '';
  }

  renderMapMarkers({
    fit:
      !hasAutoFit || (!previousLocations.length && currentLocations.length > 0),
  });
});

onUnmounted(() => {
  stopSubscription();
  destroyMap();
});
</script>

<template>
  <main
    class="location-page relative h-full min-h-full overflow-hidden bg-slate-100"
  >
    <section
      v-if="tripStore.isPublicTrip"
      class="absolute inset-0 z-[520] flex items-center justify-center p-6"
    >
      <div
        class="rounded-[28px] bg-white p-6 shadow-sm border border-white/60 text-center"
      >
        <ShieldAlert :size="28" class="mx-auto text-slate-300" />
        <h2 class="mt-3 font-black text-slate-800">無法查看位置</h2>
        <p class="mt-2 text-sm font-bold text-slate-400 leading-relaxed">
          位置分享只開放旅程成員使用。
        </p>
      </div>
    </section>

    <div ref="mapRef" class="absolute inset-0 z-0 bg-slate-100"></div>

    <div
      v-if="isLoading && !tripStore.isPublicTrip"
      class="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
    >
      <RefreshCw :size="24" class="text-orange-500 animate-spin" />
      <p class="mt-3 text-sm font-black text-slate-500">讀取位置中</p>
    </div>
    <div
      v-if="!tripStore.isPublicTrip && !isLoading"
      class="absolute inset-x-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-[510] flex flex-col items-end gap-2"
    >
      <button
        v-if="locations.length"
        type="button"
        title="顯示所有成員"
        aria-label="顯示所有成員"
        @click="showAllMembers"
        class="map-action-button flex h-11 w-11 items-center justify-center rounded-xl border border-white/80 bg-white text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
      >
        <LocateFixed :size="19" :stroke-width="2.4" />
      </button>

      <div class="flex w-full justify-end gap-2">
        <div
          v-if="selectedMember"
          class="location-member-card h-16 pointer-events-auto flex min-w-0 flex-1 items-center gap-2 rounded-2xl p-2 text-slate-900 shadow-[0_16px_32px_rgba(15,23,42,0.20)] backdrop-blur-md"
          :class="
            trackedParticipantId === selectedMember.participantId
              ? 'location-member-card--tracked'
              : selectedMember.isOnline
                ? 'location-member-card--online'
                : 'location-member-card--offline'
          "
        >
          <div class="min-w-0 flex-1 text-left">
            <div class="flex items-center gap-2">
              <div
                class="location-member-card__avatar relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-slate-100"
              >
                <img
                  v-if="selectedMember.avatar"
                  :src="selectedMember.avatar"
                  class="h-full w-full object-cover"
                  alt=""
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center font-black text-slate-500"
                >
                  {{ selectedMember.name.slice(0, 1) }}
                </div>
              </div>
              <span class="min-w-0 flex-1">
                <span
                  class="flex items-center justify-between gap-2 text-[10px] font-bold"
                >
                  <span class="flex min-w-0 items-center gap-1">
                    <span class="location-member-card__lamp"></span>
                    <Navigation
                      v-if="
                        trackedParticipantId === selectedMember.participantId
                      "
                      :size="12"
                      :stroke-width="2.8"
                      class="text-orange-500"
                    />
                    <span class="location-member-card__status">
                      {{
                        trackedParticipantId === selectedMember.participantId
                          ? '追蹤中'
                          : selectedMember.isOnline
                            ? '在線'
                            : '離線'
                      }}
                    </span>
                  </span>
                  <span
                    class="location-member-card__battery flex shrink-0 items-center gap-1"
                    :class="getBatteryToneClass(selectedMember)"
                  >
                    <Battery :size="13" :stroke-width="2.5" />
                    {{ formatBattery(selectedMember) }}
                  </span>
                </span>
                <span class="mt-0.5 block truncate text-sm font-black">{{
                  selectedMember.name
                }}</span>
                <span
                  class="mt-0.5 block truncate text-[10px] font-bold text-slate-400"
                >
                  {{ formatTime(selectedMember.timestamp) }}
                </span>
              </span>
            </div>
          </div>
          <button
            type="button"
            title="追蹤成員"
            aria-label="追蹤成員"
            @click="toggleSelectedMemberTracking"
            class="location-member-card__track flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          >
            <component
              :is="
                trackedParticipantId === selectedMember.participantId
                  ? NavigationOff
                  : Navigation
              "
              :size="16"
              :stroke-width="2.6"
            />
          </button>
          <button
            type="button"
            title="關閉成員資訊"
            aria-label="關閉成員資訊"
            @click="stopTracking"
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
          >
            <X :size="16" :stroke-width="2.6" />
          </button>
        </div>

        <button
          type="button"
          @click="isMemberPanelOpen = true"
          class="map-member-button flex h-16 flex-col aspect-square items-center justify-center rounded-2xl space-y-[4px] bg-white/95 p-2 text-slate-900 shadow-[0_16px_32px_rgba(15,23,42,0.35)]"
        >
          <span class="flex items-center justify-center">
            <Users :size="20" :stroke-width="2.5" />
          </span>
          <span class="text-left">
            <span class="block text-sm font-black">{{
              memberButtonLabel
            }}</span>
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="isMemberPanelOpen"
      class="absolute inset-0 z-[700] bg-slate-950/45 backdrop-blur-[2px]"
      @click.self="isMemberPanelOpen = false"
    >
      <section
        class="member-sheet absolute inset-x-0 bottom-0 max-h-[78dvh] rounded-t-[24px] bg-white shadow-2xl"
      >
        <div class="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200"></div>
        <header
          class="flex items-center justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-3"
        >
          <div>
            <h2 class="font-black text-slate-900">成員位置</h2>
            <p class="mt-1 text-xs font-bold text-slate-400">
              {{ onlineCount }} 人在線<span v-if="offlineCount"
                >，{{ offlineCount }} 人離線</span
              >
            </p>
          </div>
          <button
            type="button"
            title="關閉"
            aria-label="關閉成員位置"
            @click="isMemberPanelOpen = false"
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
          >
            <X :size="19" :stroke-width="2.4" />
          </button>
        </header>

        <div
          class="max-h-[calc(78dvh-82px)] overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        >
          <button
            v-for="item in locations"
            :key="item.participantId"
            type="button"
            @click="selectParticipant(item.participantId, { closePanel: true })"
            class="member-row flex w-full items-center gap-3 border-b border-slate-100 px-1 py-4 text-left last:border-b-0"
            :class="
              trackedParticipantId === item.participantId
                ? 'member-row--tracked'
                : item.isOnline
                  ? 'member-row--online'
                  : ''
            "
          >
            <div
              class="member-row__avatar relative h-12 w-12 shrink-0"
              :class="
                trackedParticipantId === item.participantId
                  ? 'member-row__avatar--tracked'
                  : item.isOnline
                    ? 'member-row__avatar--online'
                    : 'member-row__avatar--offline'
              "
            >
              <div
                class="h-full w-full overflow-hidden rounded-2xl bg-slate-100"
              >
                <img
                  v-if="item.avatar"
                  :src="item.avatar"
                  class="h-full w-full object-cover"
                  alt=""
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center font-black text-slate-500"
                >
                  {{ item.name.slice(0, 1) }}
                </div>
              </div>
              <span
                class="member-row__status-dot absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white"
              ></span>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <h3 class="truncate font-black text-slate-900">
                  {{ item.name }}
                </h3>
                <span
                  class="member-row__status-label shrink-0 text-[11px] font-bold"
                >
                  {{
                    trackedParticipantId === item.participantId
                      ? '追蹤中'
                      : item.isOnline
                        ? '在線'
                        : '離線'
                  }}
                </span>
              </div>
              <div
                class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-400"
              >
                <span class="flex items-center gap-1"
                  ><Clock :size="13" />{{ formatTime(item.timestamp) }}</span
                >
                <span
                  class="flex items-center gap-1"
                  :class="getBatteryToneClass(item)"
                  ><Battery :size="13" />{{ formatBattery(item) }}</span
                >
                <span class="flex items-center gap-1"
                  ><Navigation :size="13" />{{
                    item.acc || item.acc === 0 ? `${item.acc}m` : '--'
                  }}</span
                >
              </div>
            </div>

            <MapPin
              :size="18"
              class="member-row__pin shrink-0"
              :stroke-width="2.4"
            />
          </button>
          <div
            v-if="locations.length === 0"
            class="py-10 text-center text-sm font-black text-slate-400"
          >
            尚無成員位置
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style>
.location-member-card {
  position: relative;
  overflow: hidden;
  background: rgb(255 255 255 / 92%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 78%),
    0 16px 32px rgb(15 23 42 / 20%);
}

.location-member-card::before {
  position: absolute;
  top: 50%;
  left: 9px;
  width: 7px;
  height: 7px;
  content: '';
  background: #94a3b8;
  border-radius: 999px;
  transform: translateY(-50%);
}

.location-member-card--online {
  background:
    linear-gradient(90deg, rgb(16 185 129 / 12%), rgb(255 255 255 / 82%) 42%),
    rgb(255 255 255 / 92%);
}

.location-member-card--tracked {
  background:
    linear-gradient(90deg, rgb(249 115 22 / 14%), rgb(255 255 255 / 82%) 42%),
    rgb(255 255 255 / 92%);
}

.location-member-card--online::before {
  background: #10b981;
  box-shadow: 0 0 0 5px rgb(16 185 129 / 13%);
}

.location-member-card--tracked::before {
  background: #f97316;
  box-shadow: 0 0 0 5px rgb(249 115 22 / 15%);
}

.location-member-card__avatar {
  box-shadow: 0 0 0 1px rgb(148 163 184 / 18%);
}

.location-member-card--online .location-member-card__avatar {
  box-shadow: 0 0 0 1px rgb(16 185 129 / 22%);
}

.location-member-card--tracked .location-member-card__avatar {
  box-shadow: 0 0 0 1px rgb(249 115 22 / 28%);
}

.location-member-card__status {
  color: #64748b;
}

.location-member-card--online .location-member-card__status {
  color: #059669;
}

.location-member-card--tracked .location-member-card__status {
  color: #ea580c;
}

.location-member-card__track {
  color: #64748b;
  background: #f1f5f9;
}

.location-member-card--online .location-member-card__track {
  color: #047857;
  background: rgb(16 185 129 / 12%);
}

.location-member-card--tracked .location-member-card__track {
  color: #ea580c;
  background: rgb(249 115 22 / 14%);
}

.battery-tone--good {
  color: #059669;
}

.battery-tone--medium {
  color: #d97706;
}

.battery-tone--low {
  color: #dc2626;
}

.battery-tone--unknown {
  color: #94a3b8;
}

.member-row {
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.member-row--online {
  background: linear-gradient(
    90deg,
    rgb(16 185 129 / 9%),
    rgb(255 255 255 / 0%) 46%
  );
}

.member-row--tracked {
  background: linear-gradient(
    90deg,
    rgb(249 115 22 / 12%),
    rgb(255 255 255 / 0%) 46%
  );
}

.member-row__avatar {
  border-radius: 16px;
}

.member-row__avatar--online {
  box-shadow: 0 0 0 1px rgb(16 185 129 / 18%);
}

.member-row__avatar--tracked {
  box-shadow: 0 0 0 1px rgb(249 115 22 / 24%);
}

.member-row__status-dot {
  background: #94a3b8;
}

.member-row--online .member-row__status-dot {
  background: #10b981;
  animation: member-avatar-pulse 2s cubic-bezier(0.25, 0, 0, 1) infinite;
  --member-avatar-pulse-color: rgb(16 185 129 / 34%);
}

.member-row--tracked .member-row__status-dot {
  background: #f97316;
  animation: member-avatar-pulse 2s cubic-bezier(0.25, 0, 0, 1) infinite;
  --member-avatar-pulse-color: rgb(249 115 22 / 42%);
}

.member-row__status-label,
.member-row__pin {
  color: #94a3b8;
}

.member-row--online .member-row__status-label,
.member-row--online .member-row__pin {
  color: #059669;
}

.member-row--tracked .member-row__status-label,
.member-row--tracked .member-row__pin {
  color: #ea580c;
}

.member-map-marker {
  position: relative;
  display: flex;
  justify-content: center;
  width: 64px;
  height: 76px;
  isolation: isolate;
  transform-origin: 50% 92%;
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.member-map-marker__name {
  position: absolute;
  top: -27px;
  left: 50%;
  z-index: 4;
  max-width: 120px;
  overflow: hidden;
  padding: 5px 8px;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #0f172a;
  border-radius: 8px;
  box-shadow: 0 6px 14px rgb(15 23 42 / 28%);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.member-map-marker__shape {
  position: relative;
  width: 56px;
  height: 68px;
  background: #64748b;
  clip-path: polygon(
    50% 0%,
    68% 3%,
    84% 14%,
    94% 32%,
    94% 50%,
    76% 74%,
    50% 100%,
    24% 74%,
    6% 50%,
    6% 32%,
    16% 14%,
    32% 3%
  );
  filter: drop-shadow(0 2px 1px rgb(255 255 255 / 82%))
    drop-shadow(0 8px 10px rgb(15 23 42 / 22%));
  transition:
    background-color 180ms ease,
    filter 180ms ease;
}

.member-map-marker__avatar-ring {
  position: absolute;
  top: 4px;
  left: 50%;
  z-index: 3;
  width: 44px;
  aspect-ratio: 1 / 1;
  border-radius: 999px;
  transform: translateX(-50%);
}

.member-map-marker.is-online .member-map-marker__avatar-ring::before,
.member-map-marker.is-tracked .member-map-marker__avatar-ring::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: '';
  border-radius: inherit;
  animation: member-avatar-pulse 2s cubic-bezier(0.25, 0, 0, 1) infinite;
}

.member-map-marker.is-online .member-map-marker__avatar-ring::before {
  --member-avatar-pulse-color: rgb(16 185 129 / 46%);
}

.member-map-marker.is-tracked .member-map-marker__avatar-ring::before {
  --member-avatar-pulse-color: rgb(249 115 22 / 54%);
}

.member-map-marker__avatar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: #fff;
  font-size: 17px;
  font-weight: 900;
  border-radius: 999px;
}

.member-map-marker__avatar img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
}

.member-map-marker.is-selected {
  z-index: 2;
  transform: translateY(-4px) scale(1.14);
}

.member-map-marker.is-tracked {
  z-index: 3;
}

.member-map-marker.is-selected .member-map-marker__shape {
  filter: drop-shadow(0 2px 1px rgb(255 255 255 / 95%))
    drop-shadow(0 12px 14px rgb(15 23 42 / 34%));
}

.member-map-marker.is-selected .member-map-marker__name {
  opacity: 1;
  transform: translate(-50%, 0);
}

.member-map-marker.is-online:not(.is-tracked) .member-map-marker__shape {
  background: #67c99a;
}

.member-map-marker.is-tracked .member-map-marker__shape {
  background: #f59e57;
}

.member-map-marker.is-offline .member-map-marker__shape {
  opacity: 0.8;
}

.member-map-marker.is-offline.is-selected {
  opacity: 1;
}

@keyframes member-avatar-pulse {
  0% {
    box-shadow: 0 0 0 0 var(--member-avatar-pulse-color);
  }

  100% {
    box-shadow: 0 0 0 24px rgb(0 0 0 / 0%);
  }
}

.location-page .leaflet-top.leaflet-right {
  top: 80px;
  right: 12px;
}

.location-page .leaflet-control-zoom {
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 12px;
  box-shadow: 0 10px 24px rgb(15 23 42 / 18%);
}

.location-page .leaflet-control-zoom a {
  width: 40px;
  height: 40px;
  color: #334155;
  font-size: 20px;
  line-height: 40px;
  background: rgb(255 255 255 / 96%);
  border-color: #e2e8f0;
}

.location-page .leaflet-control-attribution {
  color: #64748b;
  font-size: 9px;
  background: rgb(255 255 255 / 82%);
}

.map-action-button:active,
.map-member-button:active,
.member-row:active {
  transform: scale(0.97);
}

.member-sheet {
  animation: member-sheet-enter 220ms ease-out;
}

@keyframes member-sheet-enter {
  from {
    transform: translateY(24px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .member-sheet,
  .member-map-marker,
  .member-map-marker__name,
  .member-map-marker__shape,
  .member-map-marker__avatar-ring::before,
  .member-row__status-dot {
    animation: none;
    transition: none;
  }
}
</style>

<route>
{
  name: "locations",
  meta: {
    title: "位置",
    fullBleed: true
  }
}
</route>
