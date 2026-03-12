const TZ = 'Asia/Dhaka';

/** Format date only — e.g. "Mar 12, 2026" */
export function formatDate(date: string | Date, style: 'short' | 'medium' | 'long' | 'full' = 'medium') {
  return new Date(date).toLocaleDateString('en-US', { dateStyle: style, timeZone: TZ });
}

/** Format time only — e.g. "2:30 PM" */
export function formatTime(date: string | Date, style: 'short' | 'medium' | 'long' = 'short') {
  return new Date(date).toLocaleTimeString('en-US', { timeStyle: style, timeZone: TZ });
}

/** Format date + time — e.g. "3/12/26, 2:30 PM" */
export function formatDateTime(
  date: string | Date,
  dateStyle: 'short' | 'medium' | 'long' = 'short',
  timeStyle: 'short' | 'medium' | 'long' = 'short',
) {
  return new Date(date).toLocaleString('en-US', { dateStyle, timeStyle, timeZone: TZ });
}

/** Format with custom options */
export function formatDateCustom(date: string | Date, options: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString('en-US', { ...options, timeZone: TZ });
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
