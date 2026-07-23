import { getMessaging, isSupported, onMessage } from 'firebase/messaging';
import app from '@/firebase/index.js';

const SYNC_TYPE = 'itineraryUpdated';
const PENDING_CACHE_NAME = 'guidebook-sync-signals';
const PENDING_REQUEST_URL = '/__guidebook_pending_itinerary_sync__';
let refreshTimer = null;

const readSignal = (payload) => payload?.data || payload || {};

const isItinerarySignal = (payload) => readSignal(payload).type === SYNC_TYPE;

const matchesCurrentTrip = (payload, tripStore) => {
  const tripId = readSignal(payload).tripId || '';
  return Boolean(tripId && tripId === tripStore.currentTripId);
};

const clearPendingSignal = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const cache = await caches.open(PENDING_CACHE_NAME);
  await cache.delete(PENDING_REQUEST_URL);
};

export const scheduleItinerarySyncRefresh = (payload, { travelStore, tripStore }) => {
  if (!isItinerarySignal(payload) || !matchesCurrentTrip(payload, tripStore)) return;

  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(async () => {
    await clearPendingSignal();
    await travelStore.init({ force: true });
  }, 900);
};

export const consumePendingItinerarySyncSignal = async ({ travelStore, tripStore }) => {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  const cache = await caches.open(PENDING_CACHE_NAME);
  const response = await cache.match(PENDING_REQUEST_URL);
  if (!response) return;
  const payload = await response.json().catch(() => null);
  scheduleItinerarySyncRefresh(payload, { travelStore, tripStore });
};

export const setupItinerarySyncSignals = async ({ travelStore, tripStore }) => {
  if (typeof window === 'undefined') return () => {};

  const handleServiceWorkerMessage = (event) => {
    scheduleItinerarySyncRefresh(event.data, { travelStore, tripStore });
  };
  navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

  let unsubscribeMessage = () => {};
  const supported = await isSupported().catch(() => false);
  if (supported) {
    try {
      unsubscribeMessage = onMessage(getMessaging(app), (payload) => {
        scheduleItinerarySyncRefresh(payload, { travelStore, tripStore });
      });
    } catch (error) {
      console.warn('Unable to listen for itinerary sync signals', error);
    }
  }

  await consumePendingItinerarySyncSignal({ travelStore, tripStore });

  return () => {
    navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    unsubscribeMessage();
  };
};
