import { defineStore } from 'pinia';
import {
  archiveTrip,
  completeTrip,
  createTrip,
  DEFAULT_TRIP_CONTEXT,
  getCurrentTripId,
  getTripByInviteCode,
  getTripById,
  getTripByPublicCode,
  getTrips,
  patchTrip,
  setActiveTrip,
  setCurrentTripId,
} from '@/api/trips';
import {
  getParticipantByGuestId,
  getParticipantByInviteCode,
  getOrCreateTripInviteParticipant,
  patchParticipant,
} from '@/api/participants';

const GUEST_ID_KEY = 'guidebook_guest_id';
const ACCESS_MODE_KEY = 'guidebook_access_mode';
export const ACCESS_MODES = {
  MEMBER: 'member',
  PUBLIC_TRIP: 'publicTrip',
};

const getLocalGuestId = () => {
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }
  return guestId;
};

export const useTripStore = defineStore('trip', {
  state: () => ({
    trips: [],
    currentTrip: null,
    currentTripId: getCurrentTripId(),
    accessMode: localStorage.getItem(ACCESS_MODE_KEY) || ACCESS_MODES.MEMBER,
    isLoading: false,
  }),

  getters: {
    isArchived: (state) => state.currentTrip?.status === 'archived',
    isCompleted: (state) => state.currentTrip?.status === 'completed',
    isTimeLocked: (state) =>
      ['completed', 'archived'].includes(state.currentTrip?.status),
    inviteCode: (state) => state.currentTrip?.inviteCode || '',
    context: (state) => ({
      ...DEFAULT_TRIP_CONTEXT,
      ...(state.currentTrip || {}),
    }),
    currencySymbol: (state) =>
      state.currentTrip?.currencySymbol || DEFAULT_TRIP_CONTEXT.currencySymbol,
    currencyCode: (state) =>
      state.currentTrip?.currencyCode || DEFAULT_TRIP_CONTEXT.currencyCode,
    isPublicTrip: (state) => state.accessMode === ACCESS_MODES.PUBLIC_TRIP,
  },

  actions: {
    async init() {
      if (this.isLoading) return;
      this.isLoading = true;
      try {
        const trip = this.currentTripId
          ? await getTripById(this.currentTripId)
          : null;

        this.currentTrip = trip;
        this.currentTripId = trip?.id || '';
        setCurrentTripId(this.currentTripId);
      } finally {
        this.isLoading = false;
      }
    },

    async refreshTrips() {
      const res = await getTrips();
      this.trips = res.data;
      return res;
    },

    async createTrip(params) {
      const res = await createTrip(params);
      await this.switchTrip(res.id);
      await this.refreshTrips();
      return res;
    },

    async updateTrip(tripId, params) {
      const res = await patchTrip(tripId, params);
      if (tripId === this.currentTripId) {
        this.currentTrip = await getTripById(tripId);
      }
      await this.refreshTrips();
      return res;
    },

    async switchTrip(tripId) {
      const trip = await getTripById(tripId);
      this.currentTrip = trip;
      this.currentTripId = trip?.id || '';
      setCurrentTripId(this.currentTripId);
      this.setAccessMode(ACCESS_MODES.MEMBER);
      return trip;
    },

    async switchPublicTrip(tripId) {
      const trip = await getTripById(tripId);
      this.currentTrip = trip;
      this.currentTripId = trip?.id || '';
      setCurrentTripId(this.currentTripId);
      this.setAccessMode(ACCESS_MODES.PUBLIC_TRIP);
      return trip;
    },

    setAccessMode(mode = ACCESS_MODES.MEMBER) {
      this.accessMode = mode;
      localStorage.setItem(ACCESS_MODE_KEY, mode);
    },

    clearCurrentTrip() {
      this.currentTrip = null;
      this.currentTripId = '';
      this.setAccessMode(ACCESS_MODES.MEMBER);
      setCurrentTripId('');
    },

    async makeActive(tripId) {
      const res = await setActiveTrip(tripId);
      await this.switchTrip(tripId);
      await this.refreshTrips();
      return res;
    },

    async archive(tripId) {
      const res = await archiveTrip(tripId);
      if (tripId === this.currentTripId) {
        this.currentTrip = await getTripById(tripId);
      }
      await this.refreshTrips();
      return res;
    },

    async complete(tripId) {
      const res = await completeTrip(tripId);
      if (tripId === this.currentTripId) {
        this.currentTrip = await getTripById(tripId);
      }
      await this.refreshTrips();
      return res;
    },

    async joinByInviteCode(inviteCode, profile = {}) {
      const publicTrip = await getTripByPublicCode(inviteCode);
      if (publicTrip) {
        if (publicTrip.status === 'archived') throw new Error('這個旅程已封存。');
        const trip = await this.switchPublicTrip(publicTrip.id);
        return {
          status: 200,
          mode: ACCESS_MODES.PUBLIC_TRIP,
          trip,
          participant: null,
        };
      }

      const trip = await getTripByInviteCode(inviteCode);
      if (trip) {
        if (trip.status === 'archived') throw new Error('這個旅程已封存。');
        const guestId = profile.uid ? '' : getLocalGuestId();
        const existingGuest = !profile.uid && guestId
          ? await getParticipantByGuestId(guestId)
          : null;
        const guestName = profile.name?.trim() || existingGuest?.name || '';
        if (!profile.uid && !guestName) {
          return {
            status: 301,
            mode: 'guestNameRequired',
            trip,
          };
        }

        const participant = await getOrCreateTripInviteParticipant(trip.id, {
          ...profile,
          guestId,
          name: guestName || profile.email || '訪客',
        });
        const participantTrip = await this.switchTrip(trip.id);

        return {
          status: 200,
          mode: profile.uid ? 'participant' : 'guestParticipant',
          trip: participantTrip,
          participant: {
            id: participant.id,
            tripId: trip.id,
          },
          isNewParticipant: Boolean(participant.isNewParticipant),
        };
      }

      const participant = await getParticipantByInviteCode(inviteCode);
      const participantTripIds =
        participant?.tripIds || (participant?.tripId ? [participant.tripId] : []);
      if (!participantTripIds.length) throw new Error('找不到這個 6 碼邀請碼。');

      const currentParticipantId = localStorage.getItem(
        `claimedParticipantId_${this.currentTripId}`
      ) || localStorage.getItem('claimedParticipantId');
      if (
        (profile.uid || currentParticipantId) &&
        currentParticipantId !== participant.id
      ) {
        throw new Error('目前已有登入身份，若要使用其他個人代碼，請先登出。');
      }

      if (
        participant.isClaimed &&
        participant.uid &&
        profile.uid &&
        participant.uid !== profile.uid
      ) {
        throw new Error('這個旅客邀請碼已經被使用。');
      }

      const targetTripId =
        this.currentTripId && participantTripIds.includes(this.currentTripId)
          ? this.currentTripId
          : participantTripIds.length === 1
            ? participantTripIds[0]
            : '';
      if (!targetTripId) {
        const trips = (
          await Promise.all(participantTripIds.map((tripId) => getTripById(tripId)))
        ).filter((item) => item && item.status !== 'archived');

        return {
          status: 300,
          mode: 'participantTripSelection',
          participant,
          trips,
        };
      }

      const participantTrip = await this.switchTrip(targetTripId);
      if (participantTrip?.status === 'archived') {
        throw new Error('這個旅程已封存。');
      }

      await patchParticipant(participant.id, {
        isClaimed: true,
        uid: profile.uid || participant.uid || null,
        name: participant.name || profile.name || profile.email || '旅伴',
        avatar: participant.avatar || profile.avatar || '',
      });

      return {
        status: 200,
        mode: 'participant',
        trip: participantTrip,
        participant: {
          id: participant.id,
          tripId: targetTripId,
        },
      };
    },

  },
});
