import { UserRole } from '../constants/roles';
import { dhakaDayKey, dhakaNoon, getEventEndsAt, isDayKey, toDateOrNull } from './eventStatus';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days after an event ends that attendance may still be entered, per actor. */
export const ATTENDANCE_BACKFILL_DAYS = {
  self: 7,
  moderator: 30,
  admin: 365,
} as const;

export type AttendanceActor = keyof typeof ATTENDANCE_BACKFILL_DAYS;

/** Self check-in always uses the tightest tier, whatever the actor's role. */
export function resolveAttendanceActor(
  role: string | null | undefined,
  isSelfCheckin: boolean
): AttendanceActor {
  if (isSelfCheckin) return 'self';
  if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) return 'admin';
  return 'moderator';
}

export interface AttendanceWindow {
  actor: AttendanceActor;
  /** Days past the event end that this actor may still enter attendance. */
  windowDays: number;
  /** When the event is over, or null if startDate is unusable. */
  endsAt: Date | null;
  /** Last instant attendance may be entered, or null if startDate is unusable. */
  deadline: Date | null;
  /** The event has finished, which is what unlocks the optional date field. */
  hasEnded: boolean;
  /** Attendance may be entered right now. */
  isOpen: boolean;
  /** The UI should offer the optional backdate field. */
  allowsBackdate: boolean;
}

export function getAttendanceWindow(
  event: { startDate: string | Date; endDate?: string | Date | null },
  options: { role?: string | null; isSelfCheckin?: boolean; now?: Date } = {}
): AttendanceWindow {
  const { role, isSelfCheckin = false, now = new Date() } = options;

  const actor = resolveAttendanceActor(role, isSelfCheckin);
  const windowDays = ATTENDANCE_BACKFILL_DAYS[actor];
  const endsAt = getEventEndsAt(event);

  // An unparseable startDate shouldn't block check-in at the venue.
  if (!endsAt) {
    return {
      actor,
      windowDays,
      endsAt: null,
      deadline: null,
      hasEnded: false,
      isOpen: true,
      allowsBackdate: false,
    };
  }

  const deadline = new Date(endsAt.getTime() + windowDays * DAY_MS);
  const hasEnded = now.getTime() > endsAt.getTime();

  return {
    actor,
    windowDays,
    endsAt,
    deadline,
    hasEnded,
    isOpen: now.getTime() <= deadline.getTime(),
    allowsBackdate: hasEnded,
  };
}

/** Shared wording so the API error and the UI hint never drift apart. */
export function attendanceWindowClosedMessage(window: AttendanceWindow): string {
  const who = window.actor === 'self' ? 'Self check-in' : 'Attendance entry';
  return `${who} closed ${window.windowDays} days after this event ended.`;
}

export interface ResolvedCheckedInAt {
  ok: boolean;
  error?: string;
  /** The value to persist, meaningless when `ok` is false. */
  checkedInAt: Date;
}

/** Decide the `checkedInAt` to store, comparing bounds by Dhaka calendar day so an event starting at 14:00 still accepts its own date. */
export function resolveCheckedInAt(input: {
  supplied?: string | Date | null;
  event: { startDate: string | Date; endDate?: string | Date | null };
  window: AttendanceWindow;
  now?: Date;
}): ResolvedCheckedInAt {
  const { supplied, event, window, now = new Date() } = input;

  if (!window.isOpen) {
    return { ok: false, error: attendanceWindowClosedMessage(window), checkedInAt: now };
  }

  if (supplied === null || supplied === undefined || supplied === '') {
    return { ok: true, checkedInAt: now };
  }

  // While the event runs the date field isn't offered, so stamp the real time.
  if (!window.allowsBackdate) {
    return { ok: true, checkedInAt: now };
  }

  const isBareDay = typeof supplied === 'string' && isDayKey(supplied);
  const parsed = isBareDay ? dhakaNoon(supplied) : toDateOrNull(supplied);
  if (!parsed) {
    return { ok: false, error: 'Invalid attendance date', checkedInAt: now };
  }

  const day = dhakaDayKey(parsed);

  if (day > dhakaDayKey(now)) {
    return { ok: false, error: 'Attendance date cannot be in the future', checkedInAt: now };
  }

  const start = toDateOrNull(event.startDate);
  if (start && day < dhakaDayKey(start)) {
    return {
      ok: false,
      error: 'Attendance date cannot be before the event started',
      checkedInAt: now,
    };
  }

  // Noon today is still ahead of a morning entry, so never stamp the future.
  return {
    ok: true,
    checkedInAt: parsed.getTime() > now.getTime() ? now : parsed,
  };
}
