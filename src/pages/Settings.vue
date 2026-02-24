<script setup>
import { ref } from 'vue';
import { useTravelStore } from '@/store/travelStore';
import { UserPlus, Trash2, Heart } from 'lucide-vue-next';

const store = useTravelStore();
const newName = ref('');

const addPerson = () => {
  if (!newName.value) return;
  store.addParticipant(newName.value);
  newName.value = '';
};
</script>

<template>
  <div class="p-4 space-y-6">
    <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
      <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <UserPlus :size="18" class="text-orange-500" /> 行員管理
      </h3>

      <div class="flex gap-2 mb-6">
        <el-input
          v-model="newName"
          placeholder="成員姓名..."
          @keyup.enter="addPerson"
        />
        <el-button type="primary" @click="addPerson">新增</el-button>
      </div>

      <div class="space-y-3">
        <div
          v-for="p in store.participants"
          :key="p.id"
          class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center font-bold text-xs"
            >
              {{ p.name[0] }}
            </div>
            <span class="font-medium text-slate-700">{{ p.name }}</span>
          </div>
          <button
            @click="store.removeParticipant(p.id)"
            class="text-slate-300 hover:text-red-500"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
