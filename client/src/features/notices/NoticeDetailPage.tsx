import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { ArrowLeft, Loader2, Paperclip, FileText, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';
import Spinner from '@/components/ui/Spinner';
import Promo from '@/components/promo/Promo';

// Lazy-load the PDF viewer so pdfjs (~600 KB) only ships when a notice
// actually has a PDF attachment.
const PdfViewer = lazy(() => import('@/components/ui/PdfViewer'));

export default function NoticeDetailPage() {
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notices.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/notices/${id}`);
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <Spinner size="md" />;
  }

  const notice = data?.data;
  if (!notice) return <p className="text-center py-12 text-muted-foreground">Notice not found</p>;

  return (
    <div className="container mx-auto py-8">
      <SEO title={notice.title} description={notice.content?.replace(/<[^>]*>/g, '').slice(0, 160)} />
      <FadeIn delay={0.05} direction="left">
        <Link to="/notices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Notices
        </Link>
      </FadeIn>

      <FadeIn delay={0.1} direction="up">
        <div className="flex items-center gap-2 mb-3">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-muted"
          >
            {notice.category}
          </motion.span>
          {notice.priority !== 'normal' && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                notice.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}
            >
              {notice.priority}
            </motion.span>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.15} direction="up">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{notice.title}</h1>
        {notice.titleBn && <h2 className="text-xl text-muted-foreground mb-4">{notice.titleBn}</h2>}
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <p className="text-sm text-muted-foreground mb-6">
          Published {formatDate(notice.publishedAt || notice.createdAt, 'long')}
          {notice.createdBy?.name && <> by <Link to={`/members/${notice.createdBy._id}`} className="hover:text-primary transition-colors">{notice.createdBy.name}</Link></>}
        </p>
      </FadeIn>

      <FadeIn delay={0.25} direction="up">
        <RichContent html={notice.content} />
      </FadeIn>

      {/* In-article promo after the notice body, above attachments. Promo
          has its own fade animation; wrapping with FadeIn would block the
          `empty:hidden` collapse when the slot is unfilled. */}
      <div className="mt-8 empty:hidden">
        <Promo kind="inArticle" minHeight={250} />
      </div>

      {notice.attachments?.length > 0 && (
        <FadeIn delay={0.3} direction="up">
          <div className="mt-8 border-t pt-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-primary" /> Attachment
            </h3>
            <NoticeAttachment attachment={notice.attachments[0]} />
          </div>
        </FadeIn>
      )}
    </div>
  );
}

/**
 * Renders a single notice attachment.
 *  - Image → inline `<img>` with click-to-open
 *  - PDF   → embedded react-pdf viewer with page navigation, zoom, fullscreen
 *  - Other → fallback download link
 */
function NoticeAttachment({ attachment }: { attachment: any }) {
  if (!attachment?.url) return null;

  const type = String(attachment.type || '').toLowerCase();
  const url = attachment.url as string;
  const name = attachment.name as string | undefined;
  const isImage = type.startsWith('image/');
  const isPdf = type === 'application/pdf' || /\.pdf($|\?)/i.test(url);

  if (isImage) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-full rounded-xl overflow-hidden border bg-card hover:opacity-95 transition-opacity"
      >
        <img
          src={url}
          alt={name || 'Notice attachment'}
          loading="lazy"
          className="w-full max-h-[640px] object-contain bg-muted/30"
        />
        {name && (
          <p className="px-4 py-2 text-xs text-muted-foreground border-t truncate">{name}</p>
        )}
      </a>
    );
  }

  if (isPdf) {
    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[480px] border rounded-xl bg-card">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <PdfViewer url={url} fileName={name} height={720} />
      </Suspense>
    );
  }

  // Generic fallback — clickable card that downloads the file.
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 max-w-md p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name || 'Attachment'}</p>
        <p className="text-[11px] text-muted-foreground">Click to download</p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground shrink-0" />
    </a>
  );
}
