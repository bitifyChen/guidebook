<script setup>
import { useRouter } from 'vue-router';
import { useUserStore } from '@/store/userStore';
import {
  LogOut,
  Map,
  Settings,
  Bell,
  PlusCircle,
  ChevronRight,
  ShieldCheck,
} from 'lucide-vue-next';

const router = useRouter();
const userStore = useUserStore();

const menuItems = [
  {
    title: '行程進度管理',
    desc: '調整停留時間與延遲',
    icon: Map,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    path: '/admin/itinerary',
  },
  {
    title: '每日起始時間',
    desc: '設定每天的出發時間',
    icon: Settings,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    path: '/admin/config',
  },
  {
    title: '新增行程地點',
    desc: '快速添加新的景點',
    icon: PlusCircle,
    color: 'text-green-500',
    bg: 'bg-green-50',
    path: '/admin/item/add',
  },
];
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
    <header
      class="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 p-6"
    >
      <div class="max-w-4xl mx-auto flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center text-white"
          >
            <ShieldCheck :size="24" />
          </div>
          <div>
            <h1 class="text-xl font-black text-slate-800 leading-none">
              Admin Dashboard
            </h1>
            <p
              class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1"
            >
              濟州小幫手管理後台
            </p>
          </div>
        </div>
        <button
          @click="
            userStore.logout();
            router.push('/admin/login');
          "
          class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-slate-300 hover:text-red-400 shadow-sm border border-slate-100"
        >
          <LogOut :size="18" />
        </button>
      </div>
    </header>

    <main class="max-w-4xl mx-auto p-6 space-y-4">
      <div
        v-for="item in menuItems"
        :key="item.path"
        @click="router.push(item.path)"
        class="bg-white p-6 rounded-[32px] border border-slate-100 flex items-center gap-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group"
      >
        <div
          :class="[
            item.bg,
            item.color,
            'w-16 h-16 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform',
          ]"
        >
          <component :is="item.icon" :size="28" />
        </div>

        <div class="flex-1">
          <h3 class="text-lg font-black text-slate-800">{{ item.title }}</h3>
          <p class="text-sm font-bold text-slate-400">{{ item.desc }}</p>
        </div>

        <div
          class="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-slate-800 group-hover:text-white transition-all"
        >
          <ChevronRight :size="20" />
        </div>
      </div>

      <div
        class="mt-12 text-center p-8 bg-slate-100/50 rounded-[40px] border border-dashed border-slate-200"
      >
        <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
          Management System v1.0
        </p>
      </div>
    </main>
  </div>
</template>

<route>
{
  name: "AdminPage",
  meta: { layout: "empty" }
}
</route>
