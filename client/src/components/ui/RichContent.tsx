import DOMPurify from 'dompurify';

interface RichContentProps {
  html: string;
  className?: string;
}

/** Renders sanitized HTML styled with Tailwind prose for consistent rich text. */
export default function RichContent({ html, className = '' }: RichContentProps) {
  if (!html) return null;

  // Must stay in step with what RichTextEditor can produce, or a saved format is silently dropped on display.
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
      'ul', 'ol', 'li', 'blockquote', 'hr', 'h1', 'h2', 'h3', 'h4',
      'a', 'code', 'pre', 'span', 'mark', 'sub', 'sup',
    ],
    // DOMPurify sanitises the declarations inside `style`, which carries text colour and alignment.
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'data-color'],
  });

  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none break-words
        prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
        prose-blockquote:border-l-primary prose-blockquote:not-italic
        prose-hr:my-3 prose-a:text-primary ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
