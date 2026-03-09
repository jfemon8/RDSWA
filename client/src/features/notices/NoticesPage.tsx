import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { FileText, Loader2, AlertTriangle } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';

export default function NoticesPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = { page: String(page), limit: '12' };
  if (category) filters.category = category;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notices.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/notices?${params}`);
      return data;
    },
  });

  const notices = data?.data || [];
  const pagination = data?.pagination;
  const categories = ['', 'general', 'academic', 'event', 'urgent', 'financial', 'other'];

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <BlurText
        text="Notices"
        className="text-3xl md:text-4xl font-bold mb-6 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2}>
        <div className="flex gap-2 mb-8 flex-wrap">
          {categories.map((c) => (
            <motion.button key={c} onClick={() => { setCategory(c); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize ${
                category === c ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'hover:bg-accent'
              }`}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            >
              {c || 'All'}
            </motion.button>
          ))}
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : notices.length === 0 ? (
        <FadeIn>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No notices found</p>
          </div>
        </FadeIn>
      ) : (
        <>
          <div className="space-y-3">
            {notices.map((n: any, i: number) => (
              <FadeIn key={n._id} delay={i * 0.04} direction="left">
                <Link to={`/notices/${n._id}`}>
                  <motion.div
                    className={`p-4 border rounded-xl bg-card hover:border-primary/30 transition-colors ${
                      n.priority === 'urgent' ? 'border-red-300 dark:border-red-800' : ''
                    }`}
                    whileHover={{ x: 4, transition: { type: 'spring', stiffness: 300 } }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {n.priority === 'urgent' && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                          <h3 className="font-semibold truncate">{n.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{n.content?.replace(/<[^>]*>/g, '')}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="capitalize">{n.category}</span>
                          <span>{new Date(n.publishedAt || n.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                        </div>
                      </div>
                      {n.priority !== 'normal' && (
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          n.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {n.priority}
                        </span>
                      )}
                    </div>
                  </motion.div>
                </Link>
              </FadeIn>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <FadeIn>
              <div className="flex justify-center gap-2 mt-8">
                <motion.button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-accent"
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Prev</motion.button>
                <span className="px-4 py-2 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
                <motion.button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                  className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-accent"
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Next</motion.button>
              </div>
            </FadeIn>
          )}
        </>
      )}
    </div>
  );
}
