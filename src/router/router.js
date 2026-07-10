import { createRouter, createWebHistory } from 'vue-router';
import generatedRoutes from 'virtual:generated-pages';

const routes = generatedRoutes;
const router = createRouter({
  history: createWebHistory('/guidebook/'),
  routes,
});

import { useUserStore } from '@/store/userStore';
import { useParticipantsStore } from '@/store/participantsStore';
import { useTripStore } from '@/store/tripStore';
import { useTravelStore } from '@/store/travelStore';
import { useExpensesStore } from '@/store/expensesStore';
import { getParticipantsByUid } from '@/api/participants';
import { getTripById } from '@/api/trips';

const SETTINGS_PATH = '/settings';

const isSettingsRoute = (path) => path.toLowerCase() === SETTINGS_PATH;

const clearTripDataStores = () => {
  useParticipantsStore().clear();
  useTravelStore().clear();
  useExpensesStore().clear();
};

const resolveSingleUserTrip = async (userStore, tripStore) => {
  if (!userStore.user?.uid || tripStore.currentTripId) return null;

  const memberships = await getParticipantsByUid(userStore.user.uid);
  const rows = [];
  const seenTripIds = new Set();

  for (const membership of memberships) {
    const tripIds = membership.tripIds || (membership.tripId ? [membership.tripId] : []);
    for (const tripId of tripIds) {
      if (!tripId || seenTripIds.has(tripId)) continue;
      const trip = await getTripById(tripId);
      if (!trip) continue;
      rows.push({ trip, participant: membership });
      seenTripIds.add(tripId);
    }
  }

  if (rows.length === 1) {
    await tripStore.switchTrip(rows[0].trip.id);
    userStore.setLocalParticipant(rows[0].participant.id);
    return rows[0].trip;
  }

  return null;
};

const resolveGoogleAdminAccess = async (userStore) => {
  if (!userStore.user?.uid) return { isAdmin: false, isSuperAdmin: false };
  await userStore.refreshGoogleAdminAccess();
  return {
    isAdmin: userStore.isAdmin,
    isSuperAdmin: userStore.isSuperAdmin,
  };
};

router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore();
  const participantsStore = useParticipantsStore();
  const tripStore = useTripStore();

  if (!userStore.isAuthReady) {
    await userStore.initAuth();
  }

  if (!tripStore.currentTripId) {
    await tripStore.init();
  }

  await resolveSingleUserTrip(userStore, tripStore);

  const isAdminRoute = to.path.startsWith('/admin');
  const isAdminLoginRoute = to.path === '/admin/login';
  const isGateRoute = isSettingsRoute(to.path) || isAdminLoginRoute;

  if (isAdminRoute) {
    if (isAdminLoginRoute) {
      return next();
    }

    if (!userStore.user) {
      return next({ path: '/admin/login', query: { redirect: to.fullPath } });
    }

    if (tripStore.currentTripId && participantsStore.participants.length === 0) {
      await participantsStore.init();
    }

    const adminAccess = await resolveGoogleAdminAccess(userStore);
    if (adminAccess.isAdmin) {
      return next();
    } else {
      return next({ path: SETTINGS_PATH });
    }
  }

  if (!tripStore.currentTripId && !isGateRoute) {
    clearTripDataStores();
    return next({ path: SETTINGS_PATH });
  }

  if (tripStore.currentTripId && participantsStore.participants.length === 0) {
    await participantsStore.init();
  }

  next();
});

export default router;
