<script setup>
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RefreshCw, ShieldAlert } from 'lucide-vue-next';
import {
  getParticipantLocationTrack,
  removeTripGatheringPoint,
  saveTripGatheringPoint,
  subscribeTripGatheringPoints,
  subscribeTripLocations,
  updateParticipantLocation,
} from '@/api/locations';
import GatheringPointEditor from '@/components/locations/GatheringPointEditor.vue';
import GatheringPointSheet from '@/components/locations/GatheringPointSheet.vue';
import LocationActionBar from '@/components/locations/LocationActionBar.vue';
import LocationNavigationCard from '@/components/locations/LocationNavigationCard.vue';
import LocationMemberTrackPicker from '@/components/locations/LocationMemberTrackPicker.vue';
import LocationMultiTrackSheet from '@/components/locations/LocationMultiTrackSheet.vue';
import LocationTrackSheet from '@/components/locations/LocationTrackSheet.vue';
import LocationTrackStopsSheet from '@/components/locations/LocationTrackStopsSheet.vue';
import MemberLocationSheet from '@/components/locations/MemberLocationSheet.vue';
import SelectedMemberCard from '@/components/locations/SelectedMemberCard.vue';
import {
  createGatheringMapPinHtml,
  createMemberMapPinHtml,
} from '@/components/locations/memberMapPin';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';
import { useUserStore } from '@/store/userStore';
import {
  detectTrackStops,
  findNearestTrackPointIndex,
  getTrackPointAtTimestamp,
  runWithConcurrency,
  sanitizeTrackPoints,
  splitTrackSegments,
} from '@/utils/locationTrack';

const tripStore = useTripStore();
const participantsStore = useParticipantsStore();
const userStore = useUserStore();

const mapRef = ref(null);
const rawLocations = ref([]);
const gatheringPoints = ref([]);
const isLoading = ref(true);
const isMemberPanelOpen = ref(false);
const isGatheringPanelOpen = ref(false);
const isHistoryPanelOpen = ref(false);
const isHistoryStopsOpen = ref(false);
const isMultiHistoryPanelOpen = ref(false);
const isMultiHistoryPickerOpen = ref(false);
const isSelectingGatheringPoint = ref(false);
const isUpdatingMyLocation = ref(false);
const isSavingGatheringPoint = ref(false);
const selectedParticipantId = ref('');
const followedParticipantId = ref('');
const trackedParticipantId = ref('');
const selectedGatheringPointId = ref('');
const activeGatheringPointId = ref('');
const deleteArmedPinId = ref('');
const deviceHeading = ref(null);
const compassState = ref('idle');
const locationNotice = ref({ type: '', message: '' });
const currentTimestamp = ref(Date.now());
const historyParticipantId = ref('');
const historyDate = ref('');
const historyPoints = ref([]);
const historyError = ref('');
const isHistoryLoading = ref(false);
const historyViewMode = ref('overview');
const historyCurrentIndex = ref(0);
const historyIsPlaying = ref(false);
const historyPlaybackSpeed = ref('1');
const historySelectedStopIndex = ref(-1);
const historyRejectedCount = ref(0);
const multiHistoryDate = ref('');
const multiHistoryParticipantIds = ref([]);
const multiHistoryTracks = ref([]);
const multiHistoryVisibleIds = ref([]);
const multiHistoryFocusedId = ref('');
const multiHistoryCurrentTimestamp = ref(0);
const multiHistoryIsPlaying = ref(false);
const multiHistoryPlaybackMode = ref(false);
const multiHistoryPlaybackSpeed = ref('1');
const multiHistoryError = ref('');

const gatheringForm = reactive({
  id: '',
  title: '集合地點',
  meetAt: '',
});

let unsubscribeLocations = null;
let unsubscribeGatheringPoints = null;
let mapInstance = null;
let markerLayer = null;
let historyLayer = null;
let historyPlaybackLayer = null;
let hasAutoFit = false;
let isOrientationListening = false;
let noticeTimer = null;
let deleteTimer = null;
let onlineStatusTimer = null;
let historyRequestSequence = 0;
let multiHistoryRequestSequence = 0;
const markersByParticipantId = new Map();
const markerAnimationsByParticipantId = new Map();
const gatheringMarkersById = new Map();
const historyTrackCache = new Map();
let historyPlaybackTimer = null;
let multiHistoryPlaybackTimer = null;

const HISTORY_PLAYBACK_INTERVALS = Object.freeze({
  0.5: 650,
  1: 350,
  2: 170,
});

const MULTI_HISTORY_PLAYBACK_INTERVALS = Object.freeze({
  0.5: 650,
  1: 350,
  2: 170,
});

const HISTORY_ROUTE_COLORS = Object.freeze([
  '#f97316',
  '#2563eb',
  '#059669',
  '#db2777',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
  '#4f46e5',
  '#65a30d',
]);

const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

const participantById = computed(() =>
  participantsStore.participants.reduce((result, participant) => {
    result[participant.id] = participant;
    return result;
  }, {})
);

const myParticipant = computed(() => userStore.myParticipant);

const canViewMemberHistory = (item) => {
  const participantId =
    typeof item === 'string' ? item : item?.participantId || item?.id || '';
  if (!participantId || !myParticipant.value?.id) return false;
  if (participantId === myParticipant.value.id) return true;
  return myParticipant.value.canViewTeamLocationHistory === true;
};

const historyParticipant = computed(() => {
  if (!historyParticipantId.value) return null;
  const participant = participantById.value[historyParticipantId.value];
  const liveLocation = locations.value.find(
    (item) => item.participantId === historyParticipantId.value
  );
  return participant
    ? {
        ...participant,
        participantId: participant.id,
      }
    : liveLocation || null;
});

const historyFirstPointTime = computed(() => {
  const point = historyPoints.value[0];
  return point ? formatTrackTime(point.ts) : '';
});

const historyLastPointTime = computed(() => {
  const point = historyPoints.value[historyPoints.value.length - 1];
  return point ? formatTrackTime(point.ts) : '';
});

const historyCurrentTime = computed(() => {
  const point = historyPoints.value[historyCurrentIndex.value];
  return point ? formatTrackTime(point.ts) : '';
});

const historyStops = computed(() => detectTrackStops(historyPoints.value));

const getTimestamp = (item) => Number(item.updatedAt || item.ts || 0);

const isValidCoordinate = (item) => {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
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
        isOnline:
          Boolean(timestamp) &&
          currentTimestamp.value - timestamp < 5 * 60 * 1000,
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp)
);

const historyEligibleMembers = computed(() => {
  const liveLocationById = new Map(
    locations.value.map((item) => [item.participantId, item])
  );
  return participantsStore.participants
    .filter((participant) => {
      const tripIds = Array.isArray(participant.tripIds)
        ? participant.tripIds
        : participant.tripId
          ? [participant.tripId]
          : [];
      return (
        tripIds.includes(tripStore.currentTripId) &&
        canViewMemberHistory(participant.id)
      );
    })
    .map((participant) => ({
      ...participant,
      participantId: participant.id,
      name: participant.name || '未命名成員',
      avatar: participant.avatar || '',
      ...(liveLocationById.get(participant.id) || {}),
    }));
});

const canOpenMultiHistory = computed(
  () => historyEligibleMembers.value.length > 1
);

const multiHistoryTimelineStart = computed(() =>
  multiHistoryTracks.value.reduce((result, track) => {
    const value = track.points?.[0]?.ts;
    return Number.isFinite(value) ? Math.min(result, value) : result;
  }, Number.POSITIVE_INFINITY)
);

const multiHistoryTimelineEnd = computed(() =>
  multiHistoryTracks.value.reduce((result, track) => {
    const value = track.points?.[track.points.length - 1]?.ts;
    return Number.isFinite(value) ? Math.max(result, value) : result;
  }, 0)
);

