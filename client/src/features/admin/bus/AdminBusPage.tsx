import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Loader2 } from 'lucide-react';

export default function AdminBusPage() {
  const [tab, setTab] = useState<'operators' | 'routes' | 'schedules' | 'counters'>('operators');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Bus Schedules</h1>

      <div className="flex gap-2 mb-6 border-b">
        {(['operators', 'routes', 'schedules', 'counters'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'operators' && <OperatorsList />}
      {tab === 'routes' && <RoutesList />}
      {tab === 'schedules' && <SchedulesList />}
      {tab === 'counters' && <CountersList />}
    </div>
  );
}

function OperatorsList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', contactNumber: '', scheduleType: 'both' });

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => { const { data } = await api.get('/bus/operators'); return data; },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/bus/operators', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'operators'] }); setShowForm(false); },
  });

  const operators = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Operator
        </button>
      </div>
      {showForm && (
        <div className="border rounded-lg p-4 bg-background mb-4">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
            <input placeholder="Operator Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm" required />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Contact Number" value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm" />
              <select value={form.scheduleType} onChange={(e) => setForm({ ...form, scheduleType: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm">
                <option value="university">University</option>
                <option value="intercity">Intercity</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">Add</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-2">
          {operators.map((o: any) => (
            <div key={o._id} className="border rounded-lg p-3 bg-background flex items-center justify-between">
              <div><p className="font-medium text-sm">{o.name}</p><p className="text-xs text-muted-foreground capitalize">{o.scheduleType} · {o.contactNumber || 'N/A'}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoutesList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ origin: '', destination: '', routeType: 'university', estimatedDuration: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'routes'],
    queryFn: async () => { const { data } = await api.get('/bus/routes'); return data; },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/bus/routes', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'routes'] }); setShowForm(false); },
  });

  const routes = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Route
        </button>
      </div>
      {showForm && (
        <div className="border rounded-lg p-4 bg-background mb-4">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Origin" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm" required />
              <input placeholder="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={form.routeType} onChange={(e) => setForm({ ...form, routeType: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm">
                <option value="university">University</option>
                <option value="intercity">Intercity</option>
              </select>
              <input placeholder="Duration (e.g. 5h 30m)" value={form.estimatedDuration} onChange={(e) => setForm({ ...form, estimatedDuration: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">Add</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-2">
          {routes.map((r: any) => (
            <div key={r._id} className="border rounded-lg p-3 bg-background">
              <p className="font-medium text-sm">{r.origin} → {r.destination}</p>
              <p className="text-xs text-muted-foreground capitalize">{r.routeType} · {r.estimatedDuration || 'N/A'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SchedulesList() {
  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'schedules'],
    queryFn: async () => { const { data } = await api.get('/bus/schedules?limit=50'); return data; },
  });

  const schedules = data?.data || [];

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead><tr className="bg-muted/50 border-b">
          <th className="text-left p-3 font-medium">Bus</th>
          <th className="text-left p-3 font-medium">Departure</th>
          <th className="text-left p-3 font-medium">Arrival</th>
          <th className="text-left p-3 font-medium">Category</th>
          <th className="text-left p-3 font-medium">Fare</th>
        </tr></thead>
        <tbody>
          {schedules.map((s: any) => (
            <tr key={s._id} className="border-t">
              <td className="p-3">{s.busName || 'N/A'}</td>
              <td className="p-3">{s.departureTime}</td>
              <td className="p-3">{s.arrivalTime || '-'}</td>
              <td className="p-3 capitalize">{s.busCategory?.replace('_', ' ')}</td>
              <td className="p-3">{s.fare ? `৳${s.fare}` : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CountersList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', phoneNumbers: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'counters'],
    queryFn: async () => { const { data } = await api.get('/bus/counters'); return data; },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/bus/counters', {
      ...form, phoneNumbers: form.phoneNumbers.split(',').map((p) => p.trim()).filter(Boolean),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'counters'] }); setShowForm(false); },
  });

  const counters = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Counter
        </button>
      </div>
      {showForm && (
        <div className="border rounded-lg p-4 bg-background mb-4">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
            <input placeholder="Counter Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm" required />
            <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm" />
            <input placeholder="Phone Numbers (comma separated)" value={form.phoneNumbers} onChange={(e) => setForm({ ...form, phoneNumbers: e.target.value })}
              className="w-full px-3 py-2 border rounded-md text-sm" />
            <div className="flex gap-2">
              <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">Add</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-2">
          {counters.map((c: any) => (
            <div key={c._id} className="border rounded-lg p-3 bg-background">
              <p className="font-medium text-sm">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.location}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
