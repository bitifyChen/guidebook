const EARTH_RADIUS_METERS = 6371000;

export const DEFAULT_TRACK_STOP_OPTIONS = Object.freeze({
  minDurationMinutes: 15,
  radiusMeters: 35,
  maxPointGapMinutes: 10,
});

const toRadians = (value) => (value * Math.PI) / 180;

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

const getPositiveOption = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

export const detectTrackStops = (points, options = {}) => {
  const normalizedPoints = normalizePoints(points);
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
