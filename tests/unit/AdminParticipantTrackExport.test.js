import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AdminParticipantTrackExportDrawer from '@/components/admin/participant/AdminParticipantTrackExportDrawer.vue';
import AdminParticipantTrackRetentionDrawer from '@/components/admin/participant/AdminParticipantTrackRetentionDrawer.vue';

const AdminDrawerStub = {
  props: ['modelValue', 'title', 'subtitle'],
  emits: ['update:modelValue', 'close'],
  template: '<section><h2>{{ title }}</h2><slot /></section>',
};

const trips = [
  {
    id: 'trip-a',
    title: '北海道之旅',
    startDate: '2026-09-01',
    endDate: '2026-09-07',
  },
];

const participants = [
  { id: 'member-a', name: '陳陳', tripIds: ['trip-a'] },
  { id: 'member-b', name: 'Ruru', tripIds: ['trip-a'] },
  { id: 'member-c', name: '未加入', tripIds: [] },
];

describe('admin participant track export and retention', () => {
  it('builds an export request from the selected trip, members, dates and format', async () => {
    const wrapper = mount(AdminParticipantTrackExportDrawer, {
      props: {
        open: true,
        trips,
        participants,
        initialTripId: 'trip-a',
        initialParticipantId: 'member-a',
      },
      global: { stubs: { AdminDrawer: AdminDrawerStub } },
    });

    expect(wrapper.get('select').element.value).toBe('trip-a');
    expect(wrapper.text()).toContain('陳陳');
    expect(wrapper.text()).toContain('Ruru');

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '全選')
      .trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('GPX'))
      .trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('開始匯出'))
      .trigger('click');

    expect(wrapper.emitted('export')[0][0]).toEqual({
      tripIds: ['trip-a'],
      participantIds: ['member-a', 'member-b'],
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      format: 'gpx',
    });
  });

  it('requires the explicit retention confirmation before running cleanup', async () => {
    const wrapper = mount(AdminParticipantTrackRetentionDrawer, {
      props: {
        open: true,
        preview: {
          status: 'ok',
          candidateCount: 1,
          firestoreDocumentCount: 1,
          pointCount: 12,
          items: [
            {
              tripId: 'trip-a',
              tripTitle: '北海道之旅',
              participantName: '陳陳',
              date: '2026-05-01',
              pointCount: 12,
            },
          ],
        },
      },
      global: { stubs: { AdminDrawer: AdminDrawerStub } },
    });

    const runButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('執行清理'));
    expect(runButton.attributes('disabled')).toBeDefined();

    await wrapper.get('input').setValue('清理');
    expect(runButton.attributes('disabled')).toBeUndefined();
    await runButton.trigger('click');
    expect(wrapper.emitted('run')).toHaveLength(1);
  });
});
