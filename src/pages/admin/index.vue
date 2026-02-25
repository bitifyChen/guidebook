<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/store/userStore';
import { loginWithGoogle } from '@/api/auth';
import {
  LogOut,
  Map,
  Settings,
  PlusCircle,
  ChevronRight,
  ShieldCheck,
  Users,
  LogIn,
  Lock,
  Home,
} from 'lucide-vue-next';

const router = useRouter();
const userStore = useUserStore();

const handleLogin = async () => {
  const res = await loginWithGoogle();
  if (res.status === 200) {
    router.push('/admin');
  }
};

const menuItems = [
  {
    title: '行程進度管理',
    desc: '調整停留時間與延遲',
    icon: Map,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    path: '/admin/itinerary',
    requiresSuperAdmin: false,
  },
  {
    title: '旅客名單管理',
    desc: '管理成員、權限與邀請碼',
    icon: Users,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    path: '/admin/participants',
    requiresSuperAdmin: true,
  },
  {
    title: '每日起始時間',
    desc: '設定每天的出發時間',
    icon: Settings,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    path: '/admin/config',
    requiresSuperAdmin: false,
  },
  {
    title: '新增行程地點',
    desc: '快速添加新的景點',
    icon: PlusCircle,
    color: 'text-green-500',
    bg: 'bg-green-50',
    path: '/admin/item/add',
    requiresSuperAdmin: false,
  },
  {
    title: '進階登入設定',
    desc: 'Firebase 與權限相關設定',
    icon: Settings,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
    path: '/admin/login',
    requiresSuperAdmin: false,
  },
];

const filteredMenuItems = computed(() => {
  if (!userStore.isAdmin) return [];
  if (userStore.isSuperAdmin) return menuItems;
  return menuItems.filter((item) => !item.requiresSuperAdmin);
});
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
        <div class="flex items-center gap-2">
          <button
            @click="router.push('/')"
            class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-500 shadow-sm border border-slate-100 transition-colors"
            title="返回首頁"
          >
            <Home :size="18" />
          </button>
          <button
            v-if="userStore.user"
            @click="
              userStore.logout();
              router.push('/');
            "
            class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-slate-300 hover:text-red-400 shadow-sm border border-slate-100 transition-colors"
            title="登出"
          >
            <LogOut :size="18" />
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto p-6 space-y-4">
      <!-- Not Logged In -->
      <div v-if="!userStore.myParticipant" class="py-20 text-center space-y-6">
        <div
          class="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center mx-auto text-slate-300"
        >
          <Lock :size="40" />
        </div>
        <div>
          <h2 class="text-xl font-black text-slate-800">尚未登入</h2>
          <p class="text-sm font-bold text-slate-400 mt-1">
            請使用帳號登入以存取管理功能
          </p>
        </div>
        <button
          @click="router.push({ name: 'SettingPage' })"
          class="bg-slate-800 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 mx-auto hover:bg-slate-700 transition-all shadow-xl shadow-slate-200"
        >
          <LogIn :size="20" />
          快速登入
        </button>
      </div>

      <!-- No Permission -->
      <div v-else-if="!userStore.isAdmin" class="py-20 text-center space-y-6">
        <div
          class="w-20 h-20 bg-red-50 rounded-[32px] flex items-center justify-center mx-auto text-red-300"
        >
          <ShieldCheck :size="40" />
        </div>
        <div>
          <h2 class="text-xl font-black text-slate-800">權限不足</h2>
          <p class="text-sm font-bold text-slate-400 mt-1">
            您的帳號目前不具備管理員權限
          </p>
        </div>
        <button
          v-if="userStore.user"
          @click="
            userStore.logout();
            router.push('/');
          "
          class="text-slate-400 font-black text-xs uppercase tracking-widest border-b border-slate-200 pb-1"
        >
          登出並返回首頁
        </button>
      </div>

      <!-- Admin Content -->
      <div v-else class="space-y-4">
        <div
          v-for="item in filteredMenuItems"
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
      </div>

      <div
        class="mt-12 text-center p-8 bg-slate-100/50 rounded-[40px] border border-dashed border-slate-200"
      >
        <p class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
          Management System v1.1
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
