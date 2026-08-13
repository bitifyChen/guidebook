const EARTH_RADIUS_METERS = 6371000;

export const DEFAULT_TRACK_STOP_OPTIONS = Object.freeze({
  minDurationMinutes: 15,
  radiusMeters: 35,
  maxPointGapMinutes: 10,
});

const toRadians = (value) => (value * Math.PI) / 180;

export const formatTrackDateInTimezone = (timezone, date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
};

export const getDefaultTrackDateForTrip = (trip, date = new Date()) => {
  const today = formatTrackDateInTimezone(trip?.timezone || 'UTC', date);
  const isClosed = ['completed', 'archived'].includes(trip?.status);
  if (trip?.endDate && (isClosed || today > trip.endDate)) {
    return trip.endDate;
  }
  return today;
};

export const shiftTrackDate = (dateValue, days) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ''));
  if (!match) return '';
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};

const getDistanceMeters = (from, to) => {
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const fromLatitude = toRadians(from.lat);
  const toLatitude = toRadians(to.lat);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  );
};

const normalizePoints = (points) =>
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

const getAccuracy = (point) => Number(point?.accuracy ?? point?.acc);

const isValidTrackPoint = (point, maxAccuracyMeters) => {
  if (
    !point ||
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    !Number.isFinite(point.ts)
  ) {
    return false;
  }

  const accuracy = getAccuracy(point);
  return !Number.isFinite(accuracy) || accuracy <= maxAccuracyMeters;
};

const isLikelyIsolatedSpike = (previous, point, next, maxSpikeGapMinutes) => {
  if (!previous || !next) return false;
  const previousGap = point.ts - previous.ts;
  const nextGap = next.ts - point.ts;
  if (
    previousGap <= 0 ||
    nextGap <= 0 ||
    previousGap > maxSpikeGapMinutes * 60 * 1000 ||
    nextGap > maxSpikeGapMinutes * 60 * 1000
  ) {
    return false;
  }

  const previousDistance = getDistanceMeters(previous, point);
  const nextDistance = getDistanceMeters(point, next);
  const bridgeDistance = getDistanceMeters(previous, next);
  return previousDistance > 150 && nextDistance > 150 && bridgeDistance < 75;
};

export const sanitizeTrackPoints = (points, options = {}) => {
  const maxAccuracyMeters = getPositiveOption(options.maxAccuracyMeters, 150);
  const maxSpikeGapMinutes = getPositiveOption(options.maxSpikeGapMinutes, 10);
  const normalizedPoints = normalizePoints(points);
  const rejectedPoints = normalizedPoints.filter(
    (point) => !isValidTrackPoint(point, maxAccuracyMeters)
  );
  const validPoints = normalizedPoints.filter((point) =>
    isValidTrackPoint(point, maxAccuracyMeters)
  );
  const cleanedPoints = validPoints.filter((point, index) => {
    if (
      !isLikelyIsolatedSpike(
        validPoints[index - 1],
        point,
        validPoints[index + 1],
        maxSpikeGapMinutes
      )
    ) {
      return true;
    }
    rejectedPoints.push(point);
    return false;
  });

  return {
    points: cleanedPoints,
    rejectedPoints,
    rejectedCount: rejectedPoints.length,
  };
};

export const splitTrackSegments = (points, maxPointGapMinutes = 10) => {
  const normalizedPoints = normalizePoints(points);
  if (!normalizedPoints.length) return [];

  const maxGapMs = getPositiveOption(maxPointGapMinutes, 10) * 60 * 1000;
  const segments = [[normalizedPoints[0]]];
  normalizedPoints.slice(1).forEach((point) => {
    const currentSegment = segments[segments.length - 1];
    const previousPoint = currentSegment[currentSegment.length - 1];
    if (point.ts - previousPoint.ts > maxGapMs) {
      segments.push([point]);
    } else {
      currentSegment.push(point);
    }
  });
  return segments;
};

export const findNearestTrackPointIndex = (points, timestampOrPoint) => {
  const normalizedPoints = normalizePoints(points);
  if (!normalizedPoints.length) return -1;
  const targetTimestamp =
    typeof timestampOrPoint === 'object'
      ? Number(timestampOrPoint?.ts)
      : Number(timestampOrPoint);
  if (!Number.isFinite(targetTimestamp)) return 0;

  return normalizedPoints.reduce(
    (nearestIndex, point, index) =>
      Math.abs(point.ts - targetTimestamp) <
      Math.abs(normalizedPoints[nearestIndex].ts - targetTimestamp)
        ? index
        : nearestIndex,
    0
  );
};

