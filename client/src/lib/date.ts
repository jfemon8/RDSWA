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
