<script setup>
import DataStatusNotice from '@/components/DataStatusNotice.vue';
import { appAlert, appConfirm } from '@/services/dialog';
import { ref, reactive, watch, computed, onUnmounted } from 'vue';
import {
  confirmDiscard,
  registerUnsavedGuard,
} from '@/services/unsavedChanges';
import { ElMessage } from 'element-plus';
import { v4 as uuid } from 'uuid';
import dayjs from 'dayjs';
import { useExpensesStore } from '@/store/expensesStore';
import { useUserStore } from '@/store/userStore';
import {
  postWalletItem,
  patchWalletItem,
  deleteWalletItem,
} from '@/api/wallet';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';
import { lockScroll, unlockScroll } from '@/utils/scrollLock';
import WalletAnalysis from '@/components/WalletAnalysis.vue';
import WalletSettlement from '@/components/WalletSettlement.vue';
import {
  Plus,
  Trash2,
  ReceiptText,
  X,
  Wallet2,
  Users,
  Lock,
  Calendar,
  PieChart,
  ArrowRightLeft,
} from 'lucide-vue-next';

const expensesStore = useExpensesStore();
const participants = useParticipantsStore();
const userStore = useUserStore();
const tripStore = useTripStore();

// 全選邏輯
const isIndeterminate = computed(() => {
  const checkedCount = form.splitWithIds.length;
  return checkedCount > 0 && checkedCount < participants.participants.length;
});

const isAllSelected = computed({
  get() {
    return (
      form.splitWithIds.length === participants.participants.length &&
      participants.participants.length > 0
    );
  },
  set(val) {
    form.splitWithIds = val ? participants.participants.map((p) => p.id) : [];
  },
});

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
const analysisVisible = ref(false);
const settlementVisible = ref(false);
const isSaving = ref(false);
const formError = ref('');
const baseline = ref('');
const isDirty = () =>
  drawerVisible.value && JSON.stringify(form) !== baseline.value;
const unregisterGuard = registerUnsavedGuard({
  dirty: isDirty,
  busy: () => isSaving.value,
});
onUnmounted(unregisterGuard);
let closePending = false;
const requestClose = async () => {
  if (isSaving.value || closePending) return;
  closePending = true;
  try {
    if (isDirty() && !(await confirmDiscard())) return;
    drawerVisible.value = false;
  } finally {
    closePending = false;
  }
};

watch([drawerVisible, analysisVisible, settlementVisible], ([d, a, s]) => {
  if (d || a || s) {
    lockScroll();
  } else {
    unlockScroll();
  }
});

const form = reactive({
  amount: '',
  description: '',
  payerId: '',
  splitWithIds: [],
  date: '',
});

const openAddDrawer = async () => {
  if (!userStore.myParticipant) return await appAlert('請先登入後再新增開支！');

  // 重置表單並設定預設付款人
  Object.assign(form, {
    id: null,
    amount: '',
    description: '',
    payerId: userStore.myParticipant?.id || '',
    splitWithIds: participants.participants.map((p) => p.id), // 預設全選
    date: dayjs().format('YYYY-MM-DD'), // 預設今天
  });
  drawerVisible.value = true;
  baseline.value = JSON.stringify(form);
  formError.value = '';
};

const editMethod = (data) => {
  if (!userStore.myParticipant) return; // 不允許編輯
  Object.assign(form, {
    ...data,
    splitWithIds: [...(data.splitWithIds || [])],
    date: data.date || dayjs().format('YYYY-MM-DD'), // 相容舊資料
  });
  drawerVisible.value = true;
  baseline.value = JSON.stringify(form);
  formError.value = '';
};

