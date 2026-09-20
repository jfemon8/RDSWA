import RichContent from "@/components/ui/RichContent";
import { markdownToHtml } from "@/lib/markdown";

interface ChatRichContentProps {
  content: string;
  className?: string;
}

/** Renders chat content using the same sanitized rich-content rules as announcements. */
export default function ChatRichContent({
  content,
  className = "",
}: ChatRichContentProps) {
  return <RichContent html={markdownToHtml(content)} className={className} />;
}
