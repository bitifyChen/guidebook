<script setup>
import { computed } from 'vue';
import { X, ArrowRightLeft, TrendingUp, TrendingDown, ArrowRight } from 'lucide-vue-next';
import { useUserStore } from '@/store/userStore';

const userStore = useUserStore();

const props = defineProps({
  visible: Boolean,
  expenses: {
    type: Array,
    default: () => [],
  },
  participants: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:visible']);

// 1. 計算每個人的原始收支
const balances = computed(() => {
  const data = {};
  // 初始化
  props.participants.forEach(p => {
    data[p.id] = {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      paid: 0,   // 實際掏出的錢
      owed: 0,   // 應該負擔的錢
    };
  });

  // 遍歷所有支出
  props.expenses.forEach(exp => {
    const amount = Number(exp.amount) || 0;
    const payerId = exp.payerId;
    const splitWithIds = exp.splitWithIds || [];

    // 付款者增加已支付
    if (data[payerId]) {
      data[payerId].paid += amount;
    }

    // 參與者增加應支付 (平均分攤)
    if (splitWithIds.length > 0) {
      const share = amount / splitWithIds.length;
      splitWithIds.forEach(id => {
        if (data[id]) {
          data[id].owed += share;
        }
      });
    }
  });

  return data;
});

// 2. 獲取目前登入者的統計資料
const myStats = computed(() => {
  const myId = userStore.myParticipant?.id;
  return balances.value[myId] || { paid: 0, owed: 0 };
});

// 3. 演算最簡還款路徑
const transactions = computed(() => {
  const results = [];
  const people = Object.values(balances.value).map(p => ({
    ...p,
    net: p.paid - p.owed // 正數代表別人欠他，負數代表他欠別人
  }));

  let debtors = people.filter(p => p.net < -0.1).sort((a, b) => a.net - b.net);
  let creditors = people.filter(p => p.net > 0.1).sort((a, b) => b.net - a.net);

  let d = 0, c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const amount = Math.min(-debtor.net, creditor.net);

    results.push({
      from: debtor,
      to: creditor,
      amount: Math.round(amount)
    });

    debtors[d].net += amount;
    creditors[c].net -= amount;

    if (Math.abs(debtors[d].net) < 0.1) d++;
    if (Math.abs(creditors[c].net) < 0.1) c++;
  }

  return results;
});

// 4. 過濾與我相關的還款資訊
const myTransactions = computed(() => {
  const myId = userStore.myParticipant?.id;
  return transactions.value.filter(t => t.from.id === myId || t.to.id === myId);
});

const close = () => emit('update:visible', false);
</script>

<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="(val) => emit('update:visible', val)"
    direction="btt"
    size="100%"
    :with-header="false"
    :append-to-body="true"
    class="full-screen-drawer"
  >
    <div class="h-full bg-slate-50 flex flex-col">
      <nav
        class="p-6 shrink-0 bg-slate-50/80 backdrop-blur-md z-40 flex items-center justify-between border-b border-slate-100"
      >
        <button
          @click="close"
          class="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"
        >
          <X :size="20" class="text-slate-400" />
        </button>
        <h2 class="font-black text-slate-800 text-lg">分帳結算詳情</h2>
        <div class="w-10"></div>
      </nav>

      <el-scrollbar class="flex-1">
        <main class="max-w-xl mx-auto p-6 space-y-6 pb-20">
          <!-- 個人收支統計卡片 -->
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
              <div class="flex items-center gap-2 mb-3 text-emerald-500">
                <TrendingUp :size="14" />
                <span class="text-[10px] font-black uppercase tracking-widest">已支付總額</span>
              </div>
              <p class="text-xl font-black text-slate-800 tracking-tighter">
                ₩{{ Math.round(myStats.paid).toLocaleString() }}
              </p>
              <p class="text-[9px] font-bold text-slate-300 mt-1">實際墊付的金額</p>
            </div>
            <div class="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
              <div class="flex items-center gap-2 mb-3 text-orange-500">
                <TrendingDown :size="14" />
                <span class="text-[10px] font-black uppercase tracking-widest">應支付總額</span>
              </div>
              <p class="text-xl font-black text-slate-800 tracking-tighter">
                ₩{{ Math.round(myStats.owed).toLocaleString() }}
              </p>
              <p class="text-[9px] font-bold text-slate-300 mt-1">我應分攤的總額</p>
            </div>
          </div>

          <!-- 結算建議 -->
          <div class="space-y-4 pt-4">
            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest px-2">
              我該如何結清錢？
            </h3>

            <div v-if="myTransactions.length === 0" class="bg-white p-10 rounded-[32px] border border-slate-100 flex flex-col items-center justify-center text-slate-300 space-y-3">
              <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                <ArrowRightLeft :size="32" class="opacity-20" />
              </div>
              <p class="font-bold text-sm italic">目前的帳目已兩清囉！</p>
            </div>

            <div
              v-for="(t, index) in myTransactions"
              :key="index"
              class="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between group"
            >
              <!-- 我的頭像 -->
              <div class="flex flex-col items-center gap-2">
                <div class="w-14 h-14 rounded-2xl overflow-hidden border-4 border-slate-50 shadow-sm">
                  <img v-if="t.from.avatar" :src="t.from.avatar" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full bg-slate-100 flex items-center justify-center font-black text-slate-400">
                    {{ t.from.name[0] }}
                  </div>
                </div>
                <span class="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{{ t.from.name }}</span>
              </div>

              <!-- 中間箭頭與金額 -->
              <div class="flex-1 flex flex-col items-center px-4">
                <div class="flex items-center gap-1 text-slate-200 mb-1">
                  <div class="h-[2px] w-8 bg-slate-100"></div>
                  <ArrowRight :size="16" class="text-orange-400" />
                  <div class="h-[2px] w-8 bg-slate-100"></div>
                </div>
                <div class="text-center">
                  <p class="text-xs font-bold text-slate-300 uppercase tracking-tighter mb-0.5">
                    {{ t.from.id === userStore.myParticipant?.id ? '應支付' : '應收取' }}
                  </p>
                  <p class="text-lg font-black text-slate-800 tracking-tighter">
                    ₩{{ t.amount.toLocaleString() }}
                  </p>
                </div>
              </div>

              <!-- 對方的頭像 -->
              <div class="flex flex-col items-center gap-2">
                <div class="w-14 h-14 rounded-2xl overflow-hidden border-4 border-slate-50 shadow-sm group-hover:border-orange-100 transition-colors">
                  <img v-if="t.to.avatar" :src="t.to.avatar" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full bg-slate-100 flex items-center justify-center font-black text-slate-400">
                    {{ t.to.name[0] }}
                  </div>
                </div>
                <span class="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{{ t.to.name }}</span>
              </div>
            </div>
          </div>

          <!-- 全體結帳概覽 (選填) -->
          <div v-if="transactions.length > myTransactions.length" class="pt-8 opacity-50">
             <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 mb-4 text-center">
              —— 其他成員的帳目 ——
            </h3>
            <div class="space-y-3">
               <div
                v-for="(t, index) in transactions.filter(t => t.from.id !== userStore.myParticipant?.id && t.to.id !== userStore.myParticipant?.id)"
                :key="'other-'+index"
                class="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-400"
              >
                <span>{{ t.from.name }}</span>
                <ArrowRight :size="10" />
                <span>{{ t.to.name }}</span>
                <span class="text-slate-600">₩{{ t.amount.toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </main>
      </el-scrollbar>
    </div>
  </el-drawer>
</template>

<style scoped>
/* 增加一點進場動畫 */
.bg-white {
  animation: slideUp 0.5s ease-out backwards;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
