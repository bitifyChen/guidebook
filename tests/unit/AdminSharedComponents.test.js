import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AdminDataTable from '@/components/admin/shared/AdminDataTable.vue';
import AdminDrawer from '@/components/admin/shared/AdminDrawer.vue';

const ElDrawerStub = {
  props: ['modelValue'],
  emits: ['update:modelValue', 'closed'],
  template: '<aside><slot /></aside>',
};

describe('admin shared components', () => {
  it('AdminDrawer emits close intent from its close button', async () => {
    const wrapper = mount(AdminDrawer, {
      props: { modelValue: true, title: '編輯旅程' },
      global: { stubs: { ElDrawer: ElDrawerStub } },
    });

    await wrapper.get('button[aria-label="關閉側邊欄"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([false]);
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('AdminDataTable keeps search, reset and pagination contracts', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      name: `成員 ${index + 1}`,
    }));
    const wrapper = mount(AdminDataTable, {
      props: {
        rows,
        columns: [{ key: 'name', label: '成員' }],
        search: [{ name: 'keyword', label: '關鍵字', type: 'text' }],
        initialSearch: { keyword: '' },
      },
    });

    expect(wrapper.text()).toContain('成員 20');
    expect(wrapper.text()).not.toContain('成員 21');
    const input = wrapper.get('input');
    await input.setValue('陳陳');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '搜尋')
      .trigger('click');
    expect(wrapper.emitted('search')[0][0]).toEqual({ keyword: '陳陳' });

    await wrapper.findAll('button').at(-1).trigger('click');
    expect(wrapper.text()).toContain('成員 21');
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '清除')
      .trigger('click');
    expect(wrapper.emitted('reset')).toHaveLength(1);
  });
});
