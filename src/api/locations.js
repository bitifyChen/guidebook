import { rtdb } from '@/firebase/index.js';
import { onValue, ref, remove, set, update } from 'firebase/database';

export const subscribeTripLocations = (tripId, callback) => {
  if (!tripId) {
    callback([]);
    return () => {};
  }

  const locationRef = ref(rtdb, `tripLocations/${tripId}`);
  const unsubscribe = onValue(locationRef, (snapshot) => {
    const value = snapshot.val() || {};
    const rows = Object.entries(value).map(([participantId, data]) => ({
      participantId,
      ...data,
    }));
    callback(rows);
  });

  return unsubscribe;
};

export const updateParticipantLocation = async ({
  tripId,
  participantId,
  latitude,
  longitude,
  accuracy = null,
  altitude = null,
  heading = null,
  speed = null,
  source = 'pwa-manual',
}) => {
  if (!tripId || !participantId) {
    throw new Error('缺少旅程或成員資料，無法更新位置。');
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('定位座標無效。');
  }

  const updatedAt = Date.now();
  const payload = {
    participantId,
    tripId,
    lat,
    lng,
    acc: Number.isFinite(Number(accuracy)) ? Math.round(Number(accuracy)) : null,
    alt: Number.isFinite(Number(altitude)) ? Number(altitude) : null,
    course: Number.isFinite(Number(heading)) ? Number(heading) : null,
    speed: Number.isFinite(Number(speed)) ? Number(speed) : null,
    source,
    ts: updatedAt,
    updatedAt,
  };

  await update(
    ref(rtdb, `tripLocations/${tripId}/${participantId}`),
    payload
  );
  return payload;
};

export const subscribeTripGatheringPoint = (tripId, callback) => {
  if (!tripId) {
    callback(null);
    return () => {};
  }

  return onValue(
    ref(rtdb, `tripGatheringPins/${tripId}/active`),
    (snapshot) => callback(snapshot.val() || null)
  );
};

export const setTripGatheringPoint = async ({
  tripId,
  latitude,
  longitude,
  title = '集合地點',
  createdBy = '',
  createdByName = '',
}) => {
  if (!tripId) throw new Error('請先選擇旅程。');

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('集合點座標無效。');
  }

  const payload = {
    lat,
    lng,
    title: String(title || '集合地點').trim() || '集合地點',
    createdBy,
    createdByName,
    updatedAt: Date.now(),
  };

  await set(ref(rtdb, `tripGatheringPins/${tripId}/active`), payload);
  return payload;
};

export const clearTripGatheringPoint = async (tripId) => {
  if (!tripId) throw new Error('請先選擇旅程。');
  await remove(ref(rtdb, `tripGatheringPins/${tripId}/active`));
};
