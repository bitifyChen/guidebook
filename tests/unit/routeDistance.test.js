import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearDrivingRouteCache,
  getDrivingRouteDistance,
  getDrivingRoutes,
} from '@/api/routeDistance';

afterEach(() => {
  clearDrivingRouteCache();
  vi.restoreAllMocks();
});

const okResponse = (duration = 600, distance = 6100) => ({
  ok: true,
  json: vi.fn().mockResolvedValue({
    routes: [
      {
        duration,
        distance,
        geometry: {
          type: 'LineString',
          coordinates: [
            [121.5, 25],
            [121.6, 25.1],
          ],
        },
      },
    ],
  }),
});

describe('OSRM route helpers', () => {
  it('returns route geometry and caches the coordinate pair', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(okResponse());
    const from = { lat: 25, lng: 121.5 };
    const to = { lat: 25.1, lng: 121.6 };

    const first = await getDrivingRouteDistance(from, to);
    const second = await getDrivingRouteDistance(from, to);

    expect(first).toEqual({
      minutes: 10,
      km: '6.1',
      geometry: {
        type: 'LineString',
        coordinates: [
          [121.5, 25],
          [121.6, 25.1],
        ],
      },
    });
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('geometries=geojson');
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('keeps partial failures isolated and preserves input ordering', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValueOnce({ ok: false, status: 429 });

    const results = await getDrivingRoutes(
      [
        {
          id: 'a',
          origin: { lat: 25, lng: 121.5 },
          destination: { lat: 25.1, lng: 121.6 },
        },
        {
          id: 'b',
          origin: { lat: 24, lng: 120.5 },
          destination: { lat: 24.1, lng: 120.6 },
        },
      ],
      { concurrency: 1 }
    );

    expect(results.map((result) => result.id)).toEqual(['a', 'b']);
    expect(results[0].route?.minutes).toBe(10);
    expect(results[0].error).toBeNull();
    expect(results[1].route).toBeNull();
    expect(results[1].error).toBeInstanceOf(Error);
  });
});
