import { describe, expect, it } from 'vitest';
import {
  calculateStayMinutes,
  calculateTimingAdjustment,
} from '@/utils/itineraryTiming';

const item = {
  scheduledStartTime: '10:00',
  scheduledEndTime: '11:00',
  startTime: '10:00',
  endTime: '11:00',
  delay: 0,
};

describe('itinerary timing', () => {
  it('recalculates departure when keeping the original duration', () => {
    expect(
      calculateTimingAdjustment({
        item,
        mode: 'arrived',
        actualTime: '10:30',
        arrivalPolicy: 'keepDuration',
      })
    ).toMatchObject({
      nextStartTime: '10:30',
      nextEndTime: '11:30',
      stayMinutes: 60,
    });
  });

  it('shortens the stay when keeping the original departure', () => {
    expect(
      calculateTimingAdjustment({
        item,
        mode: 'arrived',
        actualTime: '10:30',
        arrivalPolicy: 'keepDeparture',
      })
    ).toMatchObject({
      nextStartTime: '10:30',
      nextEndTime: '11:00',
      stayMinutes: 30,
    });
  });

  it('uses the actual departure and rejects a departure before arrival', () => {
    expect(
      calculateTimingAdjustment({
        item,
        mode: 'departed',
        actualTime: '11:20',
      })
    ).toMatchObject({ nextEndTime: '11:20', stayMinutes: 80 });
    expect(
      calculateTimingAdjustment({
        item,
        mode: 'departed',
        actualTime: '09:50',
      }).stayMinutes
    ).toBeNull();
  });

  it('supports a stay that crosses midnight', () => {
    expect(calculateStayMinutes('23:30', '01:00')).toBe(90);
  });
});
