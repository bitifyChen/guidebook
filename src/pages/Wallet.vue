<script setup>
import { ref, reactive } from 'vue';
import { v4 as uuid } from 'uuid';
import { useExpensesStore } from '@/store/expensesStore';
import {
  postWalletItem,
  patchWalletItem,
  deleteWalletItem,
} from '@/api/wallet';
import { useParticipantsStore } from '@/store/participantsStore';
import { Plus, Trash2, ReceiptText, X, Wallet2, Users } from 'lucide-vue-next';

const expensesStore = useExpensesStore();
const participants = useParticipantsStore();

// 自定義自動聚焦指令
const vFocus = {
  mounted: (el) => {
    setTimeout(() => {
      const input = el.querySelector('input') || el;
      input.focus();
    }, 400);
  },
};

const drawerVisible = ref(false);

const form = reactive({
  amount: '',
  description: '',
  payerId: '',
  splitWithIds: [],
});
const editMethod = (data) => {
  Object.assign(form, data);
  drawerVisible.value = true;
};

const submitExpense = () => {
  if (!form.amount || !form.description || !form.payerId)
    return alert('請填寫完整的開支資訊！');
  if (form.id) {
    patchWalletItem(form.id, {
      amount: parseFloat(form.amount),
      description: form.description,
      payerId: form.payerId,
      splitWithIds: [...form.splitWithIds],
    })
      .then((res) => {
        console.log('更新成功', res);
      })
      .finally(() => {
        expensesStore.init(); // 重新抓取最新的開支列表
      });
  } else {
    postWalletItem({
      amount: parseFloat(form.amount),
      description: form.description,
      payerId: form.payerId,
      splitWithIds: [...form.splitWithIds],
    })
      .then((res) => {
        console.log('新增成功', res);
      })
      .finally(() => {
        expensesStore.init(); // 重新抓取最新的開支列表
      });
  }
  drawerVisible.value = false;
};
const deleteExpense = () => {
  if (!form.id) return;
  if (confirm('確定要刪除這筆開支嗎？')) {
    deleteWalletItem(form.id)
      .then((res) => {
        console.log('刪除成功', res);
      })
      .finally(() => {
        expensesStore.init(); // 重新抓取最新的開支列表
      });
    drawerVisible.value = false;
  }
};

const onClose = () => {
  Object.assign(form, {
    id: null,
    amount: '',
    description: '',
    payerId: '',
    splitWithIds: [],
  });
};
</script>

