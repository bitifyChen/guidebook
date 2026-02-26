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
  orderBy,
  serverTimestamp,
  limit,
} from 'firebase/firestore';

const db = getFirestore(app);

const COLLECTION_NAME = 'participants';

// ==========================================
// 0. 版本號管理 (供快取控制)
// ==========================================
export const updateParticipantsVersion = async () => {
  try {
    const docRef = doc(db, 'metadata', 'participants');
    await setDoc(docRef, { lastUpdate: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Failed to update participants version:', e);
  }
};

export const getParticipantsVersion = async () => {
  try {
    const docRef = doc(db, 'metadata', 'participants');
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : { lastUpdate: 0 };
  } catch (e) {
    return { lastUpdate: 0 };
  }
};

// ==========================================
// 1. 參與者管理 (Participants)
// ==========================================

export const getParticipants = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return {
      status: 200,
      data: querySnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      })),
    };
  } catch (error) {
    throw error;
  }
};

/**
 * [CLAIM] 認領參與者
 * @param {string} inviteCode 邀請碼
 * @param {string} uid 使用者 UID (選填)
 * @param {boolean} force 是否強制重新認領
 */
export const claimParticipantByCode = async (
  inviteCode,
  uid = null,
  force = false
) => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('inviteCode', '==', inviteCode),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('找不到該邀請碼，請檢查輸入是否正確。');
    }

    const participantDoc = querySnapshot.docs[0];
    const participantData = participantDoc.data();

    // 如果已被認領且沒有強制執行，則回傳需要確認的狀態
    if (participantData.isClaimed && !force) {
      return {
        status: 409,
        message: `此邀請碼已被「${participantData.name}」認領過，是否要重新綁定到此裝置？`,
        id: participantDoc.id,
      };
    }

    // 更新該旅客資料
    const docRef = doc(db, COLLECTION_NAME, participantDoc.id);
    const updateData = {
      isClaimed: true,
      claimedAt: serverTimestamp(),
    };
    if (uid) updateData.uid = uid;

    await updateDoc(docRef, updateData);
    await updateParticipantsVersion();

    return {
      status: 200,
      data: { ...participantData, id: participantDoc.id, uid },
    };
  } catch (error) {
    throw error;
  }
};

/**
 * [CREATE] 新增參與者
 */
export const postParticipant = async (params) => {
  try {
    const docRef = doc(collection(db, COLLECTION_NAME));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let inviteCode = '';
    for (let i = 0; i < 6; i++) {
      inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const data = {
      ...params,
      inviteCode, // 加入邀請碼
      createdAt: serverTimestamp(),
    };
    await setDoc(docRef, data);
    await updateParticipantsVersion();
    return { status: 200, id: docRef.id };
  } catch (error) {
    throw error;
  }
};

/**
 * [PATCH] 部分更新參與者
 */
export const patchParticipant = (id, params) => {
  return new Promise(async (resolve, reject) => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...params,
        id,
        updatedAt: serverTimestamp(),
      });
      await updateParticipantsVersion();
      resolve({ status: 200 });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * [DELETE] 刪除參與者
 */
export const deleteParticipant = async (id) => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    await updateParticipantsVersion();
    return { status: 200 };
  } catch (error) {
    throw error;
  }
};
