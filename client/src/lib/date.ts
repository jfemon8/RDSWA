const TZ = 'Asia/Dhaka';

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ,
};

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: TZ,
};

/** Format date — e.g. "02 April 2026" (dd MMMM yyyy, BST) */
export function formatDate(date: string | Date, _style?: string) {
  return new Date(date).toLocaleDateString('en-GB', DATE_OPTS);
}

/** Format time — e.g. "09:20:00 PM" (hh:mm:ss AM/PM, BST) */
export function formatTime(date: string | Date, _style?: string) {
  return new Date(date).toLocaleTimeString('en-US', TIME_OPTS);
}

/** Format "HH:MM" (24h) or "HH:MM:SS" string → "hh:mm AM/PM" */
export function formatTimeString(hhmm: string | undefined | null): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/** Format date + time — e.g. "02 April 2026, 09:20:00 PM" (BST) */
export function formatDateTime(date: string | Date, _dateStyle?: string, _timeStyle?: string) {
  return `${formatDate(date)}, ${formatTime(date)}`;
}

/** Format with custom options (always BST) */
export function formatDateCustom(date: string | Date, _options?: Intl.DateTimeFormatOptions) {
  return formatDate(date);
}

/** Convert date to Asia/Dhaka date input value (YYYY-MM-DD) */
export function toDateInput(date: string | Date) {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Convert UTC date to Asia/Dhaka datetime-local input value (YYYY-MM-DDTHH:mm) */
export function toDateTimeLocal(date: string | Date) {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: TZ,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Convert a `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`)
 * back to a proper UTC ISO string, treating the input as **Asia/Dhaka
 * (BST, UTC+6)** wall clock time.
 *
 * Why this exists: `datetime-local` inputs emit a timezone-less string.
 * If sent to the server as-is, V8 re-interprets it as the container's
 * local time — usually UTC on Render — so a BST 15:30 entry comes back
 * shifted by 6 hours when displayed through the Dhaka formatter. This
 * helper pins the interpretation to BST so save and read round-trip
 * cleanly.
 *
 * BST has no DST, so a fixed −6h offset is exact and timezone-table-free.
 *
 * Returns `''` for empty input so callers can pass it through unchanged.
 */
export function fromDateTimeLocal(local: string | undefined | null): string {
  if (!local) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!m) return local; // unrecognized; leave for downstream validation
  const [, y, mo, d, hh, mm, ss] = m;
  // BST = UTC + 6h, so the equivalent UTC is BST - 6h.
  return new Date(Date.UTC(
    Number(y), Number(mo) - 1, Number(d),
    Number(hh) - 6, Number(mm), Number(ss || '0')
  )).toISOString();
}

/** Get Date object parts in Asia/Dhaka timezone (for calendar logic) */
export function getDhakaDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: TZ,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
  return { year: get('year'), month: get('month') - 1, day: get('day') };
}
