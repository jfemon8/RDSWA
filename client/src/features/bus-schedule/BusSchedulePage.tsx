import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Bus, Search, Loader2, Clock, MapPin, Phone, Filter, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import SEO from '@/components/SEO';

export default function BusSchedulePage() {
  const [routeType, setRouteType] = useState('university');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['bus', 'routes', routeType],
    queryFn: async () => {
      const { data } = await api.get(`/bus/routes?routeType=${routeType}`);
      return data;
    },
  });

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['bus', 'schedules', routeType],
    queryFn: async () => {
      const { data } = await api.get(`/bus/schedules?routeType=${routeType}&limit=100`);
      return data;
    },
  });

  const { data: countersData } = useQuery({
    queryKey: ['bus', 'counters'],
    queryFn: async () => {
      const { data } = await api.get('/bus/counters');
      return data;
    },
  });

  const { data: operatorsData } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => {
      const { data } = await api.get('/bus/operators');
      return data;
    },
  });

  const routes = routesData?.data || [];
  const allSchedules = schedulesData?.data || [];
  const counters = countersData?.data || [];
  const operators = operatorsData?.data || [];
  const isLoading = routesLoading || schedulesLoading;

  // Extract unique categories from schedules
  const categories = useMemo(() => {
    const cats = new Set(allSchedules.map((s: any) => s.busCategory).filter(Boolean));
    return [...cats] as string[];
  }, [allSchedules]);

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

  // Filter schedules by search + category + operator
  const filteredSchedules = useMemo(() => {
    let result = allSchedules;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s: any) =>
        s.busName?.toLowerCase().includes(q) ||
        s.route?.origin?.toLowerCase().includes(q) ||
        s.route?.destination?.toLowerCase().includes(q)
      );
    }
    if (filterCategory) {
      result = result.filter((s: any) => s.busCategory === filterCategory);
    }
    if (filterOperator) {
      result = result.filter((s: any) => s.route?.operator?._id === filterOperator);
    }
    return result;
  }, [allSchedules, search, filterCategory, filterOperator]);

  const hasActiveFilters = filterCategory || filterOperator;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <SEO title="Bus Schedule" description="Find university and intercity bus schedules, routes, and booking counters." />
      <BlurText text="Bus Schedules" className="text-3xl md:text-4xl font-bold mb-6" delay={80} animateBy="words" direction="bottom" />

      {/* Route type toggle */}
      <FadeIn delay={0.1} direction="up">
        <div className="flex gap-2 mb-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setRouteType('university')}
            className={`px-4 py-2 text-sm rounded-md border ${routeType === 'university' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
          >
            University Bus
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setRouteType('intercity')}
            className={`px-4 py-2 text-sm rounded-md border ${routeType === 'intercity' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}
          >
            Way to Home (Inter-city)
          </motion.button>
        </div>
      </FadeIn>

      {/* Search + filter toggle */}
      <FadeIn delay={0.15} direction="up">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by route, destination, or bus name..."
              className="w-full pl-10 pr-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm" />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-md text-sm ${hasActiveFilters ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
          >
            <Filter className="h-4 w-4" /> Filters
          </motion.button>
        </div>
      </FadeIn>

      {/* Filter dropdowns */}
      <AnimatePresence>
        {showFilters && (
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
              {hasActiveFilters && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setFilterCategory(''); setFilterOperator(''); }}
                  className="self-end px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md hover:bg-accent"
                >
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
        <div className="space-y-8">
          {/* Routes */}
          {filteredRoutes.length > 0 && (
            <FadeIn delay={0.1} direction="up">
              <div>
                <h2 className="text-lg font-semibold mb-4">Routes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredRoutes.map((r: any, i: number) => (
                    <FadeIn key={r._id} delay={0.1 + i * 0.06} direction="up">
                      <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="border rounded-lg p-4 bg-background">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="font-medium">{r.origin} &rarr; {r.destination}</span>
                        </div>
                        {r.operator?.name && (
                          <p className="text-sm text-muted-foreground">Operator: {r.operator.name}</p>
                        )}
                        {r.estimatedDuration && <p className="text-sm text-muted-foreground">Duration: {r.estimatedDuration}</p>}
                        {r.distanceKm && <p className="text-sm text-muted-foreground">Distance: {r.distanceKm} km</p>}
                        {r.stops?.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">Stops: {r.stops.map((s: any) => s.name).join(' → ')}</p>
                        )}
                      </motion.div>
                    </FadeIn>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {/* Schedules */}
          {filteredSchedules.length > 0 && (
            <FadeIn delay={0.2} direction="up">
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  Schedules
                  {(search || hasActiveFilters) && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({filteredSchedules.length} result{filteredSchedules.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-medium">Bus</th>
                        <th className="text-left p-3 font-medium">Route</th>
                        <th className="text-left p-3 font-medium">Departure</th>
                        <th className="text-left p-3 font-medium">Arrival</th>
                        <th className="text-left p-3 font-medium">Category</th>
                        <th className="text-left p-3 font-medium">Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSchedules.map((s: any) => (
                        <tr key={s._id} className="border-t hover:bg-accent/50">
                          <td className="p-3">
                            <p className="font-medium">{s.busName || 'N/A'}</p>
                            {s.busNumber && <p className="text-xs text-muted-foreground">{s.busNumber}</p>}
                            {s.route?.operator?.name && <p className="text-xs text-muted-foreground">{s.route.operator.name}</p>}
                          </td>
                          <td className="p-3 text-xs">
                            {s.route?.origin} → {s.route?.destination}
                          </td>
                          <td className="p-3">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {s.departureTime}</span>
                          </td>
                          <td className="p-3">{s.arrivalTime || '-'}</td>
                          <td className="p-3 capitalize">{s.busCategory?.replace('_', ' ') || '-'}</td>
                          <td className="p-3 text-xs capitalize">{s.daysOfOperation?.join(', ') || 'Daily'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Counters — click-to-call */}
          {counters.length > 0 && (
            <FadeIn delay={0.25} direction="up">
              <div>
                <h2 className="text-lg font-semibold mb-4">Booking Counters</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {counters.map((c: any, i: number) => (
                    <FadeIn key={c._id} delay={0.1 + i * 0.06} direction="up">
                      <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="border rounded-lg p-4 bg-background">
                        <p className="font-medium mb-1">{c.name}</p>
                        {c.operator?.name && (
                          <p className="text-xs text-muted-foreground mb-1">{c.operator.name}</p>
                        )}
                        {c.location && <p className="text-sm text-muted-foreground">{c.location}</p>}
                        {c.phoneNumbers?.map((phone: string, idx: number) => (
                          <a
                            key={idx}
                            href={`tel:${phone.replace(/\s/g, '')}`}
                            className="text-sm flex items-center gap-1.5 mt-1.5 text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3" /> {phone}
                          </a>
                        ))}
                        {c.bookingLink && (
                          <a
                            href={c.bookingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm flex items-center gap-1.5 mt-2 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Book Online
                          </a>
                        )}
                      </motion.div>
                    </FadeIn>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}

          {filteredRoutes.length === 0 && filteredSchedules.length === 0 && (
            <FadeIn delay={0.2} direction="up">
              <div className="text-center py-12">
                <Bus className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  {search || hasActiveFilters ? 'No results found. Try adjusting your filters.' : 'No bus schedules found'}
                </p>
              </div>
            </FadeIn>
          )}
        </div>
      )}
    </div>
  );
}
