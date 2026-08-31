import { beforeEach, describe, expect, it, vi } from 'vitest';

const archiveMocks = vi.hoisted(() => ({
  getArchivedParticipantLocationTrack: vi.fn(),
  isLocationTrackArchiveEligible: vi.fn(() => true),
}));

const databaseMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('@/api/locationTrackArchive', () => archiveMocks);
vi.mock('@/firebase/index.js', () => ({ rtdb: {} }));
vi.mock('firebase/database', () => ({
  endAt: vi.fn((value) => value),
  get: databaseMocks.get,
  limitToLast: vi.fn((value) => value),
  onValue: vi.fn(),
  orderByChild: vi.fn((value) => value),
  push: vi.fn(),
  query: vi.fn((...values) => values),
  ref: vi.fn((database, path) => path),
  remove: vi.fn(),
  startAt: vi.fn((value) => value),
  update: vi.fn(),
}));

import { getParticipantLocationTrack } from '@/api/locations';

const query = {
  tripId: 'trip-a',
  participantId: 'member-a',
  date: '2026-08-01',
  viewerId: 'viewer-a',
  startTime: 1000,
  endTime: 2000,
  now: 48 * 60 * 60 * 1000 + 3000,
};

describe('location track repository routing', () => {
  beforeEach(() => {
    archiveMocks.getArchivedParticipantLocationTrack.mockReset();
    databaseMocks.get.mockReset();
  });

  it('returns the archived segment without reading RTDB', async () => {
    archiveMocks.getArchivedParticipantLocationTrack.mockResolvedValue({
      points: [{ id: 'archive', lat: 25, lng: 121, ts: 1500 }],
    });

    const points = await getParticipantLocationTrack(query);

    expect(points[0].id).toBe('archive');
    expect(databaseMocks.get).not.toHaveBeenCalled();
  });

  it('falls back to RTDB when an archive is not available', async () => {
    archiveMocks.getArchivedParticipantLocationTrack.mockResolvedValue(null);
    databaseMocks.get.mockResolvedValue({
      val: () => ({ raw: { lat: 25, lng: 121, ts: 1500 } }),
    });

    const points = await getParticipantLocationTrack(query);

    expect(points).toEqual([{ id: 'raw', lat: 25, lng: 121, ts: 1500 }]);
  });

  it('surfaces an archive error only when RTDB no longer has the day', async () => {
    archiveMocks.getArchivedParticipantLocationTrack.mockRejectedValue(
      new Error('archive unavailable')
    );
    databaseMocks.get.mockResolvedValue({ val: () => ({}) });

    await expect(getParticipantLocationTrack(query)).rejects.toThrow(
      'archive unavailable'
    );
  });
});
