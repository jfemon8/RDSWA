import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Bus, Search, Loader2, Clock, MapPin, Phone, Filter, ExternalLink,
  ChevronLeft, ChevronRight, AlertTriangle, ArrowLeft, Info, Star, Building2,
  MessageSquare, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';
import { useBusSocket } from '@/hooks/useSocket';
import { formatDate, formatTimeString } from '@/lib/date';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';

const PAGE_LIMIT = 20;

type Tab = 'university' | 'intercity' | 'all';
type View = 'routes' | 'schedules' | 'schedule-detail' | 'operators' | 'operator-detail';

interface ScheduleBus {
  operator?: { _id: string; name: string; logo?: string; rating?: number } | string;
  busName?: string;
  busCategory?: string;
}

export default function BusSchedulePage() {
  const [tab, setTab] = useState<Tab>('university');
  const [view, setView] = useState<View>('routes');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [departureAfter, setDepartureAfter] = useState('');
  const [departureBefore, setDepartureBefore] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);

  useBusSocket();

  // Routes (for university/intercity tabs)
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['bus', 'routes', tab],
    queryFn: async () => {
      const { data } = await api.get(`/bus/routes?routeType=${tab}`);
      return data;
    },
    enabled: tab !== 'all',
  });

  // All operators (for "All Buses" tab)
  const { data: operatorsData, isLoading: operatorsLoading } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => {
      const { data } = await api.get('/bus/operators');
      return data;
    },
  });

  // Schedules for selected route (sorted ascending by departureTime)
  const scheduleParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
    if (selectedRoute) params.set('route', selectedRoute._id);
    if (departureAfter) params.set('departureAfter', departureAfter);
    if (departureBefore) params.set('departureBefore', departureBefore);
    return params.toString();
  }, [page, selectedRoute, departureAfter, departureBefore]);

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['bus', 'schedules', scheduleParams],
    queryFn: async () => {
      const { data } = await api.get(`/bus/schedules?${scheduleParams}`);
      return data;
    },
    enabled: view === 'schedules' && !!selectedRoute,
  });

  // Counters (used for operator-detail view)
  const { data: countersData } = useQuery({
    queryKey: ['bus', 'counters'],
    queryFn: async () => {
      const { data } = await api.get('/bus/counters');
      return data;
    },
  });

  const routes = routesData?.data || [];
  const schedules = schedulesData?.data || [];
  const operators = operatorsData?.data || [];
  const pagination = schedulesData?.pagination;
  const counters = countersData?.data || [];
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;

  // Ensure schedules are sorted ascending by departureTime (server also sorts)
  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a: any, b: any) => (a.departureTime || '').localeCompare(b.departureTime || ''));
  }, [schedules]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    sortedSchedules.forEach((s: any) => (s.buses || []).forEach((b: ScheduleBus) => b.busCategory && cats.add(b.busCategory)));
    return [...cats];
  }, [sortedSchedules]);

  // Filter routes by search
  const filteredRoutes = useMemo(() => {
    if (!search) return routes;
    const q = search.toLowerCase();
    return routes.filter((r: any) =>
      r.origin?.toLowerCase().includes(q) ||
      r.destination?.toLowerCase().includes(q) ||
      r.stops?.some((s: any) => s.name?.toLowerCase().includes(q))
    );
  }, [routes, search]);

  // Filter operators by search (for "All Buses" tab)
  const filteredOperators = useMemo(() => {
    if (!search) return operators;
    const q = search.toLowerCase();
    return operators.filter((op: any) =>
      op.name?.toLowerCase().includes(q) ||
      op.contactNumber?.toLowerCase().includes(q) ||
      op.email?.toLowerCase().includes(q)
    );
  }, [operators, search]);

  // Filter schedules by category
  const filteredSchedules = useMemo(() => {
    if (!filterCategory) return sortedSchedules;
    return sortedSchedules.filter((s: any) =>
      (s.buses || []).some((b: ScheduleBus) => b.busCategory === filterCategory)
    );
  }, [sortedSchedules, filterCategory]);

  const hasActiveFilters = filterCategory || departureAfter || departureBefore;

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setSearch('');
    setPage(1);
    setSelectedRoute(null);
    setSelectedSchedule(null);
    setSelectedOperatorId(null);
    setFilterCategory('');
    setDepartureAfter('');
    setDepartureBefore('');
    if (newTab === 'all') {
      setView('operators');
    } else {
      setView('routes');
    }
  };

  const handleRouteClick = (route: any) => {
    setSelectedRoute(route);
    setView('schedules');
    setPage(1);
  };

  const handleScheduleClick = (schedule: any) => {
    setSelectedSchedule(schedule);
    setView('schedule-detail');
  };

  const handleOperatorClick = (operatorId: string) => {
    setSelectedOperatorId(operatorId);
    setView('operator-detail');
  };

  const goBack = () => {
    if (view === 'operator-detail') {
      setSelectedOperatorId(null);
      // Return to wherever we came from: all-buses list OR previous view
      if (tab === 'all') setView('operators');
      else if (selectedSchedule) setView('schedule-detail');
      else if (selectedRoute) setView('schedules');
      else setView('routes');
    } else if (view === 'schedule-detail') {
      setSelectedSchedule(null);
      setView('schedules');
    } else if (view === 'schedules') {
      setSelectedRoute(null);
      setView('routes');
    }
  };

  const isLoading = (view === 'routes' && routesLoading) ||
    (view === 'schedules' && schedulesLoading) ||
    (view === 'operators' && operatorsLoading);

  const showBackButton = view !== 'routes' && view !== 'operators';

  return (
    <div className="container mx-auto py-8 overflow-x-hidden">
      <SEO title="Bus Schedule" description="Find university and intercity bus schedules, routes, and booking counters." />
      <BlurText text="Bus Schedules" className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6" delay={80} animateBy="words" direction="bottom" />

      {/* Tab buttons */}
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

      {/* Search bar (hidden in detail views) */}
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
                  'Filter schedules...'
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

      {/* Filters (only in schedules view) */}
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
                  onChange={(e) => { setDepartureAfter(e.target.value); setPage(1); }}
                  className="w-full lg:w-auto lg:min-w-[130px] px-3 py-2 border rounded-md text-sm bg-background" />
              </div>
              <div className="min-w-0">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Departure Before</label>
                <input type="time" value={departureBefore}
                  onChange={(e) => { setDepartureBefore(e.target.value); setPage(1); }}
                  className="w-full lg:w-auto lg:min-w-[130px] px-3 py-2 border rounded-md text-sm bg-background" />
              </div>
              {hasActiveFilters && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => { setFilterCategory(''); setDepartureAfter(''); setDepartureBefore(''); }}
                  className="self-end px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md hover:bg-accent">
                  Clear filters
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back button (for detail views) */}
      {showBackButton && (
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </motion.button>
      )}

      {isLoading ? (
        <Spinner size="md" />
      ) : (
        <AnimatePresence mode="wait">
          {/* ═══ ROUTES VIEW (university/intercity) ═══ */}
          {view === 'routes' && (
            <motion.div key="routes" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
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
                            {r.stops.sort((a: any, b: any) => a.order - b.order).map((s: any, si: number) => (
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
          {view === 'schedules' && selectedRoute && (
            <motion.div key="schedules" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* Route header/info */}
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
                      <span>Stops: {selectedRoute.stops.sort((a: any, b: any) => a.order - b.order).map((s: any) => s.name).join(' → ')}</span>
                    )}
                  </div>
                </div>
              </FadeIn>

              {filteredSchedules.length === 0 ? (
                <EmptyState text="No schedules found for this route." />
              ) : (
                <>
                  <FadeIn direction="up" duration={0.4}>
                    {/* Desktop table — wrapped in overflow-x-auto as a safety
                        net: if a future layout bug ever surfaces the table on
                        a narrow viewport, horizontal scroll stays inside the
                        table's box instead of pushing the whole page wide. */}
                    <div className="hidden md:block border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm table-fixed">
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

                    {/* Mobile cards */}
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

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">Page {page} of {totalPages} ({pagination?.total} schedules)</p>
                      <div className="flex items-center gap-2">
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                          className="flex items-center gap-1 px-3 py-1.5 border rounded-md text-sm hover:bg-accent disabled:opacity-40">
                          <ChevronLeft className="h-4 w-4" /> Previous
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                          className="flex items-center gap-1 px-3 py-1.5 border rounded-md text-sm hover:bg-accent disabled:opacity-40">
                          Next <ChevronRight className="h-4 w-4" />
                        </motion.button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ═══ SCHEDULE DETAIL VIEW ═══ */}
          {view === 'schedule-detail' && selectedSchedule && (
            <ScheduleDetailView
              schedule={selectedSchedule}
              onOperatorClick={handleOperatorClick}
            />
          )}

          {/* ═══ OPERATORS LIST VIEW ("All Buses" tab) ═══ */}
          {view === 'operators' && (
            <motion.div key="operators" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              {filteredOperators.length === 0 ? (
                <EmptyState text={search ? 'No operators found.' : 'No operators available.'} />
              ) : (
                <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
              operatorId={selectedOperatorId}
              counters={counters}
            />
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function ScheduleDetailView({ schedule: s, onOperatorClick }: { schedule: any; onOperatorClick: (id: string) => void }) {
  const buses: ScheduleBus[] = s.buses || [];

  return (
    <motion.div key="schedule-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      {/* Schedule Info */}
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

      {/* Buses on this schedule */}
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

      {/* Route Stops */}
      {s.route?.stops?.length > 0 && (
        <FadeIn delay={0.15} direction="up">
          <div className="border rounded-xl p-5 bg-card">
            <h3 className="font-semibold text-sm mb-3">Route Stops</h3>
            <div className="flex flex-wrap gap-1.5">
              {s.route.stops.sort((a: any, b: any) => a.order - b.order).map((st: any, si: number) => (
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
  });
  const op = data?.data;
  const opCounters = counters.filter((c: any) => c.operator?._id === operatorId);

  if (isLoading) {
    return <Spinner size="md" />;
  }
  if (!op) {
    return <EmptyState text="Operator not found." />;
  }

  return (
    <motion.div key="operator-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      {/* Operator Info */}
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

      {/* Counters */}
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

      {/* Reviews & Rating */}
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
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
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
    <FadeIn direction="up">
      <div className="text-center py-12">
        <Bus className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">{text}</p>
      </div>
    </FadeIn>
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
