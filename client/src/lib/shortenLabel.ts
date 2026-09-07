/** Words that carry no meaning in an initialism, so "Computer Science & Engineering" reduces to CSE. */
const FILLER = new Set(['and', 'of', 'in', 'for', 'the', '&']);

/** Longest label kept whole, chosen so "Soil Science" survives while "Management Studies" is shortened. */
const KEEP_WHOLE = 14;

/** Shortens a long multi-word label to its initials for a cramped axis, leaving short names untouched. */
export function shortenLabel(label: string, keepWhole = KEEP_WHOLE): string {
  const text = (label || '').trim();
  if (text.length <= keepWhole) return text;

  const words = text
    .split(/[\s/-]+/)
    .filter((w) => w && !FILLER.has(w.toLowerCase()));

  const initials = words
    .map((w) => w.replace(/[^A-Za-z0-9]/g, '').charAt(0).toUpperCase())
    .filter(Boolean)
    .join('');

  // A single long word has no initials worth showing, so trim it instead.
  if (initials.length < 2) return `${text.slice(0, keepWhole - 1)}…`;
  return initials;
}
