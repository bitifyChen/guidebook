<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronLeft, Save } from 'lucide-vue-next';
import AdminConfigWorkspace from '@/components/admin/config/AdminConfigWorkspace.vue';

const router = useRouter();
const workspace = ref(null);
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
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
      <h2 class="text-lg font-black text-slate-800">行程全域設定</h2>
      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm"
        @click="workspace?.save()"
      >
        <Save :size="20" />
      </button>
    </nav>

    <main class="mx-auto max-w-4xl">
      <AdminConfigWorkspace ref="workspace" />
    </main>
  </div>
</template>

<route>
{
  meta: { layout: "admin" }
}
</route>
