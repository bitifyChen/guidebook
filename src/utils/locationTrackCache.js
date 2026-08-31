const DATABASE_NAME = 'guidebook-location-tracks';
const DATABASE_VERSION = 1;
const STORE_NAME = 'historyTracks';

let databasePromise = null;

const getIndexedDb = () => globalThis.indexedDB;

const openDatabase = () => {
  if (!getIndexedDb()) return Promise.resolve(null);
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = getIndexedDb().open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: 'key',
        });
        store.createIndex('viewerId', 'viewerId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('歷史軌跡快取資料庫目前無法開啟。'));
  }).catch(() => null);
  return databasePromise;
};

const runRequest = async (mode, action) => {
  const database = await openDatabase();
  if (!database) return null;

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  }).catch(() => null);
};

const encodePart = (value) => encodeURIComponent(String(value || ''));

export const createLocationTrackCacheKey = ({
  viewerId,
  tripId,
  participantId,
  date,
  cacheVersion = 0,
}) =>
  [viewerId, tripId, participantId, date, cacheVersion]
    .map(encodePart)
    .join('|');

export const getCachedLocationTrack = async (identity) =>
  runRequest('readonly', (store) =>
    store.get(createLocationTrackCacheKey(identity))
  );

export const setCachedLocationTrack = async (identity, archive) =>
  runRequest('readwrite', (store) =>
    store.put({
      key: createLocationTrackCacheKey(identity),
      viewerId: String(identity.viewerId || ''),
      tripId: String(identity.tripId || ''),
      participantId: String(identity.participantId || ''),
      date: String(identity.date || ''),
      cacheVersion: Number(identity.cacheVersion || 0),
      revision: Number(archive.revision || 0),
      checksum: String(archive.checksum || ''),
      points: Array.isArray(archive.points) ? archive.points : [],
      stops: Array.isArray(archive.stops) ? archive.stops : [],
      summary: archive.summary || {},
      cachedAt: Date.now(),
    })
  );

export const deleteCachedLocationTrack = async (identity) =>
  runRequest('readwrite', (store) =>
    store.delete(createLocationTrackCacheKey(identity))
  );

export const clearCachedLocationTracksForViewer = async (viewerId) => {
  const database = await openDatabase();
  if (!database || !viewerId) return;
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const index = transaction.objectStore(STORE_NAME).index('viewerId');
    const request = index.openKeyCursor(
      globalThis.IDBKeyRange.only(String(viewerId))
    );
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      transaction.objectStore(STORE_NAME).delete(cursor.primaryKey);
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).catch(() => null);
};

export const resetLocationTrackCacheConnectionForTests = () => {
  databasePromise = null;
};
