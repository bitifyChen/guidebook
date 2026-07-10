import { defineStore } from 'pinia';
import {
  archiveTrip,
  completeTrip,
  createTrip,
  DEFAULT_TRIP_CONTEXT,
  getCurrentTripId,
  getTripByInviteCode,
  getTripById,
  getTrips,
  patchTrip,
  setActiveTrip,
  setCurrentTripId,
} from '@/api/trips';
import {
  getParticipantByInviteCode,
  patchParticipant,
} from '@/api/participants';

export const useTripStore = defineStore('trip', {
  state: () => ({
    trips: [],
    currentTrip: null,
    currentTripId: getCurrentTripId(),
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
      return trip;
    },

    clearCurrentTrip() {
      this.currentTrip = null;
      this.currentTripId = '';
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
      const trip = await getTripByInviteCode(inviteCode);
      if (trip) {
        if (trip.status === 'archived') throw new Error('這個旅程已封存。');

        await this.switchTrip(trip.id);

        return {
          status: 200,
          mode: 'guest',
          trip,
          participant: null,
        };
      }

      const participant = await getParticipantByInviteCode(inviteCode);
      const participantTripIds =
        participant?.tripIds || (participant?.tripId ? [participant.tripId] : []);
      if (!participantTripIds.length) throw new Error('找不到這個 6 碼邀請碼。');

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
