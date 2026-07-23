const COORDINATE_PATTERN = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;

const isValidCoordinate = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

const toCoordinate = (lat, lng) => {
  const nextLat = Number(lat);
  const nextLng = Number(lng);
  if (!isValidCoordinate(nextLat, nextLng)) return null;
  return { lat: nextLat, lng: nextLng };
};

const parseCoordinateText = (value) => {
  const match = String(value || '').match(COORDINATE_PATTERN);
  if (!match) return null;
  return toCoordinate(match[1], match[2]);
};

export const parseGoogleMapsCoordinates = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const dataMatch = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataMatch) return toCoordinate(dataMatch[1], dataMatch[2]);

  const atMatch = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) return toCoordinate(atMatch[1], atMatch[2]);

  try {
    const url = new URL(raw);
    for (const key of ['query', 'destination', 'origin', 'q', 'll']) {
      const parsed = parseCoordinateText(url.searchParams.get(key));
      if (parsed) return parsed;
    }
  } catch (error) {
    // Non-URL values are allowed; they may still contain explicit coordinates.
  }

  return parseCoordinateText(raw);
};

export const parseGoogleMapsPlaceId = (input) => {
  const raw = String(input || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    for (const key of ['query_place_id', 'place_id', 'placeId']) {
      const value = url.searchParams.get(key);
      if (value) return value.trim();
    }
  } catch (error) {
    // Non-URL values cannot contain reliable Google Place ID parameters.
  }

  return '';
};
