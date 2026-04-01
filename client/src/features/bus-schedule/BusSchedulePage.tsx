import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Bus, Search, Loader2, Clock, MapPin, Phone, Filter, ExternalLink,
  ChevronLeft, ChevronRight, AlertTriangle, ArrowLeft, Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import SEO from '@/components/SEO';
import { useBusSocket } from '@/hooks/useSocket';

const PAGE_LIMIT = 20;

type View = 'routes' | 'schedules' | 'bus-detail' | 'all-buses';

export default function BusSchedulePage() {
  const [routeType, setRouteType] = useState<'university' | 'intercity' | 'all'>('university');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [departureAfter, setDepartureAfter] = useState('');
  const [departureBefore, setDepartureBefore] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>('routes');
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedBus, setSelectedBus] = useState<any>(null);

  useBusSocket();

  // Routes
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['bus', 'routes', routeType === 'all' ? undefined : routeType],
    queryFn: async () => {
      const params = routeType !== 'all' ? `?routeType=${routeType}` : '';
      const { data } = await api.get(`/bus/routes${params}`);
      return data;
    },
    enabled: routeType !== 'all',
  });

  // Schedules for selected route
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

  // All schedules for "All Buses" tab
  const { data: allSchedulesData, isLoading: allBusesLoading } = useQuery({
    queryKey: ['bus', 'all-schedules'],
    queryFn: async () => {
      const { data } = await api.get('/bus/schedules?limit=200');
      return data;
    },
    enabled: view === 'all-buses',
  });

  // Counters
  const { data: countersData } = useQuery({
    queryKey: ['bus', 'counters'],
    queryFn: async () => {
      const { data } = await api.get('/bus/counters');
      return data;
    },
  });

  // Operators
  const { data: operatorsData } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => {
      const { data } = await api.get('/bus/operators');
      return data;
    },
  });

  const routes = routesData?.data || [];
  const schedules = schedulesData?.data || [];
  const allBusSchedules = allSchedulesData?.data || [];
  const pagination = schedulesData?.pagination;
  const counters = countersData?.data || [];
  const operators = operatorsData?.data || [];
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;

  const categories = useMemo(() => {
    const src = view === 'all-buses' ? allBusSchedules : schedules;
    const cats = new Set(src.map((s: any) => s.busCategory).filter(Boolean));
    return [...cats] as string[];
  }, [schedules, allBusSchedules, view]);

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

  // Filter schedules
  const filteredSchedules = useMemo(() => {
    let result = schedules;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s: any) =>
        s.busName?.toLowerCase().includes(q) ||
        s.route?.origin?.toLowerCase().includes(q) ||
        s.route?.destination?.toLowerCase().includes(q)
      );
    }
    if (filterCategory) result = result.filter((s: any) => s.busCategory === filterCategory);
    if (filterOperator) result = result.filter((s: any) => s.route?.operator?._id === filterOperator);
    return result;
  }, [schedules, search, filterCategory, filterOperator]);

  // Unique buses for All Buses view
  const allBusCards = useMemo(() => {
    const busMap = new Map<string, any>();
    const src = allBusSchedules;
    for (const s of src) {
      const key = s.busName || s.busNumber || s._id;
      if (!busMap.has(key)) {
        busMap.set(key, { ...s, scheduleCount: 1 });
      } else {
        busMap.get(key).scheduleCount++;
      }
    }
    let result = [...busMap.values()];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((b: any) =>
        b.busName?.toLowerCase().includes(q) ||
        b.route?.origin?.toLowerCase().includes(q) ||
        b.route?.destination?.toLowerCase().includes(q) ||
        b.route?.operator?.name?.toLowerCase().includes(q)
      );
    }
    if (filterCategory) result = result.filter((b: any) => b.busCategory === filterCategory);
    if (filterOperator) result = result.filter((b: any) => b.route?.operator?._id === filterOperator);
    return result;
  }, [allBusSchedules, search, filterCategory, filterOperator]);

  const hasActiveFilters = filterCategory || filterOperator || departureAfter || departureBefore;

  // Get counters for a specific operator
  const getCountersForOperator = (operatorId?: string) => {
    if (!operatorId) return counters;
    return counters.filter((c: any) => c.operator?._id === operatorId);
  };

  const handleRouteTypeChange = (type: 'university' | 'intercity' | 'all') => {
    setRouteType(type);
    setPage(1);
    if (type === 'all') {
      setView('all-buses');
      setSelectedRoute(null);
      setSelectedBus(null);
    } else {
      setView('routes');
      setSelectedRoute(null);
      setSelectedBus(null);
    }
  };

  const handleRouteClick = (route: any) => {
    setSelectedRoute(route);
    setView('schedules');
    setPage(1);
  };

  const handleBusClick = (bus: any) => {
    setSelectedBus(bus);
    setView('bus-detail');
  };

  const goBack = () => {
    if (view === 'bus-detail' && selectedRoute) {
      setView('schedules');
      setSelectedBus(null);
    } else if (view === 'bus-detail') {
      setView('all-buses');
      setSelectedBus(null);
    } else if (view === 'schedules') {
      setView('routes');
      setSelectedRoute(null);
    } else {
      setView('routes');
    }
  };

  const isLoading = (view === 'routes' && routesLoading) ||
    (view === 'schedules' && schedulesLoading) ||
    (view === 'all-buses' && allBusesLoading);

  return (
    <div className="container mx-auto py-8">
      <SEO title="Bus Schedule" description="Find university and intercity bus schedules, routes, and booking counters." />
      <BlurText text="Bus Schedules" className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6" delay={80} animateBy="words" direction="bottom" />

      {/* Route type tabs */}
      <FadeIn delay={0.1} direction="up">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'university' as const, label: 'University Bus' },
            { key: 'intercity' as const, label: 'Way to Home (Inter-city)' },
            { key: 'all' as const, label: 'All Buses' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleRouteTypeChange(tab.key)}
              className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                routeType === tab.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Search bar (always visible) */}
      <FadeIn delay={0.15} direction="up">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view === 'routes' ? 'Search by route, destination, stops...' : 'Search by bus name, route...'}
              className="w-full pl-10 pr-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
          {(view === 'schedules' || view === 'all-buses') && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm ${hasActiveFilters ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
          )}
        </div>
      </FadeIn>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (view === 'schedules' || view === 'all-buses') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-3 mb-4 p-4 border rounded-lg bg-card">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1.5 border rounded-md text-sm bg-background min-w-[140px]">
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Operator</label>
                <select value={filterOperator} onChange={(e) => setFilterOperator(e.target.value)}
                  className="px-3 py-1.5 border rounded-md text-sm bg-background min-w-[160px]">
                  <option value="">All Operators</option>
                  {operators.map((op: any) => (
                    <option key={op._id} value={op._id}>{op.name}</option>
                  ))}
                </select>
              </div>
              {view === 'schedules' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Departure After</label>
                    <input type="time" value={departureAfter}
                      onChange={(e) => { setDepartureAfter(e.target.value); setPage(1); }}
                      className="px-3 py-1.5 border rounded-md text-sm bg-background min-w-[130px]" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Departure Before</label>
                    <input type="time" value={departureBefore}
                      onChange={(e) => { setDepartureBefore(e.target.value); setPage(1); }}
                      className="px-3 py-1.5 border rounded-md text-sm bg-background min-w-[130px]" />
                  </div>
                </>
              )}
              {hasActiveFilters && (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onClick={() => { setFilterCategory(''); setFilterOperator(''); setDepartureAfter(''); setDepartureBefore(''); }}
                  className="self-end px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md hover:bg-accent">
                  Clear filters
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <AnimatePresence mode="wait">
          {/* ═══ ROUTES VIEW ═══ */}
          {view === 'routes' && (
            <motion.div key="routes" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              {filteredRoutes.length === 0 ? (
                <EmptyState text={search ? 'No routes found.' : 'No bus routes available.'} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        {r.operator?.name && <p className="text-sm text-muted-foreground">Operator: {r.operator.name}</p>}
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
                        <p className="text-xs text-primary mt-2">View schedules &rarr;</p>
                      </motion.button>
                    </FadeIn>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ SCHEDULES VIEW ═══ */}
          {view === 'schedules' && selectedRoute && (
            <motion.div key="schedules" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {/* Route header */}
              <div className="flex items-center gap-3 p-4 border rounded-lg bg-primary/5 mb-4">
                <button onClick={goBack} className="p-1.5 rounded-md hover:bg-accent">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedRoute.origin} &rarr; {selectedRoute.destination}</span>
                  </div>
                  {selectedRoute.stops?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Stops: {selectedRoute.stops.sort((a: any, b: any) => a.order - b.order).map((s: any) => s.name).join(' \u2192 ')}
                    </p>
                  )}
                </div>
              </div>

              {filteredSchedules.length === 0 ? (
                <EmptyState text="No schedules found for this route." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border min-w-[700px]">
                      <thead>
                        <tr className="bg-muted">
                          <th className="text-left p-3 font-medium">Bus</th>
                          <th className="text-left p-3 font-medium">Departure</th>
                          <th className="text-left p-3 font-medium">Arrival</th>
                          <th className="text-left p-3 font-medium">Category</th>
                          <th className="text-left p-3 font-medium">Days</th>
                          <th className="text-left p-3 font-medium">Info</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSchedules.map((s: any, index: number) => (
                          <motion.tr
                            key={s._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className={`border-t hover:bg-accent/50 ${s.isSpecialSchedule ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                          >
                            <td className="p-3">
                              <button
                                onClick={() => handleBusClick(s)}
                                className="text-left hover:text-primary transition-colors"
                              >
                                <p className="font-medium underline decoration-dotted underline-offset-2">{s.busName || 'N/A'}</p>
                                {s.busNumber && <p className="text-xs text-muted-foreground">{s.busNumber}</p>}
                                {s.route?.operator?.name && <p className="text-xs text-muted-foreground">{s.route.operator.name}</p>}
                              </button>
                            </td>
                            <td className="p-3">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.departureTime}</span>
                              {s.seasonalVariation?.adjustedDepartureTime && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 block mt-0.5">
                                  {s.seasonalVariation.season}: {s.seasonalVariation.adjustedDepartureTime}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {s.arrivalTime || '-'}
                              {s.seasonalVariation?.adjustedArrivalTime && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 block mt-0.5">
                                  {s.seasonalVariation.season}: {s.seasonalVariation.adjustedArrivalTime}
                                </span>
                              )}
                            </td>
                            <td className="p-3 capitalize">{s.busCategory?.replace('_', ' ') || '-'}</td>
                            <td className="p-3 text-xs capitalize text-muted-foreground">{s.daysOfOperation?.join(', ') || 'Daily'}</td>
                            <td className="p-3">
                              <ScheduleInfoCell schedule={s} />
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

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

          {/* ═══ ALL BUSES VIEW ═══ */}
          {view === 'all-buses' && (
            <motion.div key="all-buses" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              {allBusCards.length === 0 ? (
                <EmptyState text={search ? 'No buses found.' : 'No bus data available.'} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allBusCards.map((bus: any, i: number) => (
                    <FadeIn key={bus._id} delay={i * 0.03} direction="up">
                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleBusClick(bus)}
                        className="w-full text-left border rounded-lg p-4 bg-card hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Bus className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium truncate">{bus.busName || bus.busNumber || 'Unknown Bus'}</span>
                        </div>
                        {bus.route?.operator?.name && (
                          <p className="text-xs text-muted-foreground mb-1">Operator: {bus.route.operator.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {bus.route?.origin} &rarr; {bus.route?.destination}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {bus.departureTime}</span>
                          <span className="capitalize px-1.5 py-0.5 bg-muted rounded">{bus.busCategory?.replace('_', ' ') || 'N/A'}</span>
                        </div>
                        <p className="text-xs text-primary mt-2">View details &rarr;</p>
                      </motion.button>
                    </FadeIn>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ BUS DETAIL VIEW ═══ */}
          {view === 'bus-detail' && selectedBus && (
            <motion.div key="bus-detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <button onClick={goBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              {/* Bus Info */}
              <FadeIn delay={0.05} direction="up">
                <div className="border rounded-xl p-6 bg-card mb-4">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bus className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{selectedBus.busName || selectedBus.busNumber || 'Bus Details'}</h2>
                      {selectedBus.busNumber && <p className="text-sm text-muted-foreground">Bus No: {selectedBus.busNumber}</p>}
                      {selectedBus.route?.operator?.name && <p className="text-sm text-muted-foreground">Operator: {selectedBus.route.operator.name}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DetailRow icon={<MapPin className="h-4 w-4" />} label="Route" value={`${selectedBus.route?.origin || '?'} → ${selectedBus.route?.destination || '?'}`} />
                    <DetailRow icon={<Clock className="h-4 w-4" />} label="Departure" value={selectedBus.departureTime} />
                    {selectedBus.arrivalTime && <DetailRow icon={<Clock className="h-4 w-4" />} label="Arrival" value={selectedBus.arrivalTime} />}
                    <DetailRow icon={<Info className="h-4 w-4" />} label="Category" value={selectedBus.busCategory?.replace('_', ' ').replace(/^\w/, (c: string) => c.toUpperCase()) || 'N/A'} />
                    {selectedBus.seatType && <DetailRow icon={<Info className="h-4 w-4" />} label="Seat Type" value={selectedBus.seatType} />}
                    <DetailRow icon={<Info className="h-4 w-4" />} label="Days" value={selectedBus.daysOfOperation?.join(', ') || 'Daily'} />
                  </div>

                  {selectedBus.additionalInfo && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Additional Info</p>
                      <p className="text-sm">{selectedBus.additionalInfo}</p>
                    </div>
                  )}

                  {selectedBus.seasonalVariation?.season && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3" /> Seasonal Variation ({selectedBus.seasonalVariation.season})
                      </p>
                      {selectedBus.seasonalVariation.adjustedDepartureTime && (
                        <p className="text-sm">Departure: {selectedBus.seasonalVariation.adjustedDepartureTime}</p>
                      )}
                      {selectedBus.seasonalVariation.adjustedArrivalTime && (
                        <p className="text-sm">Arrival: {selectedBus.seasonalVariation.adjustedArrivalTime}</p>
                      )}
                      {selectedBus.seasonalVariation.note && (
                        <p className="text-xs text-muted-foreground mt-1">{selectedBus.seasonalVariation.note}</p>
                      )}
                    </div>
                  )}
                </div>
              </FadeIn>

              {/* Route Stops */}
              {selectedBus.route?.stops?.length > 0 && (
                <FadeIn delay={0.1} direction="up">
                  <div className="border rounded-xl p-5 bg-card mb-4">
                    <h3 className="font-semibold text-sm mb-3">Route Stops</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBus.route.stops.sort((a: any, b: any) => a.order - b.order).map((s: any, si: number) => (
                        <span key={si} className="inline-flex items-center text-xs text-muted-foreground">
                          {si > 0 && <span className="mx-1.5">&rarr;</span>}
                          <span className="px-2 py-1 bg-muted rounded-md">{s.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </FadeIn>
              )}

              {/* Booking Counters */}
              {(() => {
                const busCounters = getCountersForOperator(selectedBus.route?.operator?._id);
                if (busCounters.length === 0) return null;
                return (
                  <FadeIn delay={0.15} direction="up">
                    <div className="border rounded-xl p-5 bg-card mb-4">
                      <h3 className="font-semibold text-sm mb-3">Booking Counters</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {busCounters.map((c: any, ci: number) => (
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
                    </div>
                  </FadeIn>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
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

function ScheduleInfoCell({ schedule: s }: { schedule: any }) {
  if (s.isSpecialSchedule) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title={s.specialScheduleNote || 'Special schedule'}>
        <AlertTriangle className="h-3 w-3" />
        {s.specialScheduleNote || 'Special'}
      </span>
    );
  }
  if (s.seasonalVariation?.note) return <span className="text-xs text-muted-foreground">{s.seasonalVariation.note}</span>;
  if (s.additionalInfo) return <span className="text-xs text-muted-foreground">{s.additionalInfo}</span>;
  return <span className="text-xs text-muted-foreground">-</span>;
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
