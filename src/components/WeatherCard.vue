<script setup>
import { computed } from 'vue';
import { Sun, Wind, Cloud, CloudRain, CloudLightning } from 'lucide-vue-next';

const props = defineProps({
  city: { type: String, default: 'Jeju-si' },
  temp: { type: [Number, String], default: 20 },
  status: { type: String, default: 'Sunny' }, // Sunny, Cloudy, Rainy
  wind: { type: String, default: '5 km/h' },
  uv: { type: String, default: '低' },
});

// 定義天氣狀態與 UI 的完整映射
const weatherTheme = {
  Sunny: {
    bg: 'from-blue-400 to-indigo-600',
    icon: Sun,
    text: '晴時多雲，適宜戶外活動',
    shadow: 'bg-white/10',
  },
  Cloudy: {
    bg: 'from-gray-400 to-slate-600',
    icon: Cloud,
    text: '多雲陰天，光線柔和適合拍照',
    shadow: 'bg-gray-200/10',
  },
  Rainy: {
    bg: 'from-indigo-700 to-blue-900',
    icon: CloudRain,
    text: '正在下雨，建議安排室內行程',
    shadow: 'bg-blue-200/10',
  },
  Storm: {
    bg: 'from-purple-800 to-slate-900',
    icon: CloudLightning,
    text: '雷雨警告，請避免山區活動',
    shadow: 'bg-purple-400/10',
  },
};
// 取得目前的佈景主題設定
const current = computed(
  () => weatherTheme[props.status] || weatherTheme['Sunny']
);
</script>

<template>
  <div
    :class="[
      'bg-gradient-to-br rounded-3xl p-6 text-white shadow-lg relative overflow-hidden transition-all duration-500',
      current.bg,
    ]"
  >
    <div class="flex justify-between items-start relative z-10">
      <div>
        <p class="text-blue-100 text-sm font-medium">{{ city }} Weather</p>
        <h2 class="text-4xl font-bold mt-1">{{ temp }}°C</h2>
        <p class="text-blue-50 mt-1 font-light">{{ current.text }}</p>

        <div class="flex gap-4 mt-4">
          <div
            class="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-xs"
          >
            <Wind :size="14" /> <span>{{ wind }}</span>
          </div>
          <div
            class="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-xs"
          >
            <component :is="current.icon" :size="14" /> <span>UV {{ uv }}</span>
          </div>
        </div>
      </div>
      <component :is="current.icon" :size="64" class="opacity-30 -mr-2" />
    </div>

    <div
      :class="[
        'absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-2xl transition-colors',
        current.shadow,
      ]"
    ></div>
  </div>
</template>
