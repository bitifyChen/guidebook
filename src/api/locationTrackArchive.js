import {
  getCachedLocationTrack,
  setCachedLocationTrack,
} from '@/utils/locationTrackCache';

export const LOCATION_TRACK_ARCHIVE_BUFFER_MS = 48 * 60 * 60 * 1000;

const getBackendBaseUrl = () =>
  String(
    import.meta.env.VITE_GUIDEBOOK_BACKEND_URL ||
      'https://guidebook-ckce.onrender.com/'
  )
    .trim()
    .replace(/\/$/, '');

export const isLocationTrackArchiveEligible = ({
  endTime,
  now = Date.now(),
  bufferMs = LOCATION_TRACK_ARCHIVE_BUFFER_MS,
}) => {
  const end = Number(endTime);
  return Number.isFinite(end) && end <= Number(now) - Number(bufferMs);
};

const normalizeArchivePoints = (points) =>
  (Array.isArray(points) ? points : [])
    .map((point) => ({
      ...point,
      lat: Number(point?.lat),
      lng: Number(point?.lng),
      ts: Number(point?.ts),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        Number.isFinite(point.ts)
    )
    .sort((first, second) => first.ts - second.ts);

export const getArchivedParticipantLocationTrack = async ({
  tripId,
  participantId,
  date,
  viewerId,
  cacheVersion = 0,
  force = false,
  fetcher = globalThis.fetch,
}) => {
  const identity = {
    viewerId: viewerId || participantId,
    tripId,
    participantId,
    date,
    cacheVersion,
  };
  if (!force) {
    const cached = await getCachedLocationTrack(identity);
    if (cached) {
      return {
        ...cached,
        points: normalizeArchivePoints(cached.points),
        source: 'indexeddb',
      };
    }
  }

  const query = new URLSearchParams({ tripId, participantId, date });
  const response = await fetcher(
    `${getBackendBaseUrl()}/location-tracks/archive?${query.toString()}`,
    { headers: { Accept: 'application/json' } }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || '歷史軌跡封存資料讀取失敗。');
  }
  if (!payload.found) return null;

  const archive = {
    revision: Number(payload.revision || 0),
    checksum: payload.checksum || '',
    points: normalizeArchivePoints(payload.points),
    stops: Array.isArray(payload.stops) ? payload.stops : [],
    summary: payload.summary || {},
    source: 'firestore',
  };
  await setCachedLocationTrack(identity, archive);
  return archive;
};
