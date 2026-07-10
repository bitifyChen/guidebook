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
  const code = normalizeInviteCode(inviteCode);
  try {
    const q = query(collection(db, 'trips'), where('inviteCode', '==', code));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const tripDoc = querySnapshot.docs[0];
    return { ...tripDoc.data(), id: tripDoc.id };
  } catch (error) {
    console.warn('Unable to read trip by invite code:', error);
    throw error;
  }
};

export const isTripInviteCodeAvailable = async (inviteCode, excludeTripId = '') => {
  const trip = await getTripByInviteCode(inviteCode);
  return !trip || trip.id === excludeTripId;
};

const createUniqueTripInviteCode = async () => {
  for (let i = 0; i < 20; i += 1) {
    const code = generateTripInviteCode();
    if (await isTripInviteCodeAvailable(code)) return code;
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
    : await createUniqueTripInviteCode();
  validateTripInviteCode(inviteCode);

  if (!(await isTripInviteCodeAvailable(inviteCode))) {
    throw new Error('Trip invite code is already in use.');
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
    inviteCode,
    status: params.status || 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'trips', tripId), trip);
  await setDoc(
    getTripDayConfigRef(tripId),
    { tripId, list: [], updatedAt: serverTimestamp() },
    { merge: true }
  );

  if (params.setActive !== false) {
    await setActiveTrip(tripId);
  }

  return { status: 200, id: tripId, inviteCode };
};

export const patchTrip = async (tripId, params) => {
  const payload = { ...params };
  if (payload.inviteCode) {
    payload.inviteCode = normalizeInviteCode(payload.inviteCode);
    validateTripInviteCode(payload.inviteCode);
    if (!(await isTripInviteCodeAvailable(payload.inviteCode, tripId))) {
      throw new Error('Trip invite code is already in use.');
    }
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
