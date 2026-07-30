import app from '@/firebase/index.js';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const db = getFirestore(app);
const COLLECTION_NAME = 'notificationLogs';
const PUSH_DELIVERY_ENABLED = false;

const getBackendBaseUrl = () =>
  (
    import.meta.env.VITE_GUIDEBOOK_BACKEND_URL ||
    'https://guidebook-ckce.onrender.com/'
  ).replace(/\/$/, '');

const getAdminIdToken = async () => {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error('請先登入後台。');
  return user.getIdToken();
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return 0;
};

export const getNotificationLogs = async ({ limitCount = 100 } = {}) => {
  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    )
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

export const sendGuidebookNotification = async ({
  title,
  body,
  imageUrl = '',
  clickUrl = '',
  tripId = '',
  participantIds = [],
  type = '',
  silent = false,
  data = {},
}) => {
  if (!PUSH_DELIVERY_ENABLED) {
    return {
      status: 'disabled',
      skipped: true,
      reason: 'push-delivery-disabled',
      targetCount: 0,
      successCount: 0,
      failureCount: 0,
      failures: [],
    };
  }

  const idToken = await getAdminIdToken();
  const response = await fetch(`${getBackendBaseUrl()}/notifications/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body,
      imageUrl,
      clickUrl,
      tripId,
      participantIds,
      type,
      silent,
      data,
    }),
  });

  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(responseData.message || '推播發送失敗。');
  }
  return responseData;
};

export const sendItinerarySyncSignal = ({
  tripId,
  day = '',
  reason = 'itineraryUpdated',
} = {}) =>
  sendGuidebookNotification({
    tripId,
    type: 'itineraryUpdated',
    silent: true,
    data: {
      type: 'itineraryUpdated',
      tripId,
      day: day ? String(day) : '',
      reason,
      updatedAt: String(Date.now()),
    },
  });

export const sortNotificationLogs = (logs = []) =>
  [...logs].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
