import { useState, useMemo, useEffect, useRef } from 'react';
import { MAX_GC_TIME } from '@/lib/queryPersister';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, useIsRestoring } from '@tanstack/react-query';
import { useInfiniteList, infiniteListOptions } from '@/hooks/useInfiniteList';
import { useTabParam } from '@/hooks/useTabParam';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import api from '@/lib/api';

/** Offline-persistence options that keep every Bus Schedule query in IndexedDB and let Workbox answer it while the device is offline. */
const BUS_OFFLINE_OPTS = {
  meta: { persist: true } as const,
  gcTime: MAX_GC_TIME,
  staleTime: 60 * 60 * 1000,
  refetchOnReconnect: true as const,
  networkMode: 'offlineFirst' as const,
};
import {
  Bus, Search, Clock, MapPin, Phone, Filter, ExternalLink,
  AlertTriangle, ArrowLeft, Info, Star, Building2,
  MessageSquare, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { FadeIn, BlurText } from '@/components/reactbits';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';
import { useBusSocket } from '@/hooks/useSocket';
import { formatDate, formatTimeString } from '@/lib/date';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import SharedEmptyState from '@/components/ui/EmptyState';
import InfiniteScrollSentinel from '@/components/ui/InfiniteScrollSentinel';
import Promo from '@/components/promo/Promo';

const PAGE_LIMIT = 20;

type Tab = 'university' | 'intercity' | 'all';
const TABS: readonly Tab[] = ['university', 'intercity', 'all'];
type View = 'routes' | 'schedules' | 'schedule-detail' | 'operators' | 'operator-detail';

interface ScheduleBus {
  operator?: { _id: string; name: string; logo?: string; rating?: number } | string;
  busName?: string;
  busCategory?: string;
}

export default function BusSchedulePage() {
  const [tab] = useTabParam<Tab>(TABS, 'university');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [departureAfter, setDepartureAfter] = useState('');
  const [departureBefore, setDepartureBefore] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);

  // Which drill-down is open is URL state, so the browser's Back button and a refresh both do the right thing.
  const routeId = params.get('route') || '';
  const scheduleId = params.get('schedule') || '';
  const selectedOperatorId = params.get('operator') || null;

  const setParam = (next: Record<string, string | null>) =>
    setParams((prev) => {
      const merged = new URLSearchParams(prev);
      Object.entries(next).forEach(([k, v]) => (v ? merged.set(k, v) : merged.delete(k)));
      return merged;
    });

  const prefetchClient = useQueryClient();
  // True while cached queries are still coming out of IndexedDB, so the skeleton does not flash over persisted data.
  const isRestoring = useIsRestoring();
  useBusSocket();

  // Warm every tab, operator, and counter in parallel on first mount, so one online visit makes the whole page work offline.
  useEffect(() => {
    const fire = (key: unknown[], url: string) =>
      prefetchClient.prefetchQuery({
        queryKey: key,
        queryFn: async () => (await api.get(url)).data,
        ...BUS_OFFLINE_OPTS,
      }).catch(() => { /* offline: ignore, SW/persister handle it */ });

    fire(['bus', 'routes', 'university'], '/bus/routes?routeType=university');
    fire(['bus', 'routes', 'intercity'], '/bus/routes?routeType=intercity');
    fire(['bus', 'operators'], '/bus/operators');
    fire(['bus', 'counters'], '/bus/counters');
  }, [prefetchClient]);

  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['bus', 'routes', tab],
    queryFn: async () => {
      const { data } = await api.get(`/bus/routes?routeType=${tab}`);
      return data;
    },
    enabled: tab !== 'all',
    ...BUS_OFFLINE_OPTS,
  });

  const { data: operatorsData, isLoading: operatorsLoading } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => {
      const { data } = await api.get('/bus/operators');
      return data;
    },
    ...BUS_OFFLINE_OPTS,
  });

  const debouncedSearch = useDebouncedValue(search);

  // Category, time and text all filter on the server, so paging never hides a match on a later page.
  const scheduleFilters = useMemo(
    () => ({
      route: routeId || undefined,
      busCategory: filterCategory || undefined,
      search: debouncedSearch.trim() || undefined,
      departureAfter: departureAfter || undefined,
      departureBefore: departureBefore || undefined,
    }),
    [routeId, filterCategory, debouncedSearch, departureAfter, departureBefore]
  );

  const scheduleKey = ['bus', 'schedules', scheduleFilters];

  const {
    items: schedules,
    total: scheduleTotal,
    isLoading: schedulesLoading,
    hasNextPage: hasMoreSchedules,
    isFetchingNextPage: fetchingMoreSchedules,
    fetchNextPage: fetchMoreSchedules,
  } = useInfiniteList({
    queryKey: scheduleKey,
    path: '/bus/schedules',
    filters: scheduleFilters,
    limit: PAGE_LIMIT,
    enabled: !!routeId,
    queryOptions: BUS_OFFLINE_OPTS,
  });

  const { data: countersData } = useQuery({
    queryKey: ['bus', 'counters'],
    queryFn: async () => {
      const { data } = await api.get('/bus/counters');
      return data;
    },
    ...BUS_OFFLINE_OPTS,
  });

  const routes = routesData?.data || [];
  const operators = operatorsData?.data || [];
  const selectedRoute = useMemo(
    () => (routeId ? routes.find((r: any) => r._id === routeId) || null : null),
    [routes, routeId]
  );

  // Once the lists resolve, warm each item's detail, reviews, and schedules in parallel, once per operator or route.
  useEffect(() => {
    const warm = (key: unknown[], url: string) =>
      prefetchClient.prefetchQuery({
        queryKey: key,
        queryFn: async () => (await api.get(url)).data,
        ...BUS_OFFLINE_OPTS,
      }).catch(() => { /* ignore failure */ });

    for (const op of operators) {
      if (!op?._id) continue;
      warm(['bus', 'operator', op._id], `/bus/operators/${op._id}`);
      warm(['bus', 'operator', op._id, 'reviews'], `/bus/operators/${op._id}/reviews`);
    }
    for (const route of routes) {
      if (!route?._id) continue;
      // Warmed through the shared options so it lands on exactly the key the list reads.
      prefetchClient
        .prefetchInfiniteQuery({
          ...infiniteListOptions({
            queryKey: ['bus', 'schedules', { route: route._id }],
            path: '/bus/schedules',
            filters: { route: route._id },
            limit: PAGE_LIMIT,
          }),
          ...BUS_OFFLINE_OPTS,
        })
        .catch(() => { /* ignore failure */ });
    }
  }, [operators, routes, prefetchClient]);
  const counters = countersData?.data || [];

  // Ensure schedules are sorted ascending by departureTime (server also sorts)
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a: any, b: any) => (a.departureTime || '').localeCompare(b.departureTime || ''));
  }, [schedules]);

  // Held across filtering so choosing a category never empties the dropdown that produced it.
  const categoryPool = useRef<Set<string>>(new Set());
  const categories = useMemo(() => {
    sortedSchedules.forEach((s: any) =>
      (s.buses || []).forEach((b: ScheduleBus) => b.busCategory && categoryPool.current.add(b.busCategory))
    );
    return [...categoryPool.current].sort();
  }, [sortedSchedules]);

  const filteredRoutes = useMemo(() => {
    if (!search) return routes;
    const q = search.toLowerCase();
    return routes.filter((r: any) =>
      r.origin?.toLowerCase().includes(q) ||
      r.destination?.toLowerCase().includes(q) ||
      r.stops?.some((s: any) => s.name?.toLowerCase().includes(q))
    );
  }, [routes, search]);

  const filteredOperators = useMemo(() => {
    if (!search) return operators;
    const q = search.toLowerCase();
    return operators.filter((op: any) =>
      op.name?.toLowerCase().includes(q) ||
      op.contactNumber?.toLowerCase().includes(q) ||
      op.email?.toLowerCase().includes(q)
    );
  }, [operators, search]);

  const filteredSchedules = sortedSchedules;

  const hasActiveFilters = filterCategory || departureAfter || departureBefore;

  const clearFilters = () => {
    setFilterCategory('');
    setDepartureAfter('');
    setDepartureBefore('');
  };

  // The view is whatever the URL points at, resolved in drill-down order.
  const view: View = selectedOperatorId
    ? 'operator-detail'
    : scheduleId && selectedSchedule
      ? 'schedule-detail'
      : routeId
        ? 'schedules'
        : tab === 'all'
          ? 'operators'
          : 'routes';

  const handleTabChange = (newTab: Tab) => {
    setSearch('');
    setSelectedSchedule(null);
    clearFilters();
    setShowFilters(false);
    // A tab is a fresh start, so the whole query string is rewritten rather than merged into.
    setParams(new URLSearchParams({ tab: newTab }));
  };

  const handleRouteClick = (route: any) => {
    // A different route has its own categories and times, so the previous filters would silently empty the list.
    setSearch('');
    clearFilters();
    setParam({ route: route._id, schedule: null, operator: null });
  };

  const handleScheduleClick = (schedule: any) => {
    setSelectedSchedule(schedule);
    setParam({ schedule: schedule._id, operator: null });
  };

  const handleOperatorClick = (operatorId: string) => setParam({ operator: operatorId });

  const goBack = () => {
    if (view === 'operator-detail') setParam({ operator: null });
    else if (view === 'schedule-detail') { setSelectedSchedule(null); setParam({ schedule: null }); }
    else if (view === 'schedules') { setSearch(''); clearFilters(); setParam({ route: null }); }
  };

  // A deep link carries only the id, and the row it belongs to lives in a page that may not be loaded.
  useEffect(() => {
    if (!scheduleId || selectedSchedule?._id === scheduleId) return;
    const found = schedules.find((s: any) => s._id === scheduleId);
    if (found) setSelectedSchedule(found);
    else if (!schedulesLoading && schedules.length > 0) setParam({ schedule: null });
  }, [scheduleId, schedules, schedulesLoading, selectedSchedule]);

  // Each drill-down starts at the top rather than halfway down the list that was left behind.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [routeId, scheduleId, selectedOperatorId, tab]);

  // Categories belong to one route, so the pool is emptied before the next route fills it.
  useEffect(() => {
    categoryPool.current = new Set();
  }, [routeId]);

  // Skeletons show only with no data at all, so persisted content is never hidden behind them.
  const hasListData =
    view === 'schedules' ? schedules.length > 0 : routes.length > 0 || operators.length > 0;
  const isLoading = !isRestoring && !hasListData && (
    (view === 'routes' && routesLoading) ||
    (view === 'schedules' && schedulesLoading) ||
    (view === 'operators' && operatorsLoading)
  );

  const showBackButton = view !== 'routes' && view !== 'operators';

  return (
    <div className="container mx-auto py-8 overflow-x-hidden">
      <SEO
        title="Rangpur to Barishal Bus Schedule"
        description="Complete Rangpur to Barishal and Barishal to Rangpur bus schedule for University of Barishal students: operator timings, routes, counters, and seasonal variations updated regularly. RDSWA official transport guide."
        keywords="Rangpur to Barishal bus, Barishal to Rangpur bus, BU Rangpur bus schedule, University of Barishal transport, ববি বাস, রংপুর বরিশাল বাস, RDSWA bus, intercity bus Bangladesh, bus counter Rangpur Barishal"
      />
      <BlurText text="Bus Schedules" className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6" delay={80} animateBy="words" direction="bottom" />

      <FadeIn delay={0.1} direction="up">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'university' as const, label: 'University Bus' },
            { key: 'intercity' as const, label: 'Way to Home (Inter-city)' },
            { key: 'all' as const, label: 'All Buses' },
          ].map((t) => (
            <motion.button
              key={t.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTabChange(t.key)}
              className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                tab === t.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent'
              }`}
            >
              {t.label}
            </motion.button>
          ))}
        </div>
      </FadeIn>

      {(view === 'routes' || view === 'schedules' || view === 'operators') && (
        <FadeIn delay={0.15} direction="up">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  view === 'operators' ? 'Search operator by name...' :
                  view === 'routes' ? 'Search by route, destination, stops...' :
                  'Search bus name, operator or category...'
                }
                className="w-full pl-10 pr-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            {view === 'schedules' && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm ${hasActiveFilters ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
              >
                <Filter className="h-4 w-4" /> Filters
              </button>
            )}
          </div>
        </FadeIn>
      )}

      <AnimatePresence>
        {showFilters && view === 'schedules' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 mb-4 p-4 border rounded-lg bg-card">
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full lg:w-auto lg:min-w-[140px] px-3 py-2 border rounded-md text-sm bg-background">
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Departure After</label>
                <input type="time" value={departureAfter}
                  onChange={(e) => { setDepartureAfter(e.target.value); }}
                  className="w-full lg:w-auto lg:min-w-[130px] px-3 py-2 border rounded-md text-sm bg-background" />
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Departure Before</label>
                <input type="time" value={departureBefore}
                  onChange={(e) => { setDepartureBefore(e.target.value); }}
                  className="w-full lg:w-auto lg:min-w-[130px] px-3 py-2 border rounded-md text-sm bg-background" />
              </div>
              {hasActiveFilters && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={clearFilters}
                  className="self-end px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md hover:bg-accent">
                  Clear filters
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showBackButton && (
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={goBack}
          className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </motion.button>
      )}

      {/* On lg+ the content splits with a sticky promo on the right, and below lg the sidebar collapses so the schedule grid keeps its full-width design. */}
      <div className="lg:flex lg:gap-6">
        <div className="flex-1 min-w-0">
      {isLoading ? (
        <motion.div
          key="page-skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          {/* ═══ ROUTES VIEW (university/intercity) ═══ */}
          {view === 'routes' && (
            <motion.div key="routes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
              {filteredRoutes.length === 0 ? (
                <EmptyState text={search ? 'No routes found.' : 'No bus routes available.'} />
              ) : (
                <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredRoutes.map((r: any, i: number) => (
                    <FadeIn key={r._id} delay={i * 0.04} direction="up">
                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleRouteClick(r)}
                        className="w-full text-left border rounded-lg p-4 bg-card hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium text-foreground">{r.origin} &rarr; {r.destination}</span>
                        </div>
                        {r.estimatedDuration && <p className="text-sm text-muted-foreground">Duration: {r.estimatedDuration}</p>}
                        {r.distanceKm && <p className="text-sm text-muted-foreground">Distance: {r.distanceKm} km</p>}
                        {r.stops?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {[...r.stops].sort((a: any, b: any) => a.order - b.order).map((s: any, si: number) => (
                              <span key={si} className="inline-flex items-center text-[11px] text-muted-foreground">
                                {si > 0 && <span className="mx-1 text-muted-foreground/50">&rarr;</span>}
                                <span className="px-1.5 py-0.5 bg-muted rounded">{s.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-primary mt-2">View schedules</p>
                      </motion.button>
                    </FadeIn>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ SCHEDULES VIEW (for selected route) ═══ */}
          {view === 'schedules' && (
            <motion.div key="schedules" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
              {selectedRoute && (
              <FadeIn direction="up">
                <div className="p-4 border rounded-lg bg-primary/5 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">{selectedRoute.origin} &rarr; {selectedRoute.destination}</span>
                    <span className="text-xs capitalize px-2 py-0.5 rounded bg-primary/10 text-primary">{selectedRoute.routeType}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                    {selectedRoute.estimatedDuration && <span>Duration: {selectedRoute.estimatedDuration}</span>}
                    {selectedRoute.distanceKm && <span>Distance: {selectedRoute.distanceKm} km</span>}
                    {selectedRoute.stops?.length > 0 && (
                      <span>Stops: {[...selectedRoute.stops].sort((a: any, b: any) => a.order - b.order).map((s: any) => s.name).join(' → ')}</span>
                    )}
                  </div>
                </div>
              </FadeIn>
              )}

              {schedulesLoading && filteredSchedules.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                  <div className="hidden md:block"><TableSkeleton rows={6} /></div>
                  <div className="md:hidden space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-28 rounded-lg" />
                    ))}
                  </div>
                </motion.div>
              ) : filteredSchedules.length === 0 ? (
                <EmptyState
                  text={
                    search || hasActiveFilters
                      ? 'No schedules match your search or filters.'
                      : 'No schedules found for this route.'
                  }
                />
              ) : (
                <>
                  <FadeIn direction="up" duration={0.4}>
                    {/* overflow-x-auto keeps any future narrow-viewport scroll inside the table rather than widening the page. */}
                    <div className="hidden md:block border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm table-fixed min-w-[560px]">
                        <colgroup>
                          <col className="w-[20%]" />
                          <col className="w-[30%]" />
                          <col className="w-[30%]" />
                          <col className="w-[20%]" />
                        </colgroup>
                        <thead>
                          <tr className="bg-muted border-b">
                            <th className="p-3 font-medium text-center text-foreground">Time</th>
                            <th className="p-3 font-medium text-center text-foreground">Bus Name</th>
                            <th className="p-3 font-medium text-center text-foreground">Operator</th>
                            {tab === 'intercity' && <th className="p-3 font-medium text-center text-foreground">Category</th>}
                            {tab === 'university' && <th className="p-3 font-medium text-center text-foreground">Days</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSchedules.map((s: any) => {
                            const buses: ScheduleBus[] = s.buses || [];
                            const n = Math.max(buses.length, 1);
                            return buses.length > 0 ? buses.map((b, bi) => (
                              <tr key={`${s._id}-${bi}`} className={`border-t hover:bg-accent/30 cursor-pointer ${s.isSpecialSchedule ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`} onClick={() => handleScheduleClick(s)}>
                                {bi === 0 && (
                                  <td rowSpan={n} className="p-3 text-center align-middle border-r font-semibold">
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="whitespace-nowrap">{formatTimeString(s.departureTime)}</span>
                                      {s.arrivalTime && <span className="text-xs text-muted-foreground font-normal whitespace-nowrap">→ {formatTimeString(s.arrivalTime)}</span>}
                                      {s.seasonalVariation?.adjustedDepartureTime && (
                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 break-words">
                                          {s.seasonalVariation.season}: {formatTimeString(s.seasonalVariation.adjustedDepartureTime)}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                )}
                                <td className="p-3 text-center align-middle break-words">{b.busName || '-'}</td>
                                <td className="p-3 text-center align-middle break-words">
                                  {typeof b.operator === 'object' && b.operator ? (
                                    <button onClick={(e) => { e.stopPropagation(); handleOperatorClick((b.operator as { _id: string; name: string })._id); }} className="text-primary hover:underline break-words">
                                      {(b.operator as { name: string }).name}
                                    </button>
                                  ) : '-'}
                                </td>
                                {tab === 'intercity' && <td className="p-3 text-center align-middle capitalize break-words">{b.busCategory?.replace('_', ' ') || '-'}</td>}
                                {bi === 0 && tab === 'university' && (
                                  <td rowSpan={n} className="p-3 text-center align-middle text-xs capitalize text-muted-foreground border-l break-words">{s.daysOfOperation?.join(', ') || 'Daily'}</td>
                                )}
                              </tr>
                            )) : (
                              <tr key={s._id} className={`border-t hover:bg-accent/30 cursor-pointer ${s.isSpecialSchedule ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`} onClick={() => handleScheduleClick(s)}>
                                <td className="p-3 text-center align-middle border-r font-semibold">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="whitespace-nowrap">{formatTimeString(s.departureTime)}</span>
                                    {s.arrivalTime && <span className="text-xs text-muted-foreground font-normal whitespace-nowrap">→ {formatTimeString(s.arrivalTime)}</span>}
                                  </div>
                                </td>
                                <td colSpan={tab === 'university' ? 2 : 3} className="p-3 text-center align-middle text-muted-foreground">No buses</td>
                                {tab === 'university' && <td className="p-3 text-center align-middle text-xs capitalize text-muted-foreground border-l break-words">{s.daysOfOperation?.join(', ') || 'Daily'}</td>}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden space-y-3">
                      {filteredSchedules.map((s: any) => {
                        const buses: ScheduleBus[] = s.buses || [];
                        return (
                          <div
                            key={s._id}
                            onClick={() => handleScheduleClick(s)}
                            className={`border rounded-lg p-4 bg-card cursor-pointer hover:bg-accent/30 transition-colors ${s.isSpecialSchedule ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                              <p className="font-semibold text-foreground">
                                <span className="whitespace-nowrap">{formatTimeString(s.departureTime)}</span>
                                {s.arrivalTime && (
                                  <span className="text-muted-foreground font-normal">
                                    {' '}→ <span className="whitespace-nowrap">{formatTimeString(s.arrivalTime)}</span>
                                  </span>
                                )}
                              </p>
                              {tab === 'university' && (
                                <span className="text-[10px] capitalize text-muted-foreground text-right break-words min-w-0">{s.daysOfOperation?.join(', ') || 'Daily'}</span>
                              )}
                            </div>
                            {s.seasonalVariation?.adjustedDepartureTime && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                                {s.seasonalVariation.season}: {formatTimeString(s.seasonalVariation.adjustedDepartureTime)}
                              </p>
                            )}
                            {buses.length > 0 ? (
                              <div className="space-y-1 pt-2 border-t">
                                {buses.map((b, bi) => (
                                  <div key={bi} className="text-xs flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                    <span className="font-medium text-foreground break-words">{b.busName || '-'}</span>
                                    {typeof b.operator === 'object' && b.operator && (
                                      <>
                                        <span className="text-muted-foreground">·</span>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleOperatorClick((b.operator as { _id: string })._id); }}
                                          className="text-primary hover:underline break-words"
                                        >
                                          {(b.operator as { name: string }).name}
                                        </button>
                                      </>
                                    )}
                                    {tab === 'intercity' && b.busCategory && (
                                      <>
                                        <span className="text-muted-foreground">·</span>
                                        <span className="capitalize text-muted-foreground">{b.busCategory.replace('_', ' ')}</span>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="pt-2 border-t text-xs text-muted-foreground">No buses</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </FadeIn>

                  <InfiniteScrollSentinel
                    hasNextPage={!!hasMoreSchedules}
                    isFetchingNextPage={fetchingMoreSchedules}
                    fetchNextPage={fetchMoreSchedules}
                    endLabel={schedules.length > 0 ? `All ${scheduleTotal} schedules loaded` : undefined}
                  />
                </>
              )}
            </motion.div>
          )}

          {/* ═══ SCHEDULE DETAIL VIEW ═══ */}
          {view === 'schedule-detail' && selectedSchedule && (
            <ScheduleDetailView
              key="schedule-detail"
              schedule={selectedSchedule}
              onOperatorClick={handleOperatorClick}
            />
          )}

          {/* ═══ OPERATORS LIST VIEW ("All Buses" tab) ═══ */}
          {view === 'operators' && (
            <motion.div key="operators" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
              {filteredOperators.length === 0 ? (
                <EmptyState text={search ? 'No operators found.' : 'No operators available.'} />
              ) : (
                <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredOperators.map((op: any, i: number) => (
                    <FadeIn key={op._id} delay={i * 0.04} direction="up">
                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleOperatorClick(op._id)}
                        className="w-full text-left border rounded-lg p-4 bg-card hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {op.logo ? (
                            <img src={op.logo} alt={op.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground truncate">{op.name}</span>
                              {op.rating > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                                  <Star className="h-3 w-3 fill-current" />
                                  {op.rating.toFixed(1)}
                                  <span className="text-muted-foreground">({op.ratingCount || 0})</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground capitalize mt-0.5">
                              {op.scheduleType}{op.contactNumber ? ` · ${op.contactNumber}` : ''}
                            </p>
                            <p className="text-xs text-primary mt-2">View details</p>
                          </div>
                        </div>
                      </motion.button>
                    </FadeIn>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ OPERATOR DETAIL VIEW (info + all counters) ═══ */}
          {view === 'operator-detail' && selectedOperatorId && (
            <OperatorDetailView
              key="operator-detail"
              operatorId={selectedOperatorId}
              counters={counters}
            />
          )}
        </AnimatePresence>
      )}

      {/* Full-width bottom banner on every breakpoint, so mobile still gets one impression where the sidebar is hidden. */}
      <div className="mt-8 empty:hidden">
        <Promo kind="displayResponsive" minHeight={250} />
      </div>
        </div>
        <aside className="hidden lg:block lg:empty:hidden w-72 shrink-0 sticky top-20 self-start">
          <Promo kind="sidebar" minHeight={600} />
        </aside>
      </div>
    </div>
  );
}

function ScheduleDetailView({ schedule: s, onOperatorClick }: { schedule: any; onOperatorClick: (id: string) => void }) {
  const buses: ScheduleBus[] = s.buses || [];

  return (
    <motion.div key="schedule-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <FadeIn delay={0.05} direction="up">
        <div className="border rounded-xl p-6 bg-card mb-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bus className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{s.route?.origin} &rarr; {s.route?.destination}</h2>
              <p className="text-sm text-muted-foreground">{buses.length} bus{buses.length !== 1 ? 'es' : ''} on this schedule</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DetailRow icon={<Clock className="h-4 w-4" />} label="Departure Time" value={formatTimeString(s.departureTime)} />
            {s.arrivalTime && <DetailRow icon={<Clock className="h-4 w-4" />} label="Arrival Time" value={formatTimeString(s.arrivalTime)} />}
            <DetailRow icon={<Info className="h-4 w-4" />} label="Days" value={s.daysOfOperation?.join(', ') || 'Daily'} />
          </div>

          {s.additionalInfo && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-1">Additional Info</p>
              <p className="text-sm">{s.additionalInfo}</p>
            </div>
          )}

          {s.seasonalVariation?.season && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3" /> Seasonal Variation ({s.seasonalVariation.season})
              </p>
              {s.seasonalVariation.adjustedDepartureTime && (
                <p className="text-sm">Departure: {formatTimeString(s.seasonalVariation.adjustedDepartureTime)}</p>
              )}
              {s.seasonalVariation.adjustedArrivalTime && (
                <p className="text-sm">Arrival: {formatTimeString(s.seasonalVariation.adjustedArrivalTime)}</p>
              )}
              {s.seasonalVariation.note && (
                <p className="text-xs text-muted-foreground mt-1">{s.seasonalVariation.note}</p>
              )}
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.1} direction="up">
        <div className="border rounded-xl p-5 bg-card mb-4">
          <h3 className="font-semibold text-sm mb-3">Buses</h3>
          <div className="space-y-3">
            {buses.map((b, idx) => {
              const opId = typeof b.operator === 'object' ? b.operator?._id : (b.operator as string | undefined);
              const opName = typeof b.operator === 'object' ? b.operator?.name : '';
              return (
                <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                  className="border rounded-lg p-4 bg-background">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <DetailRow icon={<Bus className="h-4 w-4" />} label="Bus Name" value={b.busName || 'N/A'} />
                    <div className="flex items-start gap-2">
                      <span className="text-primary mt-0.5 shrink-0"><Building2 className="h-4 w-4" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">Operator</p>
                        {opId && opName ? (
                          <button
                            onClick={() => onOperatorClick(opId)}
                            className="text-sm font-medium text-primary hover:underline text-left"
                          >
                            {opName}
                          </button>
                        ) : (
                          <p className="text-sm font-medium">{opName || 'N/A'}</p>
                        )}
                      </div>
                    </div>
                    <DetailRow icon={<Clock className="h-4 w-4" />} label="Departure Time" value={formatTimeString(s.departureTime)} />
                    {s.arrivalTime && <DetailRow icon={<Clock className="h-4 w-4" />} label="Arrival Time" value={formatTimeString(s.arrivalTime)} />}
                    {b.busCategory && <DetailRow icon={<Info className="h-4 w-4" />} label="Category" value={b.busCategory.replace('_', ' ')} />}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </FadeIn>

      {s.route?.stops?.length > 0 && (
        <FadeIn delay={0.15} direction="up">
          <div className="border rounded-xl p-5 bg-card">
            <h3 className="font-semibold text-sm mb-3">Route Stops</h3>
            <div className="flex flex-wrap gap-1.5">
              {[...s.route.stops].sort((a: any, b: any) => a.order - b.order).map((st: any, si: number) => (
                <span key={si} className="inline-flex items-center text-xs text-muted-foreground">
                  {si > 0 && <span className="mx-1.5">&rarr;</span>}
                  <span className="px-2 py-1 bg-muted rounded-md">{st.name}</span>
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </motion.div>
  );
}

function OperatorDetailView({ operatorId, counters }: { operatorId: string; counters: any[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'operator', operatorId],
    queryFn: async () => {
      const { data } = await api.get(`/bus/operators/${operatorId}`);
      return data;
    },
    ...BUS_OFFLINE_OPTS,
  });
  const op = data?.data;
  const opCounters = counters.filter((c: any) => c.operator?._id === operatorId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }
  if (!op) {
    return <EmptyState text="Operator not found." />;
  }

  return (
    <motion.div key="operator-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <FadeIn delay={0.05} direction="up">
        <div className="border rounded-xl p-6 bg-card mb-4">
          <div className="flex items-start gap-4 mb-4">
            {op.logo ? (
              <img src={op.logo} alt={op.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">{op.name}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-xs capitalize px-2 py-0.5 rounded bg-primary/10 text-primary">{op.scheduleType}</span>
                {op.rating > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-sm text-amber-600 dark:text-amber-400">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {op.rating.toFixed(1)}
                    <span className="text-muted-foreground text-xs">({op.ratingCount || 0} reviews)</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {op.contactNumber && (
              <a href={`tel:${op.contactNumber.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Phone className="h-4 w-4" /> {op.contactNumber}
              </a>
            )}
            {op.email && (
              <a href={`mailto:${op.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline truncate">
                <Info className="h-4 w-4 shrink-0" /> {op.email}
              </a>
            )}
            {op.website && (
              <a href={op.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline truncate">
                <ExternalLink className="h-4 w-4 shrink-0" /> {op.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {op.description && (
            <div className="pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">About</p>
              <RichContent html={op.description} className="text-sm text-foreground prose-sm max-w-none" />
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.1} direction="up">
        <div className="border rounded-xl p-5 bg-card">
          <h3 className="font-semibold text-sm mb-3">Booking Counters ({opCounters.length})</h3>
          {opCounters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No counters available for this operator.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {opCounters.map((c: any, ci: number) => (
                <motion.div
                  key={c._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ci * 0.05 }}
                  className="border rounded-lg p-4 bg-background"
                >
                  <p className="font-medium text-sm mb-1">{c.name}</p>
                  {c.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <MapPin className="h-3 w-3" /> {c.location}
                    </p>
                  )}
                  {c.phoneNumbers?.map((phone: string, pi: number) => (
                    <a key={pi} href={`tel:${phone.replace(/\s/g, '')}`}
                      className="text-sm flex items-center gap-1.5 mt-1.5 text-primary hover:underline">
                      <Phone className="h-3 w-3" /> {phone}
                    </a>
                  ))}
                  {c.bookingLink && (
                    <motion.a
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      href={c.bookingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Book Online
                    </motion.a>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.15} direction="up">
        <div className="border rounded-xl p-5 bg-card mt-4">
          <OperatorReviews operatorId={operatorId} />
        </div>
      </FadeIn>
    </motion.div>
  );
}

function OperatorReviews({ operatorId }: { operatorId: string }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'operator', operatorId, 'reviews'],
    queryFn: async () => {
      const { data } = await api.get(`/bus/operators/${operatorId}/reviews`);
      return data;
    },
    ...BUS_OFFLINE_OPTS,
  });

  const reviews = data?.data || [];
  const myReview = user ? reviews.find((r: any) => r.user?._id === user._id) : null;

  const submitMutation = useMutation({
    mutationFn: () => api.post(`/bus/operators/${operatorId}/reviews`, { rating, comment: comment.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bus', 'operator', operatorId] });
      queryClient.invalidateQueries({ queryKey: ['bus', 'operator', operatorId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['bus', 'operators'] });
      setEditing(false);
      toast.success(myReview ? 'Review updated' : 'Review submitted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to submit review'),
  });

  const deleteMutation = useMutation({
    mutationFn: (reviewId: string) => api.delete(`/bus/operators/${operatorId}/reviews/${reviewId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bus', 'operator', operatorId] });
      queryClient.invalidateQueries({ queryKey: ['bus', 'operator', operatorId, 'reviews'] });
      queryClient.invalidateQueries({ queryKey: ['bus', 'operators'] });
      toast.success('Review removed');
      setEditing(false);
      setRating(0);
      setComment('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to remove review'),
  });

  const startEdit = () => {
    setRating(myReview?.rating || 0);
    setComment(myReview?.comment || '');
    setEditing(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Reviews ({reviews.length})
        </h3>
        {user && !editing && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startEdit}
            className="px-3 py-1.5 text-xs rounded-md border hover:bg-accent"
          >
            {myReview ? 'Edit your review' : 'Write a review'}
          </motion.button>
        )}
      </div>

      {!user && (
        <p className="text-sm text-muted-foreground mb-3">Log in to rate this operator.</p>
      )}

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="border rounded-lg p-4 bg-background">
              <div className="mb-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Your rating *</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(n)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star className={`h-6 w-6 ${n <= (hoverRating || rating) ? 'text-amber-500 fill-current' : 'text-muted-foreground/40'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                placeholder="Optional comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                rows={3}
                className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
              />
              <div className="flex gap-2 flex-wrap">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={rating < 1 || submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
                >
                  {submitMutation.isPending ? 'Saving...' : myReview ? 'Update' : 'Submit'}
                </motion.button>
                {myReview && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={deleteMutation.isPending}
                    onClick={async () => {
                      const ok = await confirm({ title: 'Remove Review', message: 'Remove your review for this operator?', confirmLabel: 'Remove', variant: 'danger' });
                      if (ok) deleteMutation.mutate(myReview._id);
                    }}
                    className="flex items-center gap-1 px-3 py-2 border border-destructive text-destructive rounded-md text-sm hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </motion.button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-3 py-2 border rounded-md text-sm hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r: any, i: number) => (
            <motion.div
              key={r._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`border rounded-lg p-3 bg-background ${myReview?._id === r._id ? 'border-primary/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{r.user?.name || 'Anonymous'}</span>
                  {myReview?._id === r._id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Your review</span>
                  )}
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3 w-3 ${n <= r.rating ? 'text-amber-500 fill-current' : 'text-muted-foreground/30'}`} />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(r.createdAt)}</span>
              </div>
              {r.comment && <p className="text-sm text-foreground mt-1.5">{r.comment}</p>}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <SharedEmptyState
      icon={Bus}
      title="Nothing to Show"
      description={text || 'No results match your current filters. Try clearing them or adjusting your search.'}
      hint="Bus operators, routes, schedules and counters published by RDSWA will appear here."
    />
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-primary mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium capitalize">{value}</p>
      </div>
    </div>
  );
}
