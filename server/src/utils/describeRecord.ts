import { Schema } from 'mongoose';

export interface RecordDetail {
  label: string;
  value: string;
  /** A timestamp the client formats itself, since only it knows the reader's timezone rules. */
  isDate?: boolean;
  /** Set when the value names a person, so the client can link through to their profile. */
  userId?: string;
}

/** Bookkeeping the panel shows separately, plus anything that would leak or read as noise. */
const SKIP_FIELDS = new Set([
  '_id',
  '__v',
  'id',
  'isDeleted',
  'deletedAt',
  'createdAt',
  'updatedAt',
  'password',
  'refreshTokens',
  'recentlyRotated',
  'otp',
  'ipAddress',
  'userAgent',
  'qrCode',
]);

const SKIP_PATTERN = /(password|token|secret|otp)/i;

/** The length prose is clipped to, since a whole article does not belong in a panel. */
const LONG_TEXT = 160;

/** `applicationStartDate` reads as "Application start date", and `aUnit` as "A unit". */
export function humanize(path: string): string {
  const words = path
    .split('.')
    .join(' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One stored value as a line of text, or null when there is nothing worth showing. */
export function readValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const simple = value.every((v) => typeof v === 'string' || typeof v === 'number');
    return simple ? value.join(', ') : `${value.length} item(s)`;
  }

  if (typeof value === 'object') {
    // A populated reference carries a name; anything else object-shaped has nothing to show.
    const named = (value as any).name ?? (value as any).title;
    return typeof named === 'string' && named.trim() ? named.trim() : null;
  }

  const str = String(value).trim();
  if (!str) return null;

  const plain = str.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return null;
  return plain.length > LONG_TEXT ? `${plain.slice(0, LONG_TEXT)}…` : plain;
}

const isSkipped = (path: string): boolean =>
  SKIP_FIELDS.has(path) || SKIP_PATTERN.test(path) || path.split('.').some((p) => SKIP_FIELDS.has(p));

/** The value at a dotted path, which nested schema entries like `tenure.startDate` need. */
const valueAt = (doc: any, path: string): unknown =>
  path.split('.').reduce((current, key) => (current == null ? current : current[key]), doc);

/** Everything a deleted record holds, in schema order, rather than the fields somebody remembered to list. */
export function describeRecord(doc: Record<string, any>, schema: Schema): RecordDetail[] {
  const details: RecordDetail[] = [];
  const seen = new Set<string>();

  for (const path of Object.keys(schema.paths)) {
    if (isSkipped(path)) continue;

    const schemaPath = (schema.paths as any)[path];
    // Raw references read as hex, so they are only useful once populated into an object.
    const raw = valueAt(doc, path);
    if (schemaPath?.instance === 'ObjectId' && (typeof raw !== 'object' || raw === null)) continue;

    const value = readValue(raw);
    if (value === null) continue;

    // A nested path and its parent object can both resolve, so the first one wins.
    const parent = path.split('.')[0]!;
    if (path !== parent && seen.has(parent)) continue;

    seen.add(path);
    const person =
      schemaPath?.options?.ref === 'User' && raw && typeof raw === 'object'
        ? (raw as any)._id
        : undefined;

    details.push({
      label: humanize(path),
      value,
      ...(raw instanceof Date ? { isDate: true } : {}),
      ...(person ? { userId: String(person) } : {}),
    });
  }

  return details;
}