export const getTrackPointAtTimestamp = (
  points,
  timestamp,
  maxGapMinutes = 10
) => {
  const normalizedPoints = normalizePoints(points);
  const targetTimestamp = Number(timestamp);
  if (!normalizedPoints.length || !Number.isFinite(targetTimestamp))
    return null;

  const firstPoint = normalizedPoints[0];
  const lastPoint = normalizedPoints[normalizedPoints.length - 1];
  if (targetTimestamp < firstPoint.ts || targetTimestamp > lastPoint.ts) {
    return null;
  }

  let low = 0;
  let high = normalizedPoints.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const point = normalizedPoints[middle];
    if (point.ts === targetTimestamp) return { ...point, ts: targetTimestamp };
    if (point.ts < targetTimestamp) low = middle + 1;
    else high = middle - 1;
  }

  const previous = normalizedPoints[Math.max(0, high)];
  const next = normalizedPoints[Math.min(normalizedPoints.length - 1, low)];
  if (!previous || !next) return null;
  if (previous.ts === next.ts) return { ...previous, ts: targetTimestamp };
  if (next.ts - previous.ts > getPositiveOption(maxGapMinutes, 10) * 60000) {
    return null;
  }

  const ratio = (targetTimestamp - previous.ts) / (next.ts - previous.ts);
  return {
    ...previous,
    lat: previous.lat + (next.lat - previous.lat) * ratio,
    lng: previous.lng + (next.lng - previous.lng) * ratio,
    ts: targetTimestamp,
  };
};

export const runWithConcurrency = async (items, worker, concurrency = 3) => {
  const values = Array.isArray(items) ? items : [];
  const results = new Array(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(
    Math.max(1, Number(concurrency) || 1),
    values.length
  );

  const runWorker = async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(values[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, runWorker));
  return results;
};

const getPositiveOption = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

export const detectTrackStops = (points, options = {}) => {
  const normalizedPoints = sanitizeTrackPoints(points, options).points;
  if (normalizedPoints.length < 2) return [];

  const minDurationMinutes = getPositiveOption(
    options.minDurationMinutes,
    DEFAULT_TRACK_STOP_OPTIONS.minDurationMinutes
  );
  const radiusMeters = getPositiveOption(
    options.radiusMeters,
    DEFAULT_TRACK_STOP_OPTIONS.radiusMeters
  );
  const maxPointGapMinutes = getPositiveOption(
    options.maxPointGapMinutes,
    DEFAULT_TRACK_STOP_OPTIONS.maxPointGapMinutes
  );
  const minDurationMs = minDurationMinutes * 60 * 1000;
  const maxPointGapMs = maxPointGapMinutes * 60 * 1000;
  const stops = [];
  let cluster = [];
  let clusterLatitudeTotal = 0;
  let clusterLongitudeTotal = 0;

  const startCluster = (point) => {
    cluster = [point];
    clusterLatitudeTotal = point.lat;
    clusterLongitudeTotal = point.lng;
  };

  const completeCluster = () => {
    if (cluster.length < 2) return;
    const arrivedAt = cluster[0].ts;
    const leftAt = cluster[cluster.length - 1].ts;
    const durationMs = leftAt - arrivedAt;
    if (durationMs < minDurationMs) return;

    stops.push({
      id: `${arrivedAt}-${leftAt}`,
      lat: clusterLatitudeTotal / cluster.length,
      lng: clusterLongitudeTotal / cluster.length,
      arrivedAt,
      leftAt,
      durationMinutes: Math.round(durationMs / 60000),
      pointsCount: cluster.length,
    });
  };

  normalizedPoints.forEach((point) => {
    if (!cluster.length) {
      startCluster(point);
      return;
    }

    const previousPoint = cluster[cluster.length - 1];
    const gapMs = point.ts - previousPoint.ts;
    const center = {
      lat: clusterLatitudeTotal / cluster.length,
      lng: clusterLongitudeTotal / cluster.length,
    };
    const remainsInArea = getDistanceMeters(center, point) <= radiusMeters;

    if (gapMs <= maxPointGapMs && remainsInArea) {
      cluster.push(point);
      clusterLatitudeTotal += point.lat;
      clusterLongitudeTotal += point.lng;
      return;
    }

    completeCluster();
    startCluster(point);
  });

  completeCluster();
  return stops;
};
