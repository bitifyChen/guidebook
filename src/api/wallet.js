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
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  assertCurrentTripWritable,
  getTripCollectionRef,
  getTripDocRef,
  getTripMetadataRef,
  resolveTripId,
} from '@/api/trips';

const db = getFirestore(app);

// ==========================================
// 0. 版本號管理 (供快取控制)
// ==========================================
export const updateWalletVersion = async () => {
  try {
    const tripId = await resolveTripId();
    const docRef = tripId
      ? getTripMetadataRef(tripId, 'wallet')
      : doc(db, 'metadata', 'wallet');
    await setDoc(docRef, { lastUpdate: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Failed to update wallet version:', e);
  }
};

export const getWalletVersion = async () => {
  try {
    const tripId = await resolveTripId();
    const docRef = tripId
      ? getTripMetadataRef(tripId, 'wallet')
      : doc(db, 'metadata', 'wallet');
    let snap = await getDoc(docRef);
    if (!snap.exists() && tripId) {
      snap = await getDoc(doc(db, 'metadata', `wallet_${tripId}`));
    }
    return snap.exists() ? snap.data() : { lastUpdate: 0 };
  } catch (e) {
    return { lastUpdate: 0 };
  }
};

// ==========================================
// 1. 花費管理 (Wallet)
// ==========================================

/**
 * [READ] 取得所有花費
 */
export const getWallet = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const tripId = await resolveTripId();
      if (!tripId) {
        resolve({ status: 200, data: [] });
        return;
      }
      let querySnapshot = await getDocs(getTripCollectionRef(tripId, 'wallet'));
      if (querySnapshot.empty) {
        querySnapshot = await getDocs(
          query(collection(db, 'wallet'), where('tripId', '==', tripId))
        );
      }
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
 * [CREATE / UPDATE] 新增或覆蓋花費
 * @param {string} id - 文件 ID (例如 'i1')
 * @param {Object} params - 行程內容
 */
export const postWalletItem = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      await assertCurrentTripWritable();
      const tripId = await resolveTripId();
      if (!tripId) throw new Error('請先選擇旅程');
      const walletRef = getTripCollectionRef(tripId, 'wallet');
      // 不傳 ID 給 doc()，Firestore 就會自動生成隨機 ID
      const docRef = doc(walletRef);

      await setDoc(docRef, {
        ...params,
        ...(tripId ? { tripId } : {}),
        updatedAt: serverTimestamp(),
      });
      await updateWalletVersion();
      resolve({ status: 200, id: docRef.id });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * [PATCH] 部分更新花費
 */
export const patchWalletItem = (id, params) => {
  return new Promise(async (resolve, reject) => {
    try {
      await assertCurrentTripWritable();
      const tripId = await resolveTripId();
      if (!tripId) throw new Error('請先選擇旅程');
      const docRef = getTripDocRef(tripId, 'wallet', id);
      await updateDoc(docRef, {
        ...params,
        id,
        ...(tripId ? { tripId } : {}),
        updatedAt: serverTimestamp(),
      });
      await updateWalletVersion();
      resolve({ status: 200 });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * [DELETE] 刪除花費
 */
export const deleteWalletItem = (id) => {
  return new Promise(async (resolve, reject) => {
    try {
      await assertCurrentTripWritable();
      const tripId = await resolveTripId();
      if (!tripId) throw new Error('請先選擇旅程');
      await deleteDoc(getTripDocRef(tripId, 'wallet', id));
      await updateWalletVersion();
      resolve({ status: 200 });
    } catch (error) {
      reject(error);
    }
  });
};