const validGatheringPoints = computed(() =>
  gatheringPoints.value.filter(isValidCoordinate).map((item) => ({
    ...item,
    lat: Number(item.lat),
    lng: Number(item.lng),
    updatedAt: Number(item.updatedAt || 0),
  }))
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

const myLocation = computed(() =>
  locations.value.find((item) => item.participantId === myParticipant.value?.id)
);

const activeGatheringPoint = computed(() =>
  validGatheringPoints.value.find(
    (item) => item.id === activeGatheringPointId.value
  )
);

const activeNavigationTarget = computed(() => {
  if (trackedParticipantId.value) {
    const member = locations.value.find(
      (item) => item.participantId === trackedParticipantId.value
    );
    if (member) {
      return {
        type: 'member',
        id: member.participantId,
        name: member.name,
        lat: member.lat,
        lng: member.lng,
        subtitle: member.isOnline ? '在線位置' : '最後位置',
      };
    }
  }

  if (activeGatheringPoint.value) {
    return {
      type: 'gathering',
      id: activeGatheringPoint.value.id,
      name: activeGatheringPoint.value.title || '集合地點',
      lat: activeGatheringPoint.value.lat,
      lng: activeGatheringPoint.value.lng,
      subtitle: '集合目標',
      meetAt: activeGatheringPoint.value.meetAt || '',
    };
  }

  return null;
});

const mapCenter = computed(() => {
  const tripLat = Number(tripStore.currentTrip?.latitude);
  const tripLng = Number(tripStore.currentTrip?.longitude);
  if (Number.isFinite(tripLat) && Number.isFinite(tripLng))
    return [tripLat, tripLng];
  return [35.6812, 139.7671];
});

const formatTime = (value) => {
  const time = Number(value || 0);
  if (!time) return '尚無時間';
  return new Date(time).toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTrackTime = (value) => {
  const time = Number(value || 0);
  if (!time) return '--:--';
  return new Date(time).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getLocalDateValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDateRange = (value) => {
  const startDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) return null;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1);
  return {
    startTime: startDate.getTime(),
    endTime: endDate.getTime() - 1,
  };
};

const formatMeetAt = (value) => {
  if (!value) return '未設定時間';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未設定時間';
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCountdown = (value) => {
  if (!value) return '';
  const target = new Date(value).getTime();
  if (!Number.isFinite(target)) return '';
  const diff = target - currentTimestamp.value;
  if (diff <= 0) return '已到集合時間';
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `${minutes} 分鐘後集合`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小時 ${rest} 分鐘後集合` : `${hours} 小時後集合`;
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

const toRadians = (value) => (value * Math.PI) / 180;
const toDegrees = (value) => (value * 180) / Math.PI;
const normalizeDegrees = (value) => ((value % 360) + 360) % 360;

const getDistanceMeters = (from, to) => {
  if (!from || !to) return null;
  const earthRadius = 6371000;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const getBearing = (from, to) => {
  if (!from || !to) return null;
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
  const x =
    Math.cos(fromLatitude) * Math.sin(toLatitude) -
    Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
};

const navigationDistance = computed(() =>
  getDistanceMeters(myLocation.value, activeNavigationTarget.value)
);

const navigationBearing = computed(() =>
  getBearing(myLocation.value, activeNavigationTarget.value)
);

const navigationRotation = computed(() => {
  if (!Number.isFinite(navigationBearing.value)) return 0;
  if (!Number.isFinite(deviceHeading.value)) return navigationBearing.value;
  return normalizeDegrees(navigationBearing.value - deviceHeading.value);
});

const navigationDirection = computed(() => {
  if (!Number.isFinite(navigationBearing.value)) return '等待定位';
  const directions = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
  return directions[Math.round(navigationBearing.value / 45) % 8];
});

const googleMapsUrl = computed(() => {
  if (!activeNavigationTarget.value) return '';
  const destination = `${activeNavigationTarget.value.lat},${activeNavigationTarget.value.lng}`;
  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'walking',
  });
  if (myLocation.value) {
    params.set('origin', `${myLocation.value.lat},${myLocation.value.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
});

const formatDistance = (meters) => {
  if (!Number.isFinite(meters)) return '等待我的位置';
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} 公尺`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} 公里`;
};

const formatDistanceToPoint = (pin) =>
  formatDistance(getDistanceMeters(myLocation.value, pin));

const showLocationNotice = (message, type = 'success') => {
  locationNotice.value = { message, type };
  if (noticeTimer) window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    locationNotice.value = { type: '', message: '' };
  }, 3200);
};

const clearHistoryLayer = () => {
  historyLayer?.clearLayers();
  historyPlaybackLayer?.clearLayers();
};

const stopHistoryPlayback = () => {
  historyIsPlaying.value = false;
  if (historyPlaybackTimer) {
    window.clearInterval(historyPlaybackTimer);
    historyPlaybackTimer = null;
  }
};

const stopMultiHistoryPlayback = () => {
  multiHistoryIsPlaying.value = false;
  if (multiHistoryPlaybackTimer) {
    window.clearInterval(multiHistoryPlaybackTimer);
    multiHistoryPlaybackTimer = null;
  }
};

const resetHistoryPlayback = () => {
  stopHistoryPlayback();
  historyCurrentIndex.value = 0;
  historySelectedStopIndex.value = -1;
  historyViewMode.value = 'overview';
};

const resetMultiHistoryPlayback = () => {
  stopMultiHistoryPlayback();
  multiHistoryCurrentTimestamp.value = 0;
  multiHistoryPlaybackMode.value = false;
};

const getHistoryCacheKey = ({ tripId, participantId, date }) =>
  `${tripId}:${participantId}:${date}`;

const getHistoryColor = (participantId) => {
  const value = String(participantId || '')
    .split('')
    .reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
      7
    );
  return HISTORY_ROUTE_COLORS[value % HISTORY_ROUTE_COLORS.length];
};

const fitHistoryBounds = (latLngs) => {
  if (!mapInstance || !latLngs.length) return;
  const bounds = L.latLngBounds(latLngs);
  if (bounds.isValid()) {
    mapInstance.fitBounds(bounds, {
      animate: true,
      paddingTopLeft: [28, 72],
      paddingBottomRight: [28, 210],
      maxZoom: 17,
    });
  }
};

const renderHistoryTrack = () => {
  if (!mapInstance || !historyLayer || !historyPlaybackLayer) return;
  clearHistoryLayer();
  if (!historyPoints.value.length) return;

  const latLngs = historyPoints.value.map((point) => [point.lat, point.lng]);
  splitTrackSegments(historyPoints.value).forEach((segment) => {
    if (segment.length < 2) return;
    L.polyline(
      segment.map((point) => [point.lat, point.lng]),
      {
        color: historyViewMode.value === 'overview' ? '#f97316' : '#94a3b8',
        weight: historyViewMode.value === 'overview' ? 5 : 4,
        opacity: historyViewMode.value === 'overview' ? 0.82 : 0.72,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: historyViewMode.value === 'overview' ? undefined : '2 7',
      }
    ).addTo(historyLayer);
  });

  historyStops.value.forEach((stop, stopIndex) => {
    const isSelected = historySelectedStopIndex.value === stopIndex;
    L.circleMarker([stop.lat, stop.lng], {
      radius: isSelected ? 10 : 8,
      color: isSelected ? '#fff7ed' : '#0f172a',
      weight: isSelected ? 3 : 2,
      fillColor: isSelected ? '#f97316' : '#0f172a',
      fillOpacity: 0.96,
    })
      .bindPopup(
        `停留 ${stop.durationMinutes} 分鐘<br>${formatTrackTime(stop.arrivedAt)} - ${formatTrackTime(stop.leftAt)}`,
        {
          closeButton: false,
          offset: [0, -3],
          className: 'location-track-stop-popup',
        }
      )
      .bindTooltip(String(stopIndex + 1), {
        permanent: true,
        direction: 'top',
        offset: [0, -6],
        className: 'location-track-stop-label',
      })
      .on('click', () => jumpToHistoryStop(stopIndex))
      .addTo(historyLayer);
  });

  const endpoints = [
    { latLng: latLngs[0], label: '起點', color: '#16a34a' },
    {
      latLng: latLngs[latLngs.length - 1],
      label: '終點',
      color: '#ea580c',
    },
  ];
  endpoints.forEach((endpoint, index) => {
    if (index === 1 && latLngs.length === 1) return;
    L.circleMarker(endpoint.latLng, {
      radius: 7,
      color: '#ffffff',
      weight: 3,
      fillColor: endpoint.color,
      fillOpacity: 1,
    })
      .bindTooltip(endpoint.label, {
        permanent: false,
        direction: 'top',
        offset: [0, -6],
      })
      .addTo(historyLayer);
  });

  if (historyViewMode.value === 'playback') updateHistoryPlaybackCursor();
  fitHistoryBounds(latLngs);
};

