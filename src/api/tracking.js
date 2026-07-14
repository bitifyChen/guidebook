import app from '@/firebase/index.js';
import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const db = getFirestore(app);
const TOKEN_COLLECTION = 'trackingTokens';

const bytesToHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');

export const hashTrackingToken = async (token) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(digest);
};

export const createRawTrackingToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes).toUpperCase();
};

export const getTrackingTokensByParticipant = async (participantId) => {
  if (!participantId) return [];
  const snapshot = await getDocs(
    query(
      collection(db, TOKEN_COLLECTION),
      where('participantId', '==', participantId)
    )
  );
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

export const getTrackingTokensByParticipantTrip = async (participantId, tripId) => {
  if (!participantId || !tripId) return [];
  const snapshot = await getDocs(
    query(
      collection(db, TOKEN_COLLECTION),
      where('participantId', '==', participantId),
      where('tripId', '==', tripId)
    )
  );
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

export const createParticipantTrackingToken = async ({
  participantId,
  tripId,
  deviceId = '',
  minIntervalSeconds = 30,
}) => {
  if (!participantId) throw new Error('participantId is required.');
  if (!tripId) throw new Error('tripId is required.');

  const token = createRawTrackingToken();
  const tokenHash = await hashTrackingToken(token);
  await setDoc(doc(db, TOKEN_COLLECTION, tokenHash), {
    token,
    participantId,
    tripId,
    deviceId: deviceId.trim(),
    enabled: true,
    minIntervalSeconds: Number(minIntervalSeconds) || 30,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { token, tokenHash };
};

export const ensureParticipantTrackingToken = async ({
  participantId,
  tripId,
  deviceId = '',
  minIntervalSeconds = 30,
}) => {
  const existingTokens = await getTrackingTokensByParticipantTrip(participantId, tripId);
  const activeToken = existingTokens.find((item) => item.enabled !== false && item.token);
  if (activeToken) {
    return {
      token: activeToken.token,
      tokenHash: activeToken.id,
      existing: true,
    };
  }

  return createParticipantTrackingToken({
    participantId,
    tripId,
    deviceId,
    minIntervalSeconds,
  });
};

export const revokeTrackingToken = async (tokenHash) => {
  if (!tokenHash) return;
  await updateDoc(doc(db, TOKEN_COLLECTION, tokenHash), {
    enabled: false,
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const deleteTrackingTokensByParticipant = async (participantId) => {
  if (!participantId) return;
  const tokens = await getTrackingTokensByParticipant(participantId);
  await Promise.all(tokens.map((item) => deleteDoc(doc(db, TOKEN_COLLECTION, item.id))));
};

export const getTrackingEndpointUrl = (token) => {
  const baseUrl = (
    import.meta.env.VITE_GUIDEBOOK_BACKEND_URL ||
    'https://guidebook-hoju.onrender.com'
  ).replace(/\/$/, '');
  return `${baseUrl}/tracking/traccar?token=${encodeURIComponent(token)}`;
};

export const getTraccarConfigUrl = ({
  token,
  deviceId = '',
  accuracy = 'high',
  distance = 10,
  interval = 30,
  wakelock = true,
  buffer = true,
}) => {
  if (!token) return '';
  const params = new URLSearchParams({
    url: getTrackingEndpointUrl(token),
    id: deviceId || `guidebook-${token.slice(0, 8)}`,
    accuracy,
    distance: String(distance),
    interval: String(interval),
    wakelock: String(wakelock),
    buffer: String(buffer),
  });
  return `org.traccar.client://config?${params.toString()}`;
};
