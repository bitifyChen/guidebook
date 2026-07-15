import { rtdb } from '@/firebase/index.js';
import { onValue, push, ref, remove, update } from 'firebase/database';

export const subscribeTripLocations = (tripId, callback) => {
  if (!tripId) {
    callback([]);
    return () => {};
  }

  return onValue(ref(rtdb, `tripLocations/${tripId}`), (snapshot) => {
    const value = snapshot.val() || {};
    callback(
      Object.entries(value).map(([participantId, data]) => ({
        participantId,
        ...data,
      }))
    );
  });
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

export const subscribeTripGatheringPoints = (tripId, callback) => {
  if (!tripId) {
    callback([]);
    return () => {};
  }

  return onValue(ref(rtdb, `tripGatheringPins/${tripId}`), (snapshot) => {
    const value = snapshot.val() || {};
    callback(
      Object.entries(value)
        .map(([id, data]) => ({ id, ...data }))
        .filter((item) => !item.archived)
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    );
  });
};

export const saveTripGatheringPoint = async ({
  tripId,
  pinId = '',
  latitude,
  longitude,
  title = '集合地點',
  meetAt = '',
  createdBy = '',
  createdByName = '',
}) => {
  if (!tripId) throw new Error('缺少旅程資料。');

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('集合點座標無效。');
  }

  const now = Date.now();
  const targetRef = pinId
    ? ref(rtdb, `tripGatheringPins/${tripId}/${pinId}`)
    : push(ref(rtdb, `tripGatheringPins/${tripId}`));

  const payload = {
    lat,
    lng,
    title: String(title || '集合地點').trim() || '集合地點',
    meetAt: meetAt || '',
    createdBy,
    createdByName,
    updatedAt: now,
    archived: false,
  };

  if (!pinId) payload.createdAt = now;

  await update(targetRef, payload);
  return { id: targetRef.key, ...payload };
};

export const removeTripGatheringPoint = async ({ tripId, pinId }) => {
  if (!tripId || !pinId) throw new Error('缺少集合點資料。');
  await remove(ref(rtdb, `tripGatheringPins/${tripId}/${pinId}`));
};
