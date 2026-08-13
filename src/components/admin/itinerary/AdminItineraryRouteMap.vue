<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Focus } from 'lucide-vue-next';

const props = defineProps({
  items: { type: Array, default: () => [] },
  routeResults: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  moveItemId: { type: String, default: '' },
});

const emit = defineEmits(['select', 'map-click']);

const mapRef = ref(null);
let mapInstance = null;
let markerLayer = null;
let routeLayer = null;
let resizeObserver = null;
let previousLocatedCount = 0;

const locatedItems = computed(() =>
  props.items
    .map((item, index) => ({
      item,
      index,
      lat:
        item?.geo?.lat === '' ||
        item?.geo?.lat === null ||
        item?.geo?.lat === undefined
          ? null
          : Number(item.geo.lat),
      lng:
        item?.geo?.lng === '' ||
        item?.geo?.lng === null ||
        item?.geo?.lng === undefined
          ? null
          : Number(item.geo.lng),
    }))
    .filter(
      (entry) =>
        Number.isFinite(entry.lat) &&
        Number.isFinite(entry.lng) &&
        Math.abs(entry.lat) <= 90 &&
        Math.abs(entry.lng) <= 180
    )
);

const interactionLabel = computed(() => {
  if (props.moveItemId) return '點選地圖以更新景點位置';
  return '';
});

const createMarkerIcon = (entry) => {
  const selected = String(entry.item.id) === props.selectedId;
  const child = Boolean(entry.item.parentId);
  return L.divIcon({
    className: 'admin-route-marker-shell',
    html: `<span class="admin-route-marker${selected ? ' is-selected' : ''}${child ? ' is-child' : ''}"><span class="admin-route-marker-label">${entry.index + 1}</span></span>`,
    iconSize: child ? [28, 34] : [34, 42],
    iconAnchor: child ? [14, 34] : [17, 42],
  });
};

const renderMarkers = () => {
  if (!mapInstance || !markerLayer) return;
  markerLayer.clearLayers();
  locatedItems.value.forEach((entry) => {
    const marker = L.marker([entry.lat, entry.lng], {
      icon: createMarkerIcon(entry),
      keyboard: true,
      title: entry.item.location || `景點 ${entry.index + 1}`,
    });
    marker.on('click', () => emit('select', String(entry.item.id)));
    marker.addTo(markerLayer);
  });
};

const renderRoutes = () => {
  if (!mapInstance || !routeLayer) return;
  routeLayer.clearLayers();
  props.routeResults.forEach((result) => {
    if (result.route?.geometry?.type === 'LineString') {
      L.geoJSON(result.route.geometry, {
        style: {
          color: '#4f46e5',
          opacity: 0.82,
          weight: 5,
          lineCap: 'round',
          lineJoin: 'round',
        },
      }).addTo(routeLayer);
      return;
    }

    if (result.origin && result.destination) {
      L.polyline(
        [
          [result.origin.lat, result.origin.lng],
          [result.destination.lat, result.destination.lng],
        ],
        {
          color: '#64748b',
          opacity: 0.65,
          weight: 3,
          dashArray: '7 8',
        }
      ).addTo(routeLayer);
    }
  });
};

const fitAll = () => {
  if (!mapInstance || !locatedItems.value.length) return;
  const bounds = L.latLngBounds(
    locatedItems.value.map((entry) => [entry.lat, entry.lng])
  );
  if (locatedItems.value.length === 1) {
    mapInstance.setView(bounds.getCenter(), 15, { animate: true });
    return;
  }
  mapInstance.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
};

const initializeMap = async () => {
  await nextTick();
  if (!mapRef.value || mapInstance) return;
  mapInstance = L.map(mapRef.value, {
    zoomControl: true,
    attributionControl: true,
  }).setView([23.8, 121], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapInstance);
  routeLayer = L.layerGroup().addTo(mapInstance);
  markerLayer = L.layerGroup().addTo(mapInstance);
  mapInstance.on('click', (event) => {
    if (!props.moveItemId) return;
    emit('map-click', {
      lat: event.latlng.lat,
      lng: event.latlng.lng,
    });
  });
  renderRoutes();
  renderMarkers();
  setTimeout(() => {
    mapInstance?.invalidateSize();
    fitAll();
  }, 180);

  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => mapInstance?.invalidateSize());
    resizeObserver.observe(mapRef.value);
  }
};

onMounted(initializeMap);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  mapInstance?.remove();
  mapInstance = null;
});

watch(
  () =>
    props.items
      .map(
        (item, index) =>
          `${item.id}:${index}:${item.geo?.lat ?? ''}:${item.geo?.lng ?? ''}:${item.parentId || ''}`
      )
      .join('|'),
  () => {
    renderMarkers();
    if (locatedItems.value.length !== previousLocatedCount) {
      previousLocatedCount = locatedItems.value.length;
      setTimeout(fitAll, 80);
    }
  }
);

watch(
  () => props.selectedId,
  (selectedId) => {
    renderMarkers();
    const selected = locatedItems.value.find(
      (entry) => String(entry.item.id) === selectedId
    );
    if (selected && mapInstance) {
      mapInstance.panTo([selected.lat, selected.lng], { animate: true });
    }
  }
);

watch(
  () => props.routeResults,
  () => renderRoutes(),
  { deep: true }
);
</script>

<template>
  <div class="relative h-full min-h-0 overflow-hidden bg-slate-200">
    <div ref="mapRef" class="h-full w-full"></div>

    <div
      v-if="interactionLabel"
      class="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-lg"
    >
      {{ interactionLabel }}
    </div>

    <button
      v-if="locatedItems.length"
      type="button"
      title="顯示全部景點"
      aria-label="顯示全部景點"
      class="absolute bottom-4 right-4 z-[500] flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-lg ring-1 ring-slate-200"
      @click="fitAll"
    >
      <Focus :size="18" />
    </button>
  </div>
</template>

<style scoped>
:global(.admin-route-marker-shell) {
  background: transparent;
  border: 0;
}

:global(.admin-route-marker) {
  position: relative;
  display: flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border: 3px solid #fff;
  border-radius: 50% 50% 50% 8px;
  background: #0f172a;
  box-shadow: 0 7px 16px rgb(15 23 42 / 28%);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  transform: rotate(-45deg);
}

:global(.admin-route-marker::before) {
  content: '';
  position: absolute;
  inset: 3px;
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: inherit;
}

:global(.admin-route-marker.is-selected) {
  background: #4f46e5;
  box-shadow:
    0 0 0 7px rgb(79 70 229 / 20%),
    0 8px 18px rgb(79 70 229 / 32%);
}

:global(.admin-route-marker.is-child) {
  width: 28px;
  height: 28px;
  border-width: 2px;
  background: #64748b;
  font-size: 9px;
}

:global(.admin-route-marker-label) {
  position: relative;
  z-index: 1;
  display: inline-flex;
  color: #fff;
  line-height: 1;
  transform: rotate(45deg);
}

:deep(.leaflet-control-zoom) {
  overflow: hidden;
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  box-shadow: 0 6px 18px rgb(15 23 42 / 12%) !important;
}

:deep(.leaflet-control-attribution) {
  font-size: 9px;
}
</style>
