<script setup>
import { computed } from 'vue';
import {
  Sun,
  Wind,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Loader,
} from 'lucide-vue-next';

const props = defineProps({
  city: { type: String, default: '目前城市' },
  weather: { type: Object, required: true },
});

const temp = computed(
  () =>
    `${props?.weather?.current?.temperature_2m ?? '-'} ${props?.weather?.current_units?.temperature_2m ?? '-'}` ||
    props?.weather?.current?.temperature_2m
);
const apparentTemp = computed(
  () =>
    `${props?.weather?.current?.apparent_temperature ?? '-'} ${
      props?.weather?.current_units?.apparent_temperature ?? '-'
    }` || props?.weather?.current?.apparent_temperature
);
const wind = computed(
  () =>
    `${props?.weather?.current?.wind_speed_10m ?? '-'} ${props?.weather?.current_units?.wind_speed_10m ?? '-'}`
);
const uv = computed(() => props?.weather?.current?.uv_index ?? '-');
const getWeatherThemeByCode = (code) => {
  // 參考 WMO 代碼分類邏輯
  if (code <= 1) return weatherTheme.Sunny; // 0: 晴, 1: 大致晴朗
  if (code <= 3) return weatherTheme.Cloudly; // 2: 雲量多, 3: 陰天
  if (code <= 55) return weatherTheme.Rainy; // 霧氣或毛毛雨
  if (code <= 67) return weatherTheme.Rainy; // 陣雨/持續性降雨
  if (code <= 77) return weatherTheme.Snowy; // 降雪（你可以新增一個 Snowy 主題）
  if (code <= 82) return weatherTheme.Rainy; // 強降雨
  if (code <= 99) return weatherTheme.Storm; // 雷雨
  return weatherTheme.Sunny; // 預設
};

// 定義天氣狀態與 UI 的完整映射
const weatherTheme = {
  Sunny: {
    bg: 'from-blue-400 to-indigo-600',
    icon: Sun,
    text: '晴朗舒適，適合出遊',
    shadow: 'bg-white/10',
  },
  Cloudly: {
    bg: 'from-gray-400 to-slate-600',
    icon: Cloud,
    text: '雲層較厚，氣溫適中',
    shadow: 'bg-gray-200/10',
  },
  Rainy: {
    bg: 'from-indigo-700 to-blue-900',
    icon: CloudRain,
    text: '有雨，建議室內行程',
    shadow: 'bg-blue-200/10',
  },
  Snowy: {
    bg: 'from-sky-200 to-blue-400',
    icon: Snowflake,
    text: '目前降雪中，路面濕滑請保暖',
    shadow: 'bg-white/20',
  }, // 新增
  Storm: {
    bg: 'from-purple-800 to-slate-900',
    icon: CloudLightning,
    text: '惡劣天氣，請注意安全',
    shadow: 'bg-purple-400/10',
  },
};
// 取得目前的佈景主題設定
const current = computed(() => {
  const code = props?.weather?.current?.weather_code;
  if (code !== undefined && code !== null) {
    return getWeatherThemeByCode(code);
  }
  return {
    bg: 'from-purple-800 to-slate-900',
    icon: Loader,
    text: '更新中...',
    shadow: 'bg-purple-400/10',
  };
});
</script>

<template>
  <div
    class="rounded-[22px] border border-[#dfe8e4] bg-white px-5 py-4 text-[var(--travel-ink)] relative overflow-hidden"
  >
    <div class="flex justify-between items-start relative z-10">
      <div>
        <p class="text-[var(--travel-teal)] text-xs font-bold tracking-widest">
          今日天氣 · {{ city }}
        </p>
        <h2 class="text-3xl font-black mt-1">
          {{ temp }}
        </h2>
        <span class="text-[12px] text-[#60787a]">體感 {{ apparentTemp }}</span>
        <p class="text-sm text-[#4f696b] mt-2">{{ current?.text }}</p>

        <div class="flex gap-4 mt-2">
          <div
            class="flex items-center gap-1 bg-[var(--travel-mist)] px-2 py-1 rounded-lg text-xs"
          >
            <Wind :size="14" /> <span>{{ wind }}</span>
          </div>
          <div
            class="flex items-center gap-1 bg-[var(--travel-mist)] px-2 py-1 rounded-lg text-xs"
          >
            <component :is="current?.icon" :size="14" />
            <span>UV {{ uv }}</span>
          </div>
        </div>
      </div>
      <component
        :is="current?.icon"
        :size="48"
        class="text-[var(--travel-teal)] opacity-60 -mr-2"
      />
    </div>
  </div>
</template>
