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
  getTripByInviteCode,
  getTripByPublicCode,
  getTripMetadataRef,
  resolveTripId,
} from '@/api/trips';
import {
  deleteTrackingTokensByParticipant,
  ensureParticipantTrackingToken,
} from '@/api/tracking';

const db = getFirestore(app);

const COLLECTION_NAME = 'participants';

const withTripIds = (data) => ({
  ...data,
  tripIds: data.tripIds || (data.tripId ? [data.tripId] : []),
  canViewTeamLocationHistory: data.canViewTeamLocationHistory === true,
});

const ensureTrackingTokenForParticipant = async (
  participantId,
  deviceName = '',
  tripId = ''
) => {
  await ensureParticipantTrackingToken({
    participantId,
    tripId,
    deviceId: deviceName,
    minIntervalSeconds: 30,
  });
};

const createParticipantInviteCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let inviteCode = '';
    for (let i = 0; i < 6; i += 1) {
      inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const snap = await getDocs(
      query(
        collection(db, COLLECTION_NAME),
        where('inviteCode', '==', inviteCode),
        limit(1)
      )
    );
    const [inviteTrip, publicTrip] = await Promise.all([
      getTripByInviteCode(inviteCode),
      getTripByPublicCode(inviteCode),
    ]);
    if (snap.empty && !inviteTrip && !publicTrip) return inviteCode;
  }
  throw new Error('Unable to generate a unique participant invite code.');
};

