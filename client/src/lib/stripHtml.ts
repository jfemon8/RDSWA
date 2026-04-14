/** Strip HTML tags to plain text. Safe for previews and non-rich-text contexts. */
export function stripHtml(val: unknown): string {
  const str = String(val ?? '');
  if (!str.includes('<')) return str;
  const div = document.createElement('div');
  div.innerHTML = str;
  return div.textContent || div.innerText || str;
}
