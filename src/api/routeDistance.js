const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

const toCoordinate = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

export const getDrivingRouteDistance = async (from, to) => {
  const origin = toCoordinate(from);
  const destination = toCoordinate(to);
  if (!origin || !destination) {
    throw new Error('缺少有效座標。');
  }

  const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `${OSRM_BASE_URL}/${coordinates}?overview=false&alternatives=false&steps=false`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM 回應失敗：${response.status}`);
  }

  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route) throw new Error('OSRM 沒有回傳路線。');

  return {
    minutes: Math.max(0, Math.round(Number(route.duration || 0) / 60)),
    km: (Number(route.distance || 0) / 1000).toFixed(1),
  };
};
