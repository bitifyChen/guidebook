import { describe, expect, it } from 'vitest';
import {
  detectTrackStops,
  findNearestTrackPointIndex,
  getTrackPointAtTimestamp,
  runWithConcurrency,
  sanitizeTrackPoints,
  splitTrackSegments,
} from '@/utils/locationTrack';

const point = (ts, lat = 25, lng = 121, extra = {}) => ({
  ts,
  lat,
  lng,
  ...extra,
});

describe('location track helpers', () => {
  it('removes inaccurate points and isolated spikes without changing valid order', () => {
    const result = sanitizeTrackPoints([
      point(0),
      point(5 * 60 * 1000, 25.01, 121.01),
      point(10 * 60 * 1000, 25, 121, { accuracy: 300 }),
      point(15 * 60 * 1000, 25, 121),
    ]);

    expect(result.points.map(({ ts }) => ts)).toEqual([0, 15 * 60 * 1000]);
    expect(result.rejectedCount).toBe(2);
  });

  it('splits segments when the location stream has a long gap', () => {
    const segments = splitTrackSegments([
      point(0),
      point(5 * 60 * 1000),
      point(20 * 60 * 1000),
    ]);

    expect(segments).toHaveLength(2);
    expect(segments[1]).toHaveLength(1);
  });

  it('detects a fifteen-minute stop and finds its nearest playback point', () => {
    const points = [
      point(0, 25, 121),
      point(5 * 60 * 1000, 25.0001, 121.0001),
      point(10 * 60 * 1000, 25.0001, 121.0001),
      point(15 * 60 * 1000, 25.0001, 121.0001),
      point(20 * 60 * 1000, 25.01, 121.01),
    ];

    expect(detectTrackStops(points)).toHaveLength(1);
    expect(findNearestTrackPointIndex(points, 11 * 60 * 1000)).toBe(2);
  });

  it('interpolates a playback point only inside an allowed timestamp gap', () => {
    const points = [point(0, 25, 121), point(5 * 60 * 1000, 25.005, 121.01)];

    const interpolated = getTrackPointAtTimestamp(points, 2.5 * 60 * 1000);
    expect(interpolated.lat).toBeCloseTo(25.0025, 6);
    expect(interpolated.lng).toBeCloseTo(121.005, 6);
    expect(
      getTrackPointAtTimestamp(
        [point(0), point(11 * 60 * 1000, 25.01, 121.01)],
        5 * 60 * 1000
      )
    ).toBeNull();
  });

  it('limits concurrent track reads while preserving selected member order', async () => {
    let active = 0;
    let peak = 0;
    const result = await runWithConcurrency(
      ['a', 'b', 'c', 'd', 'e'],
      async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        active -= 1;
        return value.toUpperCase();
      },
      3
    );

    expect(peak).toBeLessThanOrEqual(3);
    expect(result).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});
