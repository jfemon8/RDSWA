import RichContent from "@/components/ui/RichContent";
import { marked } from "marked";

interface ChatRichContentProps {
  content: string;
  className?: string;
}

/** Renders chat content using the same sanitized rich-content rules as announcements. */
export default function ChatRichContent({
  content,
  className = "",
}: ChatRichContentProps) {
  const html = /<\/?[a-z][^>]*>/i.test(content)
    ? content
    : marked.parse(content.replace(/==([^=\n]+)==/g, "<mark>$1</mark>"), {
        breaks: true,
        gfm: true,
        async: false,
      });

  return <RichContent html={html} className={className} />;
}
