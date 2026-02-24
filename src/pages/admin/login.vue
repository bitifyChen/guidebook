<script setup>
import { Lock } from 'lucide-vue-next';
import { loginWithGoogle } from '@/api/auth';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/store/userStore';

const router = useRouter();
const userStore = useUserStore();

const handleLogin = async () => {
  const res = await loginWithGoogle();
  if (res.status === 200) {
    router.push('/admin');
  }
};
</script>

<template>
  <div
    class="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6"
  >
    <div
      class="w-full max-w-sm bg-white rounded-[40px] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 text-center"
    >
      <div
        class="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6"
      >
        <Lock class="text-orange-500" :size="40" />
      </div>
      <h1 class="text-2xl font-black text-slate-800 mb-2">管理員登入</h1>
      <p class="text-slate-400 font-bold text-sm mb-10">
        請使用授權的 Google 帳號繼續
      </p>

      <button
        @click="handleLogin"
        class="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center gap-3 font-black text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
      >
        <img src="https://www.google.com/favicon.ico" class="w-5" />
        Google 快速登入
      </button>
    </div>
  </div>
</template>
<route>
  {
    name: "AdminLoginPage",
    meta: {
      layout: "empty"
    }
  }
</route>
