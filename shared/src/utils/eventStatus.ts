import type { EventStatus } from '../types/event.types';

export interface DeriveEventStatusInput {
  startDate: string | Date;
  endDate?: string | Date | null;
  status?: EventStatus | string | null;
  now?: Date;
}

/**
 * Event lifecycle status is derived from dates, not stored.
 *
 * `draft` and `cancelled` are admin-controlled and bypass derivation.
 * Everything else is computed purely from now vs. startDate / endDate:
 *   now < startDate                 -> 'upcoming'
 *   startDate <= now <= endDate     -> 'ongoing'
 *   now > endDate                   -> 'completed'
 *
 * When `endDate` is missing, the event is treated as lasting until the end of
 * `startDate`'s day (local to whatever the Date parses into — Mongo stores UTC,
 * so this is a reasonable default for day-long events).
 */
export function deriveEventStatus(input: DeriveEventStatusInput): EventStatus {
  const { startDate, endDate, status, now = new Date() } = input;

  if (status === 'draft' || status === 'cancelled') {
    return status;
  }

  const start = startDate instanceof Date ? startDate : new Date(startDate);
  if (isNaN(start.getTime())) {
    return (status as EventStatus) || 'upcoming';
  }

  let end: Date;
  if (endDate) {
    end = endDate instanceof Date ? endDate : new Date(endDate);
    if (isNaN(end.getTime())) {
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    }
  } else {
    end = new Date(start);
    end.setHours(23, 59, 59, 999);
  }

  const nowMs = now.getTime();
  if (nowMs < start.getTime()) return 'upcoming';
  if (nowMs <= end.getTime()) return 'ongoing';
  return 'completed';
}
