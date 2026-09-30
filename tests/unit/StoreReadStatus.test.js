import { createPinia, setActivePinia } from 'pinia';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExpensesStore } from '@/store/expensesStore';
import { useTravelStore } from '@/store/travelStore';
const m = vi.hoisted(() => ({
  trip: { currentTripId: 'a', isPublicTrip: false },
  version: vi.fn(),
  wallet: vi.fn(),
  items: vi.fn(),
  configs: vi.fn(),
}));
vi.mock('@/store/tripStore', () => ({ useTripStore: () => m.trip }));
vi.mock('@/api/wallet', () => ({
  getWalletVersion: m.version,
  getWallet: m.wallet,
}));
vi.mock('@/api/itinerary', () => ({
  getGlobalVersion: m.version,
  getItinerary: m.items,
  getDayConfigs: m.configs,
}));
beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  vi.resetAllMocks();
  m.trip.currentTripId = 'a';
});
describe('read status and trip isolation', () => {
  it.each(['wallet', 'travel'])(
    'preserves %s cache and exposes failed revalidation',
    async (kind) => {
      const store = kind === 'wallet' ? useExpensesStore() : useTravelStore();
      localStorage.setItem(
        `guidebook_a_${kind}_cache`,
        JSON.stringify({
          expenses: [{ id: 'cached' }],
          itinerary: [{ id: 'cached' }],
          config: [],
          timestamp: 1,
        })
      );
      m.version.mockResolvedValue({ unavailable: true });
      await store.init();
      expect(store.isLoading).toBe(false);
      expect(store.isStale).toBe(true);
      expect(store.loadError).toContain('上次資料');
      expect((store.expenses || store.itinerary)[0].id).toBe('cached');
    }
  );
  it('ignores a late response after switching trips and clears error after retry', async () => {
    const store = useExpensesStore();
    let resolveA;
    m.version
      .mockImplementationOnce(() => new Promise((r) => (resolveA = r)))
      .mockResolvedValue({ lastUpdate: 2 });
    const first = store.init();
    m.trip.currentTripId = 'b';
    m.wallet.mockResolvedValue({ status: 200, data: [{ id: 'b' }] });
    await store.init();
    resolveA({ lastUpdate: 1 });
    await first;
    expect(store.expenses.map((e) => e.id)).toEqual(['b']);
    expect(store.loadError).toBe('');
    expect(store.isStale).toBe(false);
  });
  it('does not present an empty result as success when the response fails', async () => {
    const store = useExpensesStore();
    m.version.mockResolvedValue({ lastUpdate: 1 });
    m.wallet.mockRejectedValue(new Error('offline'));
    await store.init();
    expect(store.loadError).toContain('載入失敗');
    expect(store.isStale).toBe(false);
  });
});
