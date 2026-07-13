import app from '@/firebase/index.js';
import { v4 as uuid } from 'uuid';
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  limit,
} from 'firebase/firestore';

const db = getFirestore(app);

export const CURRENT_TRIP_ID_KEY = 'guidebook_current_trip_id';

export const DEFAULT_TRIP_CONTEXT = {
  country: '韓國',
  countryCode: 'KR',
  timezone: 'Asia/Seoul',
  latitude: 33.5097,
  longitude: 126.5219,
  weatherCity: 'Seoul',
  currencyCode: 'KRW',
  currencySymbol: '₩',
};

const normalizeInviteCode = (code) => code.trim().toUpperCase();
const getLegacyDayConfigDocId = (tripId) => `${tripId}_dayConfigs`;

export const getTripDayConfigRef = (tripId) =>
  doc(db, 'trips', tripId, 'configs', 'dayConfigs');

export const getTripCollectionRef = (tripId, collectionName) =>
  collection(db, 'trips', tripId, collectionName);

export const getTripDocRef = (tripId, collectionName, itemId) =>
  doc(db, 'trips', tripId, collectionName, itemId);

export const getTripMetadataRef = (tripId, metadataId) =>
  doc(db, 'trips', tripId, 'metadata', metadataId);

export const getLegacyTripDayConfigRef = (tripId) =>
  doc(db, 'configs', getLegacyDayConfigDocId(tripId));

export const getLegacyGlobalDayConfigRef = () => doc(db, 'configs', 'dayConfigs');

const validateTripInviteCode = (code) => {
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    throw new Error('Trip invite code must be exactly 6 uppercase letters or numbers.');
  }
};

const findTripByCodeField = async (field, code) => {
  const normalizedCode = normalizeInviteCode(code);
  const q = query(collection(db, 'trips'), where(field, '==', normalizedCode));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const tripDoc = querySnapshot.docs[0];
  return { ...tripDoc.data(), id: tripDoc.id };
};

const parseTripDate = (value) => {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date;
};

const formatDayConfigDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

