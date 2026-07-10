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
  arrayUnion,
} from 'firebase/firestore';
import {
  assertCurrentTripWritable,
  getTripMetadataRef,
  resolveTripId,
} from '@/api/trips';

const db = getFirestore(app);

const COLLECTION_NAME = 'participants';

const withTripIds = (data) => ({
  ...data,
  tripIds: data.tripIds || (data.tripId ? [data.tripId] : []),
});

// ==========================================
// 0. 版本號管理 (供快取控制)
// ==========================================
export const updateParticipantsVersion = async () => {
  try {
    const tripId = await resolveTripId();
    const docRef = tripId
      ? getTripMetadataRef(tripId, 'participants')
      : doc(db, 'metadata', 'participants');
    await setDoc(docRef, { lastUpdate: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Failed to update participants version:', e);
  }
};

export const getParticipantsVersion = async () => {
  try {
    const tripId = await resolveTripId();
    const docRef = tripId
      ? getTripMetadataRef(tripId, 'participants')
      : doc(db, 'metadata', 'participants');
    let snap = await getDoc(docRef);
    if (!snap.exists() && tripId) {
      snap = await getDoc(doc(db, 'metadata', `participants_${tripId}`));
    }
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
    const tripId = await resolveTripId();
    if (!tripId) {
      return { status: 200, data: [] };
    }
    const snapshots = tripId
      ? await Promise.all([
          getDocs(
            query(
              collection(db, COLLECTION_NAME),
              where('tripIds', 'array-contains', tripId)
            )
          ),
          getDocs(
            query(collection(db, COLLECTION_NAME), where('tripId', '==', tripId))
          ),
        ])
      : [await getDocs(query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'asc')))];

    const rowsById = new Map();
    snapshots.forEach((querySnapshot) => {
      querySnapshot.docs.forEach((participantDoc) => {
        rowsById.set(participantDoc.id, {
          ...withTripIds(participantDoc.data()),
          id: participantDoc.id,
        });
      });
    });
    return {
      status: 200,
      data: Array.from(rowsById.values())
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return aTime - bTime;
        }),
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
    await assertCurrentTripWritable();
    const tripId = await resolveTripId();
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
    const participantData = withTripIds(participantDoc.data());

    if (tripId && !participantData.tripIds.includes(tripId)) {
      throw new Error('這個邀請碼不屬於目前旅程。');
    }

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
    if (tripId) updateData.tripIds = arrayUnion(tripId);

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
    await assertCurrentTripWritable();
    const tripId = params.tripId || (await resolveTripId());
    const docRef = doc(collection(db, COLLECTION_NAME));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let inviteCode = '';
    for (let i = 0; i < 6; i++) {
      inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const data = {
      ...params,
      tripIds: params.tripIds || (tripId ? [tripId] : []),
      ...(tripId ? { tripId } : {}),
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
      await assertCurrentTripWritable();
      const tripId = await resolveTripId();
      const docRef = doc(db, COLLECTION_NAME, id);
      const payload = {
        ...params,
        id,
        updatedAt: serverTimestamp(),
      };
      if (tripId && !params.tripIds) {
        payload.tripIds = arrayUnion(tripId);
        payload.tripId = tripId;
      }
      await updateDoc(docRef, payload);
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
    await assertCurrentTripWritable();
    await deleteDoc(doc(db, COLLECTION_NAME, id));
    await updateParticipantsVersion();
    return { status: 200 };
  } catch (error) {
    throw error;
  }
};

export const getAllParticipants = async () => {
  const querySnapshot = await getDocs(query(collection(db, COLLECTION_NAME)));
  return {
    status: 200,
    data: querySnapshot.docs
      .map((participantDoc) => ({
        ...withTripIds(participantDoc.data()),
        id: participantDoc.id,
      }))
      .sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return aTime - bTime;
      }),
  };
};

export const getParticipantByUid = async (uid, tripId = '') => {
  if (!uid) return null;
  const targetTripId = tripId || (await resolveTripId());
  const q = query(
    collection(db, COLLECTION_NAME),
    where('uid', '==', uid)
  );
  const querySnapshot = await getDocs(q);
  const participantDoc = querySnapshot.docs.find((item) => {
    const data = withTripIds(item.data());
    return !targetTripId || data.tripIds.includes(targetTripId);
  });
  if (!participantDoc) return null;
  return {
    ...withTripIds(participantDoc.data()),
    id: participantDoc.id,
  };
};

export const getParticipantsByUid = async (uid) => {
  if (!uid) return [];
  const q = query(
    collection(db, COLLECTION_NAME),
    where('uid', '==', uid)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((participantDoc) => ({
    ...withTripIds(participantDoc.data()),
    id: participantDoc.id,
  }));
};

export const getParticipantByInviteCode = async (inviteCode) => {
  if (!inviteCode) return null;
  const q = query(
    collection(db, COLLECTION_NAME),
    where('inviteCode', '==', inviteCode.trim().toUpperCase()),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const participantDoc = querySnapshot.docs[0];
  return {
    ...withTripIds(participantDoc.data()),
    id: participantDoc.id,
  };
};
