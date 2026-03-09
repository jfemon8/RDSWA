import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Bus, Search, Loader2, Clock, MapPin, Phone } from 'lucide-react';

export default function BusSchedulePage() {
  const [routeType, setRouteType] = useState('university');
  const [search, setSearch] = useState('');

  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['bus', 'routes', routeType],
    queryFn: async () => {
      const { data } = await api.get(`/bus/routes?routeType=${routeType}`);
      return data;
    },
  });

  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['bus', 'schedules', routeType, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      const { data } = await api.get(`/bus/schedules?${params}`);
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

  const routes = routesData?.data || [];
  const schedules = schedulesData?.data || [];
  const counters = countersData?.data || [];
  const isLoading = routesLoading || schedulesLoading;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Bus Schedules</h1>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setRouteType('university')}
          className={`px-4 py-2 text-sm rounded-md border ${routeType === 'university' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
          University Bus
        </button>
        <button onClick={() => setRouteType('intercity')}
          className={`px-4 py-2 text-sm rounded-md border ${routeType === 'intercity' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'}`}>
          Inter-city Bus
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by destination..."
          className="w-full pl-10 pr-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-8">
          {/* Routes */}
          {routes.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Routes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {routes.map((r: any) => (
                  <div key={r._id} className="border rounded-lg p-4 bg-background">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium">{r.origin} → {r.destination}</span>
                    </div>
                    {r.estimatedDuration && <p className="text-sm text-muted-foreground">Duration: {r.estimatedDuration}</p>}
                    {r.distanceKm && <p className="text-sm text-muted-foreground">Distance: {r.distanceKm} km</p>}
                    {r.stops?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">Stops: {r.stops.map((s: any) => s.name).join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedules */}
          {schedules.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Schedules</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-3 font-medium">Bus</th>
                      <th className="text-left p-3 font-medium">Departure</th>
                      <th className="text-left p-3 font-medium">Arrival</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-left p-3 font-medium">Fare</th>
                      <th className="text-left p-3 font-medium">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((s: any) => (
                      <tr key={s._id} className="border-t hover:bg-accent/50">
                        <td className="p-3">
                          <p className="font-medium">{s.busName || 'N/A'}</p>
                          {s.busNumber && <p className="text-xs text-muted-foreground">{s.busNumber}</p>}
                        </td>
                        <td className="p-3 flex items-center gap-1"><Clock className="h-3 w-3" /> {s.departureTime}</td>
                        <td className="p-3">{s.arrivalTime || '-'}</td>
                        <td className="p-3 capitalize">{s.busCategory?.replace('_', ' ') || '-'}</td>
                        <td className="p-3">{s.fare ? `৳${s.fare}` : '-'}</td>
                        <td className="p-3 text-xs capitalize">{s.daysOfOperation?.join(', ') || 'Daily'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Counters */}
          {counters.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Booking Counters</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {counters.map((c: any) => (
                  <div key={c._id} className="border rounded-lg p-4 bg-background">
                    <p className="font-medium mb-1">{c.name}</p>
                    {c.location && <p className="text-sm text-muted-foreground">{c.location}</p>}
                    {c.phoneNumbers?.map((p: string, i: number) => (
                      <p key={i} className="text-sm flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" /> {p}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {routes.length === 0 && schedules.length === 0 && (
            <div className="text-center py-12">
              <Bus className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No bus schedules found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
