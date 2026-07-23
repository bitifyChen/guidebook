importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA30W2hG77pT06xcBjrKbJd66yyEP9jk2U',
  authDomain: 'guidebook-jeju.firebaseapp.com',
  projectId: 'guidebook-jeju',
  storageBucket: 'guidebook-jeju.firebasestorage.app',
  messagingSenderId: '537972388759',
  appId: '1:537972388759:web:eb81ce2b9d0db4fab14ad2',
});

const messaging = firebase.messaging();
const SYNC_TYPE = 'itineraryUpdated';
const PENDING_CACHE_NAME = 'guidebook-sync-signals';
const PENDING_REQUEST_URL = '/__guidebook_pending_itinerary_sync__';

const persistPendingSignal = async (data) => {
  const cache = await caches.open(PENDING_CACHE_NAME);
  await cache.put(
    PENDING_REQUEST_URL,
    new Response(JSON.stringify(data || {}), {
      headers: { 'Content-Type': 'application/json' },
    })
  );
};

const notifyClients = async (data) => {
  const clientList = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  if (!clientList.length) {
    await persistPendingSignal(data);
    return;
  }
  clientList.forEach((client) => client.postMessage(data));
};

messaging.onBackgroundMessage((payload) => {
  if (payload.data?.type === SYNC_TYPE) {
    return notifyClients(payload.data);
  }

  if (payload.notification) return;

  const title = payload.data?.title || '旅程新動態';
  const options = {
    body: payload.data?.body || '收到一則新訊息',
    icon: '/192.png',
    badge: '/192.png',
    image: payload.data?.image,
  };

  self.registration.showNotification(title, options);
});
