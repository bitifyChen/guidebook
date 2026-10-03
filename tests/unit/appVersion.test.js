import { describe, expect, it, vi } from 'vitest';
import {
  compareVersions,
  normalizeReleaseManifest,
  resolveUpdatePrompt,
  runUpdateSequence,
  UPDATE_DISMISS_COOLDOWN_MS,
} from '@/utils/appVersion';

describe('PWA app version policy', () => {
  it('compares numeric version parts instead of strings', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBe(1);
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.1.9', '1.2.0')).toBe(-1);
    expect(compareVersions('latest', '1.2.0')).toBeNull();
  });

  it('rejects malformed or impossible release manifests', () => {
    expect(
      normalizeReleaseManifest({ version: '1.2', minimumVersion: '1.0.0' })
    ).toBeNull();
    expect(
      normalizeReleaseManifest({ version: '1.0.0', minimumVersion: '1.1.0' })
    ).toBeNull();
  });

  it('returns optional, dismissed, and required prompt decisions', () => {
    const manifest = { version: '1.3.0', minimumVersion: '1.0.0' };
    expect(
      resolveUpdatePrompt({ currentVersion: '1.2.0', manifest }).type
    ).toBe('optional');
    expect(
      resolveUpdatePrompt({
        currentVersion: '1.2.0',
        manifest,
        dismissal: { version: '1.3.0', at: 1_000 },
        now: 1_000 + UPDATE_DISMISS_COOLDOWN_MS - 1,
      }).type
    ).toBe('none');
    expect(
      resolveUpdatePrompt({
        currentVersion: '1.2.0',
        manifest,
        dismissal: { version: '1.3.0', at: 1_000 },
        now: 1_000 + UPDATE_DISMISS_COOLDOWN_MS,
      }).type
    ).toBe('optional');
    expect(
      resolveUpdatePrompt({
        currentVersion: '0.9.0',
        manifest,
      }).type
    ).toBe('required');
  });
});

describe('PWA update sequence', () => {
  it('activates a waiting worker and reloads once', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const activateWaitingWorker = vi.fn().mockResolvedValue(undefined);
    const waitForActivation = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn();

    await runUpdateSequence({
      registration: { waiting: {}, update },
      activateWaitingWorker,
      waitForWaitingWorker: vi.fn(),
      waitForActivation,
      reload,
    });

    expect(update).toHaveBeenCalledOnce();
    expect(activateWaitingWorker).toHaveBeenCalledWith(false);
    expect(waitForActivation).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('subscribes to activation before asking the waiting worker to activate', async () => {
    const calls = [];
    await runUpdateSequence({
      registration: { waiting: {}, update: vi.fn().mockResolvedValue() },
      activateWaitingWorker: async () => calls.push('activate'),
      waitForWaitingWorker: vi.fn(),
      waitForActivation: () => {
        calls.push('listen');
        return Promise.resolve();
      },
      reload: () => calls.push('reload'),
    });

    expect(calls).toEqual(['listen', 'activate', 'reload']);
  });

  it('still reloads once when a waiting worker rejects activation', async () => {
    const reload = vi.fn();
    await runUpdateSequence({
      registration: { waiting: {}, update: vi.fn().mockResolvedValue() },
      activateWaitingWorker: vi
        .fn()
        .mockRejectedValue(new Error('activation failed')),
      waitForWaitingWorker: vi.fn(),
      waitForActivation: vi.fn().mockResolvedValue(),
      reload,
    });

    expect(reload).toHaveBeenCalledOnce();
  });

  it('falls back to one reload without a service worker registration', async () => {
    const reload = vi.fn();
    const activateWaitingWorker = vi.fn();

    await runUpdateSequence({
      registration: null,
      activateWaitingWorker,
      waitForWaitingWorker: vi.fn(),
      waitForActivation: vi.fn(),
      reload,
    });

    expect(activateWaitingWorker).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });
});
