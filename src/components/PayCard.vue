<script setup>
import { computed } from 'vue';
import { Plus, Trash2, ReceiptText, X, Wallet2, Users } from 'lucide-vue-next';
import { useParticipantsStore } from '@/store/participantsStore';
const participants = useParticipantsStore();
const props = defineProps({
  item: {
    type: Object,
    default: () => ({}),
  },
});

const payer = computed(() => participants.getParticipant(props?.item?.payerId));
const emit = defineEmits(['edit']);
const openDetail = () => emit('edit', props.item);
</script>

<template>
  <div
    @click="openDetail"
    class="bg-white p-5 rounded-[24px] border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow"
  >
    <div class="flex items-center gap-4">
      <div
        class="w-12 h-12 rounded-2xl bg-orange-50 flex flex-col items-center justify-center font-black text-orange-500 text-xs border border-orange-100"
      >
        <span class="scale-125">{{ payer?.name[0] }}</span>
      </div>
      <div>
        <h4 class="font-black text-slate-800 text-base leading-tight">
          {{ item.description }}
        </h4>
        <p
          class="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1"
        >
          {{ item.date }} <span class="opacity-30">•</span> 由
          {{ payer?.name }}
          付款
        </p>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <div class="text-right">
        <span class="font-black text-slate-800 text-lg"
          >₩{{ item.amount.toLocaleString() }}</span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 讓卡片有點進場感 */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.bg-white {
  animation: slideUp 0.4s ease-out backwards;
}
</style>