const submitExpense = async () => {
  if (isSaving.value) return;
  formError.value = '';
  if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
    formError.value = '請輸入大於 0 的支出金額。';
    return;
  }
  if (!form.description.trim() || !form.payerId || !form.splitWithIds.length) {
    formError.value = '請填寫支出內容、付款人，並至少選擇一位分攤成員。';
    return;
  }

  const payload = {
    amount: parseFloat(form.amount),
    description: form.description.trim(),
    payerId: form.payerId,
    splitWithIds: [...form.splitWithIds],
    date: form.date || dayjs().format('YYYY-MM-DD'),
  };

  isSaving.value = true;
  try {
    if (form.id) await patchWalletItem(form.id, payload);
    else await postWalletItem(payload);
    drawerVisible.value = false;
    ElMessage.success('開支已儲存');
    await expensesStore.init({ force: true });
  } catch (error) {
    formError.value = '儲存失敗，輸入內容已保留，請確認連線後再試。';
  } finally {
    isSaving.value = false;
  }
};
const deleteExpense = async () => {
  if (!form.id || isSaving.value) return;
  isSaving.value = true;
  try {
    if (!(await appConfirm('刪除後無法復原，確定要刪除這筆開支嗎？'))) return;
    await deleteWalletItem(form.id);
    drawerVisible.value = false;
    ElMessage.success('開支已刪除');
    await expensesStore.init({ force: true });
  } catch (error) {
    formError.value = '刪除失敗，請確認連線後再試。';
  } finally {
    isSaving.value = false;
  }
};

const onClose = () => {
  Object.assign(form, {
    id: null,
    amount: '',
    description: '',
    payerId: '',
    splitWithIds: [],
    date: '',
  });
};
</script>