const updateHistoryPlaybackCursor = () => {
  if (!historyPlaybackLayer || !historyPoints.value.length) return;
  historyPlaybackLayer.clearLayers();
  const currentIndex = Math.min(
    Math.max(historyCurrentIndex.value, 0),
    historyPoints.value.length - 1
  );
  const currentPoint = historyPoints.value[currentIndex];
  splitTrackSegments(historyPoints.value.slice(0, currentIndex + 1)).forEach(
    (segment) => {
      if (segment.length < 2) return;
      L.polyline(
        segment.map((point) => [point.lat, point.lng]),
        {
          color: '#f97316',
          weight: 5,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round',
        }
      ).addTo(historyPlaybackLayer);
    }
  );

  L.circleMarker([currentPoint.lat, currentPoint.lng], {
    radius: 8,
    color: '#fff7ed',
    weight: 3,
    fillColor: '#f97316',
    fillOpacity: 1,
  })
    .bindTooltip(formatTrackTime(currentPoint.ts), {
      permanent: true,
      direction: 'top',
      offset: [0, -7],
      className: 'location-track-cursor-label',
    })
    .addTo(historyPlaybackLayer);
};

const seekHistory = (index, { center = true } = {}) => {
  if (!historyPoints.value.length) return;
  if (historyViewMode.value !== 'playback') {
    historyViewMode.value = 'playback';
    renderHistoryTrack();
  }
  historyCurrentIndex.value = Math.min(
    Math.max(Number(index) || 0, 0),
    historyPoints.value.length - 1
  );
  updateHistoryPlaybackCursor();
  if (center && mapInstance) {
    const point = historyPoints.value[historyCurrentIndex.value];
    mapInstance.panTo([point.lat, point.lng], { animate: true, duration: 0.2 });
  }
};

const jumpToHistoryStop = (stopIndex) => {
  const stop = historyStops.value[stopIndex];
  if (!stop) return;
  historySelectedStopIndex.value = stopIndex;
  renderHistoryTrack();
  seekHistory(findNearestTrackPointIndex(historyPoints.value, stop.arrivedAt));
};

const jumpHistoryStopRelative = (direction) => {
  if (!historyStops.value.length) return;
  const currentStopIndex = historyStops.value.reduce(
    (nearestIndex, stop, index) => {
      const stopPointIndex = findNearestTrackPointIndex(
        historyPoints.value,
        stop.arrivedAt
      );
      const currentDistance = Math.abs(
        stopPointIndex - historyCurrentIndex.value
      );
      const nearestDistance = Math.abs(
        findNearestTrackPointIndex(
          historyPoints.value,
          historyStops.value[nearestIndex]?.arrivedAt
        ) - historyCurrentIndex.value
      );
      return currentDistance < nearestDistance ? index : nearestIndex;
    },
    0
  );
  const nextIndex =
    direction === 'previous'
      ? Math.max(0, currentStopIndex - 1)
      : Math.min(historyStops.value.length - 1, currentStopIndex + 1);
  jumpToHistoryStop(nextIndex);
};

const changeHistoryPlaybackSpeed = (speed) => {
  historyPlaybackSpeed.value = speed;
  if (historyIsPlaying.value) {
    stopHistoryPlayback();
    toggleHistoryPlayback();
  }
};

const toggleHistoryPlayback = () => {
  if (!historyPoints.value.length) return;
  if (historyIsPlaying.value) {
    stopHistoryPlayback();
    return;
  }
  if (historyCurrentIndex.value >= historyPoints.value.length - 1) {
    historyCurrentIndex.value = 0;
  }
  if (historyViewMode.value !== 'playback') {
    historyViewMode.value = 'playback';
    renderHistoryTrack();
  }
  historyIsPlaying.value = true;
  historyPlaybackTimer = window.setInterval(() => {
    const nextIndex = historyCurrentIndex.value + 1;
    if (nextIndex >= historyPoints.value.length) {
      stopHistoryPlayback();
      return;
    }
    seekHistory(nextIndex, { center: true });
  }, HISTORY_PLAYBACK_INTERVALS[historyPlaybackSpeed.value] || 350);
};

const showHistoryOverview = () => {
  resetHistoryPlayback();
  renderHistoryTrack();
};