const updateParticipantsVersionForTrip = async (tripId) => {
  if (!tripId) return updateParticipantsVersion();
  await setDoc(
    getTripMetadataRef(tripId, 'participants'),
    { lastUpdate: Date.now(), updatedAt: serverTimestamp() },
    { merge: true }
  );
};

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
            query(
              collection(db, COLLECTION_NAME),
              where('tripId', '==', tripId)
            )
          ),
        ])
      : [
          await getDocs(
            query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'asc'))
          ),
        ];

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
      data: Array.from(rowsById.values()).sort((a, b) => {
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

    const tripIds = params.tripIds || (tripId ? [tripId] : []);
    const data = {
      ...params,
      tripIds,
      ...(tripId ? { tripId } : {}),
      inviteCode, // 加入邀請碼
      createdAt: serverTimestamp(),
    };
    await setDoc(docRef, data);
    await ensureTrackingTokenForParticipant(docRef.id, data.name || '', tripId);
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

export const upsertParticipantPushToken = async (
  id,
  token,
  { previousToken = '', tripId = '', userAgent = '', platform = '' } = {}
) => {
  if (!id || !token) throw new Error('缺少成員或推播 Token。');

  const docRef = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('找不到成員資料。');

  const participant = withTripIds(snap.data());
  const now = Date.now();
  const existingTokens = Array.isArray(participant.pushTokens)
    ? participant.pushTokens
    : participant.pushToken
      ? [{ token: participant.pushToken }]
      : [];
  const existingToken =
    existingTokens.find((item) => item.token === token) ||
    existingTokens.find(
      (item) => previousToken && item.token === previousToken
    ) ||
    existingTokens[0];

  const nextToken = {
    token,
    userAgent,
    platform,
    permission: 'granted',
    createdAt: existingToken?.createdAt || now,
    updatedAt: now,
  };

  await updateDoc(docRef, {
    pushTokens: [nextToken],
    pushToken: token,
    pushTokenUpdatedAt: now,
    notificationPermission: 'granted',
    notificationPreferences: {
      ...(participant.notificationPreferences || {}),
      ...(tripId ? { [tripId]: 'granted' } : {}),
    },
    updatedAt: serverTimestamp(),
  });
  await updateParticipantsVersion();

  return { status: 200 };
};

export const updateParticipantNotificationPreference = async (
  id,
  { tripId = '', permission = 'default' } = {}
) => {
  if (!id) throw new Error('缺少成員 ID。');

  const docRef = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('找不到成員資料。');

  const participant = snap.data();
  await updateDoc(docRef, {
    notificationPermission: permission,
    notificationPreferences: {
      ...(participant.notificationPreferences || {}),
      ...(tripId ? { [tripId]: permission } : {}),
    },
    updatedAt: serverTimestamp(),
  });
  await updateParticipantsVersion();

  return { status: 200 };
};

export const disableParticipantPushForTrip = async (
  id,
  { tripId = '', token = '' } = {}
) => {
  if (!id) throw new Error('缺少成員 ID。');

  const docRef = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('找不到成員資料。');

  const participant = snap.data();
  const now = Date.now();
  const currentTokens = Array.isArray(participant.pushTokens)
    ? participant.pushTokens
    : participant.pushToken
      ? [{ token: participant.pushToken }]
      : [];
  const nextTokens = currentTokens
    .filter((item) => item?.token)
    .map((item) => {
      if (token && item.token !== token) return item;
      return {
        ...item,
        permission: 'denied',
        disabledAt: now,
        updatedAt: now,
      };
    });

  await updateDoc(docRef, {
    pushTokens: nextTokens,
    pushToken: nextTokens.at(-1)?.token || participant.pushToken || '',
    pushTokenUpdatedAt: now,
    notificationPermission: 'denied',
    notificationPreferences: {
      ...(participant.notificationPreferences || {}),
      ...(tripId ? { [tripId]: 'denied' } : {}),
    },
    updatedAt: serverTimestamp(),
  });
  await updateParticipantsVersion();

  return { status: 200 };
};

/**
 * [DELETE] 刪除參與者
 */
export const deleteParticipant = async (id) => {
  try {
    await assertCurrentTripWritable();
    await deleteTrackingTokensByParticipant(id);
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
  const q = query(collection(db, COLLECTION_NAME), where('uid', '==', uid));
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
  const q = query(collection(db, COLLECTION_NAME), where('uid', '==', uid));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((participantDoc) => ({
    ...withTripIds(participantDoc.data()),
    id: participantDoc.id,
  }));
};

export const getParticipantByGuestId = async (guestId, tripId = '') => {
  if (!guestId) return null;
  const q = query(
    collection(db, COLLECTION_NAME),
    where('guestId', '==', guestId)
  );
  const querySnapshot = await getDocs(q);
  const participantDoc = querySnapshot.docs.find((item) => {
    const data = withTripIds(item.data());
    return !tripId || data.tripIds.includes(tripId);
  });
  if (!participantDoc) return null;
  return {
    ...withTripIds(participantDoc.data()),
    id: participantDoc.id,
  };
};

export const getOrCreateTripInviteParticipant = async (
  tripId,
  profile = {}
) => {
  if (!tripId) throw new Error('tripId is required.');

  const uid = profile.uid || null;
  const guestId = profile.guestId || '';
  const name = profile.name || profile.email || '訪客';
  const avatar = profile.avatar || '';
  const email = profile.email || '';

  if (uid) {
    const memberships = await getParticipantsByUid(uid);
    const existingForTrip = memberships.find((participant) =>
      participant.tripIds.includes(tripId)
    );
    if (existingForTrip) {
      await ensureParticipantTrackingToken({
        participantId: existingForTrip.id,
        tripId,
        deviceId: existingForTrip.name || name,
        minIntervalSeconds: 30,
      });
      return { ...existingForTrip, isNewParticipant: false };
    }

    if (memberships.length) {
      const target = memberships[0];
      await updateDoc(doc(db, COLLECTION_NAME, target.id), {
        tripIds: arrayUnion(tripId),
        uid,
        name: target.name || name,
        avatar: target.avatar || avatar,
        email: target.email || email,
        isClaimed: true,
        updatedAt: serverTimestamp(),
      });
      await ensureParticipantTrackingToken({
        participantId: target.id,
        tripId,
        deviceId: target.name || name,
        minIntervalSeconds: 30,
      });
      await updateParticipantsVersionForTrip(tripId);
      return {
        ...target,
        tripIds: [...new Set([...target.tripIds, tripId])],
        uid,
        isClaimed: true,
        isNewParticipant: false,
      };
    }
  }

  if (!uid && guestId) {
    const existingGuest = await getParticipantByGuestId(guestId);
    if (existingGuest) {
      if (!existingGuest.tripIds.includes(tripId)) {
        await updateDoc(doc(db, COLLECTION_NAME, existingGuest.id), {
          tripIds: arrayUnion(tripId),
          updatedAt: serverTimestamp(),
        });
        await ensureParticipantTrackingToken({
          participantId: existingGuest.id,
          tripId,
          deviceId: existingGuest.name || name,
          minIntervalSeconds: 30,
        });
        await updateParticipantsVersionForTrip(tripId);
      } else {
        await ensureParticipantTrackingToken({
          participantId: existingGuest.id,
          tripId,
          deviceId: existingGuest.name || name,
          minIntervalSeconds: 30,
        });
      }
      return {
        ...existingGuest,
        tripIds: [...new Set([...existingGuest.tripIds, tripId])],
        isNewParticipant: false,
      };
    }
  }

  const docRef = doc(collection(db, COLLECTION_NAME));
  const participant = {
    name,
    avatar,
    email,
    uid,
    guestId,
    isGuest: !uid,
    isClaimed: Boolean(uid),
    source: 'tripInviteCode',
    tripId,
    tripIds: [tripId],
    inviteCode: await createParticipantInviteCode(),
    canViewTeamLocationHistory: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(docRef, participant);
  await ensureParticipantTrackingToken({
    participantId: docRef.id,
    tripId,
    deviceId: name,
    minIntervalSeconds: 30,
  });
  await updateParticipantsVersionForTrip(tripId);

  return {
    ...participant,
    id: docRef.id,
    createdAt: null,
    updatedAt: null,
    isNewParticipant: true,
  };
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
