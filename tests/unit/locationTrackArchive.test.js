import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getArchivedParticipantLocationTrack,
  isLocationTrackArchiveEligible,
} from '@/api/locationTrackArchive';
import { resetLocationTrackCacheConnectionForTests } from '@/utils/locationTrackCache';

const identity = {
  tripId: 'trip-a',
  participantId: 'member-a',
  date: '2026-08-01',
  viewerId: 'viewer-a',
};

const response = (payload, ok = true) => ({
  ok,
  json: async () => payload,
});

describe('location track archive repository', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    globalThis.IDBKeyRange = IDBKeyRange;
    resetLocationTrackCacheConnectionForTests();
  });

  it('uses the archive only after the 48-hour buffer', () => {
    const now = Date.parse('2026-08-05T00:00:00.000Z');
    expect(
      isLocationTrackArchiveEligible({
        endTime: now - 48 * 60 * 60 * 1000,
        now,
      })
    ).toBe(true);
    expect(
      isLocationTrackArchiveEligible({
        endTime: now - 47 * 60 * 60 * 1000,
        now,
      })
    ).toBe(false);
  });

  it('stores a Firestore archive response in IndexedDB for later reads', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response({
        found: true,
        revision: 2,
        checksum: 'checksum-a',
        points: [
          { id: 'b', lat: '25.1', lng: '121.1', ts: '2000' },
          { id: 'a', lat: 25, lng: 121, ts: 1000 },
        ],
        stops: [],
        summary: { pointCount: 2 },
      })
    );

    const first = await getArchivedParticipantLocationTrack({
      ...identity,
      fetcher,
    });
    const second = await getArchivedParticipantLocationTrack({
      ...identity,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.source).toBe('firestore');
    expect(second.source).toBe('indexeddb');
    expect(second.revision).toBe(2);
    expect(second.points.map((point) => point.id)).toEqual(['a', 'b']);
  });

  it('bypasses the durable cache when force refresh is requested', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          found: true,
          revision: 1,
          points: [{ id: 'a', lat: 25, lng: 121, ts: 1000 }],
        })
      )
      .mockResolvedValueOnce(
        response({
          found: true,
          revision: 2,
          points: [{ id: 'b', lat: 25.1, lng: 121.1, ts: 2000 }],
        })
      );

    await getArchivedParticipantLocationTrack({ ...identity, fetcher });
    const refreshed = await getArchivedParticipantLocationTrack({
      ...identity,
      fetcher,
      force: true,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(refreshed.revision).toBe(2);
    expect(refreshed.points[0].id).toBe('b');
  });

  it('uses a new cache namespace after the participant archive version changes', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          found: true,
          revision: 1,
          points: [{ id: 'a', lat: 25, lng: 121, ts: 1000 }],
        })
      )
      .mockResolvedValueOnce(
        response({
          found: true,
          revision: 2,
          points: [{ id: 'b', lat: 25.1, lng: 121.1, ts: 2000 }],
        })
      );

    await getArchivedParticipantLocationTrack({
      ...identity,
      cacheVersion: 100,
      fetcher,
    });
    const updated = await getArchivedParticipantLocationTrack({
      ...identity,
      cacheVersion: 101,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(updated.points[0].id).toBe('b');
  });

  it('returns null when the requested trip segment is not archived', async () => {
    const result = await getArchivedParticipantLocationTrack({
      ...identity,
      fetcher: vi.fn().mockResolvedValue(response({ found: false })),
    });

    expect(result).toBeNull();
  });
});
