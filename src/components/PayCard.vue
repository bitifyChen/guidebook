<script setup>
import { computed } from 'vue';
import { Plus, Trash2, ReceiptText, X, Wallet2, Users } from 'lucide-vue-next';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';
const participants = useParticipantsStore();
const tripStore = useTripStore();
const props = defineProps({
  item: {
    type: Object,
    default: () => ({}),
  },
});

const payer = computed(() => participants.getParticipant(props?.item?.payerId));
const splitParticipants = computed(() => {
  return (props.item.splitWithIds || [])
    .map((id) => participants.getParticipant(id))
    .filter((p) => p);
});

const emit = defineEmits(['edit']);
const openDetail = () => emit('edit', props.item);
</script>

<template>
  <div
    @click="openDetail"
    class="bg-white px-5 py-3 rounded-[24px] border border-slate-100 flex justify-between items-start shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
  >
    <div class="flex items-start gap-4 flex-1">
      <!-- 左側：頭像與付款人標籤 -->
      <div class="flex flex-col items-center gap-1.5 shrink-0">
        <div
          class="w-12 h-12 rounded-2xl overflow-hidden bg-orange-50 flex flex-col items-center justify-center font-black text-orange-500 text-xs border border-orange-100 shadow-sm"
        >
          <img
            v-if="payer?.avatar"
            :src="payer.avatar"
            class="w-full h-full object-cover"
          />
          <span v-else class="scale-125">{{ payer?.name?.[0] || '?' }}</span>
        </div>
        <span
          class="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg truncate max-w-[4em] border border-slate-200/50"
        >
          {{ payer?.name }}
        </span>
      </div>

      <!-- 中間：內容與參與人 -->
      <div class="flex-1 pt-0.5 min-w-0">
        <h4
          class="font-black text-slate-800 text-base leading-tight mb-2 line-clamp-2 break-words truncate max-w-[10em]"
        >
          {{ item.description }}
        </h4>

        <!-- 參與人頭像堆疊 -->
        <div class="flex -space-x-1 items-center">
          <div
            v-for="p in splitParticipants"
            :key="p.id"
            class="w-5 h-5 rounded-full border-2 border-white overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 shadow-sm"
            :title="p.name"
          >
            <img
              v-if="p.avatar"
              :src="p.avatar"
              class="w-full h-full object-cover"
            />
            <span v-else class="text-[6px] font-black text-slate-400">{{
              p.name?.[0]
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右側：日期與金額 -->
    <div
      class="flex flex-col items-end justify-between self-stretch min-h-[72px]"
    >
      <span class="text-[9px] font-black text-slate-500 px-2 py-1">
        {{ item.date }}
      </span>
      <div class="text-right">
        <span class="font-black text-slate-800 text-lg tracking-tighter"
          >{{ tripStore.currencySymbol }}{{ item.amount.toLocaleString() }}</span
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
