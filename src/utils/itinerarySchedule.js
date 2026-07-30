import { alignClockMinutesToReference } from './itineraryTiming.js';

const MINUTES_PER_DAY = 24 * 60;

export const timeToMinutes = (value) => {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const formatScheduleMinutes = (value) => {
  if (!Number.isFinite(value)) return '--:--';
  const normalized =
    ((Math.round(value) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const calculateDayItinerary = (items, dayStart = '09:00') => {
  const sortedItems = [...(Array.isArray(items) ? items : [])].sort(
    (first, second) => (Number(first.order) || 0) - (Number(second.order) || 0)
  );
  let rollingMinutes = timeToMinutes(dayStart) ?? 9 * 60;
  const scheduledById = new Map();
  const topLevelItems = sortedItems.filter((item) => !item.parentId);

  topLevelItems.forEach((item) => {
    const fixedMinutes = timeToMinutes(item.fixedStartTime);
    const waitMinutes = Number.isFinite(fixedMinutes)
      ? Math.max(fixedMinutes - rollingMinutes, 0)
      : 0;
    const fixedTimeLateMinutes = Number.isFinite(fixedMinutes)
      ? Math.max(rollingMinutes - fixedMinutes, 0)
      : 0;
    const startMinutes = waitMinutes ? fixedMinutes : rollingMinutes;
    const duration = Number(item.duration) || 0;
    const delay = Number(item.delay) || 0;
    const children = sortedItems.filter(
      (candidate) => candidate.parentId === item.id
    );
    let scheduledGroupEndMinutes = startMinutes + duration;

    const childSchedules = children.map((child) => {
      const childFixedMinutes = timeToMinutes(child.fixedStartTime);
      const childDuration = Math.max(Number(child.duration) || 0, 0);
      const childLateMinutes = Number.isFinite(childFixedMinutes)
        ? Math.max(startMinutes - childFixedMinutes, 0)
        : 0;
      const childStartMinutes = Number.isFinite(childFixedMinutes)
        ? Math.max(startMinutes, childFixedMinutes)
        : startMinutes;
      const childEndMinutes = childStartMinutes + childDuration;
      scheduledGroupEndMinutes = Math.max(
        scheduledGroupEndMinutes,
        childEndMinutes
      );
      return {
        child,
        childStartMinutes,
        childEndMinutes,
        childDuration,
        childLateMinutes,
      };
    });

    const arrivalMinutes = alignClockMinutesToReference(
      item.actualTiming?.arrivalTime,
      startMinutes
    );
    const departureMinutes = alignClockMinutesToReference(
      item.actualTiming?.departureTime,
      scheduledGroupEndMinutes
    );
    const effectiveStartMinutes = Number.isFinite(arrivalMinutes)
      ? arrivalMinutes
      : startMinutes;
    let effectiveGroupEndMinutes;
    if (Number.isFinite(departureMinutes)) {
      effectiveGroupEndMinutes = departureMinutes;
    } else if (
      Number.isFinite(arrivalMinutes) &&
      item.actualTiming?.arrivalPolicy === 'keepDuration'
    ) {
      effectiveGroupEndMinutes =
        scheduledGroupEndMinutes + (arrivalMinutes - startMinutes);
    } else if (
      Number.isFinite(arrivalMinutes) &&
      item.actualTiming?.arrivalPolicy === 'keepDeparture'
    ) {
      effectiveGroupEndMinutes = scheduledGroupEndMinutes;
    } else {
      effectiveGroupEndMinutes = scheduledGroupEndMinutes + delay;
    }

    scheduledById.set(item.id, {
      ...item,
      scheduledStartTime: formatScheduleMinutes(startMinutes),
      scheduledEndTime: formatScheduleMinutes(scheduledGroupEndMinutes),
      startTime: formatScheduleMinutes(effectiveStartMinutes),
      endTime: formatScheduleMinutes(effectiveGroupEndMinutes),
      waitMinutes,
      fixedTimeLateMinutes,
    });

    childSchedules.forEach(
      ({ child, childStartMinutes, childEndMinutes, childDuration }) => {
        const childFixedMinutes = timeToMinutes(child.fixedStartTime);
        let effectiveChildStartMinutes = Number.isFinite(childFixedMinutes)
          ? Math.max(effectiveStartMinutes, childFixedMinutes)
          : effectiveStartMinutes;
        let effectiveChildEndMinutes =
          effectiveChildStartMinutes + childDuration;
        if (Number.isFinite(departureMinutes)) {
          effectiveChildStartMinutes = Math.min(
            effectiveChildStartMinutes,
            departureMinutes
          );
          effectiveChildEndMinutes = Math.min(
            Math.max(effectiveChildEndMinutes, effectiveChildStartMinutes),
            departureMinutes
          );
        }
        const childLateMinutes = Number.isFinite(childFixedMinutes)
          ? Math.max(effectiveStartMinutes - childFixedMinutes, 0)
          : 0;
        if (!Number.isFinite(departureMinutes)) {
          effectiveGroupEndMinutes = Math.max(
            effectiveGroupEndMinutes,
            effectiveChildEndMinutes
          );
        }
        scheduledById.set(child.id, {
          ...child,
          scheduledStartTime: formatScheduleMinutes(childStartMinutes),
          scheduledEndTime: formatScheduleMinutes(childEndMinutes),
          startTime: formatScheduleMinutes(effectiveChildStartMinutes),
          endTime: formatScheduleMinutes(effectiveChildEndMinutes),
          waitMinutes: 0,
          fixedTimeLateMinutes: childLateMinutes,
        });
      }
    );

    const scheduledParent = scheduledById.get(item.id);
    scheduledParent.endTime = formatScheduleMinutes(effectiveGroupEndMinutes);

    rollingMinutes =
      effectiveGroupEndMinutes + (Number(item.nextDrive?.time) || 0);
  });

  return sortedItems.map((item) => scheduledById.get(item.id) || item);
};
