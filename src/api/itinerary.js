import app from '@/firebase/index.js';
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

const db = getFirestore(app);

// ==========================================
// 0. 更新全域版本號 (供快取控制)
// 將此邏輯私有化或維持導出，但在寫入操作中自動呼叫
export const updateGlobalVersion = async () => {
  try {
    const docRef = doc(db, 'metadata', 'travel');
    await setDoc(docRef, { lastUpdate: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Failed to update version:', e);
  }
};

export const getGlobalVersion = async () => {
  try {
    const docRef = doc(db, 'metadata', 'travel');
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : { lastUpdate: 0 };
  } catch (e) {
    return { lastUpdate: 0 };
  }
};

// 1. 行程點管理 (Itinerary)
// ==========================================

/**
 * [READ] 取得所有行程點
 */
export const getItinerary = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const q = query(collection(db, 'itinerary'), orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
      resolve({ status: 200, data });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * [CREATE / UPDATE] 新增或覆蓋行程點
 * @param {string} id - 文件 ID (例如 'i1')
 * @param {Object} params - 行程內容
 */
export const postItineraryItem = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const itineraryRef = collection(db, 'itinerary');
      const docRef = doc(itineraryRef);
      await setDoc(docRef, {
        ...params,
        updatedAt: serverTimestamp(),
      });
      // 自動更新全域版本
      await updateGlobalVersion();
      resolve({ status: 200, id: docRef.id });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * [PATCH] 部分更新行程點 (例如只改 Delay 或 Duration)
 */
export const patchItineraryItem = (id, params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const docRef = doc(db, 'itinerary', id);
      await updateDoc(docRef, {
        ...params,
        id,
        updatedAt: serverTimestamp(),
      });
      // 自動更新全域版本
      await updateGlobalVersion();
      resolve({ status: 200 });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * [DELETE] 刪除行程點
 */
export const deleteItineraryItem = (id) => {
  return new Promise(async (resolve, reject) => {
    try {
      await deleteDoc(doc(db, 'itinerary', id));
      // 自動更新全域版本
      await updateGlobalVersion();
      resolve({ status: 200 });
    } catch (error) {
      reject(error);
    }
  });
};

// ==========================================
// 2. 每日設定管理 (Configs)
// ==========================================

/**
 * [READ] 取得每日出發時間設定
 */
export const getDayConfigs = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const querySnapshot = await getDocs(collection(db, 'configs'));
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      resolve({ status: 200, data });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * [PATCH] 更新特定天數的出發時間
 * @param {string} id - 文件 ID (例如 'dayConfigs')
 * @param {Object} params - 例如 { list: [...] }
 */
export const patchDayConfig = (id, params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const docRef = doc(db, 'configs', id);
      await updateDoc(docRef, params);
      // 自動更新全域版本
      await updateGlobalVersion();
      resolve({ status: 200 });
    } catch (error) {
      reject(error);
    }
  });
};
