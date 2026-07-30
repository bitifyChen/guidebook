const toCoordinate = (item) => {
  if (
    item?.geo?.lat === '' ||
    item?.geo?.lat === null ||
    item?.geo?.lat === undefined ||
    item?.geo?.lng === '' ||
    item?.geo?.lng === null ||
    item?.geo?.lng === undefined
  ) {
    return null;
  }
  const lat = Number(item?.geo?.lat);
  const lng = Number(item?.geo?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

export const getItineraryMapUrl = (item) =>
  String(item?.map || item?.geo?.mapUrl || '').trim();

export const hasValidItineraryGeo = (item) => Boolean(toCoordinate(item));

export const buildItineraryRouteGroups = (items) => {
  const sortedItems = [...(Array.isArray(items) ? items : [])].sort(
    (first, second) => (Number(first.order) || 0) - (Number(second.order) || 0)
  );
  const parents = sortedItems.filter((item) => !item.parentId);

  return parents.map((parent) => {
    const children = sortedItems.filter((item) => item.parentId === parent.id);
    const lastChild = children[children.length - 1] || null;
    const originItem = hasValidItineraryGeo(lastChild) ? lastChild : parent;
    return { parent, children, originItem };
  });
};

export const buildItineraryRouteSegments = (items) => {
  const groups = buildItineraryRouteGroups(items);
  return groups.slice(0, -1).map((group, index) => ({
    item: group.parent,
    originItem: group.originItem,
    destinationItem: groups[index + 1].parent,
    origin: toCoordinate(group.originItem),
    destination: toCoordinate(groups[index + 1].parent),
  }));
};

export const getMissingRouteCoordinateItems = (items) => {
  const missing = new Map();
  buildItineraryRouteSegments(items).forEach((segment) => {
    if (!segment.origin) missing.set(segment.originItem.id, segment.originItem);
    if (!segment.destination) {
      missing.set(segment.destinationItem.id, segment.destinationItem);
    }
  });
  return [...missing.values()];
};

export const buildCoordinateAssistantItems = (items) =>
  items.map((item) => ({
    id: String(item.id),
    location: String(item.location || ''),
    map: getItineraryMapUrl(item),
    geo: {
      lat: hasValidItineraryGeo(item) ? Number(item.geo.lat) : null,
      lng: hasValidItineraryGeo(item) ? Number(item.geo.lng) : null,
    },
  }));

export const buildCoordinateAssistantPrompt = (items) =>
  [
    '請依據景點名稱與 Google Maps 連結補齊座標，並嚴格遵守以下規則：',
    '只回傳合法 JSON 陣列，不要使用 Markdown，不要加入說明文字。',
    '不得新增、刪除、重排項目，也不得修改 id、location、map。',
    'map 必須逐字保留原始純 URL 字串，不得改成 Markdown 超連結或其他格式。',
    '只可填寫 geo.lat 與 geo.lng，兩者必須是有效數字。',
    '',
    JSON.stringify(buildCoordinateAssistantItems(items), null, 2),
  ].join('\n');

const normalizeAssistantMapValue = (value) => {
  const text = String(value || '').trim();
  const markdownLink = text.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/i);
  return markdownLink ? markdownLink[2] : text;
};

export const parseCoordinateAssistantText = (text) => {
  const normalizedText = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!normalizedText) throw new Error('剪貼簿沒有可套用的 JSON。');

  const payload = JSON.parse(normalizedText);
  if (!Array.isArray(payload)) throw new Error('座標 JSON 必須是陣列。');
  return payload.map((item) => ({
    ...item,
    map: normalizeAssistantMapValue(item?.map),
  }));
};

export const validateCoordinateAssistantPayload = (payload, sourceItems) => {
  if (!Array.isArray(payload)) throw new Error('座標 JSON 必須是陣列。');
  const source = buildCoordinateAssistantItems(sourceItems);
  if (payload.length !== source.length) {
    throw new Error('回傳筆數與待補景點不一致。');
  }

  const sourceById = new Map(source.map((item) => [item.id, item]));
  const seenIds = new Set();
  return payload.map((item, index) => {
    const id = String(item?.id || '');
    const original = sourceById.get(id);
    if (!original) throw new Error(`第 ${index + 1} 筆包含未知 ID。`);
    if (seenIds.has(id)) throw new Error(`ID ${id} 重複出現。`);
    seenIds.add(id);
    if (
      String(item.location || '') !== original.location ||
      normalizeAssistantMapValue(item.map) !== original.map
    ) {
      throw new Error(`${original.location || id} 的名稱或地圖連結已被修改。`);
    }

    const lat = Number(item.geo?.lat);
    const lng = Number(item.geo?.lng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      throw new Error(`${original.location || id} 的經緯度無效。`);
    }
    return { id, geo: { lat, lng } };
  });
};
