/** Strip HTML tags to plain text, for previews and other non-rich-text contexts. */
export function stripHtml(val: unknown): string {
  const str = String(val ?? '');
  if (!str.includes('<')) return str;
  const div = document.createElement('div');
  div.innerHTML = str;
  // Markup carrying no text yields an empty string, which beats falling back to showing the tags.
  return div.textContent ?? '';
}
