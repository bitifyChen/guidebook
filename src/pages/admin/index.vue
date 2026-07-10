<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/store/userStore';
import { useTripStore } from '@/store/tripStore';
import {
  CalendarDays,
  Clock,
  Plane,
  PlusCircle,
  Users,
} from 'lucide-vue-next';

const router = useRouter();
const userStore = useUserStore();
const tripStore = useTripStore();

const cards = computed(() =>
  [
    {
      title: '旅程管理',
      desc: '建立旅程、邀請碼、完成與封存',
      icon: Plane,
      path: '/admin/trips',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      superOnly: true,
    },
    {
      title: '行程排序',
      desc: '調整每日項目、停留時間、延遲與匯入匯出',
      icon: CalendarDays,
      path: '/admin/itinerary',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      title: '每日設定',
      desc: '設定每日日期、標題與起始時間',
      icon: Clock,
      path: '/admin/config',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: '新增行程項目',
      desc: '為目前旅程新增景點、交通或自由時間',
      icon: PlusCircle,
      path: '/admin/item/add',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: '成員管理',
      desc: '建立遊客、複製個人 6 碼、設定權限',
      icon: Users,
      path: '/admin/participants',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      superOnly: true,
    },
  ].filter((card) => !card.superOnly || userStore.isSuperAdmin)
);
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl bg-white border border-slate-200 p-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-slate-900">後台總覽</h2>
          <p class="text-sm font-bold text-slate-400 mt-1">
            目前所有管理功能都會鎖定在上方選取的旅程。
          </p>
        </div>
        <div
          class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600"
        >
          {{ tripStore.currentTrip?.title || '尚未選擇旅程' }}
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <button
        v-for="card in cards"
        :key="card.path"
        @click="router.push(card.path)"
        class="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/70 transition-all"
      >
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          :class="[card.bg, card.color]"
        >
          <component :is="card.icon" :size="24" />
        </div>
        <div class="font-black text-slate-900">{{ card.title }}</div>
        <p class="text-sm font-bold text-slate-400 mt-1 leading-relaxed">
          {{ card.desc }}
        </p>
      </button>
    </section>
  </div>
</template>

<route>
{
  name: "AdminPage",
  meta: { layout: "admin" }
}
</route>
