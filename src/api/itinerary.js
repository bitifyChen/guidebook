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
  writeBatch,
} from 'firebase/firestore';
import {
  assertCurrentTripWritable,
  getLegacyGlobalDayConfigRef,
  getLegacyTripDayConfigRef,
  getTripCollectionRef,
  getTripDayConfigRef,
  getTripDocRef,
  getTripMetadataRef,
  resolveTripId,
} from '@/api/trips';

const db = getFirestore(app);

// ==========================================
// 0. 更新全域版本號 (供快取控制)
// 將此邏輯私有化或維持導出，但在寫入操作中自動呼叫
export const updateGlobalVersion = async () => {
  try {
    const tripId = await resolveTripId();
    const docRef = tripId
      ? getTripMetadataRef(tripId, 'travel')
      : doc(db, 'metadata', 'travel');
    await setDoc(docRef, { lastUpdate: Date.now() }, { merge: true });
  } catch (e) {
    console.error('Failed to update version:', e);
  }
};

export const getGlobalVersion = async () => {
  try {
    const tripId = await resolveTripId();
    const docRef = tripId
      ? getTripMetadataRef(tripId, 'travel')
      : doc(db, 'metadata', 'travel');
    let snap = await getDoc(docRef);
    if (!snap.exists() && tripId) {
      snap = await getDoc(doc(db, 'metadata', `travel_${tripId}`));
    }
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
      const tripId = await resolveTripId();
      if (!tripId) {
        resolve({ status: 200, data: [] });
        return;
      }
      let querySnapshot = await getDocs(
        getTripCollectionRef(tripId, 'itinerary')
      );
      if (querySnapshot.empty) {
        querySnapshot = await getDocs(
          query(collection(db, 'itinerary'), where('tripId', '==', tripId))
        );
      }
      const data = querySnapshot.docs
        .map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      resolve({ status: 200, data });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * [CREATE / UPDATE] 新增或覆蓋行程點
 * @param {Object} params - 行程內容
 */
export const postItineraryItem = (params) => {
  return new Promise(async (resolve, reject) => {
    try {
      await assertCurrentTripWritable();
      const tripId = await resolveTripId();
      if (!tripId) throw new Error('請先選擇旅程');
      const itineraryRef = getTripCollectionRef(tripId, 'itinerary');
      const docRef = doc(itineraryRef);
      await setDoc(docRef, {
        ...params,
        ...(tripId ? { tripId } : {}),
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
      await assertCurrentTripWritable();
      const tripId = await resolveTripId();
      if (!tripId) throw new Error('請先選擇旅程');
      const docRef = getTripDocRef(tripId, 'itinerary', id);
      await updateDoc(docRef, {
        ...params,
        id,
        ...(tripId ? { tripId } : {}),
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
      await assertCurrentTripWritable();
      const tripId = await resolveTripId();
      if (!tripId) throw new Error('請先選擇旅程');
      await deleteDoc(getTripDocRef(tripId, 'itinerary', id));
      // 自動更新全域版本
      await updateGlobalVersion();
      resolve({ status: 200 });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * [BULK SYNC] 大量同步行程點 (匯入功能)
 * 邏輯：ID 匹配則更新，JSON 消失則刪除，新 ID 則新增
 * @param {Array} newItems - 來自 JSON 的新行程陣列
 */
export const bulkUpdateItinerary = async (newItems) => {
  try {
    await assertCurrentTripWritable();
    const tripId = await resolveTripId();
    if (!tripId) throw new Error('請先選擇旅程');
    const batch = writeBatch(db);
    const itineraryRef = getTripCollectionRef(tripId, 'itinerary');
    // 1. 取得目前資料庫所有項目
    const { data: currentItems } = await getItinerary();
    const currentIds = currentItems.map((item) => item.id);
    const newIds = newItems.filter((item) => item.id).map((item) => item.id);

    // 2. 處理刪除 (存在於 current 但不存在於 new)
    const toDelete = currentItems.filter((item) => !newIds.includes(item.id));
    toDelete.forEach((item) => {
      const docRef = getTripDocRef(tripId, 'itinerary', item.id);
      batch.delete(docRef);
    });

    // 3. 處理新增與更新
    newItems.forEach((item) => {
      const { id, ...content } = item;
      if (id && currentIds.includes(id)) {
        // 更新 (排除不需要寫入的計算欄位，例如 startTime, endTime)
        const { startTime, endTime, ...rest } = content;
        const docRef = getTripDocRef(tripId, 'itinerary', id);
        batch.update(docRef, {
          ...rest,
          ...(tripId ? { tripId } : {}),
          updatedAt: serverTimestamp(),
        });
      } else {
        // 新增 (若無 ID 則自動生成)
        const docRef = id ? doc(itineraryRef, id) : doc(itineraryRef);
        batch.set(docRef, {
          ...content,
          ...(tripId ? { tripId } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    });

    // 4. 提交批次操作
    await batch.commit();
    await updateGlobalVersion();
    return { status: 200, deleted: toDelete.length, updated: newItems.length };
  } catch (error) {
    console.error('Bulk update failed:', error);
    throw error;
  }
};

export const bulkUpdateItineraryDay = async (day, newItems) => {
  try {
    await assertCurrentTripWritable();
    const tripId = await resolveTripId();
    if (!tripId) throw new Error('請先選擇旅程');

    const targetDay = Number(day);
    if (!Number.isFinite(targetDay)) throw new Error('Day 格式不正確');

    const batch = writeBatch(db);
    const itineraryRef = getTripCollectionRef(tripId, 'itinerary');
    const { data: currentItems } = await getItinerary();
    const currentDayItems = currentItems.filter(
      (item) => Number(item.day) === targetDay
    );
    const currentIds = currentDayItems.map((item) => item.id);
    const newIds = newItems.filter((item) => item.id).map((item) => item.id);

    const toDelete = currentDayItems.filter(
      (item) => !newIds.includes(item.id)
    );
    toDelete.forEach((item) => {
      batch.delete(getTripDocRef(tripId, 'itinerary', item.id));
    });

    newItems.forEach((item, index) => {
      const { id, ...content } = item;
      delete content.startTime;
      delete content.endTime;
      delete content.updatedAt;
      delete content.tripId;
      const payload = {
        ...content,
        day: targetDay,
        order: Number(content.order) || index + 1,
        tripId,
        updatedAt: serverTimestamp(),
      };

      if (id && currentIds.includes(id)) {
        batch.update(getTripDocRef(tripId, 'itinerary', id), payload);
      } else {
        const docRef = id ? doc(itineraryRef, id) : doc(itineraryRef);
        batch.set(docRef, payload);
      }
    });

    await batch.commit();
    await updateGlobalVersion();
    return { status: 200, deleted: toDelete.length, updated: newItems.length };
  } catch (error) {
    console.error('Day bulk update failed:', error);
    throw error;
  }
};

export const bulkPatchItineraryCoordinates = async (items) => {
  await assertCurrentTripWritable();
  const tripId = await resolveTripId();
  if (!tripId) throw new Error('請先選擇旅程');

  const batch = writeBatch(db);
  items.forEach(({ id, geo }) => {
    if (!id) throw new Error('景點缺少 ID');
    batch.update(getTripDocRef(tripId, 'itinerary', id), {
      'geo.lat': Number(geo.lat),
      'geo.lng': Number(geo.lng),
      tripId,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  await updateGlobalVersion();
  return { status: 200, updated: items.length };
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
      const tripId = await resolveTripId();
      if (tripId) {
        let snap = await getDoc(getTripDayConfigRef(tripId));
        if (!snap.exists()) {
          snap = await getDoc(getLegacyTripDayConfigRef(tripId));
        }
        if (!snap.exists()) {
          snap = await getDoc(getLegacyGlobalDayConfigRef());
        }
        const data = snap.exists()
          ? [{ id: 'dayConfigs', ...snap.data(), tripId }]
          : [];
        resolve({ status: 200, data });
        return;
      }

      resolve({ status: 200, data: [] });
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
      await assertCurrentTripWritable();
      const tripId = await resolveTripId();
      const docRef = tripId
        ? getTripDayConfigRef(tripId)
        : doc(db, 'configs', id);
      await setDoc(
        docRef,
        {
          ...params,
          ...(tripId ? { tripId } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // 自動更新全域版本
      await updateGlobalVersion();
      resolve({ status: 200 });
    } catch (error) {
      reject(error);
    }
  });
};
