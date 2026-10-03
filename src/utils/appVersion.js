const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

export const UPDATE_DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const normalizeVersion = (value) => {
  const match = String(value || '')
    .trim()
    .match(VERSION_PATTERN);
  if (!match) return null;
  return match.slice(1).map((part) => Number(part));
};

export const compareVersions = (left, right) => {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }
  return 0;
};

export const normalizeReleaseManifest = (manifest) => {
  const version = String(manifest?.version || '').replace(/^v/, '');
  const minimumVersion = String(manifest?.minimumVersion || '').replace(
    /^v/,
    ''
  );
  if (!normalizeVersion(version) || !normalizeVersion(minimumVersion)) {
    return null;
  }
  if (compareVersions(version, minimumVersion) < 0) return null;
  return { version, minimumVersion };
};

export const resolveUpdatePrompt = ({
  currentVersion,
  manifest,
  dismissal,
  now = Date.now(),
  cooldownMs = UPDATE_DISMISS_COOLDOWN_MS,
}) => {
  const normalizedManifest = normalizeReleaseManifest(manifest);
  if (!normalizeVersion(currentVersion) || !normalizedManifest) {
    return { type: 'none', manifest: normalizedManifest };
  }

  if (compareVersions(currentVersion, normalizedManifest.minimumVersion) < 0) {
    return { type: 'required', manifest: normalizedManifest };
  }

  if (compareVersions(normalizedManifest.version, currentVersion) <= 0) {
    return { type: 'none', manifest: normalizedManifest };
  }

  const dismissedRecently =
    dismissal?.version === normalizedManifest.version &&
    Number.isFinite(Number(dismissal?.at)) &&
    now - Number(dismissal.at) < cooldownMs;

  return {
    type: dismissedRecently ? 'none' : 'optional',
    manifest: normalizedManifest,
  };
};

export const runUpdateSequence = async ({
  registration,
  activateWaitingWorker,
  waitForWaitingWorker,
  waitForActivation,
  reload,
  updateTimeoutMs = 6000,
  activationTimeoutMs = 6000,
}) => {
  try {
    if (registration?.update) {
      await Promise.race([
        registration.update().catch(() => null),
        new Promise((resolve) => setTimeout(resolve, updateTimeoutMs)),
      ]);
    }
  } catch {
    // A failed update check must still fall back to one normal reload.
  }

  const waitingWorker =
    registration?.waiting ||
    (registration ? await waitForWaitingWorker(registration) : null);

  if (waitingWorker && activateWaitingWorker) {
    const activation = Promise.resolve(waitForActivation()).catch(() => null);
    await Promise.race([
      Promise.resolve()
        .then(() => activateWaitingWorker(false))
        .catch(() => null),
      new Promise((resolve) => setTimeout(resolve, activationTimeoutMs)),
    ]);
    await activation;
  }

  reload();
};