<template>
  <div class="space-y-4">
    <DataStatusNotice
      :loading="expensesStore.isLoading"
      :stale="expensesStore.isStale"
      :error="expensesStore.loadError"
      @retry="expensesStore.init({ force: true })"
    />
    <div
      class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[32px] p-[24px] text-white shadow-2xl relative overflow-hidden group"
    >
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-2 opacity-60">
          <Wallet2 :size="14" />
          <p class="text-[10px] font-black uppercase tracking-[0.2em]">
            旅行總支出
          </p>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-xl font-bold text-orange-400">{{
            tripStore.currencySymbol
          }}</span>
          <h2 class="text-4xl font-black tracking-tight">
            {{ expensesStore.totalSpent.toLocaleString() }}
          </h2>
        </div>

        <el-button
          class="w-full !rounded-[20px] !h-14 mt-8 !text-lg !font-black !bg-orange-500 !border-none !text-white shadow-xl shadow-orange-900/20 active:scale-95 transition-transform disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
          @click="openAddDrawer"
        >
          <component
            :is="userStore.myParticipant ? Plus : Lock"
            :size="20"
            class="mr-2 stroke-[3px]"
          />
          {{ userStore.myParticipant ? '新增行程開支' : '請先登入以新增' }}
        </el-button>
      </div>
      <ReceiptText
        :size="120"
        class="absolute -bottom-6 -right-6 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700"
      />
    </div>

    <!-- 功能入口網格 -->
    <div class="grid grid-cols-2 gap-4">
      <button
        @click="analysisVisible = true"
        class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all group"
      >
        <div
          class="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform"
        >
          <PieChart :size="24" />
        </div>
        <span class="text-md font-bold text-slate-600">花費分析</span>
      </button>
      <button
        @click="settlementVisible = true"
        class="bg-white p-4 rounded-2xl border border-slate-100 flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-all group"
      >
        <div
          class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform"
        >
          <ArrowRightLeft :size="24" />
        </div>
        <span class="text-md font-bold text-slate-600">分帳詳情</span>
      </button>
    </div>

    <div class="space-y-4">
      <div class="flex justify-between items-end mb-4">
        <div class="flex items-center gap-2">
          <h3 class="font-black text-slate-800 text-xl tracking-tight">
            費用明細
          </h3>
          <div
            v-if="!userStore.myParticipant"
            class="bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1"
          >
            <Lock :size="10" class="text-slate-400" />
            <span class="text-[9px] font-black text-slate-400 uppercase"
              >Read Only</span
            >
          </div>
        </div>
        <span
          class="text-[10px] font-black text-slate-400 uppercase tracking-widest"
          >{{ expensesStore.expenses.length }} 筆記錄</span
        >
      </div>

      <div
        v-if="
          expensesStore.expenses.length === 0 &&
          !expensesStore.isLoading &&
          !expensesStore.loadError
        "
        class="flex flex-col items-center py-20 text-slate-300"
      >
        <ReceiptText :size="48" class="opacity-20 mb-2" />
        <p class="italic font-medium">尚未有任何開銷紀錄</p>
      </div>

      <PayCard
        v-for="exp in expensesStore.expenses"
        :key="exp.id"
        :item="exp"
        :class="{ 'opacity-80': !userStore.myParticipant }"
        @edit="editMethod"
      >
      </PayCard>
    </div>

    <!-- 彈出組件 -->
    <WalletAnalysis
      v-model:visible="analysisVisible"
      :expenses="expensesStore.expenses"
    />

    <WalletSettlement
      v-model:visible="settlementVisible"
      :expenses="expensesStore.expenses"
      :participants="participants.participants"
    />

    <!-- 新增/編輯 抽屜 -->
    <el-drawer
      v-model="drawerVisible"
      direction="btt"
      size="auto"
      :with-header="false"
      :append-to-body="true"
      :lock-scroll="false"
      :before-close="requestClose"
      :close-on-press-escape="!isSaving"
      class="custom-drawer frontend-contained-drawer"
      @close="onClose"
    >
      <div class="p-4">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-2xl font-black text-slate-800">
            {{ form.id ? '編輯' : '新增' }}這筆開支
          </h2>
          <button
            @click="requestClose"
            :disabled="isSaving"
            aria-label="關閉開支表單"
            class="p-2 bg-slate-100 rounded-full text-slate-400"
          >
            <X :size="20" />
          </button>
        </div>

        <el-form label-position="top" class="custom-form" :disabled="isSaving">
          <el-form-item>
            <template #label
              ><span class="label-custom"
                >支出金額 ({{ tripStore.currencySymbol }})</span
              ></template
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

          <el-form-item>
            <template #label
              ><span class="label-custom">支出日期</span></template
            >
            <el-input v-model="form.date" type="date" class="custom-input" />
          </el-form-item>
          <el-form-item>
            <template #label
              ><span class="label-custom tracking-tighter"
                >付款人</span
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
            <template #label>
              <div class="flex justify-between items-center w-full pr-2">
                <div class="flex items-center gap-2">
                  <span class="label-custom">要跟誰分這筆錢？</span>
                  <span
                    class="bg-slate-50 rounded-2xl flex items-center px-2 gap-2 text-[10px] text-slate-500"
                  >
                    <Users :size="10" />
                    <span class="font-bold"
                      >{{ form.splitWithIds.length }} 人</span
                    >
                  </span>
                </div>
              </div>
            </template>
            <div class="flex flex-wrap gap-2">
              <el-checkbox
                v-model="isAllSelected"
                :indeterminate="isIndeterminate"
                class="custom-checkbox !mr-0"
                border
                >全選</el-checkbox
              >
              <el-checkbox
                v-for="p in participants.participants"
                :key="p.id"
                v-model="form.splitWithIds"
                :label="p.id"
                class="custom-checkbox !mr-0"
                border
                >{{ p.name }}</el-checkbox
              >
            </div>
          </el-form-item>
        </el-form>

        <p
          v-if="formError"
          role="alert"
          class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {{ formError }}
        </p>
        <div
          class="sticky bottom-0 mt-6 flex gap-3 bg-white py-3 pb-[max(12px,env(safe-area-inset-bottom))]"
        >
          <el-button
            v-if="form.id"
            type="primary"
            @click="deleteExpense"
            :disabled="isSaving"
            class="w-full !h-16 !rounded-[24px] !bg-red-500 !border-none !text-xl !font-black shadow-xl shadow-red-100 !ml-0"
            >刪除這筆開支</el-button
          >
          <el-button
            type="primary"
            @click="submitExpense"
            :loading="isSaving"
            :disabled="isSaving"
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
