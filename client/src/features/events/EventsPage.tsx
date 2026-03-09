import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Calendar, MapPin, Loader2 } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';

export default function EventsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = { page: String(page), limit: '12' };
  if (status) filters.status = status;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.events.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/events?${params}`);
      return data;
    },
  });

  const events = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <BlurText
        text="Events"
        className="text-3xl md:text-4xl font-bold mb-6 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2}>
        <div className="flex gap-2 mb-8 flex-wrap">
          {['', 'upcoming', 'ongoing', 'completed'].map((s) => (
            <motion.button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                status === s ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'hover:bg-accent'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </motion.button>
          ))}
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <FadeIn>
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No events found</p>
          </div>
        </FadeIn>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((e: any, i: number) => (
              <FadeIn key={e._id} delay={i * 0.05} direction="up">
                <Link to={`/events/${e._id}`}>
                  <motion.div
                    className="border rounded-xl overflow-hidden bg-card hover:border-primary/30 transition-colors"
                    whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
                  >
                    {e.coverImage && (
                      <div className="overflow-hidden">
                        <motion.img
                          src={e.coverImage}
                          alt=""
                          className="w-full h-40 object-cover"
                          whileHover={{ scale: 1.05 }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <StatusBadge status={e.status} />
                        {e.type && <span className="text-xs text-muted-foreground capitalize">{e.type}</span>}
                      </div>
                      <h3 className="font-semibold mb-2 line-clamp-2">{e.title}</h3>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(e.startDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                        </div>
                        {e.venue && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">{e.venue}</span>
                          </div>
                        )}
                      </div>
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ongoing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] || colors.upcoming}`}>
      {status}
    </span>
  );
}
