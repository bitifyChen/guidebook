import app from '@/firebase/index.js';
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  DEFAULT_PACKING_CATALOG,
  normalizePackingCatalog,
} from '@/utils/packingList';

const db = getFirestore(app);
const catalogRef = () => doc(db, 'settings', 'packingCatalog');

export const getPackingCatalog = async () => {
  const snapshot = await getDoc(catalogRef());
  if (!snapshot.exists()) return [];
  return normalizePackingCatalog(snapshot.data().list || []);
};

export const savePackingCatalog = async (list) => {
  const normalized = normalizePackingCatalog(list);
  await setDoc(
    catalogRef(),
    { list: normalized, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return normalized;
};

export const ensurePackingCatalog = async () => {
  const snapshot = await getDoc(catalogRef());
  if (snapshot.exists() && Array.isArray(snapshot.data().list)) {
    return normalizePackingCatalog(snapshot.data().list);
  }
  return savePackingCatalog(DEFAULT_PACKING_CATALOG);
};
