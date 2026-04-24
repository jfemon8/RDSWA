import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { formatDate, formatTime } from '@/lib/date';
import { queryKeys } from '@/lib/queryKeys';
import { Calendar, MapPin, Users, FileText, X, Mail } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import RichContent from '@/components/ui/RichContent';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import { deriveEventStatus } from '@rdswa/shared';

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
    <div className="container mx-auto py-6 md:py-12">
      <BlurText
        text="Meeting Records"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.1}>
        <div className="flex gap-2 mb-6 flex-wrap">
          {['', 'upcoming', 'ongoing', 'completed'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                status === s ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'hover:bg-accent'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </FadeIn>

      {isLoading ? (
        <Spinner size="md" />
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Meeting Records"
          description={status
            ? `No ${status} meetings are listed. Try a different status filter or view all meetings.`
            : 'No committee or general meeting records are available yet. Records are added after meetings are held.'}
          primary={status
            ? { label: 'View All Meetings', icon: X, onClick: () => { setStatus(''); setPage(1); } }
            : { label: 'Contact Admin', icon: Mail, to: '/contact' }}
          hint="Meeting agendas, attendance and minutes are documented here for members to review."
        />
      ) : (
        <>
          <div className="space-y-3">
            {meetings.map((m: any, i: number) => (
              <FadeIn key={m._id} delay={i * 0.05} direction="up">
                <Link to={`/events/${m._id}`}>
                  <div
                    className="border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge status={deriveEventStatus(m)} />
                          <h3 className="font-semibold truncate flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-primary shrink-0" /> {m.title}
                          </h3>
                        </div>
                        {m.description && (
                          <RichContent html={m.description} className="text-sm text-muted-foreground line-clamp-2 mb-2" />
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(m.startDate)}
                            {' '}
                            {formatTime(m.startDate)}
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
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <FadeIn>
              <div className="flex justify-center gap-2 mt-6">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-accent">Prev</button>
                <span className="px-4 py-2 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                  className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-accent">Next</button>
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
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize whitespace-nowrap ${colors[status] || colors.upcoming}`}>
      {status}
    </span>
  );
}
