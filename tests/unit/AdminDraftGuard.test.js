import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';
import {
  canLeaveWorkspace,
  shouldGuardWorkspaceNavigation,
} from '@/services/unsavedChanges';
const m = vi.hoisted(() => ({ confirm: vi.fn(), alert: vi.fn() }));
vi.mock('@/services/dialog', () => ({
  appConfirm: m.confirm,
  appAlert: m.alert,
}));
const wrappers = [];
const setup = (props = {}) => {
  const w = mount(AdminDrawer, {
    props: { modelValue: true, draft: { name: '原內容' }, ...props },
    global: {
      stubs: { ElDrawer: { template: '<section><slot /></section>' } },
    },
  });
  wrappers.push(w);
  return w;
};
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.resetAllMocks();
});
describe('admin draft guard', () => {
  it('applies route guards only when leaving the admin workspace', () => {
    expect(
      shouldGuardWorkspaceNavigation(
        { fullPath: '/locations' },
        { fullPath: '/wallet', meta: { layout: 'default' } }
      )
    ).toBe(false);
    expect(
      shouldGuardWorkspaceNavigation(
        { fullPath: '/wallet' },
        { fullPath: '/admin/trips', meta: { layout: 'admin' } }
      )
    ).toBe(true);
    expect(
      shouldGuardWorkspaceNavigation(
        { fullPath: '/admin/trips' },
        { fullPath: '/admin/trips', meta: { layout: 'admin' } }
      )
    ).toBe(false);
  });

  it('keeps edited input when canceling close and emits close only once when accepted', async () => {
    const w = setup();
    await flushPromises();
    await w.setProps({ draft: { name: '新內容' } });
    m.confirm.mockResolvedValue(false);
    await w.vm.requestClose();
    expect(w.emitted('close')).toBeUndefined();
    expect(w.props('draft').name).toBe('新內容');
    m.confirm.mockResolvedValue(true);
    await w.vm.requestClose();
    expect(w.emitted('close')).toHaveLength(1);
    expect(w.emitted('update:modelValue')).toEqual([[false]]);
  });
  it('blocks close and route/trip departure while saving', async () => {
    const w = setup({ busy: true });
    await flushPromises();
    await w.vm.requestClose();
    expect(w.emitted('close')).toBeUndefined();
    expect(await canLeaveWorkspace()).toBe(false);
    expect(m.alert).toHaveBeenCalledTimes(1);
  });
  it('asks once for concurrent departure requests', async () => {
    const w = setup({ dirty: true });
    await flushPromises();
    let resolve;
    m.confirm.mockImplementation(() => new Promise((r) => (resolve = r)));
    const first = canLeaveWorkspace(),
      second = canLeaveWorkspace();
    resolve(false);
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    expect(m.confirm).toHaveBeenCalledTimes(1);
  });
});
