export const ITINERARY_TYPE_OPTIONS = [
  { value: 'point', label: '地點行程', defaultCategory: '景點' },
  { value: 'transport', label: '交通移動', defaultCategory: '交通' },
  { value: 'free', label: '自由時間', defaultCategory: '備註' },
];

export const ITINERARY_CATEGORY_OPTIONS = [
  { value: '景點', label: '景點' },
  { value: '餐飲', label: '餐飲' },
  { value: '交通', label: '交通' },
  { value: '住宿', label: '住宿' },
  { value: '購物', label: '購物' },
  { value: '活動', label: '活動' },
  { value: '集合', label: '集合' },
  { value: '備註', label: '備註' },
];

export const getItineraryTypeOption = (value) =>
  ITINERARY_TYPE_OPTIONS.find((option) => option.value === value) ||
  ITINERARY_TYPE_OPTIONS[0];

export const getItineraryCategoryLabel = (value, type = 'point') =>
  ITINERARY_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ||
  value ||
  getItineraryTypeOption(type).defaultCategory;
