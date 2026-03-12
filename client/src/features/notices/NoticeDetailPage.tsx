import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { ArrowLeft, Loader2, Paperclip } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import SEO from '@/components/SEO';

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
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const notice = data?.data;
  if (!notice) return <p className="text-center py-12 text-muted-foreground">Notice not found</p>;

  return (
    <div className="mx-auto py-8 px-4 sm:px-6">
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
          {notice.createdBy?.name && ` by ${notice.createdBy.name}`}
        </p>
      </FadeIn>

      <FadeIn delay={0.25} direction="up">
        <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: notice.content }} />
      </FadeIn>

      {notice.attachments?.length > 0 && (
        <FadeIn delay={0.3} direction="up">
          <div className="mt-8 border-t pt-6">
            <h3 className="font-semibold mb-3">Attachments</h3>
            <div className="space-y-2">
              {notice.attachments.map((a: any, i: number) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Paperclip className="h-4 w-4" />
                  {a.name || 'Attachment'}
                </a>
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
