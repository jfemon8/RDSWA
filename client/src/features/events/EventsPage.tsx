import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { formatDate, formatDateCustom, getDhakaDateParts } from '@/lib/date';
import { queryKeys } from '@/lib/queryKeys';
import { Calendar, MapPin, Search, LayoutGrid, CalendarDays, ChevronLeft, ChevronRight, Building2, Mail, X } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { ImageCardSkeleton } from '@/components/ui/Skeleton';
import SEO from '@/components/SEO';
import EmptyState from '@/components/ui/EmptyState';
import { deriveEventStatus } from '@rdswa/shared';
import Promo from '@/components/promo/Promo';

// One in-feed promo per N event cards. 6 keeps density unobtrusive while
// still hitting the 12-per-page list often enough to register impressions.
const PROMO_EVERY = 6;

const EVENT_TYPES = ['event', 'meeting', 'workshop', 'seminar', 'social', 'other'];
const STATUSES = ['', 'upcoming', 'ongoing', 'completed'];

export default function EventsPage() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [committee, setCommittee] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const filters: Record<string, string> = { page: String(page), limit: '12' };
  if (status) filters.status = status;
  if (type) filters.type = type;
  if (committee) filters.committee = committee;
  if (search) filters.search = search;

  const { data: committeesData } = useQuery({
    queryKey: queryKeys.committees.all,
    queryFn: async () => {
      const { data } = await api.get('/committees');
      return data;
    },
  });
  const committees: Array<{ _id: string; name: string; year?: string }> = committeesData?.data || [];

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

  // Calendar data: fetch all events for the displayed month
  const calendarFilters: Record<string, string> = { limit: '100' };
  if (type) calendarFilters.type = type;
  if (committee) calendarFilters.committee = committee;
  if (search) calendarFilters.search = search;

  const { data: calendarData } = useQuery({
    queryKey: queryKeys.events.list({ ...calendarFilters, view: 'calendar', month: String(calendarMonth.getMonth()), year: String(calendarMonth.getFullYear()) }),
    queryFn: async () => {
      const params = new URLSearchParams(calendarFilters);
      const { data } = await api.get(`/events?${params}`);
      return data;
    },
    enabled: viewMode === 'calendar',
  });

  const calendarEvents = calendarData?.data || [];

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const { year, month } = getDhakaDateParts(calendarMonth);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { date: number; events: any[] }[] = [];

    // Empty slots for offset
    for (let i = 0; i < firstDay; i++) days.push({ date: 0, events: [] });

    for (let d = 1; d <= daysInMonth; d++) {
      const dayEvents = calendarEvents.filter((e: any) => {
        const parts = getDhakaDateParts(new Date(e.startDate));
        return parts.year === year && parts.month === month && parts.day === d;
      });
      days.push({ date: d, events: dayEvents });
    }
    return days;
  }, [calendarMonth, calendarEvents]);

  const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

  return (
    <div className="container mx-auto py-6 md:py-12">
      <SEO
        title="Events"
        description="Upcoming and past RDSWA events at the University of Barishal — workshops, seminars, cultural programs, sports, scholarships, and social gatherings for Rangpur Division students. RDSWA ইভেন্টস ও কর্মসূচি।"
        keywords="RDSWA events, BU events, University of Barishal events, Rangpur student events, RDSWA workshops, RDSWA seminars, ববি ইভেন্ট, RDSWA কর্মসূচি"
      />
      <BlurText
        text="Events"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      {/* Search & View Toggle */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search events..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-1 border rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded ${viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>
      </FadeIn>

      {/* Filters row */}
      <FadeIn delay={0.2}>
        <div className="flex gap-2 mb-6 flex-wrap">
          {/* Status filters */}
          {STATUSES.map((s) => (
            <button
              key={`s-${s}`}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                status === s ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'hover:bg-accent'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
          <span className="border-l mx-1" />
          {/* Type filter */}
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Types</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          {/* Committee filter */}
          <select
            value={committee}
            onChange={(e) => { setCommittee(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Committees</option>
            {committees.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}{c.year ? ` (${c.year})` : ''}
              </option>
            ))}
          </select>
        </div>
      </FadeIn>

      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            {isLoading ? (
              <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <ImageCardSkeleton key={i} />)}
              </div>
            ) : events.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No Events Found"
                description={search || status || type || committee
                  ? 'No events match your filters. Try clearing them to see all events.'
                  : 'No events have been scheduled yet. Check back soon — new events are posted regularly.'}
                primary={search || status || type || committee
                  ? { label: 'Clear Filters', icon: X, onClick: () => { setSearch(''); setStatus(''); setType(''); setCommittee(''); setPage(1); } }
                  : { label: 'Contact Admin', icon: Mail, to: '/contact' }}
                hint="Upcoming meetings, workshops, and social gatherings for RDSWA members appear here as soon as they are announced."
              />
            ) : (
              <>
                <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {events.map((e: any, i: number) => (
                    <Fragment key={e._id}>
                      <FadeIn delay={i * 0.05} direction="up">
                        <Link to={`/events/${e._id}`}>
                          <div
                            className="border rounded-xl overflow-hidden bg-card hover:border-primary/30 transition-colors"
                          >
                            {e.coverImage && (
                              <div className="overflow-hidden">
                                <img
                                  src={e.coverImage}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-40 object-cover"
                                />
                              </div>
                            )}
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <StatusBadge status={deriveEventStatus(e)} />
                                {e.type && <span className="text-xs text-muted-foreground capitalize">{e.type}</span>}
                              </div>
                              <h3 className="font-semibold mb-2 line-clamp-2 flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-primary shrink-0" /> {e.title}
                              </h3>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {formatDate(e.startDate)}
                                </div>
                                {e.venue && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span className="truncate">{e.venue}</span>
                                  </div>
                                )}
                                {e.committee && (
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-3.5 w-3.5" />
                                    <span className="truncate">
                                      {typeof e.committee === 'object' ? e.committee.name : 'Committee'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </FadeIn>
                      {/* In-feed promo every Nth card. Spans all grid columns
                          via col-span so it reads as a content break, not a
                          stray oversized card. Skipped on the very last card
                          to avoid trailing the list with an ad. */}
                      {(i + 1) % PROMO_EVERY === 0 && i < events.length - 1 && (
                        <div className="sm:col-span-2 lg:col-span-3 empty:hidden">
                          <Promo kind="infeed" minHeight={180} />
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <FadeIn>
                    <div className="flex justify-center gap-2 mt-8">
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
          </motion.div>
        ) : (
          /* Calendar View */
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <div className="border rounded-xl bg-card overflow-hidden">
              {/* Calendar header */}
              <div className="flex items-center justify-between p-4 border-b">
                <button onClick={prevMonth} className="p-1 hover:bg-accent rounded">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="font-semibold">
                  {formatDateCustom(calendarMonth, { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={nextMonth} className="p-1 hover:bg-accent rounded">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 border-b">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  const todayParts = getDhakaDateParts(new Date());
                  const calParts = getDhakaDateParts(calendarMonth);
                  const isToday = day.date > 0 &&
                    todayParts.day === day.date &&
                    todayParts.month === calParts.month &&
                    todayParts.year === calParts.year;

                  return (
                    <div
                      key={i}
                      className={`min-h-[80px] md:min-h-[100px] border-b border-r p-1 ${
                        day.date === 0 ? 'bg-muted/30' : ''
                      } ${isToday ? 'bg-primary/5' : ''}`}
                    >
                      {day.date > 0 && (
                        <>
                          <span className={`text-xs font-medium inline-block w-6 h-6 leading-6 text-center rounded-full ${
                            isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                          }`}>
                            {day.date}
                          </span>
                          <div className="space-y-0.5 mt-0.5">
                            {day.events.slice(0, 2).map((e: any) => {
                              const derived = deriveEventStatus(e);
                              return (
                                <Link key={e._id} to={`/events/${e._id}`}>
                                  <div
                                    className={`text-[10px] md:text-xs px-1 py-0.5 rounded truncate cursor-pointer ${
                                      derived === 'upcoming' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                      derived === 'ongoing' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                      'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {e.title}
                                  </div>
                                </Link>
                              );
                            })}
                            {day.events.length > 2 && (
                              <span className="text-[10px] text-muted-foreground px-1">+{day.events.length - 2} more</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ongoing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] || colors.upcoming}`}>
      {status}
    </span>
  );
}
