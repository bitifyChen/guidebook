// Import and configure the Firebase SDK
importScripts(
  'https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js'
);
importScripts(
  'https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js'
);

firebase.initializeApp({
  apiKey: 'placeholder', // FCM background sw doesn't strictly need the real API key, but needs the structure
  authDomain: 'guidebook-jeju.firebaseapp.com',
  projectId: 'guidebook-jeju',
  storageBucket: 'guidebook-jeju.firebasestorage.app',
  messagingSenderId: '537972388759',
  appId: '1:537972388759:web:eb81ce2b9d0db4fab14ad2',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/guidebook/favicon.ico',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
