import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AdminParticipantTrackDeleteDialog from '@/components/admin/participant/AdminParticipantTrackDeleteDialog.vue';
import AdminParticipantTrackDrawer from '@/components/admin/participant/AdminParticipantTrackDrawer.vue';

const AdminDrawerStub = {
  props: ['modelValue', 'title', 'subtitle'],
  emits: ['update:modelValue', 'close'],
  template: '<section><slot /></section>',
};

const ElDialogStub = {
  props: ['modelValue', 'title'],
  emits: ['update:modelValue'],
  template:
    '<section><h2>{{ title }}</h2><slot /><slot name="footer" /></section>',
};

const TrackMapStub = {
  props: ['points', 'selectedPointId'],
  emits: ['select-point'],
  template:
    '<button type="button" @click="$emit(\'select-point\', points[0]?.id)">map</button>',
};

const points = [
  {
    id: 'point-1',
    ts: 1786550401000,
    lat: 25.033,
    lng: 121.5654,
    acc: 12,
    bat: 85,
    source: 'traccar',
  },
];

describe('admin participant track management', () => {
  it('emits trip, date, selection and deletion intents', async () => {
    const wrapper = mount(AdminParticipantTrackDrawer, {
      props: {
        open: true,
        participant: { id: 'member-1', name: '測試成員' },
        trips: [
          {
            id: 'trip-1',
            title: '測試旅程',
            timezone: 'Asia/Taipei',
            status: 'active',
          },
        ],
        selectedTripId: 'trip-1',
        selectedDate: '2026-08-13',
        points,
        meta: { pointCount: 1, timezone: 'Asia/Taipei' },
      },
      global: {
        stubs: {
          AdminDrawer: AdminDrawerStub,
          AdminParticipantTrackMap: TrackMapStub,
        },
      },
    });

    await wrapper.get('button[title="前一天"]').trigger('click');
    expect(wrapper.emitted('change-date')[0]).toEqual(['2026-08-12']);
    await wrapper.get('button[title="後一天"]').trigger('click');
    expect(wrapper.emitted('change-date')[1]).toEqual(['2026-08-14']);

    await wrapper.get('input[type="date"]').setValue('2026-08-11');
    expect(wrapper.emitted('change-date')[2]).toEqual(['2026-08-11']);

    await wrapper.findComponent(TrackMapStub).trigger('click');
    expect(wrapper.emitted('select-point')[0]).toEqual(['point-1']);

    await wrapper.get('button[title="刪除此定位點"]').trigger('click');
    expect(wrapper.emitted('delete-point')[0]).toEqual(['point-1']);

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('清除當日'))
      .trigger('click');
    expect(wrapper.emitted('delete-day')).toHaveLength(1);
    expect(wrapper.text()).toContain('清除歷史不會停止定位');
  });

  it('requires the participant name before clearing all history', async () => {
    const wrapper = mount(AdminParticipantTrackDeleteDialog, {
      props: {
        open: true,
        scope: 'all',
        participantName: '測試成員',
        preview: { pointCount: 28 },
      },
      global: { stubs: { ElDialog: ElDialogStub } },
    });

    const confirmButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('確認刪除'));
    expect(confirmButton.attributes('disabled')).toBeDefined();

    await wrapper.get('input').setValue('測試成員');
    expect(confirmButton.attributes('disabled')).toBeUndefined();
    await confirmButton.trigger('click');
    expect(wrapper.emitted('confirm')[0]).toEqual(['測試成員']);
  });
});