const getTripDateRange = (startDate, endDate) => {
  const start = parseTripDate(startDate);
  const end = parseTripDate(endDate);
  if (!start || !end || end < start) return [];

  const dates = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const buildDayConfigsForDateRange = (
  startDate,
  endDate,
  existingList = [],
  options = {}
) => {
  const { pruneExcess = false } = options;
  const dates = getTripDateRange(startDate, endDate);
  if (!dates.length) return existingList;
  if (dates.length > 120) {
    throw new Error('旅程日期區間過長，請確認開始與結束日期。');
  }

  const normalizedList = pruneExcess
    ? existingList.slice(0, dates.length)
    : [...existingList];
  dates.forEach((date, index) => {
    const day = index + 1;
    const existing = normalizedList[index] || {};
    normalizedList[index] = {
      ...existing,
      day,
      title: existing.title || `Day ${day}`,
      date: formatDayConfigDate(date),
      start: existing.start || '09:00',
    };
  });

  return normalizedList;
};

export const getTripDayConfigSyncPreview = async (
  tripId,
  { startDate, endDate }
) => {
  if (!tripId) return null;

  const configRef = getTripDayConfigRef(tripId);
  const snap = await getDoc(configRef);
  const currentList = snap.exists() && Array.isArray(snap.data().list)
    ? snap.data().list
    : [];
  const dates = getTripDateRange(startDate, endDate);
  if (!startDate || !endDate || !dates.length) {
    return {
      currentDays: currentList.length,
      targetDays: 0,
      addCount: 0,
      removeCount: currentList.length,
      changed: currentList.length > 0,
    };
  }
  if (dates.length > 120) {
    throw new Error('旅程日期區間過長，請確認開始與結束日期。');
  }

  const targetDays = dates.length;
  return {
    currentDays: currentList.length,
    targetDays,
    addCount: Math.max(targetDays - currentList.length, 0),
    removeCount: Math.max(currentList.length - targetDays, 0),
    changed: currentList.length !== targetDays,
  };
};

export const ensureTripDayConfigsForDateRange = async (
  tripId,
  { startDate, endDate },
  options = {}
) => {
  if (!tripId) return { status: 200, changed: false };

  const configRef = getTripDayConfigRef(tripId);
  const snap = await getDoc(configRef);
  const currentList = snap.exists() && Array.isArray(snap.data().list)
    ? snap.data().list
    : [];
  if (!startDate || !endDate) {
    if (!snap.exists()) {
      await setDoc(
        configRef,
        { tripId, list: [], updatedAt: serverTimestamp() },
        { merge: true }
      );
      return { status: 200, changed: true, days: 0 };
    }
    return { status: 200, changed: false };
  }

  const nextList = buildDayConfigsForDateRange(
    startDate,
    endDate,
    currentList,
    options
  );

  const changed = JSON.stringify(currentList) !== JSON.stringify(nextList);
  if (!changed) return { status: 200, changed: false };

  await setDoc(
    configRef,
    { tripId, list: nextList, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await setDoc(
    getTripMetadataRef(tripId, 'travel'),
    { lastUpdate: Date.now(), updatedAt: serverTimestamp() },
    { merge: true }
  );

  return { status: 200, changed: true, days: nextList.length };
};

export const generateTripInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const getCurrentTripId = () => {
  return localStorage.getItem(CURRENT_TRIP_ID_KEY) || '';
};

export const setCurrentTripId = (tripId) => {
  if (tripId) {
    localStorage.setItem(CURRENT_TRIP_ID_KEY, tripId);
  } else {
    localStorage.removeItem(CURRENT_TRIP_ID_KEY);
  }
};

export const getTrips = async () => {
  try {
    const q = query(collection(db, 'trips'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return {
      status: 200,
      data: querySnapshot.docs.map((item) => ({
        ...item.data(),
        id: item.id,
      })),
    };
  } catch (error) {
    console.warn('Unable to read trips:', error);
    return { status: 200, data: [] };
  }
};

export const getTripById = async (tripId) => {
  if (!tripId) return null;
  try {
    const snap = await getDoc(doc(db, 'trips', tripId));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  } catch (error) {
    console.warn('Unable to read trip by id:', error);
    return null;
  }
};

export const getTripByInviteCode = async (inviteCode) => {
  try {
    return await findTripByCodeField('inviteCode', inviteCode);
  } catch (error) {
    console.warn('Unable to read trip by invite code:', error);
    throw error;
  }
};

export const getTripByPublicCode = async (publicCode) => {
  try {
    return await findTripByCodeField('publicCode', publicCode);
  } catch (error) {
    console.warn('Unable to read trip by public code:', error);
    throw error;
  }
};

export const isTripCodeAvailable = async (code, excludeTripId = '') => {
  const normalizedCode = normalizeInviteCode(code);
  const [inviteTrip, publicTrip] = await Promise.all([
    getTripByInviteCode(normalizedCode),
    getTripByPublicCode(normalizedCode),
  ]);
  if (inviteTrip && inviteTrip.id !== excludeTripId) return false;
  if (publicTrip && publicTrip.id !== excludeTripId) return false;

  const participantSnap = await getDocs(
    query(
      collection(db, 'participants'),
      where('inviteCode', '==', normalizedCode),
      limit(1)
    )
  );
  return participantSnap.empty;
};

export const isTripInviteCodeAvailable = isTripCodeAvailable;

const createUniqueTripCode = async (reservedCodes = []) => {
  const reserved = new Set(reservedCodes.filter(Boolean).map(normalizeInviteCode));
  for (let i = 0; i < 20; i += 1) {
    const code = generateTripInviteCode();
    if (!reserved.has(code) && (await isTripCodeAvailable(code))) return code;
  }
  throw new Error('Unable to generate a unique trip invite code.');
};

export const getActiveTrip = async () => {
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'app'));
    const activeTripId = settingsSnap.exists()
      ? settingsSnap.data().activeTripId
      : '';
    if (activeTripId) {
      const trip = await getTripById(activeTripId);
      if (trip) return trip;
    }

    const q = query(collection(db, 'trips'), where('status', '==', 'active'));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const tripDoc = querySnapshot.docs[0];
    return { ...tripDoc.data(), id: tripDoc.id };
  } catch (error) {
    console.warn('Unable to resolve active trip; falling back to legacy data.', error);
    return null;
  }
};

export const resolveTripId = async () => {
  const localTripId = getCurrentTripId();
  if (localTripId) return localTripId;

  return '';
};

export const assertCurrentTripWritable = async () => {
  const tripId = await resolveTripId();
  if (!tripId) return;
  const trip = await getTripById(tripId);
  if (trip?.status === 'archived') {
    throw new Error('This trip is archived and cannot be edited.');
  }
};

const commitInChunks = async (operations, chunkSize = 450) => {
  for (let i = 0; i < operations.length; i += chunkSize) {
    const batch = writeBatch(db);
    operations.slice(i, i + chunkSize).forEach((operation) => operation(batch));
    await batch.commit();
  }
};

export const createTrip = async (params) => {
  const tripId = uuid();
  const inviteCode = params.inviteCode
    ? normalizeInviteCode(params.inviteCode)
    : await createUniqueTripCode();
  const publicCode = params.publicCode
    ? normalizeInviteCode(params.publicCode)
    : await createUniqueTripCode([inviteCode]);
  validateTripInviteCode(inviteCode);
  validateTripInviteCode(publicCode);

  if (inviteCode === publicCode) {
    throw new Error('Trip public code and invite code cannot be the same.');
  }

  if (!(await isTripCodeAvailable(inviteCode))) {
    throw new Error('Trip invite code is already in use.');
  }
  if (!(await isTripCodeAvailable(publicCode))) {
    throw new Error('Trip public code is already in use.');
  }

  const trip = {
    title: params.title || 'Untitled Trip',
    destination: params.destination || '',
    country: params.country || DEFAULT_TRIP_CONTEXT.country,
    countryCode: params.countryCode || DEFAULT_TRIP_CONTEXT.countryCode,
    timezone: params.timezone || DEFAULT_TRIP_CONTEXT.timezone,
    latitude:
      params.latitude !== undefined && params.latitude !== ''
        ? Number(params.latitude)
        : DEFAULT_TRIP_CONTEXT.latitude,
    longitude:
      params.longitude !== undefined && params.longitude !== ''
        ? Number(params.longitude)
        : DEFAULT_TRIP_CONTEXT.longitude,
    weatherCity: params.weatherCity || params.destination || DEFAULT_TRIP_CONTEXT.weatherCity,
    currencyCode: params.currencyCode || DEFAULT_TRIP_CONTEXT.currencyCode,
    currencySymbol: params.currencySymbol || DEFAULT_TRIP_CONTEXT.currencySymbol,
    startDate: params.startDate || '',
    endDate: params.endDate || '',
    publicCode,
    inviteCode,
    status: params.status || 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'trips', tripId), trip);
  await ensureTripDayConfigsForDateRange(tripId, trip);

  if (params.setActive !== false) {
    await setActiveTrip(tripId);
  }

  return { status: 200, id: tripId, publicCode, inviteCode };
};

export const patchTrip = async (tripId, params) => {
  const currentSnap = await getDoc(doc(db, 'trips', tripId));
  const currentTrip = currentSnap.exists() ? currentSnap.data() : {};
  const payload = { ...params };
  if (payload.publicCode) {
    payload.publicCode = normalizeInviteCode(payload.publicCode);
    validateTripInviteCode(payload.publicCode);
    if (!(await isTripCodeAvailable(payload.publicCode, tripId))) {
      throw new Error('Trip public code is already in use.');
    }
  }
  if (payload.inviteCode) {
    payload.inviteCode = normalizeInviteCode(payload.inviteCode);
    validateTripInviteCode(payload.inviteCode);
    if (!(await isTripCodeAvailable(payload.inviteCode, tripId))) {
      throw new Error('Trip invite code is already in use.');
    }
  }
  if (!currentTrip.publicCode && !payload.publicCode) {
    payload.publicCode = await createUniqueTripCode([
      payload.inviteCode || currentTrip.inviteCode,
    ]);
  }
  const nextPublicCode = payload.publicCode ?? currentTrip.publicCode;
  const nextInviteCode = payload.inviteCode ?? currentTrip.inviteCode;
  if (nextPublicCode && nextInviteCode && nextPublicCode === nextInviteCode) {
    throw new Error('Trip public code and invite code cannot be the same.');
  }
  if (payload.latitude !== undefined && payload.latitude !== '') {
    payload.latitude = Number(payload.latitude);
  }
  if (payload.longitude !== undefined && payload.longitude !== '') {
    payload.longitude = Number(payload.longitude);
  }

  await updateDoc(doc(db, 'trips', tripId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
  return { status: 200 };
};

export const setActiveTrip = async (tripId) => {
  await setDoc(
    doc(db, 'settings', 'app'),
    { activeTripId: tripId, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await patchTrip(tripId, { status: 'active' });
  setCurrentTripId(tripId);
  return { status: 200 };
};

export const completeTrip = async (tripId) => {
  await updateDoc(doc(db, 'trips', tripId), {
    status: 'completed',
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { status: 200 };
};

export const archiveTrip = async (tripId) => {
  await updateDoc(doc(db, 'trips', tripId), {
    status: 'archived',
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { status: 200 };
};

export const normalizeTripConfigs = async (tripId, options = {}) => {
  if (!tripId) throw new Error('tripId is required.');

  const { removeLegacy = false } = options;
  const tripConfigRef = getTripDayConfigRef(tripId);
  const legacyTripConfigRef = getLegacyTripDayConfigRef(tripId);
  const legacyGlobalConfigRef = getLegacyGlobalDayConfigRef();
  const [tripConfigSnap, legacyTripConfigSnap, legacyGlobalConfigSnap] =
    await Promise.all([
      getDoc(tripConfigRef),
      getDoc(legacyTripConfigRef),
      getDoc(legacyGlobalConfigRef),
    ]);

  const batch = writeBatch(db);
  let operations = 0;
  let migrated = 0;
  let removed = 0;

  if (legacyTripConfigSnap.exists()) {
    batch.set(
      tripConfigRef,
      {
        ...legacyTripConfigSnap.data(),
        tripId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    operations += 1;
    migrated += 1;
  } else if (legacyGlobalConfigSnap.exists()) {
    batch.set(
      tripConfigRef,
      {
        ...legacyGlobalConfigSnap.data(),
        tripId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    operations += 1;
    migrated += 1;
  } else if (!tripConfigSnap.exists()) {
    batch.set(
      tripConfigRef,
      { tripId, list: [], updatedAt: serverTimestamp() },
      { merge: true }
    );
    operations += 1;
  }

  if (removeLegacy) {
    if (legacyTripConfigSnap.exists()) {
      batch.delete(legacyTripConfigRef);
      operations += 1;
      removed += 1;
    }
    if (legacyGlobalConfigSnap.exists()) {
      batch.delete(legacyGlobalConfigRef);
      operations += 1;
      removed += 1;
    }
  }

  if (operations > 0) {
    await batch.commit();
  }
  return { status: 200, migrated, removed };
};

const readLegacyMetadata = async (id) => {
  const snap = await getDoc(doc(db, 'metadata', id));
  return snap.exists() ? snap.data() : null;
};

const copyTopLevelCollectionToTrip = async (
  tripId,
  collectionName,
  options = {}
) => {
  const { removeLegacy = false } = options;
  const snapshot = await getDocs(
    query(collection(db, collectionName), where('tripId', '==', tripId))
  );
  const operations = [];

  snapshot.docs.forEach((item) => {
    operations.push((batch) => {
      batch.set(
        getTripDocRef(tripId, collectionName, item.id),
        {
          ...item.data(),
          id: item.id,
          tripId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (removeLegacy) {
        batch.delete(doc(db, collectionName, item.id));
      }
    });
  });

  await commitInChunks(operations);
  return snapshot.size;
};

export const migrateTripDataToNested = async (tripId, options = {}) => {
  if (!tripId) throw new Error('tripId is required.');

  const { removeLegacy = false } = options;
  const result = {
    itinerary: 0,
    wallet: 0,
    participants: 0,
    metadata: 0,
    configs: 0,
    removedLegacy: removeLegacy,
  };

  result.itinerary = await copyTopLevelCollectionToTrip(
    tripId,
    'itinerary',
    { removeLegacy }
  );
  result.wallet = await copyTopLevelCollectionToTrip(tripId, 'wallet', {
    removeLegacy,
  });

  const participantSnap = await getDocs(
    query(collection(db, 'participants'), where('tripId', '==', tripId))
  );
  const participantOperations = participantSnap.docs.map((item) => (batch) => {
    batch.update(doc(db, 'participants', item.id), {
      tripIds: arrayUnion(tripId),
      updatedAt: serverTimestamp(),
    });
  });
  await commitInChunks(participantOperations);
  result.participants = participantSnap.size;

  const [travelMeta, walletMeta, participantsMeta] = await Promise.all([
    readLegacyMetadata(`travel_${tripId}`),
    readLegacyMetadata(`wallet_${tripId}`),
    readLegacyMetadata(`participants_${tripId}`),
  ]);

  const metadataBatch = writeBatch(db);
  let metadataOps = 0;
  const metadataPairs = [
    ['travel', travelMeta, `travel_${tripId}`],
    ['wallet', walletMeta, `wallet_${tripId}`],
    ['participants', participantsMeta, `participants_${tripId}`],
  ];

  metadataPairs.forEach(([targetId, data, legacyId]) => {
    if (!data) return;
    metadataBatch.set(
      getTripMetadataRef(tripId, targetId),
      {
        ...data,
        tripId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    if (removeLegacy) {
      metadataBatch.delete(doc(db, 'metadata', legacyId));
    }
    metadataOps += 1;
  });

  if (metadataOps > 0) {
    await metadataBatch.commit();
  }
  result.metadata = metadataOps;

  const configResult = await normalizeTripConfigs(tripId, { removeLegacy });
  result.configs = configResult.migrated;

  await updateDoc(doc(db, 'trips', tripId), {
    nestedMigratedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { status: 200, result };
};
