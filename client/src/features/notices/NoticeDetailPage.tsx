import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { ArrowLeft, Loader2, Paperclip } from 'lucide-react';

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
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link to="/notices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Notices
      </Link>

      <div className="flex items-center gap-2 mb-3">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-muted">{notice.category}</span>
        {notice.priority !== 'normal' && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
            notice.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}>
            {notice.priority}
          </span>
        )}
      </div>

      <h1 className="text-3xl font-bold mb-2">{notice.title}</h1>
      {notice.titleBn && <h2 className="text-xl text-muted-foreground mb-4">{notice.titleBn}</h2>}

      <p className="text-sm text-muted-foreground mb-6">
        Published {new Date(notice.publishedAt || notice.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })}
        {notice.createdBy?.name && ` by ${notice.createdBy.name}`}
      </p>

      <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: notice.content }} />

      {notice.attachments?.length > 0 && (
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
      )}
    </div>
  );
}