<template>
  <div class="space-y-8">
    <div
      class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden group"
    >
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-2 opacity-60">
          <Wallet2 :size="14" />
          <p class="text-[10px] font-black uppercase tracking-[0.2em]">
            旅行總支出
          </p>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-xl font-bold text-orange-400">₩</span>
          <h2 class="text-4xl font-black tracking-tight">
            {{ expensesStore.totalSpent.toLocaleString() }}
          </h2>
        </div>

        <el-button
          class="w-full !rounded-[20px] !h-14 mt-8 !text-lg !font-black !bg-orange-500 !border-none !text-white shadow-xl shadow-orange-900/20 active:scale-95 transition-transform"
          @click="drawerVisible = true"
        >
          <Plus :size="20" class="mr-2 stroke-[3px]" />
          新增行程開支
        </el-button>
      </div>
      <ReceiptText
        :size="120"
        class="absolute -bottom-6 -right-6 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700"
      />
    </div>

    <div class="space-y-4">
      <div class="flex justify-between items-end mb-4">
        <h3 class="font-black text-slate-800 text-xl tracking-tight">
          費用明細
        </h3>
        <span
          class="text-[10px] font-black text-slate-400 uppercase tracking-widest"
          >{{ expensesStore.expenses.length }} 筆記錄</span
        >
      </div>

      <div
        v-if="expensesStore.expenses.length === 0"
        class="flex flex-col items-center py-20 text-slate-300"
      >
        <ReceiptText :size="48" class="opacity-20 mb-2" />
        <p class="italic font-medium">尚未有任何開銷紀錄</p>
      </div>

      <PayCard
        v-for="exp in expensesStore.expenses"
        :key="exp.id"
        :item="exp"
        @edit="editMethod"
      >
      </PayCard>
    </div>

    <el-drawer
      v-model="drawerVisible"
      direction="btt"
      size="auto"
      :with-header="false"
      :append-to-body="true"
      class="custom-drawer"
      @close="onClose"
    >
      <div class="p-4">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl font-black text-slate-800">
            {{ form.id ? '編輯' : '新增' }}這筆開支
          </h2>
          <button
            @click="drawerVisible = false"
            class="p-2 bg-slate-100 rounded-full text-slate-400"
          >
            <X :size="20" />
          </button>
        </div>

        <el-form label-position="top" class="custom-form">
          <el-form-item>
            <template #label
              ><span class="label-custom">支出金額 (₩)</span></template
            >
            <el-input
              v-model="form.amount"
              v-focus
              inputmode="decimal"
              type="number"
              placeholder="0"
              class="custom-input"
            />
          </el-form-item>

          <el-form-item>
            <template #label
              ><span class="label-custom">支出內容</span></template
            >
            <el-input
              v-model="form.description"
              placeholder="例如：漢拿山炒飯"
              class="custom-input"
              enterkeyhint="done"
            />
          </el-form-item>

          <div class="grid grid-cols-2 gap-4">
            <el-form-item>
              <template #label
                ><span class="label-custom tracking-tighter"
                  >誰先墊錢？</span
                ></template
              >
              <el-select
                v-model="form.payerId"
                class="w-full custom-select"
                placeholder="選擇付款人"
              >
                <el-option
                  v-for="p in participants.participants"
                  :key="p.id"
                  :label="p.name"
                  :value="p.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item>
              <template #label
                ><span class="label-custom tracking-tighter"
                  >參與人數</span
                ></template
              >
              <div
                class="h-12 bg-slate-50 rounded-2xl flex items-center px-4 gap-2 text-slate-500"
              >
                <Users :size="16" />
                <span class="text-sm font-bold"
                  >{{ form.splitWithIds.length }} 人</span
                >
              </div>
            </el-form-item>
          </div>

          <el-form-item>
            <template #label
              ><span class="label-custom">要跟誰分這筆錢？</span></template
            >
            <el-checkbox-group
              v-model="form.splitWithIds"
              class="flex flex-wrap gap-2"
            >
              <el-checkbox
                v-for="p in participants.participants"
                :key="p.id"
                :label="p.id"
                class="custom-checkbox"
                border
                >{{ p.name }}</el-checkbox
              >
            </el-checkbox-group>
          </el-form-item>
        </el-form>

        <div class="mt-8 flex gap-4">
          <el-button
            v-if="form.id"
            type="primary"
            @click="deleteExpense"
            class="w-full !h-16 !rounded-[24px] !bg-red-500 !border-none !text-xl !font-black shadow-xl shadow-red-100 !ml-0"
            >刪除這筆開支</el-button
          >
          <el-button
            type="primary"
            @click="submitExpense"
            class="w-full !h-16 !rounded-[24px] !bg-orange-500 !border-none !text-xl !font-black shadow-xl shadow-orange-100"
            >{{ form.id ? '更新' : '儲存' }}這筆開支</el-button
          >
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.label-custom {
  font-size: 0.75rem; /* text-xs */
  font-weight: 900; /* font-black */
  color: #94a3b8; /* text-slate-400 */
  text-transform: uppercase;
  letter-spacing: 0.1em; /* tracking-widest */
  margin-left: 0.25rem; /* ml-1 */
}

/* 讓 Input 變可愛 */
:deep(.custom-input .el-input__wrapper) {
  border-radius: 1rem !important; /* rounded-2xl */
  background-color: #f8fafc !important; /* bg-slate-50 */
  box-shadow: none !important;
  border: 2px solid transparent !important;
  transition: all 0.3s;
  height: 56px;
}
:deep(.custom-input .el-input__wrapper.is-focus) {
  border-color: #ff8c00 !important; /* orange-500 */
  background-color: #ffffff !important;
}

/* 選擇框樣式 */
:deep(.custom-select .el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: #f8fafc !important;
  box-shadow: none !important;
  height: 48px;
}

/* 複選框按鈕化 */
.custom-checkbox.el-checkbox {
  border-radius: 0.75rem !important;
  margin-right: 0 !important;
  margin-bottom: 0 !important;
  border-color: #f1f5f9 !important;
  background-color: #f8fafc !important;
  transition: all 0.3s;
}
.custom-checkbox.is-checked {
  background-color: #fff4e6 !important;
  border-color: #ff8c00 !important;
}
</style>
