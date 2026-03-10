import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Calendar, MapPin, Users, FileText, Loader2 } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';

export default function MeetingRecordsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = {
    page: String(page), limit: '20', type: 'meeting',
  };
  if (status) filters.status = status;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.events.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/events?${params}`);
      return data;
    },
  });

  const meetings = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <BlurText
        text="Meeting Records"
        className="text-3xl md:text-4xl font-bold mb-6 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.1}>
        <div className="flex gap-2 mb-6 flex-wrap">
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
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : meetings.length === 0 ? (
        <FadeIn>
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No meeting records found</p>
          </div>
        </FadeIn>
      ) : (
        <>
          <div className="space-y-3">
            {meetings.map((m: any, i: number) => (
              <FadeIn key={m._id} delay={i * 0.05} direction="up">
                <Link to={`/events/${m._id}`}>
                  <motion.div
                    className="border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors"
                    whileHover={{ y: -3, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge status={m.status} />
                          <h3 className="font-semibold truncate">{m.title}</h3>
                        </div>
                        {m.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{m.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(m.startDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                            {' '}
                            {new Date(m.startDate).toLocaleTimeString('en-US', { timeStyle: 'short' })}
                          </div>
                          {m.venue && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {m.venue}
                            </div>
                          )}
                          {m.attendance && m.attendance.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {m.attendance.length} attended
                            </div>
                          )}
                          {m.isOnline && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-[10px]">
                              Online
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </FadeIn>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <FadeIn>
              <div className="flex justify-center gap-2 mt-6">
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
    draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize whitespace-nowrap ${colors[status] || colors.upcoming}`}>
      {status}
    </span>
  );
}
