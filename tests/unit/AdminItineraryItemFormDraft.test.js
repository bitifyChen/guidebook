import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminItineraryItemForm from '@/components/admin/itinerary/AdminItineraryItemForm.vue';
import {
  deleteItineraryItem,
  patchItineraryItem,
  postItineraryItem,
} from '@/api/itinerary';

vi.mock('@/api/itinerary', () => ({
  deleteItineraryItem: vi.fn(),
  patchItineraryItem: vi.fn(),
  postItineraryItem: vi.fn(),
}));

vi.mock('@/api/storage', () => ({
  uploadImage: vi.fn(),
}));

vi.mock('@/store/travelStore', () => ({
  useTravelStore: () => ({
    selectedDay: 2,
    config: [{ day: 2 }],
    itinerary: [],
    init: vi.fn(),
  }),
}));

const createItem = () => ({
  id: 'draft-item',
  day: 2,
  order: 1,
  type: 'point',
  parentId: '',
  location: '草稿景點',
  category: '景點',
  cover: '',
  map: 'https://www.google.com/maps/place/test/@25,121,17z',
  geo: { lat: 25, lng: 121, placeId: '' },
  duration: 30,
  delay: 0,
  fixedStartTime: '',
  nextDrive: { time: 10, km: 3 },
  description: '',
  detail: '',
  images: [],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Admin itinerary item form draft mode', () => {
  it('emits normalized data without writing itinerary APIs', async () => {
    const item = createItem();
    const wrapper = mount(AdminItineraryItemForm, {
      props: {
        item,
        mode: 'edit',
        draft: true,
        lockDay: true,
        defaultDay: 2,
        availableItems: [item],
      },
    });

    await flushPromises();
    await wrapper.get('input[placeholder="地點名稱"]').setValue('更新草稿景點');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('saved')[0][0].item).toMatchObject({
      id: 'draft-item',
      day: 2,
      location: '更新草稿景點',
      geo: { lat: 25, lng: 121 },
    });
    expect(patchItineraryItem).not.toHaveBeenCalled();
    expect(postItineraryItem).not.toHaveBeenCalled();
    expect(deleteItineraryItem).not.toHaveBeenCalled();
  });
});
