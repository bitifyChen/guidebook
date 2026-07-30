import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AdminTripPackingDrawer from '@/components/admin/trip/AdminTripPackingDrawer.vue';

const AdminDrawerStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<section><slot /></section>',
};

const ElScrollbarStub = {
  template: '<div><slot /></div>',
};

const findButton = (wrapper, label) =>
  wrapper.findAll('button').find((button) => button.text().includes(label));

const mountDrawer = async () => {
  const wrapper = mount(AdminTripPackingDrawer, {
    props: {
      open: false,
      trip: {
        title: '北海道之旅',
        packingList: [
          {
            id: 'documents',
            category: '重要證件',
            items: [
              { id: 'passport', name: '全家護照' },
              { id: 'trip-custom', name: '紙本行程' },
            ],
          },
        ],
      },
      catalog: [
        {
          id: 'documents',
          category: '重要證件',
          items: [
            { id: 'passport', name: '護照' },
            { id: 'ticket', name: '機票' },
          ],
        },
      ],
    },
    global: {
      stubs: {
        AdminDrawer: AdminDrawerStub,
        ElScrollbar: ElScrollbarStub,
      },
    },
  });
  await wrapper.setProps({ open: true });
  return wrapper;
};

describe('AdminTripPackingDrawer', () => {
  it('emits the merged selection only when save is clicked', async () => {
    const wrapper = await mountDrawer();

    await findButton(wrapper, '全選').trigger('click');
    expect(wrapper.emitted('save')).toBeUndefined();

    await findButton(wrapper, '儲存').trigger('click');
    const payload = wrapper.emitted('save')[0][0];
    expect(payload[0].items).toEqual([
      { id: 'passport', name: '全家護照' },
      { id: 'ticket', name: '機票' },
      { id: 'trip-custom', name: '紙本行程' },
    ]);
  });

  it('emits an empty list after removing all and saving', async () => {
    const wrapper = await mountDrawer();

    await findButton(wrapper, '全移除').trigger('click');
    expect(wrapper.emitted('save')).toBeUndefined();

    await findButton(wrapper, '儲存').trigger('click');
    expect(wrapper.emitted('save')[0][0]).toEqual([]);
  });
});
