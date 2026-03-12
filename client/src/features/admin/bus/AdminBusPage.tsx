import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { Plus, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react';

const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
const DAY_LABELS: Record<string, string> = { sat: 'Sat', sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };

export default function AdminBusPage() {
  const [tab, setTab] = useState<'operators' | 'routes' | 'schedules' | 'counters' | 'import'>('operators');

  return (
    <FadeIn direction="up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Bus Schedules</h1>

        <div className="flex flex-col sm:flex-row gap-2 mb-6 border-b overflow-x-auto">
          {(['operators', 'routes', 'schedules', 'counters', 'import'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 capitalize whitespace-nowrap ${
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
        {tab === 'import' && <BulkImport />}
      </div>
    </FadeIn>
  );
}

// -- Operators --

function OperatorsList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', contactNumber: '', email: '', description: '', scheduleType: 'both' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => { const { data } = await api.get('/bus/operators'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => editId ? api.patch(`/bus/operators/${editId}`, form) : api.post('/bus/operators', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'operators'] }); resetForm(); toast.success(editId ? 'Operator updated' : 'Operator added'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to save operator'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/operators/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'operators'] }); toast.success('Operator deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete operator'); },
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ name: '', contactNumber: '', email: '', description: '', scheduleType: 'both' }); };

  const startEdit = (o: any) => {
    setEditId(o._id);
    setForm({ name: o.name, contactNumber: o.contactNumber || '', email: o.email || '', description: o.description || '', scheduleType: o.scheduleType || 'both' });
    setShowForm(true);
  };

  const operators = data?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Operator
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 sm:p-6 bg-card mb-4">
              <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); if (!form.name.trim()) { setErrors({ name: 'Operator name is required' }); return; } saveMutation.mutate(); }} className="space-y-3">
                <div>
                  <input placeholder="Operator Name *" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((prev) => { const { name, ...rest } = prev; return rest; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.name ? 'border-red-500' : ''}`} required />
                  <FieldError message={errors.name} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input placeholder="Contact Number" value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select value={form.scheduleType} onChange={(e) => setForm({ ...form, scheduleType: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="university">University</option>
                    <option value="intercity">Intercity</option>
                    <option value="both">Both</option>
                  </select>
                  <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isLoading ? <Spinner /> : (
        <div className="space-y-2">
          {operators.map((o: any, index: number) => (
            <FadeIn key={o._id} direction="up" delay={index * 0.05} duration={0.4}>
              <div
                className="border rounded-lg p-3 bg-card flex items-center justify-between hover:bg-accent/30 transition-colors">
                <div>
                  <p className="font-medium text-sm text-foreground">{o.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{o.scheduleType} · {o.contactNumber || 'N/A'}{o.email ? ` · ${o.email}` : ''}</p>
                </div>
                <div className="flex gap-1">
                  <EditBtn onClick={() => startEdit(o)} />
                  <DeleteBtn onClick={() => deleteMutation.mutate(o._id)} />
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Routes (with operator selector & stops) --

function RoutesList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ operator: '', origin: '', destination: '', routeType: 'university', estimatedDuration: '', distanceKm: '' });
  const [stops, setStops] = useState<Array<{ name: string; order: number }>>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'routes'],
    queryFn: async () => { const { data } = await api.get('/bus/routes'); return data; },
  });

  const { data: operatorsData } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => { const { data } = await api.get('/bus/operators'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
        stops: stops.filter((s) => s.name.trim()),
      };
      return editId ? api.patch(`/bus/routes/${editId}`, payload) : api.post('/bus/routes', payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'routes'] }); resetForm(); toast.success(editId ? 'Route updated' : 'Route added'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to save route'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/routes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'routes'] }); toast.success('Route deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete route'); },
  });

  const resetForm = () => {
    setShowForm(false); setEditId(null);
    setForm({ operator: '', origin: '', destination: '', routeType: 'university', estimatedDuration: '', distanceKm: '' });
    setStops([]);
  };

  const startEdit = (r: any) => {
    setEditId(r._id);
    setForm({
      operator: r.operator?._id || r.operator || '',
      origin: r.origin, destination: r.destination,
      routeType: r.routeType || 'university',
      estimatedDuration: r.estimatedDuration || '',
      distanceKm: r.distanceKm ? String(r.distanceKm) : '',
    });
    setStops(r.stops?.length ? r.stops : []);
    setShowForm(true);
  };

  const addStop = () => setStops([...stops, { name: '', order: stops.length }]);
  const removeStop = (idx: number) => setStops(stops.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  const updateStop = (idx: number, name: string) => setStops(stops.map((s, i) => i === idx ? { ...s, name } : s));

  const routes = data?.data || [];
  const operators = operatorsData?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Route
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 sm:p-6 bg-card mb-4">
              <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.operator) errs.operator = 'Please select an operator'; if (!form.origin.trim()) errs.origin = 'Origin is required'; if (!form.destination.trim()) errs.destination = 'Destination is required'; if (Object.keys(errs).length) { setErrors(errs); return; } saveMutation.mutate(); }} className="space-y-3">
                <div>
                  <select value={form.operator} onChange={(e) => { setForm({ ...form, operator: e.target.value }); setErrors((prev) => { const { operator, ...rest } = prev; return rest; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.operator ? 'border-red-500' : ''}`} required>
                    <option value="">Select Operator *</option>
                    {operators.map((o: any) => <option key={o._id} value={o._id}>{o.name}</option>)}
                  </select>
                  <FieldError message={errors.operator} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input placeholder="Origin *" value={form.origin} onChange={(e) => { setForm({ ...form, origin: e.target.value }); setErrors((prev) => { const { origin, ...rest } = prev; return rest; }); }}
                      className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.origin ? 'border-red-500' : ''}`} required />
                    <FieldError message={errors.origin} />
                  </div>
                  <div>
                    <input placeholder="Destination *" value={form.destination} onChange={(e) => { setForm({ ...form, destination: e.target.value }); setErrors((prev) => { const { destination, ...rest } = prev; return rest; }); }}
                      className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.destination ? 'border-red-500' : ''}`} required />
                    <FieldError message={errors.destination} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select value={form.routeType} onChange={(e) => setForm({ ...form, routeType: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="university">University</option>
                    <option value="intercity">Intercity</option>
                  </select>
                  <input placeholder="Duration (e.g. 5h 30m)" value={form.estimatedDuration} onChange={(e) => setForm({ ...form, estimatedDuration: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  <input placeholder="Distance (km)" type="number" value={form.distanceKm} onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>

                {/* Stops */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Stops</span>
                    <button type="button" onClick={addStop} className="text-xs text-primary hover:underline">+ Add Stop</button>
                  </div>
                  {stops.map((stop, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-muted-foreground w-6">{idx + 1}.</span>
                      <input placeholder={`Stop ${idx + 1}`} value={stop.name} onChange={(e) => updateStop(idx, e.target.value)}
                        className="flex-1 px-3 py-1.5 border rounded-md bg-card text-foreground text-sm" />
                      <button type="button" onClick={() => removeStop(idx)} className="p-1 text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isLoading ? <Spinner /> : (
        <div className="space-y-2">
          {routes.map((r: any, index: number) => (
            <FadeIn key={r._id} direction="up" delay={index * 0.05} duration={0.4}>
              <div
                className="border rounded-lg p-3 bg-card flex items-center justify-between hover:bg-accent/30 transition-colors">
                <div>
                  <p className="font-medium text-sm text-foreground">{r.origin} → {r.destination}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {r.routeType} · {r.operator?.name || 'No operator'} · {r.estimatedDuration || 'N/A'}
                    {r.distanceKm ? ` · ${r.distanceKm}km` : ''}
                    {r.stops?.length ? ` · ${r.stops.length} stops` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <EditBtn onClick={() => startEdit(r)} />
                  <DeleteBtn onClick={() => deleteMutation.mutate(r._id)} />
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Schedules (daysOfOperation array, seasonal variation, no fare) --

function SchedulesList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    route: '', busName: '', busNumber: '', busCategory: 'non_ac',
    departureTime: '', arrivalTime: '', seatType: '',
    isSpecialSchedule: false, specialScheduleNote: '',
  });
  const [selectedDays, setSelectedDays] = useState<string[]>([...DAYS]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'schedules'],
    queryFn: async () => { const { data } = await api.get('/bus/schedules?limit=100'); return data; },
  });

  const { data: routesData } = useQuery({
    queryKey: ['bus', 'routes'],
    queryFn: async () => { const { data } = await api.get('/bus/routes'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, daysOfOperation: selectedDays };
      return editId ? api.patch(`/bus/schedules/${editId}`, payload) : api.post('/bus/schedules', payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'schedules'] }); resetForm(); toast.success(editId ? 'Schedule updated' : 'Schedule added'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to save schedule'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/schedules/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'schedules'] }); toast.success('Schedule deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete schedule'); },
  });

  const resetForm = () => {
    setShowForm(false); setEditId(null);
    setForm({ route: '', busName: '', busNumber: '', busCategory: 'non_ac', departureTime: '', arrivalTime: '', seatType: '', isSpecialSchedule: false, specialScheduleNote: '' });
    setSelectedDays([...DAYS]);
  };

  const startEdit = (s: any) => {
    setEditId(s._id);
    setForm({
      route: s.route?._id || s.route || '',
      busName: s.busName || '',
      busNumber: s.busNumber || '',
      busCategory: s.busCategory || 'non_ac',
      departureTime: s.departureTime || '',
      arrivalTime: s.arrivalTime || '',
      seatType: s.seatType || '',
      isSpecialSchedule: s.isSpecialSchedule || false,
      specialScheduleNote: s.specialScheduleNote || '',
    });
    setSelectedDays(s.daysOfOperation?.length ? s.daysOfOperation : [...DAYS]);
    setShowForm(true);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const schedules = data?.data || [];
  const routes = routesData?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Schedule
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 sm:p-6 bg-card mb-4">
              <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.route) errs.route = 'Please select a route'; if (!form.departureTime.trim()) errs.departureTime = 'Departure time is required'; if (Object.keys(errs).length) { setErrors(errs); return; } saveMutation.mutate(); }} className="space-y-3">
                <div>
                  <select value={form.route} onChange={(e) => { setForm({ ...form, route: e.target.value }); setErrors((prev) => { const { route, ...rest } = prev; return rest; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.route ? 'border-red-500' : ''}`} required>
                    <option value="">Select Route *</option>
                    {routes.map((r: any) => (
                      <option key={r._id} value={r._id}>
                        {r.origin} → {r.destination} ({r.operator?.name || 'N/A'})
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.route} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input placeholder="Bus Name" value={form.busName} onChange={(e) => setForm({ ...form, busName: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  <input placeholder="Bus Number" value={form.busNumber} onChange={(e) => setForm({ ...form, busNumber: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  <select value={form.busCategory} onChange={(e) => setForm({ ...form, busCategory: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="ac">AC</option>
                    <option value="non_ac">Non-AC</option>
                    <option value="sleeper">Sleeper</option>
                    <option value="economy">Economy</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <input placeholder="Departure (e.g. 08:00 AM) *" value={form.departureTime} onChange={(e) => { setForm({ ...form, departureTime: e.target.value }); setErrors((prev) => { const { departureTime, ...rest } = prev; return rest; }); }}
                      className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.departureTime ? 'border-red-500' : ''}`} required />
                    <FieldError message={errors.departureTime} />
                  </div>
                  <input placeholder="Arrival (e.g. 02:00 PM)" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  <input placeholder="Seat Type" value={form.seatType} onChange={(e) => setForm({ ...form, seatType: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>

                {/* Days of Operation */}
                <div>
                  <span className="text-sm font-medium text-foreground mb-1.5 block">Days of Operation</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map((day) => (
                      <button key={day} type="button" onClick={() => toggleDay(day)}
                        className={`px-3 py-1 rounded-md text-xs ${
                          selectedDays.includes(day)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}>
                        {DAY_LABELS[day]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Special schedule */}
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isSpecialSchedule}
                    onChange={(e) => setForm({ ...form, isSpecialSchedule: e.target.checked })}
                    className="rounded" />
                  <span className="text-sm text-foreground">Special/Seasonal Schedule</span>
                </label>
                <AnimatePresence>
                  {form.isSpecialSchedule && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <input placeholder="Note (e.g. Eid special, Winter schedule)" value={form.specialScheduleNote}
                        onChange={(e) => setForm({ ...form, specialScheduleNote: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2">
                  <button
                    type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isLoading ? <Spinner /> : (
        <FadeIn direction="up" duration={0.4}>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="bg-muted border-b">
                <th className="text-left p-3 font-medium text-foreground">Bus</th>
                <th className="text-left p-3 font-medium text-foreground">Route</th>
                <th className="text-left p-3 font-medium text-foreground">Departure</th>
                <th className="text-left p-3 font-medium text-foreground">Arrival</th>
                <th className="text-left p-3 font-medium text-foreground">Category</th>
                <th className="text-left p-3 font-medium text-foreground">Days</th>
                <th className="text-right p-3 font-medium text-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {schedules.map((s: any) => (
                  <tr key={s._id} className="border-t hover:bg-accent/30">
                    <td className="p-3">
                      <p className="font-medium text-foreground">{s.busName || 'N/A'}</p>
                      {s.busNumber && <p className="text-xs text-muted-foreground">{s.busNumber}</p>}
                    </td>
                    <td className="p-3 text-xs text-foreground">
                      {s.route?.origin} → {s.route?.destination}
                    </td>
                    <td className="p-3 text-foreground">{s.departureTime}</td>
                    <td className="p-3 text-foreground">{s.arrivalTime || '-'}</td>
                    <td className="p-3 capitalize text-foreground">{s.busCategory?.replace('_', ' ')}</td>
                    <td className="p-3 capitalize text-xs text-muted-foreground">{s.daysOfOperation?.join(', ') || 'Daily'}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <EditBtn onClick={() => startEdit(s)} />
                        <DeleteBtn onClick={() => deleteMutation.mutate(s._id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

// -- Counters (with operator selector) --

function CountersList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ operator: '', name: '', location: '', phoneNumbers: '', bookingLink: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'counters'],
    queryFn: async () => { const { data } = await api.get('/bus/counters'); return data; },
  });

  const { data: operatorsData } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => { const { data } = await api.get('/bus/operators'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        phoneNumbers: form.phoneNumbers.split(',').map((p) => p.trim()).filter(Boolean),
      };
      return editId ? api.patch(`/bus/counters/${editId}`, payload) : api.post('/bus/counters', payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'counters'] }); resetForm(); toast.success(editId ? 'Counter updated' : 'Counter added'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to save counter'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/counters/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'counters'] }); toast.success('Counter deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete counter'); },
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ operator: '', name: '', location: '', phoneNumbers: '', bookingLink: '' }); };

  const startEdit = (c: any) => {
    setEditId(c._id);
    setForm({
      operator: c.operator?._id || c.operator || '',
      name: c.name,
      location: c.location || '',
      phoneNumbers: (c.phoneNumbers || []).join(', '),
      bookingLink: c.bookingLink || '',
    });
    setShowForm(true);
  };

  const counters = data?.data || [];
  const operators = operatorsData?.data || [];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
          <Plus className="h-4 w-4" /> Add Counter
        </button>
      </div>
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 sm:p-6 bg-card mb-4">
              <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.operator) errs.operator = 'Please select an operator'; if (!form.name.trim()) errs.name = 'Counter name is required'; if (Object.keys(errs).length) { setErrors(errs); return; } saveMutation.mutate(); }} className="space-y-3">
                <div>
                  <select value={form.operator} onChange={(e) => { setForm({ ...form, operator: e.target.value }); setErrors((prev) => { const { operator, ...rest } = prev; return rest; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.operator ? 'border-red-500' : ''}`} required>
                    <option value="">Select Operator *</option>
                    {operators.map((o: any) => <option key={o._id} value={o._id}>{o.name}</option>)}
                  </select>
                  <FieldError message={errors.operator} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input placeholder="Counter Name *" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((prev) => { const { name, ...rest } = prev; return rest; }); }}
                      className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.name ? 'border-red-500' : ''}`} required />
                    <FieldError message={errors.name} />
                  </div>
                  <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <input placeholder="Phone Numbers (comma separated)" value={form.phoneNumbers} onChange={(e) => setForm({ ...form, phoneNumbers: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                <input placeholder="Booking Link (optional)" value={form.bookingLink} onChange={(e) => setForm({ ...form, bookingLink: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                <div className="flex gap-2">
                  <button
                    type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isLoading ? <Spinner /> : (
        <div className="space-y-2">
          {counters.map((c: any, index: number) => (
            <FadeIn key={c._id} direction="up" delay={index * 0.05} duration={0.4}>
              <div
                className="border rounded-lg p-3 bg-card flex items-center justify-between hover:bg-accent/30 transition-colors">
                <div>
                  <p className="font-medium text-sm text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.operator?.name || 'N/A'} · {c.location || 'N/A'}
                    {c.phoneNumbers?.length ? ` · ${c.phoneNumbers.join(', ')}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <EditBtn onClick={() => startEdit(c)} />
                  <DeleteBtn onClick={() => deleteMutation.mutate(c._id)} />
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Bulk Import --

function BulkImport() {
  const toast = useToast();
  const [type, setType] = useState('schedules');
  const [jsonInput, setJsonInput] = useState('');
  const [result, setResult] = useState<any>(null);

  const importMutation = useMutation({
    mutationFn: async () => {
      let data: any[];
      try {
        data = JSON.parse(jsonInput);
        if (!Array.isArray(data)) throw new Error();
      } catch {
        throw new Error('Invalid JSON. Must be an array of objects.');
      }
      const { data: res } = await api.post('/bus/import', { type, data });
      return res;
    },
    onSuccess: (data) => { setResult(data); toast.success('Import completed'); },
    onError: (err: any) => { setResult({ error: err.message }); toast.error(err.message || 'Import failed'); },
  });

  return (
    <FadeIn direction="up">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Bulk Import</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Paste a JSON array of records to import. Each object should match the expected fields for the selected type.
        </p>

        <select value={type} onChange={(e) => setType(e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm mb-3">
          <option value="operators">Operators</option>
          <option value="routes">Routes</option>
          <option value="schedules">Schedules</option>
          <option value="counters">Counters</option>
        </select>

        <textarea
          placeholder={`[\n  { "busName": "Shyamoli Express", "route": "<routeId>", "departureTime": "08:00 AM", "daysOfOperation": ["sat","sun","mon"] }\n]`}
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
        />

        <button
          onClick={() => importMutation.mutate()}
          disabled={!jsonInput.trim() || importMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
        >
          {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Import
        </button>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-4 border rounded-lg bg-card"
            >
              {result.error ? (
                <p className="text-sm text-destructive">{result.error}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">{result.data?.created}/{result.data?.total} records imported</p>
                  {result.data?.errors?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {result.data.errors.map((err: any, i: number) => (
                        <p key={i} className="text-xs text-destructive">Row {err.row}: {err.error}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
}

// -- Shared Components --

function Spinner() {
  return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="p-1.5 hover:bg-accent rounded"><Pencil className="h-3.5 w-3.5" /></button>
  );
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/30 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
  );
}
