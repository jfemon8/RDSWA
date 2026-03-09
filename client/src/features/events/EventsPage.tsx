import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Calendar, MapPin, Loader2 } from 'lucide-react';

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
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Events</h1>

      <div className="flex gap-2 mb-6">
        {['', 'upcoming', 'ongoing', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-4 py-2 text-sm rounded-md border transition-colors ${
              status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No events found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((e: any) => (
              <Link key={e._id} to={`/events/${e._id}`} className="border rounded-lg overflow-hidden bg-background hover:shadow-md transition-shadow">
                {e.coverImage && (
                  <img src={e.coverImage} alt="" className="w-full h-40 object-cover" />
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
              </Link>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Prev</button>
              <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Next</button>
            </div>
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
