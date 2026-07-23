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

export const getActiveTrackingTokenByParticipant = async (participantId) => {
  const tokens = await getTrackingTokensByParticipant(participantId);
  return tokens.find((item) => item.enabled !== false && item.token) || null;
};

export const createParticipantTrackingToken = async ({
  participantId,
  deviceId = '',
  minIntervalSeconds = 30,
}) => {
  if (!participantId) throw new Error('participantId is required.');

  const existingTokens = await getTrackingTokensByParticipant(participantId);
  const existingToken = existingTokens.find((item) => item.token);
  if (existingToken) {
    await updateDoc(doc(db, TOKEN_COLLECTION, existingToken.id), {
      participantId,
      deviceId: deviceId.trim(),
      enabled: true,
      revokedAt: null,
      minIntervalSeconds: Number(minIntervalSeconds) || 30,
      updatedAt: serverTimestamp(),
    });

    return {
      token: existingToken.token,
      tokenHash: existingToken.id,
      existing: true,
    };
  }

  const token = createRawTrackingToken();
  const tokenHash = await hashTrackingToken(token);
  await setDoc(doc(db, TOKEN_COLLECTION, tokenHash), {
    token,
    participantId,
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
  deviceId = '',
  minIntervalSeconds = 30,
}) => {
  const existingTokens = await getTrackingTokensByParticipant(participantId);
  const activeToken = existingTokens.find(
    (item) => item.enabled !== false && item.token
  );
  if (activeToken) {
    await updateDoc(doc(db, TOKEN_COLLECTION, activeToken.id), {
      participantId,
      deviceId: deviceId.trim(),
      enabled: true,
      revokedAt: null,
      minIntervalSeconds: Number(minIntervalSeconds) || 30,
      updatedAt: serverTimestamp(),
    });

    return {
      token: activeToken.token,
      tokenHash: activeToken.id,
      existing: true,
    };
  }

  return createParticipantTrackingToken({
    participantId,
    deviceId,
    minIntervalSeconds,
  });
};

export const deleteTrackingTokensByParticipant = async (participantId) => {
  if (!participantId) return;
  const tokens = await getTrackingTokensByParticipant(participantId);
  await Promise.all(
    tokens.map((item) => deleteDoc(doc(db, TOKEN_COLLECTION, item.id)))
  );
};

export const getTrackingEndpointUrl = (token) => {
  const baseUrl = (
    import.meta.env.VITE_GUIDEBOOK_BACKEND_URL ||
    'https://guidebook-ckce.onrender.com/'
  ).replace(/\/$/, '');
  return `${baseUrl}/tracking/traccar?token=${encodeURIComponent(token)}`;
};

export const getTraccarConfigUrl = ({
  token,
  deviceId = '',
  accuracy = 'highest',
  distance = 0,
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
