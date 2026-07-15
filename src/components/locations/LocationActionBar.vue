<script setup>
import { Crosshair, Flag, LocateFixed, Loader2, Users } from 'lucide-vue-next';

defineProps({
  hasParticipant: { type: Boolean, default: false },
  isUpdating: { type: Boolean, default: false },
  memberLabel: { type: String, default: '0' },
  gatheringCount: { type: Number, default: 0 },
  canShowAll: { type: Boolean, default: false },
});

defineEmits([
  'update-location',
  'open-members',
  'open-gathering-points',
  'show-all',
]);
</script>

<template>
  <div class="map-app-actions">
    <button
      v-if="hasParticipant"
      type="button"
      :disabled="isUpdating"
      class="map-app-button"
      @click="$emit('update-location')"
    >
      <Loader2 v-if="isUpdating" :size="16" class="animate-spin" />
      <Crosshair v-else :size="16" :stroke-width="2.5" />
      <span>更新定位</span>
    </button>
    <button type="button" class="map-app-button" @click="$emit('open-members')">
      <Users :size="16" :stroke-width="2.5" />
      <span>成員 {{ memberLabel }}</span>
    </button>
    <button
      type="button"
      class="map-app-button"
      @click="$emit('open-gathering-points')"
    >
      <Flag :size="16" :stroke-width="2.5" />
      <span>集合點 {{ gatheringCount }}</span>
    </button>
    <button
      v-if="canShowAll"
      type="button"
      class="map-app-button map-app-button--light"
      @click="$emit('show-all')"
    >
      <LocateFixed :size="16" :stroke-width="2.5" />
      <span>顯示全部</span>
    </button>
  </div>
</template>

<style scoped>
.map-app-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.map-app-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 104px;
  height: 42px;
  padding: 0 12px;
  color: #f8fafc;
  font-size: 12px;
  font-weight: 900;
  background:
    linear-gradient(135deg, rgb(30 41 59 / 76%), rgb(15 23 42 / 86%)),
    rgb(15 23 42 / 92%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 15px;
  -webkit-backdrop-filter: blur(12px) saturate(145%);
  backdrop-filter: blur(12px) saturate(145%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 18%),
    0 18px 40px rgb(15 23 42 / 32%);
}

.map-app-button--light {
  color: #334155;
  background: rgb(255 255 255 / 94%);
  border-color: rgb(255 255 255 / 90%);
}

.map-app-button:active {
  transform: scale(0.97);
}
</style>
