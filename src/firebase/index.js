import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore'; // 導入 Firestore
import { getAuth } from 'firebase/auth'; // 導入 Auth
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'guidebook-jeju.firebaseapp.com',
  projectId: 'guidebook-jeju',
  storageBucket: 'guidebook-jeju.firebasestorage.app',
  messagingSenderId: '537972388759',
  appId: '1:537972388759:web:eb81ce2b9d0db4fab14ad2',
  measurementId: 'G-5MDKRPQN4H',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 初始化各項服務
const db = getFirestore(app);
const auth = getAuth(app);

let messaging = null;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.warn('目前瀏覽器環境不支援 Firebase Messaging (FCM)', e);
}

const registerMessagingServiceWorker = async () => {
  const scope = '/firebase-cloud-messaging-push-scope/';
  const existingRegistration = await navigator.serviceWorker.getRegistration(scope);
  if (existingRegistration) return existingRegistration;

  const serviceWorkerUrl = '/firebase-messaging-token-sw.js';
  const response = await fetch(serviceWorkerUrl, { cache: 'no-store' });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('javascript')) {
    throw new Error('Firebase 推播 Service Worker 載入失敗，請確認 /firebase-messaging-token-sw.js 可以正常開啟。');
  }

  return navigator.serviceWorker.register(serviceWorkerUrl, {
    scope,
  });
};

const waitForRegistrationActive = (registration) => {
  if (registration.active) return Promise.resolve(registration);

  const serviceWorker = registration.installing || registration.waiting;
  if (!serviceWorker) return Promise.resolve(registration);

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Firebase 推播 Service Worker 尚未啟用，請重新整理後再試一次。'));
    }, 10000);

    serviceWorker.addEventListener('statechange', () => {
      if (serviceWorker.state === 'activated') {
        clearTimeout(timeoutId);
        resolve(registration);
      }
    });
  });
};

const waitForServiceWorkerReady = async () => {
  const registration = await registerMessagingServiceWorker();
  return waitForRegistrationActive(registration);
};

export const getFCMToken = async () => {
  if (typeof window === 'undefined') return null;

  if (!('serviceWorker' in navigator)) {
    throw new Error('此瀏覽器不支援 Service Worker，無法取得推播 Token。');
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    throw new Error('此瀏覽器環境不支援 Firebase Cloud Messaging。');
  }

  if (!messaging) {
    throw new Error('Firebase Messaging 未成功初始化，無法取得 Token。');
  }

  const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
  if (!vapidKey) {
    throw new Error('尚未設定 VITE_FIREBASE_VAPID_KEY，請先到 Firebase Console 建立 Web Push 憑證並填入 .env。');
  }

  try {
    const registration = await waitForServiceWorkerReady();

    return await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey,
    });
  } catch (error) {
    console.error('獲取 FCM Token 失敗:', error);
    throw error;
  }
};

// EXPORT
export { db, auth }; // 導出常用實例
export default app;
