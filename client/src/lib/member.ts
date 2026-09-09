/** Ordinal suffix for a batch number, so 1/2/3 read as 1st/2nd/3rd while the teens stay "th". */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

/** One line of academic context for a member card, skipping whatever they have not filled in. */
export function memberMeta(m: {
  department?: string;
  batch?: number | string;
  session?: string;
}): string {
  const batch = Number(m.batch);
  return [
    m.department,
    Number.isFinite(batch) && batch > 0 ? `${ordinal(batch)} Batch` : '',
    m.session ? `${m.session} Session` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
