import { rtdb } from '@/firebase/index.js';
import { onValue, ref } from 'firebase/database';

export const subscribeTripLocations = (tripId, callback) => {
  if (!tripId) {
    callback([]);
    return () => {};
  }

  const locationRef = ref(rtdb, `tripLocations/${tripId}`);
  const unsubscribe = onValue(locationRef, (snapshot) => {
    const value = snapshot.val() || {};
    const rows = Object.entries(value).map(([participantId, data]) => ({
      participantId,
      ...data,
    }));
    callback(rows);
  });

  return unsubscribe;
};
