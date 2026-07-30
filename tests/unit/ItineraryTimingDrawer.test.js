import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ItineraryTimingDrawer from '@/components/ItineraryTimingDrawer.vue';

const AdminDrawerStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div><slot /></div>',
};

const mountDrawer = async (mode = 'arrived') => {
  const wrapper = mount(ItineraryTimingDrawer, {
    props: {
      open: false,
      mode,
      item: {
        location: '札幌車站',
        scheduledStartTime: '10:00',
        scheduledEndTime: '11:00',
        startTime: '10:00',
        endTime: '11:00',
        delay: 0,
      },
    },
    global: {
      stubs: {
        ElDrawer: AdminDrawerStub,
        ElScrollbar: AdminDrawerStub,
      },
    },
  });
  await wrapper.setProps({ open: true });
  return wrapper;
};

describe('ItineraryTimingDrawer', () => {
  it('previews both arrival policies and emits the selected values', async () => {
    const wrapper = await mountDrawer();
    const timeInput = wrapper.get('input[type="time"]');
    const previewCard = wrapper.get('section.bg-slate-900');
    expect(
      previewCard.element.compareDocumentPosition(timeInput.element) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await timeInput.setValue('10:30');
    await wrapper.get('input[value="keepDuration"]').setValue(true);
    expect(wrapper.text()).toContain('11:30');
    expect(wrapper.text()).toContain('本次停留 60 分鐘');
    expect(wrapper.findAll('.timing-preview-pulse').length).toBeGreaterThan(0);

    await wrapper.get('input[value="keepDeparture"]').setValue(true);
    expect(wrapper.text()).toContain('本次停留 30 分鐘');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('save')[0][0]).toEqual({
      actualTime: '10:30',
      arrivalPolicy: 'keepDeparture',
    });
  });

  it('blocks an actual departure that is earlier than arrival', async () => {
    const wrapper = await mountDrawer('departed');
    await wrapper.get('input[type="time"]').setValue('09:50');
    expect(wrapper.text()).toContain('時間需確認');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBe(
      ''
    );
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('save')).toBeUndefined();
  });
});
