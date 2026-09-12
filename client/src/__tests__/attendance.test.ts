import { describe, it, expect } from 'vitest';
import {
  ATTENDANCE_BACKFILL_DAYS,
  deriveEventStatus,
  dhakaEndOfDay,
  getAttendanceWindow,
  getEventEndsAt,
  resolveCheckedInAt,
  UserRole,
} from '@rdswa/shared';

/** Starts 14:00 Dhaka on 2 Sep 2026, no explicit end. */
const EVENT = { startDate: '2026-09-02T08:00:00.000Z' };
/** Last instant of 2 Sep 2026 in Dhaka === 17:59:59.999Z. */
const EVENT_ENDS = '2026-09-02T17:59:59.999Z';

const DURING = new Date('2026-09-02T10:00:00.000Z');
const NEXT_DAY = new Date('2026-09-03T10:00:00.000Z');

describe('Dhaka day boundaries', () => {
  it('ends a day-long event at 23:59:59.999 Dhaka, not process-local midnight', () => {
    expect(dhakaEndOfDay(new Date(EVENT.startDate)).toISOString()).toBe(EVENT_ENDS);
    expect(getEventEndsAt(EVENT)!.toISOString()).toBe(EVENT_ENDS);
  });

  it('prefers an explicit endDate over the derived day end', () => {
    const end = '2026-09-04T06:00:00.000Z';
    expect(getEventEndsAt({ ...EVENT, endDate: end })!.toISOString()).toBe(end);
  });

  it('derives status consistently across the Dhaka midnight boundary', () => {
    // 17:59Z is still 2 Sep in Dhaka; 18:00Z has rolled over to 3 Sep.
    expect(deriveEventStatus({ ...EVENT, now: new Date('2026-09-02T17:59:00.000Z') })).toBe('ongoing');
    expect(deriveEventStatus({ ...EVENT, now: new Date('2026-09-02T18:00:00.000Z') })).toBe('completed');
    expect(deriveEventStatus({ ...EVENT, now: DURING })).toBe('ongoing');
  });

  it('keeps draft and cancelled as admin overrides', () => {
    expect(deriveEventStatus({ ...EVENT, status: 'draft', now: NEXT_DAY })).toBe('draft');
    expect(deriveEventStatus({ ...EVENT, status: 'cancelled', now: NEXT_DAY })).toBe('cancelled');
  });
});

describe('attendance window tiers', () => {
  it('gives self check-in the tightest window regardless of role', () => {
    const w = getAttendanceWindow(EVENT, {
      role: UserRole.SUPER_ADMIN,
      isSelfCheckin: true,
      now: NEXT_DAY,
    });
    expect(w.actor).toBe('self');
    expect(w.windowDays).toBe(ATTENDANCE_BACKFILL_DAYS.self);
  });

  it('separates moderator from admin and super admin', () => {
    const days = (role: string) => getAttendanceWindow(EVENT, { role, now: NEXT_DAY }).windowDays;
    expect(days(UserRole.MODERATOR)).toBe(30);
    expect(days(UserRole.ADMIN)).toBe(365);
    expect(days(UserRole.SUPER_ADMIN)).toBe(365);
  });

  it('closes each window exactly N days after the event ends', () => {
    const w = getAttendanceWindow(EVENT, { role: UserRole.MODERATOR, now: NEXT_DAY });
    expect(w.deadline!.toISOString()).toBe('2026-10-02T17:59:59.999Z');

    const justInside = getAttendanceWindow(EVENT, {
      role: UserRole.MODERATOR,
      now: new Date('2026-10-02T17:59:59.000Z'),
    });
    const justOutside = getAttendanceWindow(EVENT, {
      role: UserRole.MODERATOR,
      now: new Date('2026-10-02T18:00:00.000Z'),
    });
    expect(justInside.isOpen).toBe(true);
    expect(justOutside.isOpen).toBe(false);
  });

  it('only offers the backdate field once the event has ended', () => {
    expect(getAttendanceWindow(EVENT, { now: DURING }).allowsBackdate).toBe(false);
    expect(getAttendanceWindow(EVENT, { now: NEXT_DAY }).allowsBackdate).toBe(true);
  });
});

describe('resolveCheckedInAt', () => {
  const openWindow = (now: Date, role?: string, isSelfCheckin = false) =>
    getAttendanceWindow(EVENT, { role, isSelfCheckin, now });

  it('stamps now while the event is still running, ignoring any supplied date', () => {
    const r = resolveCheckedInAt({
      supplied: '2026-09-01',
      event: EVENT,
      window: openWindow(DURING),
      now: DURING,
    });
    expect(r.ok).toBe(true);
    expect(r.checkedInAt).toEqual(DURING);
  });

  it('defaults to now when no date is supplied after the event', () => {
    const r = resolveCheckedInAt({ event: EVENT, window: openWindow(NEXT_DAY), now: NEXT_DAY });
    expect(r.ok).toBe(true);
    expect(r.checkedInAt).toEqual(NEXT_DAY);
  });

  it("accepts the event's own date even when the event started later that day", () => {
    // Event began 08:00Z and Dhaka-noon is 06:00Z, which an instant comparison would wrongly reject.
    const r = resolveCheckedInAt({
      supplied: '2026-09-02',
      event: EVENT,
      window: openWindow(NEXT_DAY),
      now: NEXT_DAY,
    });
    expect(r.ok).toBe(true);
    expect(r.checkedInAt.toISOString()).toBe('2026-09-02T06:00:00.000Z');
  });

  it('rejects a date before the event started', () => {
    const r = resolveCheckedInAt({
      supplied: '2026-09-01',
      event: EVENT,
      window: openWindow(NEXT_DAY),
      now: NEXT_DAY,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/before the event started/i);
  });

  it('rejects a future date', () => {
    const r = resolveCheckedInAt({
      supplied: '2026-09-04',
      event: EVENT,
      window: openWindow(NEXT_DAY),
      now: NEXT_DAY,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/future/i);
  });

  it("clamps today's date back to now rather than stamping hours ahead", () => {
    // 04:00Z on 3 Sep is 10:00 Dhaka, noon Dhaka would be two hours ahead.
    const morning = new Date('2026-09-03T04:00:00.000Z');
    const r = resolveCheckedInAt({
      supplied: '2026-09-03',
      event: EVENT,
      window: openWindow(morning),
      now: morning,
    });
    expect(r.ok).toBe(true);
    expect(r.checkedInAt).toEqual(morning);
  });

  it('refuses any entry once the window has closed', () => {
    const late = new Date('2026-09-20T10:00:00.000Z'); // 18 days out
    const r = resolveCheckedInAt({
      event: EVENT,
      window: openWindow(late, undefined, true), // self → 7 days
      now: late,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/closed 7 days/i);
  });

  it('still allows a moderator after the 7-day self window has closed', () => {
    const late = new Date('2026-09-20T10:00:00.000Z');
    const r = resolveCheckedInAt({
      event: EVENT,
      window: openWindow(late, UserRole.MODERATOR),
      now: late,
    });
    expect(r.ok).toBe(true);
  });

  it('rejects an unparseable date', () => {
    const r = resolveCheckedInAt({
      supplied: 'not-a-date',
      event: EVENT,
      window: openWindow(NEXT_DAY),
      now: NEXT_DAY,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid/i);
  });
});