const updateMultiHistoryPlaybackCursor = () => {
  if (!historyPlaybackLayer) return;
  historyPlaybackLayer.clearLayers();
  if (!multiHistoryPlaybackMode.value) return;

  multiHistoryTracks.value.forEach((track) => {
    if (!multiHistoryVisibleIds.value.includes(track.participantId)) return;
    const point = getTrackPointAtTimestamp(
      track.points,
      multiHistoryCurrentTimestamp.value
    );
    if (!point) return;

    splitTrackSegments(
      track.points.filter(
        (item) => item.ts <= multiHistoryCurrentTimestamp.value
      )
    ).forEach((segment) => {
      const progressPoints = segment.map((item) => [item.lat, item.lng]);
      if (segment[segment.length - 1]?.ts < point.ts) return;
      progressPoints.push([point.lat, point.lng]);
      if (progressPoints.length > 1) {
        L.polyline(progressPoints, {
          color: track.color,
          weight: 5,
          opacity: 0.92,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(historyPlaybackLayer);
      }
    });
    L.circleMarker([point.lat, point.lng], {
      radius: 7,
      color: '#fff',
      weight: 3,
      fillColor: track.color,
      fillOpacity: 1,
    })
      .bindTooltip(
        `${track.member?.name || '成員'} · ${formatTrackTime(point.ts)}`,
        {
          permanent: true,
          direction: 'top',
          offset: [0, -7],
          className: 'location-track-cursor-label',
        }
      )
      .addTo(historyPlaybackLayer);
    if (track.participantId === multiHistoryFocusedId.value) {
      mapInstance?.panTo([point.lat, point.lng], { animate: false });
    }
  });
};

const renderMultiHistoryTrack = () => {
  if (!mapInstance || !historyLayer || !historyPlaybackLayer) return;
  historyLayer.clearLayers();
  historyPlaybackLayer.clearLayers();
  const bounds = [];

  multiHistoryTracks.value.forEach((track) => {
    if (!multiHistoryVisibleIds.value.includes(track.participantId)) return;
    const points = track.points || [];
    if (!points.length) return;
    points.forEach((point) => bounds.push([point.lat, point.lng]));
    splitTrackSegments(points).forEach((segment) => {
      if (segment.length < 2) return;
      L.polyline(
        segment.map((point) => [point.lat, point.lng]),
        {
          color: track.color,
          weight: multiHistoryPlaybackMode.value ? 3 : 4,
          opacity: multiHistoryPlaybackMode.value ? 0.3 : 0.72,
          lineCap: 'round',
          lineJoin: 'round',
        }
      ).addTo(historyLayer);
    });

    if (track.participantId !== multiHistoryFocusedId.value) return;
    track.stops.forEach((stop, stopIndex) => {
      L.circleMarker([stop.lat, stop.lng], {
        radius: 8,
        color: '#0f172a',
        weight: 2,
        fillColor: track.color,
        fillOpacity: 0.96,
      })
        .bindPopup(
          `停留 ${stop.durationMinutes} 分鐘<br>${formatTrackTime(stop.arrivedAt)} - ${formatTrackTime(stop.leftAt)}`,
          {
            closeButton: false,
            offset: [0, -3],
            className: 'location-track-stop-popup',
          }
        )
        .bindTooltip(String(stopIndex + 1), {
          permanent: true,
          direction: 'top',
          offset: [0, -6],
          className: 'location-track-stop-label',
        })
        .addTo(historyLayer);
    });
  });

  updateMultiHistoryPlaybackCursor();
  if (!multiHistoryPlaybackMode.value) fitHistoryBounds(bounds);
};

const loadParticipantHistory = async () => {
  const requestId = ++historyRequestSequence;
  const tripId = tripStore.currentTripId;
  const participantId = historyParticipantId.value;
  const selectedDate = historyDate.value;

  if (!tripId) {
    historyPoints.value = [];
    clearHistoryLayer();
    isHistoryLoading.value = false;
    historyError.value = '目前沒有可讀取的旅程。';
    return;
  }
  if (!participantId || !canViewMemberHistory(participantId)) {
    historyPoints.value = [];
    clearHistoryLayer();
    isHistoryLoading.value = false;
    historyError.value = '目前沒有查看這位成員軌跡的權限。';
    return;
  }
  const range = getLocalDateRange(selectedDate);
  if (!range) {
    historyPoints.value = [];
    clearHistoryLayer();
    isHistoryLoading.value = false;
    historyError.value = '請選擇正確的日期。';
    return;
  }

  isHistoryLoading.value = true;
  historyError.value = '';
  historyPoints.value = [];
  historyRejectedCount.value = 0;
  resetHistoryPlayback();
  clearHistoryLayer();

  const cacheKey = getHistoryCacheKey({
    tripId,
    participantId,
    date: selectedDate,
  });
  if (historyTrackCache.has(cacheKey)) {
    const cachedTrack = historyTrackCache.get(cacheKey);
    historyPoints.value = cachedTrack.points;
    historyRejectedCount.value = cachedTrack.rejectedCount;
    renderHistoryTrack();
    isHistoryLoading.value = false;
    return;
  }

  try {
    const points = await getParticipantLocationTrack({
      tripId,
      participantId,
      ...range,
    });
    if (requestId !== historyRequestSequence) return;

    const sanitizedTrack = sanitizeTrackPoints(points);
    historyTrackCache.set(cacheKey, sanitizedTrack);
    historyPoints.value = sanitizedTrack.points;
    historyRejectedCount.value = sanitizedTrack.rejectedCount;
    renderHistoryTrack();
  } catch (error) {
    if (requestId !== historyRequestSequence) return;
    historyPoints.value = [];
    clearHistoryLayer();
    historyError.value = error.message || '歷史軌跡讀取失敗。';
  } finally {
    if (requestId === historyRequestSequence) {
      isHistoryLoading.value = false;
    }
  }
};

const getMultiHistoryMember = (participantId) =>
  historyEligibleMembers.value.find(
    (member) => member.participantId === participantId
  ) || null;

const closeMultiHistoryPicker = () => {
  isMultiHistoryPickerOpen.value = false;
};

const openMultiHistoryPicker = () => {
  if (!canOpenMultiHistory.value) return;
  if (isHistoryPanelOpen.value) closeParticipantHistory();
  isMemberPanelOpen.value = false;
  isHistoryStopsOpen.value = false;
  multiHistoryDate.value = multiHistoryDate.value || getLocalDateValue();
  if (!multiHistoryParticipantIds.value.length) {
    multiHistoryParticipantIds.value = historyEligibleMembers.value
      .slice(0, 2)
      .map((member) => member.participantId);
  }
  isMultiHistoryPickerOpen.value = true;
};

const toggleMultiHistoryMember = (participantId) => {
  if (!participantId) return;
  const selected = new Set(multiHistoryParticipantIds.value);
  if (selected.has(participantId)) selected.delete(participantId);
  else selected.add(participantId);
  multiHistoryParticipantIds.value = Array.from(selected);
};

const loadMultiParticipantHistory = async () => {
  const requestId = ++multiHistoryRequestSequence;
  const tripId = tripStore.currentTripId;
  const selectedDate = multiHistoryDate.value;
  const selectedIds = multiHistoryParticipantIds.value.filter((id) =>
    historyEligibleMembers.value.some((member) => member.participantId === id)
  );
  const range = getLocalDateRange(selectedDate);

  resetMultiHistoryPlayback();
  clearHistoryLayer();
  multiHistoryTracks.value = [];
  multiHistoryVisibleIds.value = [];
  multiHistoryFocusedId.value = '';
  multiHistoryError.value = '';

  if (!tripId || !range || selectedIds.length === 0) {
    multiHistoryError.value = '請選擇至少一位成員與正確日期。';
    return;
  }

  isHistoryLoading.value = true;
  const results = await runWithConcurrency(
    selectedIds,
    async (participantId) => {
      const cacheKey = getHistoryCacheKey({
        tripId,
        participantId,
        date: selectedDate,
      });
      const member = getMultiHistoryMember(participantId);
      const color = getHistoryColor(participantId);
      try {
        let sanitizedTrack = historyTrackCache.get(cacheKey);
        if (!sanitizedTrack) {
          const points = await getParticipantLocationTrack({
            tripId,
            participantId,
            ...range,
          });
          sanitizedTrack = sanitizeTrackPoints(points);
          historyTrackCache.set(cacheKey, sanitizedTrack);
        }
        return {
          participantId,
          member,
          color,
          points: sanitizedTrack.points,
          stops: detectTrackStops(sanitizedTrack.points),
          rejectedCount: sanitizedTrack.rejectedCount,
          error: '',
        };
      } catch (error) {
        return {
          participantId,
          member,
          color,
          points: [],
          stops: [],
          rejectedCount: 0,
          error: error.message || '讀取失敗',
        };
      }
    },
    3
  );

  if (requestId !== multiHistoryRequestSequence) return;
  multiHistoryTracks.value = results;
  const validTracks = results.filter((track) => track.points.length);
  multiHistoryVisibleIds.value = validTracks.map(
    (track) => track.participantId
  );
  multiHistoryFocusedId.value = validTracks[0]?.participantId || '';
  multiHistoryCurrentTimestamp.value =
    validTracks.reduce(
      (result, track) => Math.min(result, track.points[0].ts),
      Number.POSITIVE_INFINITY
    ) || 0;
  if (results.some((track) => track.error)) {
    multiHistoryError.value = '部分成員軌跡讀取失敗，仍可查看其他成員。';
  }
  renderMultiHistoryTrack();
  isHistoryLoading.value = false;
};

const applyMultiHistorySelection = async () => {
  if (!multiHistoryParticipantIds.value.length) {
    showLocationNotice('請至少選擇一位成員。', 'error');
    return;
  }
  closeMultiHistoryPicker();
  isHistoryPanelOpen.value = false;
  isHistoryStopsOpen.value = false;
  isMultiHistoryPanelOpen.value = true;
  await loadMultiParticipantHistory();
};

const changeMultiHistoryDate = async (date) => {
  if (!date || date === multiHistoryDate.value) return;
  multiHistoryDate.value = date;
  if (isMultiHistoryPanelOpen.value) await loadMultiParticipantHistory();
};

const toggleMultiHistoryVisible = (participantId) => {
  const visible = new Set(multiHistoryVisibleIds.value);
  if (visible.has(participantId)) visible.delete(participantId);
  else if (
    multiHistoryTracks.value.some(
      (track) => track.participantId === participantId && track.points.length
    )
  ) {
    visible.add(participantId);
  }
  multiHistoryVisibleIds.value = Array.from(visible);
  if (!visible.has(multiHistoryFocusedId.value)) {
    multiHistoryFocusedId.value = multiHistoryVisibleIds.value[0] || '';
  }
  renderMultiHistoryTrack();
};

const focusMultiHistoryMember = (participantId) => {
  const track = multiHistoryTracks.value.find(
    (item) => item.participantId === participantId && item.points.length
  );
  if (!track) return;
  multiHistoryFocusedId.value = participantId;
  if (!multiHistoryVisibleIds.value.includes(participantId)) {
    multiHistoryVisibleIds.value = [
      ...multiHistoryVisibleIds.value,
      participantId,
    ];
  }
  renderMultiHistoryTrack();
  fitHistoryBounds(track.points.map((point) => [point.lat, point.lng]));
};

const seekMultiHistory = (timestamp) => {
  const start = multiHistoryTimelineStart.value;
  const end = multiHistoryTimelineEnd.value;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
  multiHistoryPlaybackMode.value = true;
  multiHistoryCurrentTimestamp.value = Math.min(
    Math.max(Number(timestamp) || start, start),
    end
  );
  renderMultiHistoryTrack();
  const focusedTrack = multiHistoryTracks.value.find(
    (track) => track.participantId === multiHistoryFocusedId.value
  );
  const point = focusedTrack
    ? getTrackPointAtTimestamp(
        focusedTrack.points,
        multiHistoryCurrentTimestamp.value
      )
    : null;
  if (point) mapInstance?.panTo([point.lat, point.lng], { animate: true });
};

const toggleMultiHistoryPlayback = () => {
  const start = multiHistoryTimelineStart.value;
  const end = multiHistoryTimelineEnd.value;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
  if (multiHistoryIsPlaying.value) {
    stopMultiHistoryPlayback();
    return;
  }
  if (
    !multiHistoryCurrentTimestamp.value ||
    multiHistoryCurrentTimestamp.value >= end
  ) {
    multiHistoryCurrentTimestamp.value = start;
  }
  multiHistoryPlaybackMode.value = true;
  multiHistoryIsPlaying.value = true;
  renderMultiHistoryTrack();
  const step = Math.max(30000, (end - start) / 180);
  multiHistoryPlaybackTimer = window.setInterval(() => {
    const speed = Number(multiHistoryPlaybackSpeed.value) || 1;
    const next = multiHistoryCurrentTimestamp.value + step * speed;
    if (next >= end) {
      multiHistoryCurrentTimestamp.value = end;
      renderMultiHistoryTrack();
      stopMultiHistoryPlayback();
      return;
    }
    multiHistoryCurrentTimestamp.value = next;
    renderMultiHistoryTrack();
  }, MULTI_HISTORY_PLAYBACK_INTERVALS[multiHistoryPlaybackSpeed.value] || 350);
};

const changeMultiHistoryPlaybackSpeed = (speed) => {
  multiHistoryPlaybackSpeed.value = speed;
  if (multiHistoryIsPlaying.value) {
    stopMultiHistoryPlayback();
    toggleMultiHistoryPlayback();
  }
};

const showMultiHistoryOverview = () => {
  resetMultiHistoryPlayback();
  renderMultiHistoryTrack();
};

const closeMultiHistory = () => {
  multiHistoryRequestSequence += 1;
  isMultiHistoryPanelOpen.value = false;
  isMultiHistoryPickerOpen.value = false;
  multiHistoryTracks.value = [];
  multiHistoryVisibleIds.value = [];
  multiHistoryFocusedId.value = '';
  multiHistoryError.value = '';
  resetMultiHistoryPlayback();
  clearHistoryLayer();
  isHistoryLoading.value = false;
};

const selectHistoryStop = (stopIndex) => {
  isHistoryStopsOpen.value = false;
  jumpToHistoryStop(stopIndex);
};

const changeParticipantHistoryDate = async (date) => {
  if (!date || date === historyDate.value) return;
  historyDate.value = date;
  await loadParticipantHistory();
};

const openParticipantHistory = async (participantId) => {
  if (!canViewMemberHistory(participantId)) return;
  if (isMultiHistoryPanelOpen.value) closeMultiHistory();
  historyParticipantId.value = participantId;
  historyDate.value = historyDate.value || getLocalDateValue();
  historyPoints.value = [];
  historyRejectedCount.value = 0;
  resetHistoryPlayback();
  historyError.value = '';
  isHistoryStopsOpen.value = false;
  isMemberPanelOpen.value = false;
  isHistoryPanelOpen.value = true;
  trackedParticipantId.value = '';
  followedParticipantId.value = '';
  activeGatheringPointId.value = '';
  await loadParticipantHistory();
};

const closeParticipantHistory = () => {
  historyRequestSequence += 1;
  isHistoryPanelOpen.value = false;
  isHistoryStopsOpen.value = false;
  historyParticipantId.value = '';
  historyPoints.value = [];
  historyRejectedCount.value = 0;
  resetHistoryPlayback();
  historyError.value = '';
  isHistoryLoading.value = false;
  clearHistoryLayer();
};

const createMemberIcon = (item) =>
  L.divIcon({
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

const createGatheringIcon = (pin) =>
  L.divIcon({
    className: '',
    iconSize: [66, 82],
    iconAnchor: [33, 78],
    html: createGatheringMapPinHtml({
      label: formatCountdown(pin.meetAt) || '集合',
      isActive: activeGatheringPointId.value === pin.id,
    }),
  });

const getBrowserPosition = (options = {}) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('此裝置不支援定位功能。'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000,
      ...options,
    });
  });

const centerMapOnBrowserPosition = async () => {
  if (!mapInstance) return false;
  try {
    const position = await getBrowserPosition({
      maximumAge: 60000,
      timeout: 8000,
    });
    mapInstance.setView(
      [position.coords.latitude, position.coords.longitude],
      Math.max(mapInstance.getZoom() || 16, 16),
      { animate: false }
    );
    hasAutoFit = true;
    return true;
  } catch (error) {
    return false;
  }
};

const persistBrowserPosition = async (position) => {
  const participantId = myParticipant.value?.id;
  if (!participantId) {
    throw new Error('目前沒有可更新位置的成員身份。');
  }

  const payload = await updateParticipantLocation({
    tripId: tripStore.currentTripId,
    participantId,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    heading: position.coords.heading,
    speed: position.coords.speed,
  });

  historyTrackCache.delete(
    getHistoryCacheKey({
      tripId: tripStore.currentTripId,
      participantId,
      date: getLocalDateValue(),
    })
  );

  mapInstance?.flyTo(
    [payload.lat, payload.lng],
    Math.max(mapInstance?.getZoom() || 16, 17),
    { duration: 0.5 }
  );
  return payload;
};

const updateMyLocation = async ({ quiet = false } = {}) => {
  if (isUpdatingMyLocation.value) return null;
  if (!myParticipant.value) {
    if (!quiet) showLocationNotice('請先以旅程成員身份登入。', 'error');
    return null;
  }

  isUpdatingMyLocation.value = true;
  try {
    const position = await getBrowserPosition();
    const payload = await persistBrowserPosition(position);
    if (!quiet) showLocationNotice('已更新我的位置。');
    return payload;
  } catch (error) {
    const denied = error?.code === 1;
    if (!quiet) {
      showLocationNotice(
        denied ? '定位權限已關閉，請到瀏覽器設定開啟。' : error.message,
        'error'
      );
    }
    return null;
  } finally {
    isUpdatingMyLocation.value = false;
  }
};

const handleOrientation = (event) => {
  let heading = Number(event.webkitCompassHeading);
  if (!Number.isFinite(heading)) {
    const alpha = Number(event.alpha);
    if (!Number.isFinite(alpha)) return;
    const orientationAngle = Number(window.screen?.orientation?.angle || 0);
    heading = normalizeDegrees(360 - alpha + orientationAngle);
  }
  deviceHeading.value = normalizeDegrees(heading);
  compassState.value = 'granted';
};

const startOrientationListener = () => {
  if (isOrientationListening) return;
  window.addEventListener('deviceorientationabsolute', handleOrientation, true);
  window.addEventListener('deviceorientation', handleOrientation, true);
  isOrientationListening = true;
};

const requestCompassPermission = async () => {
  if (typeof window.DeviceOrientationEvent === 'undefined') {
    compassState.value = 'unavailable';
    return false;
  }

  try {
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      const permission =
        await window.DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') {
        compassState.value = 'denied';
        return false;
      }
    }
    startOrientationListener();
    compassState.value = 'granted';
    return true;
  } catch (error) {
    compassState.value = 'denied';
    return false;
  }
};

