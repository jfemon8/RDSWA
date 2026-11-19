/** Strip HTML tags to plain text, for previews and other non-rich-text contexts. */
export function stripHtml(val: unknown): string {
  const str = String(val ?? '');
  if (!str.includes('<')) return str;
  // DOMParser builds an inert document, whereas a live element's innerHTML would load `<img onerror>` and run the handler.
  const doc = new DOMParser().parseFromString(str, 'text/html');
  // Markup carrying no text yields an empty string, which beats falling back to showing the tags.
  return doc.body.textContent ?? '';
}
