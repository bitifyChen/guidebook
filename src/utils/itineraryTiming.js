export const clockTimeToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const formatClockMinutes = (value) => {
  if (!Number.isFinite(value)) return '--:--';
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(
    normalized % 60
  ).padStart(2, '0')}`;
};

export const nearestClockMinuteDelta = (target, reference) => {
  let delta = target - reference;
  if (delta > 720) delta -= 1440;
  if (delta < -720) delta += 1440;
  return Math.round(delta);
};

export const alignClockMinutesToReference = (value, reference) => {
  const minutes = clockTimeToMinutes(value);
  if (!Number.isFinite(minutes) || !Number.isFinite(reference)) return null;
  return reference + nearestClockMinuteDelta(minutes, reference);
};

export const calculateStayMinutes = (startTime, endTime) => {
  const startMinutes = clockTimeToMinutes(startTime);
  const endMinutes = clockTimeToMinutes(endTime);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return null;
  }

  let duration = endMinutes - startMinutes;
  if (duration < -720) duration += 1440;
  if (duration < 0) return null;
  return duration;
};

export const calculateTimingAdjustment = ({
  item,
  mode,
  actualTime,
  arrivalPolicy = '',
}) => {
  const scheduledStartMinutes = clockTimeToMinutes(
    item?.scheduledStartTime || item?.startTime
  );
  const scheduledEndMinutes = alignClockMinutesToReference(
    item?.scheduledEndTime || item?.endTime,
    scheduledStartMinutes
  );
  const actualMinutes = alignClockMinutesToReference(
    actualTime,
    mode === 'departed' ? scheduledEndMinutes : scheduledStartMinutes
  );
  const previousDelay = Number(item?.delay) || 0;
  const departureMinutes = alignClockMinutesToReference(
    item?.actualTiming?.departureTime,
    scheduledEndMinutes
  );
  if (
    !Number.isFinite(actualMinutes) ||
    !Number.isFinite(scheduledStartMinutes) ||
    !Number.isFinite(scheduledEndMinutes)
  ) {
    const nextStartTime = item?.startTime || '--:--';
    const nextEndTime = item?.endTime || '--:--';
    return {
      previousDelay,
      nextDelay: previousDelay,
      change: 0,
      nextEndTime,
      nextStartTime,
      stayMinutes: calculateStayMinutes(nextStartTime, nextEndTime),
      canKeepDeparture: false,
      departureAuthoritative: Boolean(item?.actualTiming?.departureTime),
    };
  }

  const canKeepDeparture = actualMinutes <= scheduledEndMinutes;
  let nextDelay = previousDelay;
  let nextEndMinutes = Number.isFinite(departureMinutes)
    ? departureMinutes
    : scheduledEndMinutes + previousDelay;

  if (mode === 'arrived' && !Number.isFinite(departureMinutes)) {
    if (arrivalPolicy === 'keepDuration') {
      nextDelay = actualMinutes - scheduledStartMinutes;
      nextEndMinutes = scheduledEndMinutes + nextDelay;
    } else if (arrivalPolicy === 'keepDeparture' && canKeepDeparture) {
      nextDelay = 0;
      nextEndMinutes = scheduledEndMinutes;
    }
  } else if (mode === 'departed') {
    nextDelay = actualMinutes - scheduledEndMinutes;
    nextEndMinutes = actualMinutes;
  }

  const nextStartTime =
    mode === 'arrived'
      ? formatClockMinutes(actualMinutes)
      : item?.startTime || formatClockMinutes(scheduledStartMinutes);
  const nextEndTime = formatClockMinutes(nextEndMinutes);

  return {
    previousDelay,
    nextDelay,
    change: nextDelay - previousDelay,
    nextStartTime,
    nextEndTime,
    stayMinutes: calculateStayMinutes(nextStartTime, nextEndTime),
    canKeepDeparture,
    departureAuthoritative: Number.isFinite(departureMinutes),
  };
};

export const canParticipantManageTripTiming = ({
  trip,
  participant,
  isPublicTrip = false,
  hasGlobalAdminAccess = false,
}) => {
  if (isPublicTrip || trip?.status !== 'active') return false;
  if (hasGlobalAdminAccess) return true;
  return Boolean(
    participant?.id &&
    (participant.tripIds || []).includes(trip.id) &&
    (trip.managerParticipantIds || []).includes(participant.id)
  );
};