const prepareNavigation = async () => {
  const compassPermission = requestCompassPermission();
  if (!myLocation.value) await updateMyLocation({ quiet: true });
  await compassPermission;
};

const fitAllLocations = ({ animate = true } = {}) => {
  if (!mapInstance) return;
  const bounds = [
    ...locations.value.map((item) => [item.lat, item.lng]),
    ...validGatheringPoints.value.map((item) => [item.lat, item.lng]),
  ];

  if (!bounds.length) {
    mapInstance.setView(mapCenter.value, 12, { animate });
    return;
  }

  if (bounds.length === 1) {
    mapInstance.setView(bounds[0], 16, { animate });
    return;
  }

  mapInstance.fitBounds(bounds, {
    animate,
    paddingTopLeft: [28, 120],
    paddingBottomRight: [28, 170],
    maxZoom: 16,
  });
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
    if (
      trackedParticipantId.value === participantId ||
      followedParticipantId.value === participantId
    ) {
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
    if (
      trackedParticipantId.value === participantId ||
      followedParticipantId.value === participantId
    ) {
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
  if (isHistoryPanelOpen.value) closeParticipantHistory();
  if (isMultiHistoryPanelOpen.value) closeMultiHistory();
  const item = locations.value.find(
    (location) => location.participantId === participantId
  );
  if (!item) return;
  selectedParticipantId.value = item.participantId;
  followedParticipantId.value = item.participantId;
  selectedGatheringPointId.value = '';
  activeGatheringPointId.value = '';
  if (
    trackedParticipantId.value &&
    trackedParticipantId.value !== item.participantId
  ) {
    trackedParticipantId.value = '';
  }
  renderMapMarkers();
  mapInstance.flyTo([item.lat, item.lng], Math.max(mapInstance.getZoom(), 17), {
    duration: 0.65,
  });
  if (closePanel) isMemberPanelOpen.value = false;
};

const selectGatheringPoint = (pin, { closePanel = false } = {}) => {
  if (!mapInstance || !pin) return;
  selectedGatheringPointId.value = pin.id;
  selectedParticipantId.value = '';
  followedParticipantId.value = '';
  trackedParticipantId.value = '';
  renderMapMarkers();
  mapInstance.flyTo([pin.lat, pin.lng], Math.max(mapInstance.getZoom(), 17), {
    duration: 0.65,
  });
  if (closePanel) isGatheringPanelOpen.value = false;
};

const toggleSelectedMemberTracking = () => {
  if (!selectedMember.value) return;
  if (trackedParticipantId.value === selectedMember.value.participantId) {
    trackedParticipantId.value = '';
    followedParticipantId.value = '';
    renderMapMarkers();
    return;
  }

  activeGatheringPointId.value = '';
  followedParticipantId.value = selectedMember.value.participantId;
  trackedParticipantId.value = selectedMember.value.participantId;
  renderMapMarkers();
  mapInstance?.flyTo(
    [selectedMember.value.lat, selectedMember.value.lng],
    Math.max(mapInstance.getZoom(), 17),
    { duration: 0.55 }
  );
  prepareNavigation();
};

const navigateToGatheringPoint = async (pin) => {
  if (!pin) return;
  trackedParticipantId.value = '';
  followedParticipantId.value = '';
  selectedParticipantId.value = '';
  selectedGatheringPointId.value = pin.id;
  activeGatheringPointId.value = pin.id;
  renderMapMarkers();
  mapInstance?.flyTo([pin.lat, pin.lng], Math.max(mapInstance.getZoom(), 17), {
    duration: 0.55,
  });
  isGatheringPanelOpen.value = false;
  await prepareNavigation();
};

const stopTracking = ({ clearSelection = true } = {}) => {
  trackedParticipantId.value = '';
  followedParticipantId.value = '';
  activeGatheringPointId.value = '';
  if (clearSelection) {
    selectedParticipantId.value = '';
    selectedGatheringPointId.value = '';
  }
  renderMapMarkers();
};

const showAllMembers = () => {
  if (isHistoryPanelOpen.value) closeParticipantHistory();
  if (isMultiHistoryPanelOpen.value) closeMultiHistory();
  stopTracking();
  fitAllLocations();
};

const openMemberPanel = () => {
  if (isHistoryPanelOpen.value) closeParticipantHistory();
  if (isMultiHistoryPanelOpen.value) closeMultiHistory();
  isGatheringPanelOpen.value = false;
  isMemberPanelOpen.value = true;
};

const openGatheringPanel = () => {
  if (isHistoryPanelOpen.value) closeParticipantHistory();
  if (isMultiHistoryPanelOpen.value) closeMultiHistory();
  isMemberPanelOpen.value = false;
  isGatheringPanelOpen.value = true;
};

const resetGatheringForm = () => {
  gatheringForm.id = '';
  gatheringForm.title = '集合地點';
  gatheringForm.meetAt = '';
};

const startGatheringPointCreate = () => {
  if (!userStore.isAdmin || !mapInstance) return;
  resetGatheringForm();
  isSelectingGatheringPoint.value = true;
  isGatheringPanelOpen.value = false;
  showLocationNotice('拖動地圖，將準星放在集合位置。');
};

const startGatheringPointEdit = (pin) => {
  if (!userStore.isAdmin || !mapInstance || !pin) return;
  gatheringForm.id = pin.id;
  gatheringForm.title = pin.title || '集合地點';
  gatheringForm.meetAt = pin.meetAt || '';
  selectedGatheringPointId.value = pin.id;
  isSelectingGatheringPoint.value = true;
  isGatheringPanelOpen.value = false;
  mapInstance.flyTo([pin.lat, pin.lng], Math.max(mapInstance.getZoom(), 17), {
    duration: 0.5,
  });
};

const cancelGatheringPointEdit = () => {
  isSelectingGatheringPoint.value = false;
  resetGatheringForm();
};

const saveGatheringPointFromMapCenter = async () => {
  if (!userStore.isAdmin || !mapInstance || isSavingGatheringPoint.value)
    return;
  const center = mapInstance.getCenter();
  isSavingGatheringPoint.value = true;
  try {
    const editingId = gatheringForm.id;
    const saved = await saveTripGatheringPoint({
      tripId: tripStore.currentTripId,
      pinId: editingId,
      latitude: center.lat,
      longitude: center.lng,
      title: gatheringForm.title,
      meetAt: gatheringForm.meetAt,
      createdBy: myParticipant.value?.id || userStore.user?.uid || '',
      createdByName:
        myParticipant.value?.name || userStore.user?.displayName || '',
    });
    selectedGatheringPointId.value = saved.id;
    isSelectingGatheringPoint.value = false;
    isGatheringPanelOpen.value = true;
    showLocationNotice(editingId ? '已更新集合點。' : '已建立集合點。');
    resetGatheringForm();
  } catch (error) {
    showLocationNotice(error.message, 'error');
  } finally {
    isSavingGatheringPoint.value = false;
  }
};

const removeGatheringPoint = async (pin) => {
  if (!userStore.isAdmin || !pin) return;
  if (deleteArmedPinId.value !== pin.id) {
    deleteArmedPinId.value = pin.id;
    if (deleteTimer) window.clearTimeout(deleteTimer);
    deleteTimer = window.setTimeout(() => {
      deleteArmedPinId.value = '';
    }, 3000);
    return;
  }

  try {
    await removeTripGatheringPoint({
      tripId: tripStore.currentTripId,
      pinId: pin.id,
    });
    if (activeGatheringPointId.value === pin.id)
      activeGatheringPointId.value = '';
    if (selectedGatheringPointId.value === pin.id)
      selectedGatheringPointId.value = '';
    deleteArmedPinId.value = '';
    showLocationNotice('已移除集合點。');
  } catch (error) {
    showLocationNotice(error.message, 'error');
  }
};

const renderMapMarkers = ({ fit = false } = {}) => {
  if (!mapInstance || !markerLayer) return;
  const activeParticipantIds = new Set();
  const activePinIds = new Set();

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
    marker.on('click', () => selectParticipant(item.participantId));
    markersByParticipantId.set(item.participantId, marker);
  });

  markersByParticipantId.forEach((marker, participantId) => {
    if (activeParticipantIds.has(participantId)) return;
    stopMarkerAnimation(participantId);
    markerLayer.removeLayer(marker);
    markersByParticipantId.delete(participantId);
  });

  validGatheringPoints.value.forEach((pin) => {
    activePinIds.add(pin.id);
    const nextLatLng = [pin.lat, pin.lng];
    const currentMarker = gatheringMarkersById.get(pin.id);

    if (currentMarker) {
      currentMarker.setLatLng(nextLatLng);
      currentMarker.setIcon(createGatheringIcon(pin));
      return;
    }

    const marker = L.marker(nextLatLng, {
      icon: createGatheringIcon(pin),
      title: pin.title || '集合地點',
      zIndexOffset: 500,
    });
    marker.addTo(markerLayer);
    marker.on('click', () => selectGatheringPoint(pin));
    gatheringMarkersById.set(pin.id, marker);
  });

  gatheringMarkersById.forEach((marker, pinId) => {
    if (activePinIds.has(pinId)) return;
    markerLayer.removeLayer(marker);
    gatheringMarkersById.delete(pinId);
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
    preferCanvas: true,
  }).setView(mapCenter.value, 12);
  L.control.zoom({ position: 'topright' }).addTo(mapInstance);
  L.control
    .attribution({ position: 'bottomleft', prefix: '' })
    .addAttribution('&copy; OpenStreetMap')
    .addTo(mapInstance);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(mapInstance);
  historyLayer = L.layerGroup().addTo(mapInstance);
  historyPlaybackLayer = L.layerGroup().addTo(mapInstance);
  markerLayer = L.layerGroup().addTo(mapInstance);
  setTimeout(() => mapInstance?.invalidateSize(), 120);
  await centerMapOnBrowserPosition();
  renderMapMarkers();
};

