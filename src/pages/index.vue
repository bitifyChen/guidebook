<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useExpensesStore } from '@/store/expensesStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTravelStore } from '@/store/travelStore';
import dayjs from 'dayjs';
const travelStore = useTravelStore();
const expense = useExpensesStore();
const participants = useParticipantsStore();

const currentActivity = computed(() => travelStore.currentActivity);
const nextActivity = computed(() => travelStore.nextActivity);

//取得濟州島天氣
const weather = ref({});
const getWeather = async () => {
  const CACHE_KEY = 'jeju_weather_cache';
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        console.log('Using cached weather data');
        weather.value = data;
        return;
      }
    }

    const response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=33.5097&longitude=126.5219&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index&timezone=Asia%2FSeoul'
    );
    const data = await response.json();
    weather.value = data;
    
    // 存入快取
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Error fetching weather data:', error);
    weather.value = null;
  }
};

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
