import DOMPurify from 'dompurify';

interface RichContentProps {
  html: string;
  className?: string;
}

/**
 * Safely renders HTML content with sanitization.
 * Styles via Tailwind prose for consistent rich text display.
 */
export default function RichContent({ html, className = '' }: RichContentProps) {
  if (!html) return null;

  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
      'ul', 'ol', 'li', 'blockquote', 'hr', 'h1', 'h2', 'h3', 'h4',
      'a', 'code', 'pre',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });

  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none text-justify
        prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
        prose-blockquote:border-l-primary prose-blockquote:not-italic
        prose-hr:my-3 prose-a:text-primary ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
