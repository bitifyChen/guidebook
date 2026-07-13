<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminItineraryItemForm from '@/components/admin/AdminItineraryItemForm.vue';
import { useTravelStore } from '@/store/travelStore';
import { ChevronLeft } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const travelStore = useTravelStore();

const currentItem = computed(() =>
  travelStore.itinerary.find((item) => item.id === route.params.id)
);

const leavePage = () => {
  router.back();
};

onMounted(async () => {
  if (!travelStore.itinerary.length) {
    await travelStore.init();
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <nav
      class="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur"
    >
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
        @click="leavePage"
      >
        <ChevronLeft :size="20" />
      </button>
      <h2 class="text-lg font-black text-slate-900">編輯行程</h2>
      <div class="w-10"></div>
    </nav>
    <main class="mx-auto h-[calc(100vh-73px)] max-w-3xl">
      <AdminItineraryItemForm
        v-if="currentItem"
        mode="edit"
        :item="currentItem"
        @cancel="leavePage"
        @saved="leavePage"
        @deleted="leavePage"
      />
      <div
        v-else
        class="flex h-full items-center justify-center text-sm font-bold text-slate-400"
      >
        讀取行程中
      </div>
    </main>
  </div>
</template>

<route>
{
  name: "AdminItemDetailPage",
  meta: {
    layout: "admin"
  }
}
</route>
