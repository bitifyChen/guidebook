import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ElMessageBox } from 'element-plus';
import AdminItineraryPlaceImport from '@/components/admin/itinerary/AdminItineraryPlaceImport.vue';
import AdminItineraryRouteImport from '@/components/admin/itinerary/AdminItineraryRouteImport.vue';
import AdminItineraryRoutePlannerDrawer from '@/components/admin/itinerary/AdminItineraryRoutePlannerDrawer.vue';

vi.mock('@/api/routeDistance', () => ({
  getDrivingRoutes: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/api/googleMapsRoute', () => ({
  resolveGoogleMapsRouteUrl: vi.fn(),
}));

vi.mock('@/components/admin/itinerary/AdminItineraryItemDrawer.vue', () => ({
  default: { template: '<div data-test="item-drawer"></div>' },
}));

const AdminDrawerStub = {
  props: ['modelValue', 'closeOnClickModal'],
  emits: ['update:modelValue'],
  template: '<section><slot name="actions" /><slot /></section>',
};

const RouteMapStub = {
  template: '<div data-test="route-map"></div>',
};

const RouteTimelineStub = {
  props: ['items'],
  template: '<div data-test="route-timeline">{{ items.length }}</div>',
};

const RouteItemEditorStub = {
  template: '<div data-test="route-editor"></div>',
};

const RouteImportStub = {
  template: '<div data-test="route-import"></div>',
};

const ItemDrawerStub = {
  template: '<div data-test="item-drawer"></div>',
};

const createItem = () => ({
  id: 'item-1',
  day: 2,
  order: 1,
  type: 'point',
  category: '景點',
  location: '測試景點',
  map: 'https://www.google.com/maps/search/?api=1&query=25%2C121.5',
  geo: { lat: 25, lng: 121.5 },
  duration: 30,
  fixedStartTime: '',
  nextDrive: { time: 0, km: '' },
  images: [],
});

afterEach(() => vi.restoreAllMocks());

describe('Admin itinerary route planner', () => {
  it('emits a day-scoped draft and keeps the canonical map structure', async () => {
    const wrapper = mount(AdminItineraryRoutePlannerDrawer, {
      props: {
        open: true,
        day: 2,
        items: [createItem()],
        startTime: '09:00',
      },
      global: {
        stubs: {
          AdminDrawer: AdminDrawerStub,
          AdminItineraryRouteMap: RouteMapStub,
          AdminItineraryRouteTimeline: RouteTimelineStub,
          AdminItineraryRouteItemEditor: RouteItemEditorStub,
          AdminItineraryRouteImport: RouteImportStub,
          AdminItineraryItemDrawer: ItemDrawerStub,
        },
      },
    });

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('儲存本日行程'))
      .trigger('click');

    const payload = wrapper.emitted('save')[0][0];
    expect(payload.day).toBe(2);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: 'item-1',
      day: 2,
      order: 1,
      map: createItem().map,
      geo: { lat: 25, lng: 121.5 },
    });
    expect(payload.items[0].geo).not.toHaveProperty('mapUrl');
  });

  it('cancels without emitting a save request', async () => {
    const wrapper = mount(AdminItineraryRoutePlannerDrawer, {
      props: { open: true, day: 2, items: [createItem()] },
      global: {
        stubs: {
          AdminDrawer: AdminDrawerStub,
          AdminItineraryRouteMap: RouteMapStub,
          AdminItineraryRouteTimeline: RouteTimelineStub,
          AdminItineraryRouteItemEditor: RouteItemEditorStub,
          AdminItineraryRouteImport: RouteImportStub,
          AdminItineraryItemDrawer: ItemDrawerStub,
        },
      },
    });

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '取消')
      .trigger('click');

    expect(wrapper.emitted('update:open')[0]).toEqual([false]);
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  it('uses the backdrop close path and only asks once for dirty drafts', async () => {
    const confirmSpy = vi
      .spyOn(ElMessageBox, 'confirm')
      .mockResolvedValue('confirm');
    const wrapper = mount(AdminItineraryRoutePlannerDrawer, {
      props: { open: true, day: 2, items: [createItem()] },
      global: {
        stubs: {
          AdminDrawer: AdminDrawerStub,
          AdminItineraryRouteMap: RouteMapStub,
          AdminItineraryRouteTimeline: RouteTimelineStub,
          AdminItineraryRouteItemEditor: RouteItemEditorStub,
          AdminItineraryRouteImport: RouteImportStub,
          AdminItineraryItemDrawer: ItemDrawerStub,
        },
      },
    });

    wrapper.findComponent(RouteItemEditorStub).vm.$emit('update', {
      field: 'location',
      value: '修改後景點',
    });
    const drawer = wrapper.findComponent(AdminDrawerStub);
    expect(drawer.props('closeOnClickModal')).toBe(true);
    drawer.vm.$emit('update:modelValue', false);
    drawer.vm.$emit('update:modelValue', false);
    await flushPromises();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });
});

