import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';

export default function AdminBusPage() {
  const [tab, setTab] = useState<'operators' | 'routes' | 'schedules' | 'counters'>('operators');

  return (
    <FadeIn direction="up">
      <div>
        <h1 className="text-2xl font-bold mb-6">Bus Schedules</h1>

        <div className="flex gap-2 mb-6 border-b">
          {(['operators', 'routes', 'schedules', 'counters'] as const).map((t) => (
            <motion.button
              key={t}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t}
            </motion.button>
          ))}
        </div>

        {tab === 'operators' && <OperatorsList />}
        {tab === 'routes' && <RoutesList />}
        {tab === 'schedules' && <SchedulesList />}
        {tab === 'counters' && <CountersList />}
      </div>
    </FadeIn>
  );
}

function OperatorsList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', contactNumber: '', scheduleType: 'both' });

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => { const { data } = await api.get('/bus/operators'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => editId ? api.patch(`/bus/operators/${editId}`, form) : api.post('/bus/operators', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'operators'] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/operators/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bus', 'operators'] }),
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ name: '', contactNumber: '', scheduleType: 'both' }); };

  const startEdit = (o: any) => {
    setEditId(o._id);
    setForm({ name: o.name, contactNumber: o.contactNumber || '', scheduleType: o.scheduleType || 'both' });
    setShowForm(true);
  };

  const operators = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Operator
        </motion.button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 bg-background mb-4">
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
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
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
                  </motion.button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-2">
          {operators.map((o: any, index: number) => (
            <FadeIn key={o._id} direction="up" delay={index * 0.05} duration={0.4}>
              <motion.div whileHover={{ scale: 1.01, backgroundColor: 'var(--accent)' }} transition={{ duration: 0.2 }}
                className="border rounded-lg p-3 bg-background flex items-center justify-between">
                <div><p className="font-medium text-sm">{o.name}</p><p className="text-xs text-muted-foreground capitalize">{o.scheduleType} · {o.contactNumber || 'N/A'}</p></div>
                <div className="flex gap-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(o)} className="p-1.5 hover:bg-accent rounded"><Pencil className="h-3.5 w-3.5" /></motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteMutation.mutate(o._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"><Trash2 className="h-3.5 w-3.5" /></motion.button>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

function RoutesList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ origin: '', destination: '', routeType: 'university', estimatedDuration: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'routes'],
    queryFn: async () => { const { data } = await api.get('/bus/routes'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => editId ? api.patch(`/bus/routes/${editId}`, form) : api.post('/bus/routes', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'routes'] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/routes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bus', 'routes'] }),
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ origin: '', destination: '', routeType: 'university', estimatedDuration: '' }); };

  const startEdit = (r: any) => {
    setEditId(r._id);
    setForm({ origin: r.origin, destination: r.destination, routeType: r.routeType || 'university', estimatedDuration: r.estimatedDuration || '' });
    setShowForm(true);
  };

  const routes = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Route
        </motion.button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 bg-background mb-4">
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
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
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
                  </motion.button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-2">
          {routes.map((r: any, index: number) => (
            <FadeIn key={r._id} direction="up" delay={index * 0.05} duration={0.4}>
              <motion.div whileHover={{ scale: 1.01, backgroundColor: 'var(--accent)' }} transition={{ duration: 0.2 }}
                className="border rounded-lg p-3 bg-background flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-muted-foreground capitalize">{r.routeType} · {r.estimatedDuration || 'N/A'}</p>
                </div>
                <div className="flex gap-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(r)} className="p-1.5 hover:bg-accent rounded"><Pencil className="h-3.5 w-3.5" /></motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteMutation.mutate(r._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"><Trash2 className="h-3.5 w-3.5" /></motion.button>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

function SchedulesList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    operator: '', route: '', busName: '', busCategory: 'ac', departureTime: '', arrivalTime: '', fare: '', daysOfWeek: 'everyday',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'schedules'],
    queryFn: async () => { const { data } = await api.get('/bus/schedules?limit=50'); return data; },
  });

  const { data: operatorsData } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => { const { data } = await api.get('/bus/operators'); return data; },
  });

  const { data: routesData } = useQuery({
    queryKey: ['bus', 'routes'],
    queryFn: async () => { const { data } = await api.get('/bus/routes'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: any = { ...form, fare: form.fare ? Number(form.fare) : undefined };
      return editId ? api.patch(`/bus/schedules/${editId}`, payload) : api.post('/bus/schedules', payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'schedules'] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/schedules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bus', 'schedules'] }),
  });

  const resetForm = () => {
    setShowForm(false); setEditId(null);
    setForm({ operator: '', route: '', busName: '', busCategory: 'ac', departureTime: '', arrivalTime: '', fare: '', daysOfWeek: 'everyday' });
  };

  const startEdit = (s: any) => {
    setEditId(s._id);
    setForm({
      operator: s.operator?._id || s.operator || '',
      route: s.route?._id || s.route || '',
      busName: s.busName || '',
      busCategory: s.busCategory || 'ac',
      departureTime: s.departureTime || '',
      arrivalTime: s.arrivalTime || '',
      fare: s.fare ? String(s.fare) : '',
      daysOfWeek: s.daysOfWeek || 'everyday',
    });
    setShowForm(true);
  };

  const schedules = data?.data || [];
  const operators = operatorsData?.data || [];
  const routes = routesData?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Schedule
        </motion.button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 bg-background mb-4">
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm" required>
                    <option value="">Select Operator</option>
                    {operators.map((o: any) => <option key={o._id} value={o._id}>{o.name}</option>)}
                  </select>
                  <select value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm" required>
                    <option value="">Select Route</option>
                    {routes.map((r: any) => <option key={r._id} value={r._id}>{r.origin} → {r.destination}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input placeholder="Bus Name" value={form.busName} onChange={(e) => setForm({ ...form, busName: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm" />
                  <select value={form.busCategory} onChange={(e) => setForm({ ...form, busCategory: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm">
                    <option value="ac">AC</option>
                    <option value="non_ac">Non-AC</option>
                    <option value="sleeper">Sleeper</option>
                  </select>
                  <input placeholder="Fare (৳)" type="number" value={form.fare} onChange={(e) => setForm({ ...form, fare: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input placeholder="Departure (e.g. 08:00 AM)" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm" required />
                  <input placeholder="Arrival (e.g. 02:00 PM)" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm" />
                  <select value={form.daysOfWeek} onChange={(e) => setForm({ ...form, daysOfWeek: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm">
                    <option value="everyday">Everyday</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekends">Weekends</option>
                    <option value="fri_sat">Fri & Sat</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
                  </motion.button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <FadeIn direction="up" duration={0.4}>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-medium">Bus</th>
                <th className="text-left p-3 font-medium">Departure</th>
                <th className="text-left p-3 font-medium">Arrival</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">Fare</th>
                <th className="text-left p-3 font-medium">Days</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {schedules.map((s: any) => (
                  <motion.tr key={s._id} whileHover={{ backgroundColor: 'var(--accent)' }} transition={{ duration: 0.2 }} className="border-t">
                    <td className="p-3">{s.busName || 'N/A'}</td>
                    <td className="p-3">{s.departureTime}</td>
                    <td className="p-3">{s.arrivalTime || '-'}</td>
                    <td className="p-3 capitalize">{s.busCategory?.replace('_', ' ')}</td>
                    <td className="p-3">{s.fare ? `৳${s.fare}` : '-'}</td>
                    <td className="p-3 capitalize text-xs">{s.daysOfWeek?.replace('_', ' ') || '-'}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(s)} className="p-1.5 hover:bg-accent rounded"><Pencil className="h-3.5 w-3.5" /></motion.button>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteMutation.mutate(s._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"><Trash2 className="h-3.5 w-3.5" /></motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function CountersList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', location: '', phoneNumbers: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'counters'],
    queryFn: async () => { const { data } = await api.get('/bus/counters'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, phoneNumbers: form.phoneNumbers.split(',').map((p) => p.trim()).filter(Boolean) };
      return editId ? api.patch(`/bus/counters/${editId}`, payload) : api.post('/bus/counters', payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'counters'] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/counters/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bus', 'counters'] }),
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ name: '', location: '', phoneNumbers: '' }); };

  const startEdit = (c: any) => {
    setEditId(c._id);
    setForm({ name: c.name, location: c.location || '', phoneNumbers: (c.phoneNumbers || []).join(', ') });
    setShowForm(true);
  };

  const counters = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Counter
        </motion.button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 bg-background mb-4">
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
                <input placeholder="Counter Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm" required />
                <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm" />
                <input placeholder="Phone Numbers (comma separated)" value={form.phoneNumbers} onChange={(e) => setForm({ ...form, phoneNumbers: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm" />
                <div className="flex gap-2">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
                  </motion.button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-2">
          {counters.map((c: any, index: number) => (
            <FadeIn key={c._id} direction="up" delay={index * 0.05} duration={0.4}>
              <motion.div whileHover={{ scale: 1.01, backgroundColor: 'var(--accent)' }} transition={{ duration: 0.2 }}
                className="border rounded-lg p-3 bg-background flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.location}{c.phoneNumbers?.length ? ` · ${c.phoneNumbers.join(', ')}` : ''}</p>
                </div>
                <div className="flex gap-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => startEdit(c)} className="p-1.5 hover:bg-accent rounded"><Pencil className="h-3.5 w-3.5" /></motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => deleteMutation.mutate(c._id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"><Trash2 className="h-3.5 w-3.5" /></motion.button>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
