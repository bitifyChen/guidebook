<script setup>
import { useRouter } from 'vue-router';
import AdminItineraryItemForm from '@/components/admin/AdminItineraryItemForm.vue';
import { ChevronLeft } from 'lucide-vue-next';

const router = useRouter();

const leavePage = () => {
  router.back();
};
</script>

<template>
  <div class="min-h-[100dvh] bg-slate-50">
    <nav
      class="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur sm:px-6 sm:py-4"
    >
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
        @click="leavePage"
      >
        <ChevronLeft :size="20" />
      </button>
      <h2 class="text-lg font-black text-slate-900">新增行程</h2>
      <div class="w-10"></div>
    </nav>
    <main class="mx-auto h-[calc(100dvh-65px)] max-w-3xl sm:h-[calc(100dvh-73px)]">
      <AdminItineraryItemForm
        mode="create"
        @cancel="leavePage"
        @saved="leavePage"
      />
    </main>
  </div>
</template>

<route>
{
  name: "AdminItemAddPage",
  meta: {
    layout: "admin"
  }
}
</route>