const destroyMap = () => {
  markerLayer = null;
  historyLayer = null;
  historyPlaybackLayer = null;
  stopHistoryPlayback();
  stopMultiHistoryPlayback();
  markerAnimationsByParticipantId.forEach((animationId) => {
    window.cancelAnimationFrame(animationId);
  });
  markerAnimationsByParticipantId.clear();
  markersByParticipantId.clear();
  gatheringMarkersById.clear();
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  hasAutoFit = false;
};

const subscribeData = () => {
  if (!tripStore.currentTripId || tripStore.isPublicTrip) {
    rawLocations.value = [];
    gatheringPoints.value = [];
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  if (unsubscribeLocations) unsubscribeLocations();
  if (unsubscribeGatheringPoints) unsubscribeGatheringPoints();

  unsubscribeLocations = subscribeTripLocations(
    tripStore.currentTripId,
    (rows) => {
      rawLocations.value = rows;
      rows.forEach((item) => {
        historyTrackCache.delete(
          getHistoryCacheKey({
            tripId: tripStore.currentTripId,
            participantId: item.participantId,
            date: getLocalDateValue(),
          })
        );
      });
      isLoading.value = false;
    }
  );

  unsubscribeGatheringPoints = subscribeTripGatheringPoints(
    tripStore.currentTripId,
    (rows) => {
      gatheringPoints.value = rows;
      if (
        activeGatheringPointId.value &&
        !rows.some((item) => item.id === activeGatheringPointId.value)
      ) {
        activeGatheringPointId.value = '';
      }
      if (
        selectedGatheringPointId.value &&
        !rows.some((item) => item.id === selectedGatheringPointId.value)
      ) {
        selectedGatheringPointId.value = '';
      }
    }
  );
};

watch(
  () => [tripStore.currentTripId, tripStore.isPublicTrip],
  async () => {
    historyRequestSequence += 1;
    multiHistoryRequestSequence += 1;
    historyTrackCache.clear();
    stopTracking();
    selectedParticipantId.value = '';
    followedParticipantId.value = '';
    selectedGatheringPointId.value = '';
    isMemberPanelOpen.value = false;
    isGatheringPanelOpen.value = false;
    isHistoryPanelOpen.value = false;
    isHistoryStopsOpen.value = false;
    isMultiHistoryPanelOpen.value = false;
    isMultiHistoryPickerOpen.value = false;
    multiHistoryParticipantIds.value = [];
    multiHistoryTracks.value = [];
    multiHistoryVisibleIds.value = [];
    multiHistoryFocusedId.value = '';
    multiHistoryError.value = '';
    resetMultiHistoryPlayback();
    isSelectingGatheringPoint.value = false;
    rawLocations.value = [];
    gatheringPoints.value = [];
    historyParticipantId.value = '';
    historyPoints.value = [];
    historyError.value = '';
    isHistoryLoading.value = false;
    destroyMap();
    subscribeData();
    await initMap();
  },
  { immediate: true }
);

watch([locations, validGatheringPoints], () => {
  renderMapMarkers();
});

watch(currentTimestamp, () => {
  renderMapMarkers();
});

onMounted(() => {
  onlineStatusTimer = window.setInterval(() => {
    currentTimestamp.value = Date.now();
  }, 30000);
  initMap();
});

onUnmounted(() => {
  historyRequestSequence += 1;
  multiHistoryRequestSequence += 1;
  historyTrackCache.clear();
  if (unsubscribeLocations) unsubscribeLocations();
  if (unsubscribeGatheringPoints) unsubscribeGatheringPoints();
  destroyMap();
  if (isOrientationListening) {
    window.removeEventListener(
      'deviceorientationabsolute',
      handleOrientation,
      true
    );
    window.removeEventListener('deviceorientation', handleOrientation, true);
    isOrientationListening = false;
  }
  if (noticeTimer) window.clearTimeout(noticeTimer);
  if (deleteTimer) window.clearTimeout(deleteTimer);
  if (onlineStatusTimer) window.clearInterval(onlineStatusTimer);
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
        class="rounded-[28px] border border-white/60 bg-white p-6 text-center shadow-sm"
      >
        <ShieldAlert :size="28" class="mx-auto text-slate-300" />
        <h2 class="mt-3 font-black text-slate-800">無法使用位置分享</h2>
        <p class="mt-2 text-sm font-bold leading-relaxed text-slate-400">
          位置分享只開放旅程成員使用。
        </p>
      </div>
    </section>

    <div ref="mapRef" class="absolute inset-0 z-0 bg-slate-100"></div>

    <LocationNavigationCard
      v-if="!tripStore.isPublicTrip"
      :target="activeNavigationTarget"
      :direction="navigationDirection"
      :distance-text="formatDistance(navigationDistance)"
      :countdown-text="formatCountdown(activeNavigationTarget?.meetAt)"
      :rotation="navigationRotation"
      :google-maps-url="googleMapsUrl"
      @stop="stopTracking"
    />

    <Transition name="location-notice">
      <div
        v-if="locationNotice.message"
        class="absolute inset-x-4 z-[530] mx-auto max-w-sm rounded-xl px-4 py-3 text-center text-xs font-black shadow-lg"
        :class="[
          activeNavigationTarget ? 'top-24' : 'top-4',
          locationNotice.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-slate-900 text-white',
        ]"
      >
        {{ locationNotice.message }}
      </div>
    </Transition>

    <div
      v-if="isLoading && !tripStore.isPublicTrip"
      class="absolute inset-0 z-[500] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
    >
      <RefreshCw :size="24" class="animate-spin text-orange-500" />
      <p class="mt-3 text-sm font-black text-slate-500">讀取位置中</p>
    </div>

    <GatheringPointEditor
      :open="isSelectingGatheringPoint"
      :form="gatheringForm"
      :is-saving="isSavingGatheringPoint"
      @save="saveGatheringPointFromMapCenter"
      @cancel="cancelGatheringPointEdit"
    />

    <div
      v-if="!tripStore.isPublicTrip && !isLoading && !isSelectingGatheringPoint"
      class="absolute inset-x-4 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-[510] flex flex-col items-end gap-2"
    >
      <LocationActionBar
        :has-participant="Boolean(myParticipant)"
        :is-updating="isUpdatingMyLocation"
        :member-label="memberButtonLabel"
        :gathering-count="validGatheringPoints.length"
        :can-show-all="Boolean(locations.length || validGatheringPoints.length)"
        @update-location="updateMyLocation()"
        @open-members="openMemberPanel"
        @open-gathering-points="openGatheringPanel"
        @show-all="showAllMembers"
      />

      <SelectedMemberCard
        :member="selectedMember"
        :is-tracked="trackedParticipantId === selectedMember?.participantId"
        :battery-text="selectedMember ? formatBattery(selectedMember) : '--'"
        :battery-tone-class="
          selectedMember
            ? getBatteryToneClass(selectedMember)
            : 'battery-tone--unknown'
        "
        :time-text="selectedMember ? formatTime(selectedMember.timestamp) : ''"
        :can-view-history="canViewMemberHistory(selectedMember)"
        @toggle-track="toggleSelectedMemberTracking"
        @view-history="openParticipantHistory(selectedMember?.participantId)"
        @close="stopTracking"
      />
    </div>

    <MemberLocationSheet
      :open="isMemberPanelOpen"
      :locations="locations"
      :online-count="onlineCount"
      :offline-count="offlineCount"
      :tracked-participant-id="trackedParticipantId"
      :format-time="formatTime"
      :format-battery="formatBattery"
      :get-battery-tone-class="getBatteryToneClass"
      :can-view-history="canViewMemberHistory"
      :can-open-multi-history="canOpenMultiHistory"
      :history-participant-id="historyParticipantId"
      @close="isMemberPanelOpen = false"
      @select-member="selectParticipant($event, { closePanel: true })"
      @view-history="openParticipantHistory"
      @open-multi-history="openMultiHistoryPicker"
    />

    <LocationTrackSheet
      :open="isHistoryPanelOpen"
      :member="historyParticipant"
      :selected-date="historyDate"
      :is-loading="isHistoryLoading"
      :points-count="historyPoints.length"
      :stops-count="historyStops.length"
      :first-point-time="historyFirstPointTime"
      :last-point-time="historyLastPointTime"
      :error="historyError"
      :current-index="historyCurrentIndex"
      :max-index="Math.max(0, historyPoints.length - 1)"
      :is-playing="historyIsPlaying"
      :playback-speed="historyPlaybackSpeed"
      :current-time-text="historyCurrentTime"
      :view-mode="historyViewMode"
      @close="closeParticipantHistory"
      @change-date="changeParticipantHistoryDate"
      @toggle-playback="toggleHistoryPlayback"
      @seek="seekHistory($event, { center: false })"
      @change-speed="changeHistoryPlaybackSpeed"
      @jump-stop="jumpHistoryStopRelative"
      @open-stops="isHistoryStopsOpen = true"
      @show-overview="showHistoryOverview"
    />

    <LocationTrackStopsSheet
      :open="isHistoryStopsOpen"
      :member="historyParticipant"
      :stops="historyStops"
      :selected-stop-index="historySelectedStopIndex"
      :format-time="formatTrackTime"
      @close="isHistoryStopsOpen = false"
      @select="selectHistoryStop"
    />

    <LocationMultiTrackSheet
      :open="isMultiHistoryPanelOpen"
      :tracks="multiHistoryTracks"
      :visible-participant-ids="multiHistoryVisibleIds"
      :focused-participant-id="multiHistoryFocusedId"
      :selected-date="multiHistoryDate"
      :is-loading="isHistoryLoading"
      :is-playing="multiHistoryIsPlaying"
      :is-playback-mode="multiHistoryPlaybackMode"
      :playback-speed="multiHistoryPlaybackSpeed"
      :timeline-start="multiHistoryTimelineStart"
      :timeline-end="multiHistoryTimelineEnd"
      :current-timestamp="multiHistoryCurrentTimestamp"
      :error="multiHistoryError"
      :format-time="formatTrackTime"
      @close="closeMultiHistory"
      @change-date="changeMultiHistoryDate"
      @edit-members="openMultiHistoryPicker"
      @toggle-visible="toggleMultiHistoryVisible"
      @focus-member="focusMultiHistoryMember"
      @toggle-playback="toggleMultiHistoryPlayback"
      @show-overview="showMultiHistoryOverview"
      @seek="seekMultiHistory"
      @change-speed="changeMultiHistoryPlaybackSpeed"
    />

    <LocationMemberTrackPicker
      :open="isMultiHistoryPickerOpen"
      :members="historyEligibleMembers"
      :selected-participant-ids="multiHistoryParticipantIds"
      :selected-date="multiHistoryDate"
      @close="closeMultiHistoryPicker"
      @toggle-member="toggleMultiHistoryMember"
      @change-date="changeMultiHistoryDate"
      @apply="applyMultiHistorySelection"
    />

    <GatheringPointSheet
      :open="isGatheringPanelOpen"
      :points="validGatheringPoints"
      :active-point-id="activeGatheringPointId"
      :delete-armed-point-id="deleteArmedPinId"
      :is-admin="userStore.isAdmin"
      :format-meet-at="formatMeetAt"
      :format-countdown="formatCountdown"
      :format-distance-to-point="formatDistanceToPoint"
      @close="isGatheringPanelOpen = false"
      @create="startGatheringPointCreate"
      @select="selectGatheringPoint"
      @navigate="navigateToGatheringPoint"
      @edit="startGatheringPointEdit"
      @remove="removeGatheringPoint"
    />
  </main>
</template>

<style>
.location-page {
  height: 100%;
  min-height: 100%;
  overscroll-behavior: none;
  touch-action: none;
}

.location-page .leaflet-container {
  width: 100%;
  height: 100%;
}

.location-page .location-track-stop-popup .leaflet-popup-content-wrapper {
  color: #fff;
  background: #0f172a;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgb(15 23 42 / 24%);
}

.location-page .location-track-stop-popup .leaflet-popup-content {
  margin: 7px 9px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.35;
  text-align: center;
}

.location-page .location-track-stop-popup .leaflet-popup-tip {
  background: #0f172a;
}

.location-page .location-track-stop-label,
.location-page .location-track-cursor-label {
  border: 0;
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  background: #0f172a;
  border-radius: 999px;
  box-shadow: 0 4px 10px rgb(15 23 42 / 24%);
}

.location-page .location-track-cursor-label {
  background: #f97316;
}

.location-notice-enter-active,
.location-notice-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.location-notice-enter-from,
.location-notice-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.gathering-map-marker {
  position: relative;
  display: flex;
  justify-content: center;
  width: 66px;
  height: 82px;
  transform-origin: 50% 92%;
  transition: transform 180ms ease;
}

.gathering-map-marker__label {
  position: absolute;
  top: -22px;
  left: 50%;
  z-index: 2;
  max-width: 128px;
  padding: 4px 7px;
  overflow: hidden;
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #c2410c;
  border-radius: 7px;
  box-shadow: 0 6px 14px rgb(124 45 18 / 24%);
  transform: translateX(-50%);
}

.gathering-map-marker__shape {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 52px;
  height: 66px;
  padding-top: 17px;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  background: #f97316;
  clip-path: polygon(
    50% 0%,
    70% 4%,
    88% 18%,
    96% 38%,
    88% 58%,
    50% 100%,
    12% 58%,
    4% 38%,
    12% 18%,
    30% 4%
  );
  filter: drop-shadow(0 2px 1px rgb(255 255 255 / 88%))
    drop-shadow(0 9px 12px rgb(124 45 18 / 28%));
}

.gathering-map-marker.is-active {
  z-index: 4;
  transform: translateY(-4px) scale(1.12);
}

.gathering-map-marker.is-active .gathering-map-marker__shape {
  animation: gathering-marker-pulse 1.8s ease-out infinite;
}

@keyframes gathering-marker-pulse {
  0%,
  100% {
    filter: drop-shadow(0 2px 1px rgb(255 255 255 / 88%))
      drop-shadow(0 9px 12px rgb(124 45 18 / 28%));
  }

  50% {
    filter: drop-shadow(0 2px 1px rgb(255 255 255 / 88%))
      drop-shadow(0 10px 18px rgb(249 115 22 / 58%));
  }
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
  padding: 5px 8px;
  overflow: hidden;
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

@keyframes member-avatar-pulse {
  0% {
    box-shadow: 0 0 0 0 var(--member-avatar-pulse-color);
  }

  100% {
    box-shadow: 0 0 0 24px rgb(0 0 0 / 0%);
  }
}

.location-page .leaflet-top.leaflet-right {
  top: 86px;
  right: 12px;
}

.location-page .leaflet-control-zoom {
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 12px;
  box-shadow: 0 10px 24px rgb(15 23 42 / 18%);
}

.location-page .leaflet-control-zoom a {
  width: 38px;
  height: 38px;
  color: #334155;
  font-size: 20px;
  line-height: 38px;
  background: rgb(255 255 255 / 96%);
  border-color: #e2e8f0;
}

.location-page .leaflet-control-attribution {
  color: #64748b;
  font-size: 9px;
  background: rgb(255 255 255 / 82%);
}

@media (prefers-reduced-motion: reduce) {
  .member-map-marker,
  .member-map-marker__name,
  .member-map-marker__shape,
  .member-map-marker__avatar-ring::before,
  .gathering-map-marker,
  .gathering-map-marker__shape {
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
