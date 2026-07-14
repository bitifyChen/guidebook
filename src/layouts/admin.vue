<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Bell,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  Plane,
  User,
  Users,
  X,
} from 'lucide-vue-next';
import AdminNavMenuItem from '@/components/admin/AdminNavMenuItem.vue';
import AdminTripSelector from '@/components/AdminTripSelector.vue';
import { useTripStore } from '@/store/tripStore';
import { useUserStore } from '@/store/userStore';

const route = useRoute();
const router = useRouter();
const tripStore = useTripStore();
const userStore = useUserStore();
const isSidebarOpen = ref(true);
const isMobileOpen = ref(false);

const baseMenu = [
  { label: '總覽', path: '/admin', icon: LayoutDashboard },
  { label: '旅程管理', path: '/admin/trips', icon: Plane, superOnly: true },
  { label: '成員管理', path: '/admin/participants', icon: Users, superOnly: true },
  { label: '推播管理', path: '/admin/notifications', icon: Bell, superOnly: true },
];

const sideMenu = computed(() =>
  baseMenu
    .map((item) => {
      if (item.superOnly && !userStore.isSuperAdmin) return null;
      if (item.children) {
        return {
          ...item,
          children: item.children.filter(
            (child) => !child.superOnly || userStore.isSuperAdmin
          ),
        };
      }
      return item;
    })
    .filter(Boolean)
);

const pageTitle = computed(() => {
  const flatten = (items) =>
    items.flatMap((item) => [item, ...(item.children ? flatten(item.children) : [])]);
  const allItems = flatten(sideMenu.value);
  return (
    allItems
      .filter((item) => item.path)
      .sort((a, b) => b.path.length - a.path.length)
      .find((item) => route.path === item.path || route.path.startsWith(`${item.path}/`))
      ?.label || '後台管理'
  );
});

const adminViewKey = computed(() => {
  if (route.path === '/admin/trips') return route.fullPath;
  return `${route.fullPath}:${tripStore.currentTripId || 'no-trip'}`;
});

const handleLogout = async () => {
  await userStore.logout();
  router.push('/admin/login');
};

onMounted(async () => {
  if (!userStore.isAuthReady) {
    await userStore.initAuth();
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-800 md:h-screen md:overflow-hidden">
    <div class="flex min-h-screen md:h-screen">
      <aside
        class="hidden md:flex flex-col bg-slate-950 text-white transition-all duration-300"
        :class="isSidebarOpen ? 'w-64' : 'w-20'"
      >
        <div class="p-5 flex items-center gap-3 border-b border-white/10">
          <div class="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center font-black">
            GB
          </div>
          <div v-if="isSidebarOpen" class="min-w-0">
            <div class="font-black leading-none">Guidebook</div>
            <div class="text-[10px] font-bold text-slate-400 mt-1">Admin Console</div>
          </div>
        </div>

        <nav class="flex-1 overflow-y-auto p-3 space-y-1">
          <AdminNavMenuItem
            v-for="item in sideMenu"
            :key="item.path || item.label"
            :item="item"
            :active-path="route.path"
            :is-sidebar-open="isSidebarOpen"
          />
        </nav>

        <div class="p-3 border-t border-white/10">
          <button
            @click="handleLogout"
            class="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-slate-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut class="w-5 h-5" />
            <span v-if="isSidebarOpen" class="font-bold text-sm">登出</span>
          </button>
        </div>
      </aside>

      <aside
        class="fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white md:hidden transition-transform"
        :class="isMobileOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="p-5 flex items-center justify-between border-b border-white/10">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center font-black">
              GB
            </div>
            <div class="font-black">Guidebook</div>
          </div>
          <button @click="isMobileOpen = false" class="p-2 rounded-lg hover:bg-white/10">
            <X class="w-5 h-5" />
          </button>
        </div>
        <nav class="p-3 space-y-1">
          <AdminNavMenuItem
            v-for="item in sideMenu"
            :key="item.path || item.label"
            :item="item"
            :active-path="route.path"
            :is-sidebar-open="true"
            @click="isMobileOpen = false"
          />
        </nav>
      </aside>

      <div
        v-if="isMobileOpen"
        class="fixed inset-0 z-40 bg-slate-950/60 md:hidden"
        @click="isMobileOpen = false"
      ></div>

      <section class="flex-1 min-w-0 flex flex-col">
        <header class="bg-white border-b border-slate-200">
          <div class="min-h-16 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <button
                @click="isMobileOpen = true"
                class="md:hidden w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center"
              >
                <Menu class="w-5 h-5" />
              </button>
              <button
                @click="isSidebarOpen = !isSidebarOpen"
                class="hidden md:flex w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 items-center justify-center"
              >
                <Menu class="w-5 h-5" />
              </button>
              <div class="min-w-0">
                <h1 class="font-black text-slate-800 truncate">{{ pageTitle }}</h1>
                <p class="text-[10px] font-bold text-slate-400">目前所有操作會套用到選取的旅程</p>
              </div>
            </div>

            <div class="flex items-center gap-2 min-w-0">
              <AdminTripSelector />
              <button
                @click="router.push('/')"
                class="hidden sm:flex w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 items-center justify-center text-slate-500 hover:bg-slate-100"
                title="前往前台"
              >
                <ExternalLink class="w-5 h-5" />
              </button>
              <div class="hidden md:flex items-center gap-3 pl-3 border-l border-slate-200">
                <div class="text-right">
                  <div class="text-sm font-black leading-none">
                    {{ userStore.myParticipant?.name || userStore.user?.displayName || 'Admin' }}
                  </div>
                  <div class="text-[10px] font-bold text-slate-400 mt-1">
                    {{ userStore.isSuperAdmin ? 'Super Admin' : 'Admin' }}
                  </div>
                </div>
                <div class="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <User class="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          <router-view v-slot="{ Component }">
            <transition name="admin-page" mode="out-in">
              <component :is="Component" :key="adminViewKey" />
            </transition>
          </router-view>
        </main>
      </section>
    </div>
  </div>
</template>

<style scoped>
.admin-page-enter-active,
.admin-page-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.admin-page-enter-from,
.admin-page-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
