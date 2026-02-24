import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore'; // 導入 Firestore
import { getAuth } from 'firebase/auth'; // 導入 Auth

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

//EXPORT
export default app;
