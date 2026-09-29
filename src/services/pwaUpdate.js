import { reactive, readonly } from 'vue';
import { registerSW } from 'virtual:pwa-register';
import {
  normalizeReleaseManifest,
  resolveUpdatePrompt,
  runUpdateSequence,
  UPDATE_DISMISS_COOLDOWN_MS,
} from '@/utils/appVersion';

const DISMISS_STORAGE_KEY = 'guidebook_pwa_update_dismissal';
const CHECK_TIMEOUT_MS = 6000;
const WAITING_TIMEOUT_MS = 8000;
const ACTIVATION_TIMEOUT_MS = 6000;

const currentVersion = import.meta.env.VITE_APP_VERSION || '0.0.0';
const state = reactive({
  status: 'idle',
  currentVersion,
  targetVersion: '',
  minimumVersion: '',
  promptType: 'none',
  error: '',
});

let registration = null;
let updateServiceWorker = null;
let hasRegistered = false;
let checkPromise = null;
let updatePromise = null;
let stopLifecycleChecks = null;
let hasReloaded = false;

const withTimeout = (promise, timeoutMs, fallback = null) =>
  new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
    Promise.resolve(promise)
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        resolve(fallback);
      });
  });

const releaseManifestUrl = () => {
  const baseUrl = new URL(
    import.meta.env.BASE_URL || '/',
    window.location.origin
  );
  const normalizedPath = baseUrl.pathname.replace(/\/$/, '');
  baseUrl.pathname = `${normalizedPath}/version.json`.replace(/^\/\//, '/');
  baseUrl.searchParams.set('check', String(Date.now()));
  return baseUrl.toString();
};

const readDismissal = () => {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

const reloadOnce = () => {
  if (hasReloaded) return;
  hasReloaded = true;
  window.location.reload();
};

const waitForWaitingWorker = (targetRegistration) =>
  new Promise((resolve) => {
    if (targetRegistration.waiting) {
      resolve(targetRegistration.waiting);
      return;
    }

    let settled = false;
    const finish = (worker = null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(worker);
    };
    const observeWorker = (worker) => {
      if (!worker) return;
      if (worker.state === 'installed') {
        finish(targetRegistration.waiting || worker);
        return;
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          finish(targetRegistration.waiting || worker);
        }
      });
    };
    const timeoutId = window.setTimeout(() => finish(null), WAITING_TIMEOUT_MS);
    observeWorker(targetRegistration.installing);
    targetRegistration.addEventListener('updatefound', () => {
      observeWorker(targetRegistration.installing);
    });
  });

const waitForActivation = () =>
  new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      navigator.serviceWorker?.removeEventListener('controllerchange', finish);
      window.removeEventListener('pagehide', finish);
      resolve();
    };
    const timeoutId = window.setTimeout(finish, ACTIVATION_TIMEOUT_MS);
    navigator.serviceWorker?.addEventListener('controllerchange', finish, {
      once: true,
    });
    window.addEventListener('pagehide', finish, { once: true });
  });

export const registerPwaUpdateService = () => {
  if (hasRegistered || !('serviceWorker' in navigator)) return;
  hasRegistered = true;
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      checkForAppUpdate({ ignoreDismissal: true });
    },
    onRegisteredSW(_serviceWorkerUrl, nextRegistration) {
      registration = nextRegistration || null;
    },
    onRegisterError(error) {
      console.warn('PWA Service Worker 註冊失敗：', error);
    },
  });
};

export const checkForAppUpdate = ({ ignoreDismissal = false } = {}) => {
  if (
    checkPromise ||
    state.status === 'updating' ||
    ['optional', 'required'].includes(state.promptType) ||
    !navigator.onLine
  ) {
    return checkPromise || Promise.resolve(null);
  }

  checkPromise = (async () => {
    state.status = 'checking';
    state.error = '';
    try {
      const response = await withTimeout(
        fetch(releaseManifestUrl(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        }),
        CHECK_TIMEOUT_MS
      );
      if (!response?.ok) return null;
      const manifest = normalizeReleaseManifest(await response.json());
      if (!manifest) return null;

      const decision = resolveUpdatePrompt({
        currentVersion,
        manifest,
        dismissal: ignoreDismissal ? null : readDismissal(),
      });
      state.targetVersion = manifest.version;
      state.minimumVersion = manifest.minimumVersion;
      state.promptType = decision.type;
      if (decision.type !== 'none') state.status = decision.type;
      return decision;
    } catch (error) {
      state.error = error?.message || '版本檢查失敗';
      return null;
    } finally {
      if (!['optional', 'required'].includes(state.status))
        state.status = 'idle';
      checkPromise = null;
    }
  })();

  return checkPromise;
};

export const dismissAppUpdate = () => {
  if (state.promptType !== 'optional' || !state.targetVersion) return;
  try {
    localStorage.setItem(
      DISMISS_STORAGE_KEY,
      JSON.stringify({ version: state.targetVersion, at: Date.now() })
    );
  } catch {
    // Storage may be unavailable in private browsing; dismissal still applies now.
  }
  state.promptType = 'none';
  state.status = 'idle';
};

export const applyAppUpdate = () => {
  if (updatePromise) return updatePromise;
  updatePromise = (async () => {
    state.status = 'updating';
    state.error = '';
    try {
      if (!registration && 'serviceWorker' in navigator) {
        registration = await withTimeout(
          navigator.serviceWorker.getRegistration(
            import.meta.env.BASE_URL || '/'
          ),
          CHECK_TIMEOUT_MS
        );
      }
      await runUpdateSequence({
        registration,
        activateWaitingWorker: updateServiceWorker,
        waitForWaitingWorker,
        waitForActivation,
        reload: reloadOnce,
      });
    } catch (error) {
      state.error = error?.message || '更新失敗，請稍後再試。';
      state.status = ['optional', 'required'].includes(state.promptType)
        ? state.promptType
        : 'idle';
      updatePromise = null;
      throw error;
    }
  })();
  return updatePromise;
};

export const forceReloadApp = () => applyAppUpdate();

export const startPwaUpdateChecks = () => {
  if (stopLifecycleChecks) return stopLifecycleChecks;
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') checkForAppUpdate();
  };
  const handleOnline = () => checkForAppUpdate();
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('online', handleOnline);
  const timeoutId = window.setTimeout(() => checkForAppUpdate(), 1200);
  stopLifecycleChecks = () => {
    window.clearTimeout(timeoutId);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('online', handleOnline);
    stopLifecycleChecks = null;
  };
  return stopLifecycleChecks;
};

export const pwaUpdateState = readonly(state);
export { UPDATE_DISMISS_COOLDOWN_MS };
