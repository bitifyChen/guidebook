import { parseGoogleMapsCoordinates } from './mapUrlParser';

const GOOGLE_MAPS_HOSTS = new Set([
  'google.com',
  'www.google.com',
  'maps.google.com',
  'www.google.com.tw',
  'www.google.co.jp',
  'www.google.co.kr',
]);

const SHORT_GOOGLE_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);
const COORDINATE_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

const isValidCoordinate = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

const parseCoordinate = (value) => {
  const match = String(value || '').match(COORDINATE_PATTERN);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return isValidCoordinate(lat, lng) ? { lat, lng } : null;
};

const decodeRouteLabel = (value) => {
  try {
    return decodeURIComponent(String(value || ''))
      .replace(/\+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    return String(value || '')
      .replace(/\+/g, ' ')
      .trim();
  }
};

const parseUrl = (input) => {
  try {
    return new URL(String(input || '').trim());
  } catch (error) {
    throw new Error('請輸入有效的 Google Maps 連結。');
  }
};

const assertGoogleMapsUrl = (url) => {
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    (!GOOGLE_MAPS_HOSTS.has(hostname) && !SHORT_GOOGLE_HOSTS.has(hostname))
  ) {
    throw new Error('只支援 Google Maps HTTPS 路線連結。');
  }
};

export const isGoogleMapsShortUrl = (input) => {
  const url = parseUrl(input);
  return SHORT_GOOGLE_HOSTS.has(url.hostname.toLowerCase());
};

export const buildGoogleMapsPointUrl = ({ name = '', lat, lng } = {}) => {
  const numericLat = Number(lat);
  const numericLng = Number(lng);
  const query = isValidCoordinate(numericLat, numericLng)
    ? `${numericLat},${numericLng}`
    : String(name || '').trim();
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : '';
};

const buildStop = (name, geo = null) => ({
  name: String(name || '').trim(),
  map: buildGoogleMapsPointUrl({ name, ...geo }),
  geo: {
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
  },
});

const parseApiDirectionsStops = (url) => {
  if (url.searchParams.get('api') !== '1') return [];
  const origin = url.searchParams.get('origin');
  const destination = url.searchParams.get('destination');
  if (!origin || !destination) return [];

  const waypoints = String(url.searchParams.get('waypoints') || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  return [origin, ...waypoints, destination].map((value) => {
    const name = decodeRouteLabel(value);
    return buildStop(name, parseCoordinate(name));
  });
};

const extractDirectionsPathLabels = (url) => {
  const segments = url.pathname.split('/').filter(Boolean);
  const dirIndex = segments.indexOf('dir');
  if (dirIndex < 0) return [];

  const labels = [];
  for (const segment of segments.slice(dirIndex + 1)) {
    if (segment.startsWith('@') || segment.startsWith('data=')) break;
    const label = decodeRouteLabel(segment);
    if (label) labels.push(label);
  }
  return labels;
};

const extractDirectionsCoordinates = (url) => {
  const matches = [
    ...url.href.matchAll(/!2m2!1d(-?\d+(?:\.\d+)?)!2d(-?\d+(?:\.\d+)?)/g),
  ];
  return matches
    .map((match) => ({ lat: Number(match[2]), lng: Number(match[1]) }))
    .filter((point) => isValidCoordinate(point.lat, point.lng));
};

const extractPlaceName = (url) => {
  const segments = url.pathname.split('/').filter(Boolean);
  for (const marker of ['place', 'search']) {
    const markerIndex = segments.indexOf(marker);
    const candidate = segments[markerIndex + 1];
    if (markerIndex >= 0 && candidate && !candidate.startsWith('@')) {
      return decodeRouteLabel(candidate);
    }
  }

  for (const key of ['query', 'q']) {
    const candidate = String(url.searchParams.get(key) || '').trim();
    if (candidate && !parseCoordinate(candidate)) {
      return decodeRouteLabel(candidate);
    }
  }
  return '';
};

export const parseGoogleMapsPlaceUrl = (input, { sourceUrl = input } = {}) => {
  const resolvedUrl = parseUrl(input);
  assertGoogleMapsUrl(resolvedUrl);
  if (SHORT_GOOGLE_HOSTS.has(resolvedUrl.hostname.toLowerCase())) {
    throw new Error('Google Maps 短網址需要先解析。');
  }
  if (resolvedUrl.pathname.split('/').includes('dir')) {
    throw new Error('請貼上單一景點連結，不是多站路線連結。');
  }

  const geo = parseGoogleMapsCoordinates(resolvedUrl.href);
  if (!geo) {
    throw new Error(
      '此景點連結無法取得座標，請重新分享 Google Maps 景點連結。'
    );
  }

  const normalizedSourceUrl = String(sourceUrl || input).trim();
  return {
    sourceUrl: normalizedSourceUrl,
    resolvedUrl: resolvedUrl.href,
    name: extractPlaceName(resolvedUrl) || 'Google Maps 景點',
    map: normalizedSourceUrl,
    geo,
  };
};

const parsePathDirectionsStops = (url) => {
  const labels = extractDirectionsPathLabels(url);
  if (!labels.length) return [];
  const coordinates = extractDirectionsCoordinates(url);
  const coordinatesMatchLabels = coordinates.length === labels.length;

  return labels.map((name, index) => {
    const coordinate = parseCoordinate(name);
    const geo =
      coordinate || (coordinatesMatchLabels ? coordinates[index] : null);
    return buildStop(name, geo);
  });
};

export const parseGoogleMapsDirectionsUrl = (
  input,
  { sourceUrl = input } = {}
) => {
  const resolvedUrl = parseUrl(input);
  assertGoogleMapsUrl(resolvedUrl);
  if (SHORT_GOOGLE_HOSTS.has(resolvedUrl.hostname.toLowerCase())) {
    throw new Error('Google Maps 短網址需要先解析。');
  }

  const apiStops = parseApiDirectionsStops(resolvedUrl);
  const stops =
    apiStops.length > 0 ? apiStops : parsePathDirectionsStops(resolvedUrl);
  if (stops.length < 2) {
    throw new Error('此連結不是可匯入的 Google Maps 多站路線。');
  }

  return {
    sourceUrl: String(sourceUrl || input).trim(),
    resolvedUrl: resolvedUrl.href,
    stops,
  };
};

export const createImportedItineraryItems = (
  stops,
  { day, startOrder = 1, idFactory } = {}
) => {
  const createId =
    idFactory ||
    ((index) =>
      `route-temp-${Date.now()}-${String(index + 1).padStart(2, '0')}`);

  const toNullableCoordinate = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  };

  return (Array.isArray(stops) ? stops : []).map((stop, index) => ({
    id: createId(index),
    day: Number(day),
    type: 'point',
    order: Number(startOrder) + index,
    parentId: '',
    location: String(stop?.name || '').trim(),
    category: '景點',
    cover: '',
    map: String(stop?.map || '').trim(),
    geo: {
      lat: toNullableCoordinate(stop?.geo?.lat),
      lng: toNullableCoordinate(stop?.geo?.lng),
    },
    duration: 0,
    delay: 0,
    fixedStartTime: '',
    nextDrive: { time: 0, km: '' },
    description: '',
    detail: '',
    images: [],
  }));
};
