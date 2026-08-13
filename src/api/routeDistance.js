const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_TIMEOUT_MS = 12000;
const routeCache = new Map();

const toCoordinate = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

const getRouteCacheKey = (origin, destination) =>
  [origin, destination]
    .map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`)
    .join('|');

export const getDrivingRouteDistance = async (from, to) => {
  const origin = toCoordinate(from);
  const destination = toCoordinate(to);
  if (!origin || !destination) {
    throw new Error('缺少有效座標。');
  }

  const cacheKey = getRouteCacheKey(origin, destination);
  if (routeCache.has(cacheKey)) return routeCache.get(cacheKey);

  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_BASE_URL}/${coordinates}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('OSRM 路線計算逾時。');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    throw new Error(`OSRM 回應失敗：${response.status}`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route) throw new Error('OSRM 沒有回傳路線。');

  const result = {
    minutes: Math.max(0, Math.round(Number(route.duration || 0) / 60)),
    km: (Number(route.distance || 0) / 1000).toFixed(1),
    geometry:
      route.geometry?.type === 'LineString' &&
      Array.isArray(route.geometry.coordinates)
        ? route.geometry
        : null,
  };
  routeCache.set(cacheKey, result);
  return result;
};

export const getDrivingRoutes = async (segments, { concurrency = 3 } = {}) => {
  const source = Array.isArray(segments) ? segments : [];
  const results = new Array(source.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < source.length) {
      const index = nextIndex;
      nextIndex += 1;
      const segment = source[index];
      try {
        results[index] = {
          ...segment,
          route: await getDrivingRouteDistance(
            segment.origin,
            segment.destination
          ),
          error: null,
        };
      } catch (error) {
        results[index] = { ...segment, route: null, error };
      }
    }
  };

  const workerCount = Math.min(
    Math.max(Number(concurrency) || 1, 1),
    source.length
  );
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
};

export const clearDrivingRouteCache = () => routeCache.clear();
