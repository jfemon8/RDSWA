import { marked } from 'marked';

/** Inline markdown for text typed literally, which inside editor HTML never reaches the markdown parser. */
const INLINE_RULES: Array<[RegExp, string]> = [
  [/`([^`\n]+)`/g, '<code>$1</code>'],
  [/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>'],
  [/__([^_\n]+)__/g, '<strong>$1</strong>'],
  [/~~([^~\n]+)~~/g, '<del>$1</del>'],
  [/==([^=\n]+)==/g, '<mark>$1</mark>'],
  [/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, '$1<em>$2</em>'],
  [/(^|[^\w_])_([^_\n]+)_(?![\w_])/g, '$1<em>$2</em>'],
];

/** Gate so unmarked text never pays for a DOM walk. */
const HAS_MARKERS = /[*_~=`]/;

const HAS_HTML_TAG = /<\/?[a-z][^>]*>/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function applyInline(text: string): string {
  let out = escapeHtml(text);
  for (const [pattern, replacement] of INLINE_RULES)
    out = out.replace(pattern, replacement);
  return out;
}

/** Walks the text nodes of already-rendered HTML so markdown markers inside it still format. */
function inlineMarkdownInHtml(html: string): string {
  if (typeof DOMParser === 'undefined' || !HAS_MARKERS.test(html)) return html;

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    // Code spans are verbatim, so their markers stay as typed.
    if (node.parentElement?.closest('code, pre')) continue;
    if (HAS_MARKERS.test(node.nodeValue || '')) targets.push(node);
  }

  for (const node of targets) {
    const replaced = applyInline(node.nodeValue || '');
    if (replaced === escapeHtml(node.nodeValue || '')) continue;
    const holder = doc.createElement('span');
    holder.innerHTML = replaced;
    node.replaceWith(...Array.from(holder.childNodes));
  }

  return doc.body.innerHTML;
}

/** Message content as HTML, whether it was written as markdown, as editor HTML, or as both. */
export function markdownToHtml(content: string): string {
  if (!content) return '';
  if (HAS_HTML_TAG.test(content)) return inlineMarkdownInHtml(content);
  return marked.parse(content.replace(/==([^=\n]+)==/g, '<mark>$1</mark>'), {
    breaks: true,
    gfm: true,
    async: false,
  }) as string;
}

/** The same content as one line of plain text, for list previews and notifications. */
export function markdownToText(content: string): string {
  if (!content) return '';
  return content
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/==([^=\n]+)==/g, '$1')
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, '$1$2')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