describe('Admin itinerary Google route import', () => {
  it('previews a route and emits the selected replacement stops', async () => {
    const wrapper = mount(AdminItineraryRouteImport, {
      props: { open: true, existingCount: 3 },
    });
    const input = wrapper.get('input[type="url"]');
    await input.setValue(
      'https://www.google.com/maps/dir/?api=1&origin=25.0330,121.5654&destination=25.0478,121.5170'
    );
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '解析')
      .trigger('click');
    await wrapper.vm.$nextTick();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '取代本日')
      .trigger('click');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('套用到草稿'))
      .trigger('click');

    const payload = wrapper.emitted('apply')[0][0];
    expect(payload.mode).toBe('replace');
    expect(payload.stops).toHaveLength(2);
    expect(payload.stops[0].geo).toEqual({ lat: 25.033, lng: 121.5654 });
  });

  it('keeps renamed and selected stops when appending a route', async () => {
    const wrapper = mount(AdminItineraryRouteImport, {
      props: { open: true, existingCount: 1 },
    });
    await wrapper
      .get('input[type="url"]')
      .setValue(
        'https://www.google.com/maps/dir/?api=1&origin=25.0330,121.5654&waypoints=25.0478,121.5170&destination=25.0420,121.5350'
      );
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '解析')
      .trigger('click');
    await wrapper.vm.$nextTick();

    const nameInputs = wrapper.findAll('input[aria-label="景點名稱"]');
    await nameInputs[0].setValue('重新命名的起點');
    const stopCheckboxes = wrapper.findAll('input[type="checkbox"]');
    await stopCheckboxes[1].setValue(false);
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('套用到草稿'))
      .trigger('click');

    const payload = wrapper.emitted('apply')[0][0];
    expect(payload.mode).toBe('append');
    expect(payload.stops).toHaveLength(2);
    expect(payload.stops[0].name).toBe('重新命名的起點');
    expect(payload.stops.map((stop) => stop.geo)).toEqual([
      { lat: 25.033, lng: 121.5654 },
      { lat: 25.042, lng: 121.535 },
    ]);
  });
});

describe('Admin itinerary Google place import', () => {
  it('parses a place link and emits the renamed draft item', async () => {
    const wrapper = mount(AdminItineraryPlaceImport, {
      props: { open: true },
    });
    const url =
      'https://www.google.com/maps/place/%E5%8F%B0%E5%8C%97%E8%BB%8A%E7%AB%99/@25.0478,121.517,17z/data=!3d25.0478!4d121.517';
    await wrapper.get('input[type="url"]').setValue(url);
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '解析')
      .trigger('click');
    await flushPromises();
    await wrapper.get('input[aria-label="景點名稱"]').setValue('集合地點');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('新增至草稿'))
      .trigger('click');

    expect(wrapper.emitted('apply')[0][0]).toMatchObject({
      name: '集合地點',
      map: url,
      geo: { lat: 25.0478, lng: 121.517 },
    });
  });
});
