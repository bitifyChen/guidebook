<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useExpensesStore } from '@/store/expensesStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTravelStore } from '@/store/travelStore';
import dayjs from 'dayjs';
const store = useTravelStore();
const expense = useExpensesStore();
const participants = useParticipantsStore();

const currentTime = ref(dayjs());
let timer = null;

// 使用 dayjs 判斷當前天數 (假設你有 startDate)
const currentDay = computed(() => {
  // 假設 store 有一個 startDate，若無請換成你的日期邏輯
  const start = dayjs(store.travelStartDate);
  return currentTime.value.diff(start, 'day') + 1;
});

const currentActivity = computed(() => {
  const now = currentTime.value;
  return store.dailyItinerary.find((item) => {
    const start = dayjs(item.startTime, 'HH:mm');
    const end = dayjs(item.endTime, 'HH:mm');
    // 使用 dayjs 判斷時間區間
    return (
      item.day === currentDay.value && now.isAfter(start) && now.isBefore(end)
    );
  });
});

const nextActivity = computed(() => {
  const now = currentTime.value;
  // 先篩選出當天尚未開始的，再找跨天的
  return store.dailyItinerary
    .filter(
      (item) =>
        (item.day === currentDay.value &&
          dayjs(item.startTime, 'HH:mm').isAfter(now)) ||
        item.day > currentDay.value
    )
    .sort((a, b) =>
      dayjs(a.startTime, 'HH:mm').diff(dayjs(b.startTime, 'HH:mm'))
    )[0];
});

//取得濟州島天氣
const weather = ref({});

const getWeather = async () => {
  try {
    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=33.5097&longitude=126.5219&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index&timezone=Asia%2FSeoul'
    );
    const data = await response.json();
    weather.value = data;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    weather.value = null;
  }
};

onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = dayjs(); // 每分鐘更新一次 dayjs 對象
  }, 60000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
getWeather();
</script>

<template>
  <div class="space-y-4">
    <WeatherCard :weather="weather" />
    <section>
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-slate-800">目前行程</h3>
      </div>
      <ItineraryCard
        v-if="currentActivity"
        :item="currentActivity"
        :timeLine="false"
      />
      <div
        v-else
        class="bg-white/50 p-6 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm"
      >
        目前沒有進行中的行程
      </div>
    </section>
    <section>
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-slate-800">下一個行程</h3>
      </div>
      <ItineraryCard
        v-if="nextActivity"
        :item="nextActivity"
        :timeLine="false"
      />
      <div
        v-else
        class="bg-white/50 p-6 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm"
      >
        之後沒有行程囉，好好休息吧！
      </div>
    </section>
    <section>
      <div class="grid grid-cols-2 gap-4">
        <div
          class="bg-white p-4 rounded-2xl border border-slate-100 text-center"
        >
          <p class="text-xs text-slate-400 font-bold mb-1">已支出</p>
          <p class="text-xl font-bold text-slate-800">
            ₩{{ expense.totalSpent.toLocaleString() }}
          </p>
        </div>
        <div
          class="bg-white p-4 rounded-2xl border border-slate-100 text-center"
        >
          <p class="text-xs text-slate-400 font-bold mb-1">旅行成員</p>
          <p class="text-xl font-bold text-slate-800">
            {{ participants.participants.length }} 位
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
