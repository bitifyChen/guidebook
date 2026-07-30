<script setup>
import { useRouter } from 'vue-router';
import { ChevronLeft } from 'lucide-vue-next';
import AdminItineraryWorkspace from '@/components/admin/itinerary/AdminItineraryWorkspace.vue';

const router = useRouter();
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-32">
    <nav
      class="sticky top-0 z-40 flex items-center justify-between bg-slate-50/80 p-6 backdrop-blur-md"
    >
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-100 bg-white shadow-sm"
        @click="router.push('/admin')"
      >
        <ChevronLeft :size="20" />
      </button>
      <h2 class="text-lg font-black text-slate-800">行程進度管理</h2>
      <div class="h-10 w-10"></div>
    </nav>

    <main class="mx-auto max-w-5xl">
      <AdminItineraryWorkspace />
    </main>
  </div>
</template>

<route>
{
  meta: { layout: "admin" }
}
</route>
