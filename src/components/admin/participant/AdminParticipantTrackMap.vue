<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { splitTrackSegments } from '@/utils/locationTrack';

const props = defineProps({
  points: { type: Array, default: () => [] },
  selectedPointId: { type: String, default: '' },
});

const emit = defineEmits(['select-point']);
const mapElement = ref(null);
let map = null;
let trackLayer = null;
let pointLayer = null;
let canvasRenderer = null;
const markerById = new Map();

const drawTrack = ({ fit = false } = {}) => {
  if (!map || !trackLayer || !pointLayer) return;
  trackLayer.clearLayers();
  pointLayer.clearLayers();
  markerById.clear();

  const bounds = [];
  splitTrackSegments(props.points).forEach((segment) => {
    if (segment.length > 1) {
      L.polyline(
        segment.map((point) => [point.lat, point.lng]),
        {
          color: '#4f46e5',
          weight: 4,
          opacity: 0.8,
          lineJoin: 'round',
          renderer: canvasRenderer,
        }
      ).addTo(trackLayer);
    }
  });

  props.points.forEach((point) => {
    const isSelected = point.id === props.selectedPointId;
    const marker = L.circleMarker([point.lat, point.lng], {
      renderer: canvasRenderer,
      radius: isSelected ? 7 : 4,
      color: isSelected ? '#ffffff' : '#4338ca',
      weight: isSelected ? 3 : 1,
      fillColor: isSelected ? '#f97316' : '#6366f1',
      fillOpacity: isSelected ? 1 : 0.8,
    });
    marker.on('click', () => emit('select-point', point.id));
    marker.addTo(pointLayer);
    markerById.set(point.id, marker);
    bounds.push([point.lat, point.lng]);
  });

  if (fit && bounds.length) {
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
  }
};

const focusSelectedPoint = () => {
  if (!map || !props.selectedPointId) return;
  const point = props.points.find((item) => item.id === props.selectedPointId);
  if (!point) return;
  map.flyTo([point.lat, point.lng], Math.max(map.getZoom(), 16), {
    duration: 0.45,
  });
};

onMounted(async () => {
  await nextTick();
  map = L.map(mapElement.value, {
    zoomControl: true,
    preferCanvas: true,
  }).setView([23.7, 121], 7);
  canvasRenderer = L.canvas({ padding: 0.5 });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);
  trackLayer = L.layerGroup().addTo(map);
  pointLayer = L.layerGroup().addTo(map);
  drawTrack({ fit: true });
  window.setTimeout(() => map?.invalidateSize(), 180);
});

watch(
  () => props.points,
  () => drawTrack({ fit: true }),
  { deep: true }
);

watch(
  () => props.selectedPointId,
  () => {
    drawTrack();
    focusSelectedPoint();
  }
);

onBeforeUnmount(() => {
  map?.remove();
  map = null;
});
</script>

<template>
  <div class="relative h-full min-h-[320px] overflow-hidden bg-slate-100">
    <div ref="mapElement" class="absolute inset-0"></div>
    <div
      v-if="!points.length"
      class="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-slate-100/85"
    >
      <div
        class="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-400 shadow-sm"
      >
        此日期沒有軌跡資料
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.leaflet-control-attribution) {
  font-size: 9px;
}
</style>
