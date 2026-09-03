import type { EventStatus } from '../types/event.types';

export interface DeriveEventStatusInput {
  startDate: string | Date;
  endDate?: string | Date | null;
  status?: EventStatus | string | null;
  now?: Date;
}

/** Asia/Dhaka is UTC+6 year-round, so a fixed offset is exact and keeps `shared/` dependency-free. */
export const DHAKA_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse to a Date, or null when the input is missing or unparseable. */
export function toDateOrNull(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Midnight opening `d`'s calendar day in Asia/Dhaka, as a real instant. */
export function dhakaStartOfDay(d: Date): Date {
  // Shift into Dhaka wall-clock so the UTC getters read as local fields.
  const shifted = new Date(d.getTime() + DHAKA_UTC_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
      DHAKA_UTC_OFFSET_MS
  );
}

/**
 * Last millisecond of `d`'s calendar day in Asia/Dhaka.
 *
 * Deliberately not `setHours(23,59,59,999)`, which uses the process timezone
 * and made the UTC server and the Dhaka browser disagree by six hours.
 */
export function dhakaEndOfDay(d: Date): Date {
  return new Date(dhakaStartOfDay(d).getTime() + DAY_MS - 1);
}

/** `d`'s calendar day in Asia/Dhaka as `YYYY-MM-DD`, the `<input type="date">` shape. */
export function dhakaDayKey(d: Date): string {
  const shifted = new Date(d.getTime() + DHAKA_UTC_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

/** True when `value` is a bare `YYYY-MM-DD` calendar date rather than an instant. */
export function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Midday in Asia/Dhaka on the given `YYYY-MM-DD`, so the value renders as that day under any formatter. */
export function dhakaNoon(dayKey: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return null;
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) - DHAKA_UTC_OFFSET_MS
  );
}

/** When an event is over: `endDate` if usable, else the end of its start day in Dhaka, else null. */
export function getEventEndsAt(input: {
  startDate: string | Date;
  endDate?: string | Date | null;
}): Date | null {
  const start = toDateOrNull(input.startDate);
  if (!start) return null;
  return toDateOrNull(input.endDate) ?? dhakaEndOfDay(start);
}

/** Derive lifecycle status from dates, honouring `draft` and `cancelled` as admin overrides. */
export function deriveEventStatus(input: DeriveEventStatusInput): EventStatus {
  const { startDate, endDate, status, now = new Date() } = input;

  if (status === 'draft' || status === 'cancelled') {
    return status;
  }

  const start = toDateOrNull(startDate);
  if (!start) {
    return (status as EventStatus) || 'upcoming';
  }

  const end = getEventEndsAt({ startDate: start, endDate })!;

  const nowMs = now.getTime();
  if (nowMs < start.getTime()) return 'upcoming';
  if (nowMs <= end.getTime()) return 'ongoing';
  return 'completed';
}
