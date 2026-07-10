/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// 1. 讓 VitePWA 自動注入並快取本地靜態資源 (Index.html, JS, CSS 等)
precacheAndRoute(self.__WB_MANIFEST);

// 2. 搬移你原本的圖片快取邏輯到這裡 (處理外部圖片)
registerRoute(
  ({ url }) =>
    url.origin === 'https://i.ibb.co' ||
    url.origin === 'https://firebasestorage.googleapis.com',
  new CacheFirst({
    cacheName: 'external-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// 3. 初始化 Firebase Config
const firebaseConfig = {
  // @ts-ignore
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'guidebook-jeju.firebaseapp.com',
  projectId: 'guidebook-jeju',
  storageBucket: 'guidebook-jeju.firebasestorage.app',
  messagingSenderId: '537972388759',
  appId: '1:537972388759:web:eb81ce2b9d0db4fab14ad2',
};

const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

// 4. 背景收到 FCM 推播時的處理邏輯
onBackgroundMessage(messaging, (payload) => {
  console.log('【Guidebook 背景收到推播】', payload);

  if (payload.notification) return;

  const title = payload.data?.title || '旅程新動態';
  const options = {
    body: payload.data?.body || '收到一則新訊息',
    icon: '/192.png', // 使用你 manifest 裡定義的橘色 icon
    badge: '/192.png',
    image: payload.data?.image,
  };

  self.registration.showNotification(title, options);
});
