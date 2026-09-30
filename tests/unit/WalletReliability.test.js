import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Wallet from '@/pages/Wallet.vue';
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
  init: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock('@/api/wallet', () => ({
  postWalletItem: mocks.post,
  patchWalletItem: mocks.patch,
  deleteWalletItem: mocks.remove,
}));
vi.mock('@/services/dialog', () => ({
  appAlert: vi.fn(),
  appConfirm: mocks.confirm,
}));
vi.mock('@/store/expensesStore', () => ({
  useExpensesStore: () => ({ totalSpent: 0, expenses: [], init: mocks.init }),
}));
vi.mock('@/store/participantsStore', () => ({
  useParticipantsStore: () => ({
    participants: [{ id: 'member', name: '旅伴' }],
  }),
}));
vi.mock('@/store/userStore', () => ({
  useUserStore: () => ({ myParticipant: { id: 'member' } }),
}));
vi.mock('@/store/tripStore', () => ({
  useTripStore: () => ({ currencySymbol: '$' }),
}));
vi.mock('element-plus', () => ({ ElMessage: { success: vi.fn() } }));
vi.mock('@/components/WalletAnalysis.vue', () => ({
  default: { template: '<div />' },
}));
vi.mock('@/components/WalletSettlement.vue', () => ({
  default: { template: '<div />' },
}));
const wrappers = [];
function setup() {
  const wrapper = mount(Wallet, {
    global: {
      stubs: {
        ElDrawer: {
          props: ['modelValue'],
          template: '<section v-if="modelValue"><slot /></section>',
        },
        ElButton: { template: '<button><slot /></button>' },
        ElForm: { template: '<form><slot /></form>' },
        ElFormItem: { template: '<div><slot /></div>' },
        ElInput: true,
        ElSelect: true,
        ElOption: true,
        ElCheckbox: true,
        PayCard: true,
      },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.resetAllMocks();
});
describe('wallet write reliability', () => {
  it('keeps the drawer and input after failure and prevents duplicate writes', async () => {
    let reject;
    mocks.post.mockImplementation(
      () =>
        new Promise((_, r) => {
          reject = r;
        })
    );
    const w = setup();
    await w.vm.openAddDrawer();
    Object.assign(w.vm.form, { amount: '120', description: '午餐' });
    const pending = w.vm.submitExpense();
    await w.vm.submitExpense();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(w.vm.drawerVisible).toBe(true);
    await w.vm.requestClose();
    expect(w.vm.drawerVisible).toBe(true);
    reject(new Error('offline'));
    await pending;
    await flushPromises();
    expect(w.vm.form.description).toBe('午餐');
    expect(w.vm.drawerVisible).toBe(true);
    expect(w.text()).toContain('輸入內容已保留');
    mocks.post.mockResolvedValue({ status: 200 });
    await w.vm.submitExpense();
    expect(w.vm.drawerVisible).toBe(false);
    expect(mocks.init).toHaveBeenCalledWith({ force: true });
  });
  it('does not mutate the source row and cancellation never deletes', async () => {
    const w = setup();
    const row = {
      id: 'one',
      amount: 120,
      description: '午餐',
      payerId: 'member',
      splitWithIds: ['member'],
    };
    w.vm.editMethod(row);
    w.vm.form.splitWithIds.push('other');
    expect(row.splitWithIds).toEqual(['member']);
    mocks.confirm.mockResolvedValue(false);
    await w.vm.deleteExpense();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(w.vm.drawerVisible).toBe(true);
  });
});
