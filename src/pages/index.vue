<script setup>
import { computed } from 'vue';
import { useExpensesStore } from '@/store/expensesStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTravelStore } from '@/store/travelStore';
const store = useTravelStore();
const expense = useExpensesStore();
const participants = useParticipantsStore();
const nextActivity = computed(() => store.itinerary[0]);
</script>

<template>
  <div class="space-y-6">
    <WeatherCard status="Sunny" temp="22" />
    <section>
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-slate-800">下一個行程</h3>
      </div>
      <ItineraryCard
        v-if="nextActivity"
        :item="nextActivity"
        :timeLine="false"
      />
    </section>

    <div class="grid grid-cols-2 gap-4">
      <div class="bg-white p-4 rounded-2xl border border-slate-100 text-center">
        <p class="text-xs text-slate-400 font-bold mb-1">已支出</p>
        <p class="text-xl font-bold text-slate-800">
          ₩{{ expense.totalSpent.toLocaleString() }}
        </p>
      </div>
      <div class="bg-white p-4 rounded-2xl border border-slate-100 text-center">
        <p class="text-xs text-slate-400 font-bold mb-1">旅行成員</p>
        <p class="text-xl font-bold text-slate-800">
          {{ participants.participants.length }} 位
        </p>
      </div>
    </div>
  </div>
</template>
