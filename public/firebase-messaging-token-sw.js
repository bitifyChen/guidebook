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

messaging.onBackgroundMessage((payload) => {
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
