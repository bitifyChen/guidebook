export const ITINERARY_JSON_ALLOWED_FIELDS = [
  'id',
  'day',
  'type',
  'order',
  'parentId',
  'location',
  'category',
  'cover',
  'map',
  'geo',
  'duration',
  'delay',
  'fixedStartTime',
  'nextDrive',
  'description',
  'detail',
  'images',
];

const ALLOWED_FIELD_SET = new Set(ITINERARY_JSON_ALLOWED_FIELDS);
const FORBIDDEN_FIELD_SET = new Set([
  'startTime',
  'endTime',
  'updatedAt',
  'tripId',
]);

const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const toOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
};

const cleanString = (value) =>
  value === null || value === undefined ? '' : String(value).trim();

const normalizeGeo = (geo) => {
  const source = geo && typeof geo === 'object' ? geo : {};
  const lat = toOptionalNumber(source.lat);
  const lng = toOptionalNumber(source.lng);
  const normalized = {
    lat,
    lng,
    placeId: cleanString(source.placeId),
  };
  return normalized.lat !== null ||
    normalized.lng !== null ||
    normalized.placeId
    ? normalized
    : null;
};

export const normalizeItineraryItemForJson = (item, forcedDay = null) => {
  const source = item || {};
  const map = cleanString(source.map || source.geo?.mapUrl);
  const normalized = {};

  if (source.id) normalized.id = String(source.id);
  normalized.day = Number(forcedDay || source.day || 1);
  normalized.type = cleanString(source.type || 'point') || 'point';
  normalized.order = toNumber(source.order, 0);
  normalized.parentId = cleanString(source.parentId);
  normalized.location = cleanString(source.location);
  normalized.category = cleanString(source.category);
  normalized.cover = cleanString(source.cover);
  normalized.map = map;

  const geo = normalizeGeo(source.geo);
  if (geo) normalized.geo = geo;

  normalized.duration = toNumber(source.duration, 0);
  normalized.delay = toNumber(source.delay, 0);
  normalized.fixedStartTime = cleanString(source.fixedStartTime);
  normalized.nextDrive = {
    time: toNumber(source.nextDrive?.time, 0),
    km: cleanString(source.nextDrive?.km),
  };
  normalized.description = cleanString(source.description);
  normalized.detail =
    source.detail === null || source.detail === undefined
      ? ''
      : String(source.detail);
  normalized.images = Array.isArray(source.images)
    ? source.images.map(cleanString).filter(Boolean)
    : [];

  return normalized;
};

export const buildDayItineraryJson = (items, day) =>
  items
    .filter((item) => Number(item.day) === Number(day))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((item, index) => ({
      ...normalizeItineraryItemForJson(item, day),
      order: index + 1,
    }));

export const buildFullItineraryJson = (items) =>
  [...items]
    .sort((a, b) => {
      if (Number(a.day) !== Number(b.day)) return Number(a.day) - Number(b.day);
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    })
    .map((item) => normalizeItineraryItemForJson(item));

const parsePayloadItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.itinerary)) return payload.itinerary;
  throw new Error('JSON 必須是陣列，或包含 items / itinerary 陣列。');
};

export const sanitizeItineraryJsonItems = (payload, options = {}) => {
  const { mode = 'day', day = 1 } = options;
  const rawItems = parsePayloadItems(payload);
  const ignoredFields = new Set();
  const warnings = [];

  const items = rawItems.map((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw new Error(`第 ${index + 1} 筆不是有效的物件。`);
    }

    for (const key of Object.keys(rawItem)) {
      if (!ALLOWED_FIELD_SET.has(key)) ignoredFields.add(key);
      if (FORBIDDEN_FIELD_SET.has(key)) ignoredFields.add(key);
    }

    const filtered = {};
    for (const key of ITINERARY_JSON_ALLOWED_FIELDS) {
      if (key in rawItem) filtered[key] = rawItem[key];
    }

    const normalized = normalizeItineraryItemForJson(
      filtered,
      mode === 'day' ? day : null
    );

    if (mode === 'day' && Number(rawItem.day || day) !== Number(day)) {
      warnings.push(`第 ${index + 1} 筆 day 已改回 Day ${day}。`);
    }

    normalized.order = index + 1;
    if (!normalized.location) {
      warnings.push(`第 ${index + 1} 筆缺少地點名稱。`);
    }

    return normalized;
  });

  if (ignoredFields.size) {
    warnings.push(`已忽略欄位：${[...ignoredFields].sort().join(', ')}`);
  }

  return { items, warnings };
};

export const buildItineraryAIPrompt = ({ mode, day, jsonText }) => {
  const scopeText =
    mode === 'day'
      ? `請只編輯 Day ${day} 的行程，不要輸出其他天。`
      : '請編輯整份行程，只有確定需要時才新增、刪除或移動天數。';

  return [
    '你是旅遊行程資料編輯助手。請依照以下規則修改 JSON：',
    scopeText,
    '只回傳合法 JSON，不要使用 Markdown，不要加說明文字。',
    '保留既有 id，除非該項目是新建立的行程。',
    `只能使用這些欄位：${ITINERARY_JSON_ALLOWED_FIELDS.join(', ')}。`,
    '不要輸出 startTime、endTime、updatedAt、tripId。',
    '請維持欄位型別：day/order/duration/delay/nextDrive.time 使用數字，images 使用字串陣列。',
    '地圖連結只能寫入 map；geo 只能包含 lat、lng 與選填 placeId，不要輸出 geo.mapUrl。',
    '若能判斷地點，請補齊 geo.lat、geo.lng；無法確認就保留空值。',
    '若能依相鄰地點估算，請補 nextDrive.time 與 nextDrive.km；無法確認就保留原值。',
    '',
    jsonText,
  ].join('\n');
};
