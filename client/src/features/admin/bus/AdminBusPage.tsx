import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import RichTextEditor from '@/components/ui/RichTextEditor';
import RichContent from '@/components/ui/RichContent';
import { Plus, Loader2, Pencil, Trash2, Upload, X, Download, FileText, Star, ChevronDown } from 'lucide-react';
import { downloadTablePdf } from '@/lib/downloadPdf';
import { toDateInput, formatTimeString } from '@/lib/date';

const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
const DAY_LABELS: Record<string, string> = { sat: 'Sat', sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };

function ExportButtons({ type, label }: { type: string; label: string }) {
  const toast = useToast();
  return (
    <div className="flex gap-1.5">
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={async () => {
          try {
            const { data } = await api.get(`/bus/export/${type}?format=csv`, { responseType: 'text' });
            const blob = new Blob([data], { type: 'text/csv; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `bus-${type}.csv`; a.click();
            URL.revokeObjectURL(url);
            toast.success('CSV downloaded');
          } catch { toast.error('Export failed'); }
        }}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-md hover:bg-accent">
        <Download className="h-3 w-3" /> CSV
      </motion.button>
      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={async () => {
          try {
            const { data } = await api.get(`/bus/export/${type}?format=csv`, { responseType: 'text' });
            await downloadTablePdf(data, `Bus ${label}`, `bus-${type}`);
            toast.success('PDF downloaded');
          } catch { toast.error('Export failed'); }
        }}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-md hover:bg-accent">
        <FileText className="h-3 w-3" /> PDF
      </motion.button>
    </div>
  );
}

export default function AdminBusPage() {
  const [tab, setTab] = useState<'operators' | 'routes' | 'schedules' | 'counters' | 'import'>('operators');

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
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

// -- Operators (with website, richText description, computed rating from reviews) --

function OperatorsList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', contactNumber: '', email: '', website: '', description: '', scheduleType: 'both' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => { const { data } = await api.get('/bus/operators'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => editId ? api.patch(`/bus/operators/${editId}`, form) : api.post('/bus/operators', form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'operators'] }); resetForm(); toast.success(editId ? 'Operator updated' : 'Operator added'); },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to save operator'); } },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/operators/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'operators'] }); toast.success('Operator deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete operator'); },
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ name: '', contactNumber: '', email: '', website: '', description: '', scheduleType: 'both' }); };

  const startEdit = (o: any) => {
    setEditId(o._id);
    setForm({ name: o.name, contactNumber: o.contactNumber || '', email: o.email || '', website: o.website || '', description: o.description || '', scheduleType: o.scheduleType || 'both' });
    setShowForm(true);
  };

  const operators = data?.data || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <ExportButtons type="operators" label="Operators" />
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
                  <input placeholder="Website (optional, https://...)" type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                  <RichTextEditor value={form.description} onChange={(html) => setForm({ ...form, description: html })} placeholder="Write about this operator..." minHeight="100px" />
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
              <div className="border rounded-lg bg-card hover:bg-accent/30 transition-colors">
                <div className="flex items-center justify-between gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === o._id ? null : o._id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <motion.span animate={{ rotate: expandedId === o._id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </motion.span>
                    <p className="font-medium text-sm text-foreground truncate">{o.name}</p>
                    <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                      <Star className="h-3 w-3 fill-current" />
                      {o.rating?.toFixed(1) || '0.0'}
                      <span className="text-muted-foreground">({o.ratingCount || 0})</span>
                    </span>
                  </div>
                  <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <EditBtn onClick={() => startEdit(o)} />
                    <DeleteBtn onClick={() => deleteMutation.mutate(o._id)} />
                  </div>
                </div>
                <AnimatePresence>
                  {expandedId === o._id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-3 pt-0 border-t mx-3 mb-3 space-y-2 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                          <div><span className="text-muted-foreground">Type:</span> <span className="capitalize text-foreground">{o.scheduleType}</span></div>
                          <div><span className="text-muted-foreground">Contact:</span> <span className="text-foreground">{o.contactNumber || 'N/A'}</span></div>
                          {o.email && <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{o.email}</span></div>}
                          {o.website && <div><span className="text-muted-foreground">Website:</span> <a href={o.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{o.website.replace(/^https?:\/\//, '')}</a></div>}
                        </div>
                        {o.description && (
                          <div className="pt-2 border-t">
                            <span className="text-muted-foreground block mb-1">Description:</span>
                            <RichContent html={o.description} className="text-foreground prose-sm max-w-none" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Routes (NO operator — routes are operator-agnostic) --

function RoutesList() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ origin: '', destination: '', routeType: 'university', estimatedDuration: '', distanceKm: '' });
  const [stops, setStops] = useState<Array<{ name: string; order: number }>>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'routes'],
    queryFn: async () => { const { data } = await api.get('/bus/routes'); return data; },
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
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to save route'); } },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/routes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'routes'] }); toast.success('Route deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete route'); },
  });

  const resetForm = () => {
    setShowForm(false); setEditId(null);
    setForm({ origin: '', destination: '', routeType: 'university', estimatedDuration: '', distanceKm: '' });
    setStops([]);
  };

  const startEdit = (r: any) => {
    setEditId(r._id);
    setForm({
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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <ExportButtons type="routes" label="Routes" />
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
              <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.origin.trim()) errs.origin = 'Origin is required'; if (!form.destination.trim()) errs.destination = 'Destination is required'; if (Object.keys(errs).length) { setErrors(errs); return; } saveMutation.mutate(); }} className="space-y-3">
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
              <div className="border rounded-lg bg-card hover:bg-accent/30 transition-colors">
                <div className="flex items-center justify-between gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === r._id ? null : r._id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <motion.span animate={{ rotate: expandedId === r._id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </motion.span>
                    <p className="font-medium text-sm text-foreground truncate">{r.origin} → {r.destination}</p>
                    <span className="text-xs capitalize text-muted-foreground shrink-0">{r.routeType}</span>
                  </div>
                  <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <EditBtn onClick={() => startEdit(r)} />
                    <DeleteBtn onClick={() => deleteMutation.mutate(r._id)} />
                  </div>
                </div>
                <AnimatePresence>
                  {expandedId === r._id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-3 pt-0 border-t mx-3 mb-3 space-y-2 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                          <div><span className="text-muted-foreground">Type:</span> <span className="capitalize text-foreground">{r.routeType}</span></div>
                          {r.estimatedDuration && <div><span className="text-muted-foreground">Duration:</span> <span className="text-foreground">{r.estimatedDuration}</span></div>}
                          {r.distanceKm && <div><span className="text-muted-foreground">Distance:</span> <span className="text-foreground">{r.distanceKm} km</span></div>}
                        </div>
                        {r.stops?.length > 0 && (
                          <div className="pt-2 border-t">
                            <span className="text-muted-foreground block mb-1">Stops ({r.stops.length}):</span>
                            <div className="flex flex-wrap gap-1">
                              {r.stops.sort((a: any, b: any) => a.order - b.order).map((s: any, si: number) => (
                                <span key={si} className="inline-flex items-center text-foreground">
                                  {si > 0 && <span className="mx-1 text-muted-foreground/50">→</span>}
                                  <span className="px-1.5 py-0.5 bg-muted rounded">{s.name}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Schedules (two-level: select route first, then CRUD schedules for that route) --

interface ScheduleBus { operator: string; busName: string; busCategory: string }

function SchedulesList() {
  const [selectedRoute, setSelectedRoute] = useState<any>(null);

  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['bus', 'routes'],
    queryFn: async () => { const { data } = await api.get('/bus/routes'); return data; },
  });

  const routes = routesData?.data || [];

  if (selectedRoute) {
    return <RouteSchedules route={selectedRoute} onBack={() => setSelectedRoute(null)} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <ExportButtons type="schedules" label="Schedules" />
        <p className="text-sm text-muted-foreground">Select a route to manage schedules</p>
      </div>
      {routesLoading ? <Spinner /> : routes.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No routes found. Add routes first.</p>
      ) : (
        <div className="space-y-2">
          {routes.map((r: any, index: number) => (
            <FadeIn key={r._id} direction="up" delay={index * 0.05} duration={0.4}>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedRoute(r)}
                className="w-full text-left border rounded-lg p-3 bg-card hover:border-primary/40 transition-colors"
              >
                <p className="font-medium text-sm text-foreground">{r.origin} → {r.destination}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {r.routeType}{r.estimatedDuration ? ` · ${r.estimatedDuration}` : ''}
                  {r.distanceKm ? ` · ${r.distanceKm}km` : ''}
                  {r.stops?.length ? ` · ${r.stops.length} stops` : ''}
                </p>
              </motion.button>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteSchedules({ route, onBack }: { route: any; onBack: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    departureTime: '', arrivalTime: '',
    isSpecialSchedule: false, specialScheduleNote: '',
    seasonalSeason: '', seasonalStartDate: '', seasonalEndDate: '',
    seasonalDepartureTime: '', seasonalArrivalTime: '', seasonalNote: '',
  });
  const emptyBus = (): ScheduleBus => ({ operator: '', busName: '', busCategory: 'non_ac' });
  const [buses, setBuses] = useState<ScheduleBus[]>([emptyBus()]);
  const [selectedDays, setSelectedDays] = useState<string[]>([...DAYS]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'schedules', 'route', route._id],
    queryFn: async () => { const { data } = await api.get(`/bus/schedules?route=${route._id}&limit=100`); return data; },
  });

  const { data: operatorsData } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => { const { data } = await api.get('/bus/operators'); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const { seasonalSeason, seasonalStartDate, seasonalEndDate, seasonalDepartureTime, seasonalArrivalTime, seasonalNote, ...rest } = form;
      const payload: any = { ...rest, route: route._id, daysOfOperation: selectedDays, buses: buses.filter((b) => b.operator) };
      if (seasonalSeason) {
        payload.seasonalVariation = {
          season: seasonalSeason,
          startDate: seasonalStartDate || undefined,
          endDate: seasonalEndDate || undefined,
          adjustedDepartureTime: seasonalDepartureTime || undefined,
          adjustedArrivalTime: seasonalArrivalTime || undefined,
          note: seasonalNote || undefined,
        };
      }
      return editId ? api.patch(`/bus/schedules/${editId}`, payload) : api.post('/bus/schedules', payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'schedules'] }); resetForm(); toast.success(editId ? 'Schedule updated' : 'Schedule added'); },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to save schedule'); } },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/schedules/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'schedules'] }); toast.success('Schedule deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete schedule'); },
  });

  const resetForm = () => {
    setShowForm(false); setEditId(null);
    setForm({ departureTime: '', arrivalTime: '', isSpecialSchedule: false, specialScheduleNote: '', seasonalSeason: '', seasonalStartDate: '', seasonalEndDate: '', seasonalDepartureTime: '', seasonalArrivalTime: '', seasonalNote: '' });
    setBuses([emptyBus()]);
    setSelectedDays([...DAYS]);
  };

  const startEdit = (s: any) => {
    setEditId(s._id);
    setForm({
      departureTime: s.departureTime || '',
      arrivalTime: s.arrivalTime || '',
      isSpecialSchedule: s.isSpecialSchedule || false,
      specialScheduleNote: s.specialScheduleNote || '',
      seasonalSeason: s.seasonalVariation?.season || '',
      seasonalStartDate: s.seasonalVariation?.startDate ? toDateInput(s.seasonalVariation.startDate) : '',
      seasonalEndDate: s.seasonalVariation?.endDate ? toDateInput(s.seasonalVariation.endDate) : '',
      seasonalDepartureTime: s.seasonalVariation?.adjustedDepartureTime || '',
      seasonalArrivalTime: s.seasonalVariation?.adjustedArrivalTime || '',
      seasonalNote: s.seasonalVariation?.note || '',
    });
    setBuses((s.buses || []).length ? s.buses.map((b: any) => ({
      operator: b.operator?._id || b.operator || '',
      busName: b.busName || '',
      busCategory: b.busCategory || 'non_ac',
    })) : [emptyBus()]);
    setSelectedDays(s.daysOfOperation?.length ? s.daysOfOperation : [...DAYS]);
    setShowForm(true);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  const updateBus = (idx: number, field: keyof ScheduleBus, value: string) => {
    setBuses(buses.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };
  const addBus = () => setBuses([...buses, emptyBus()]);
  const removeBus = (idx: number) => setBuses(buses.length > 1 ? buses.filter((_, i) => i !== idx) : buses);

  const schedules = data?.data || [];
  const operators = operatorsData?.data || [];

  return (
    <div>
      {/* Route header + back */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{route.origin} → {route.destination}</p>
          <p className="text-xs text-muted-foreground capitalize">{route.routeType}{route.estimatedDuration ? ` · ${route.estimatedDuration}` : ''}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm shrink-0">
          <Plus className="h-4 w-4" /> Add Schedule
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 sm:p-6 bg-card mb-4">
              <form noValidate onSubmit={(e) => {
                e.preventDefault(); setErrors({});
                const errs: Record<string, string> = {};
                if (!form.departureTime.trim()) errs.departureTime = 'Departure time is required';
                const validBuses = buses.filter((b) => b.operator);
                if (validBuses.length === 0) errs.buses = 'At least one bus with an operator is required';
                if (Object.keys(errs).length) { setErrors(errs); return; }
                saveMutation.mutate();
              }} className="space-y-4">
                {/* Common fields */}
                <div className="space-y-3 border-b pb-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Schedule Details</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Departure Time *</label>
                      <input type="time" value={form.departureTime} onChange={(e) => { setForm({ ...form, departureTime: e.target.value }); setErrors((prev) => { const { departureTime, ...rest } = prev; return rest; }); }}
                        className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.departureTime ? 'border-red-500' : ''}`} required />
                      <FieldError message={errors.departureTime} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Arrival Time</label>
                      <input type="time" value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">Days of Operation</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {DAYS.map((day) => (
                        <button key={day} type="button" onClick={() => toggleDay(day)}
                          className={`px-3 py-1 rounded-md text-xs ${selectedDays.includes(day) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                          {DAY_LABELS[day]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Buses array */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Buses on this schedule</span>
                    <button type="button" onClick={addBus} className="text-xs text-primary hover:underline">+ Add Bus</button>
                  </div>
                  <AnimatePresence initial={false}>
                    {buses.map((bus, idx) => (
                      <motion.div key={idx} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                        className="border rounded-md p-3 bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">Bus #{idx + 1}</span>
                          {buses.length > 1 && (
                            <button type="button" onClick={() => removeBus(idx)} className="p-1 text-muted-foreground hover:text-destructive">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select value={bus.operator} onChange={(e) => updateBus(idx, 'operator', e.target.value)}
                            className="px-3 py-1.5 border rounded-md bg-card text-foreground text-sm" required>
                            <option value="">Select Operator *</option>
                            {operators.map((o: any) => <option key={o._id} value={o._id}>{o.name}</option>)}
                          </select>
                          <select value={bus.busCategory} onChange={(e) => updateBus(idx, 'busCategory', e.target.value)}
                            className="px-3 py-1.5 border rounded-md bg-card text-foreground text-sm">
                            <option value="ac">AC</option>
                            <option value="non_ac">Non-AC</option>
                            <option value="sleeper">Sleeper</option>
                            <option value="economy">Economy</option>
                          </select>
                        </div>
                        <input placeholder="Bus Name" value={bus.busName} onChange={(e) => updateBus(idx, 'busName', e.target.value)}
                          className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <FieldError message={errors.buses} />
                </div>

                {/* Special schedule */}
                <div className="flex items-center gap-2">
                  <input id="isSpecialSchedule" type="checkbox" checked={form.isSpecialSchedule}
                    onChange={(e) => setForm({ ...form, isSpecialSchedule: e.target.checked })}
                    className="rounded cursor-pointer" />
                  <span className="text-sm text-foreground">Special/Seasonal Schedule</span>
                </div>
                <AnimatePresence>
                  {form.isSpecialSchedule && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                      <input placeholder="Note (e.g. Eid special, Winter schedule)" value={form.specialScheduleNote}
                        onChange={(e) => setForm({ ...form, specialScheduleNote: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                      <div className="border rounded-md p-3 bg-muted/30 space-y-3">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Seasonal Variation</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Season</label>
                            <select value={form.seasonalSeason} onChange={(e) => setForm({ ...form, seasonalSeason: e.target.value })}
                              className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm">
                              <option value="">None</option>
                              <option value="summer">Summer</option>
                              <option value="winter">Winter</option>
                              <option value="rainy">Rainy</option>
                              <option value="eid">Eid</option>
                              <option value="puja">Puja</option>
                              <option value="exam">Exam Period</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                            <input type="date" value={form.seasonalStartDate} onChange={(e) => setForm({ ...form, seasonalStartDate: e.target.value })}
                              className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                            <input type="date" value={form.seasonalEndDate} onChange={(e) => setForm({ ...form, seasonalEndDate: e.target.value })}
                              className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Adjusted Departure</label>
                            <input type="time" value={form.seasonalDepartureTime} onChange={(e) => setForm({ ...form, seasonalDepartureTime: e.target.value })}
                              className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Adjusted Arrival</label>
                            <input type="time" value={form.seasonalArrivalTime} onChange={(e) => setForm({ ...form, seasonalArrivalTime: e.target.value })}
                              className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm" />
                          </div>
                        </div>
                        <input placeholder="Seasonal note (optional)" value={form.seasonalNote} onChange={(e) => setForm({ ...form, seasonalNote: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm" />
                      </div>
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
      {isLoading ? <Spinner /> : schedules.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No schedules for this route yet.</p>
      ) : (
        <FadeIn direction="up" duration={0.4}>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full min-w-[600px] text-sm">
              <thead><tr className="bg-muted border-b">
                <th className="text-left p-3 font-medium text-foreground">Departure</th>
                <th className="text-left p-3 font-medium text-foreground">Arrival</th>
                <th className="text-left p-3 font-medium text-foreground">Buses</th>
                <th className="text-left p-3 font-medium text-foreground">Days</th>
                <th className="text-right p-3 font-medium text-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {schedules.map((s: any) => (
                  <tr key={s._id} className="border-t hover:bg-accent/30">
                    <td className="p-3 text-foreground">{formatTimeString(s.departureTime)}</td>
                    <td className="p-3 text-foreground">{s.arrivalTime ? formatTimeString(s.arrivalTime) : '-'}</td>
                    <td className="p-3 text-xs text-foreground">
                      {(s.buses || []).map((b: any, i: number) => (
                        <div key={i} className="py-0.5">
                          <span className="font-medium">{b.busName || 'N/A'}</span>
                          <span className="text-muted-foreground"> · {b.operator?.name || 'N/A'}</span>
                          <span className="capitalize text-muted-foreground"> · {b.busCategory?.replace('_', ' ')}</span>
                        </div>
                      ))}
                      {!s.buses?.length && <span className="text-muted-foreground">No buses</span>}
                    </td>
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

// -- Counters (two-level: select operator first, then CRUD counters for that operator) --

function CountersList() {
  const [selectedOperator, setSelectedOperator] = useState<any>(null);

  const { data: operatorsData, isLoading: operatorsLoading } = useQuery({
    queryKey: ['bus', 'operators'],
    queryFn: async () => { const { data } = await api.get('/bus/operators'); return data; },
  });

  const operators = operatorsData?.data || [];

  if (selectedOperator) {
    return <OperatorCounters operator={selectedOperator} onBack={() => setSelectedOperator(null)} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <ExportButtons type="counters" label="Counters" />
        <p className="text-sm text-muted-foreground">Select an operator to manage counters</p>
      </div>
      {operatorsLoading ? <Spinner /> : operators.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No operators found. Add operators first.</p>
      ) : (
        <div className="space-y-2">
          {operators.map((o: any, index: number) => (
            <FadeIn key={o._id} direction="up" delay={index * 0.05} duration={0.4}>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setSelectedOperator(o)}
                className="w-full text-left border rounded-lg p-3 bg-card hover:border-primary/40 transition-colors"
              >
                <p className="font-medium text-sm text-foreground">{o.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="capitalize">{o.scheduleType}</span>{o.contactNumber ? ` · ${o.contactNumber}` : ''}
                </p>
              </motion.button>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

function OperatorCounters({ operator, onBack }: { operator: any; onBack: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', location: '', phoneNumbers: '', bookingLink: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['bus', 'counters', 'operator', operator._id],
    queryFn: async () => { const { data } = await api.get(`/bus/counters?operator=${operator._id}`); return data; },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        operator: operator._id,
        phoneNumbers: form.phoneNumbers.split(',').map((p) => p.trim()).filter(Boolean),
      };
      return editId ? api.patch(`/bus/counters/${editId}`, payload) : api.post('/bus/counters', payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'counters'] }); resetForm(); toast.success(editId ? 'Counter updated' : 'Counter added'); },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to save counter'); } },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bus/counters/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bus', 'counters'] }); toast.success('Counter deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete counter'); },
  });

  const resetForm = () => { setShowForm(false); setEditId(null); setForm({ name: '', location: '', phoneNumbers: '', bookingLink: '' }); };

  const startEdit = (c: any) => {
    setEditId(c._id);
    setForm({
      name: c.name,
      location: c.location || '',
      phoneNumbers: (c.phoneNumbers || []).join(', '),
      bookingLink: c.bookingLink || '',
    });
    setShowForm(true);
  };

  const counters = data?.data || [];

  return (
    <div>
      {/* Operator header + back */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{operator.name}</p>
          <p className="text-xs text-muted-foreground"><span className="capitalize">{operator.scheduleType}</span>{operator.contactNumber ? ` · ${operator.contactNumber}` : ''}</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm shrink-0">
          <Plus className="h-4 w-4" /> Add Counter
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 sm:p-6 bg-card mb-4">
              <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.name.trim()) errs.name = 'Counter name is required'; if (Object.keys(errs).length) { setErrors(errs); return; } saveMutation.mutate(); }} className="space-y-3">
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
      {isLoading ? <Spinner /> : counters.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No counters for this operator yet.</p>
      ) : (
        <div className="space-y-2">
          {counters.map((c: any, index: number) => (
            <FadeIn key={c._id} direction="up" delay={index * 0.05} duration={0.4}>
              <div className="border rounded-lg bg-card hover:bg-accent/30 transition-colors">
                <div className="flex items-center justify-between gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === c._id ? null : c._id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <motion.span animate={{ rotate: expandedId === c._id ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </motion.span>
                    <p className="font-medium text-sm text-foreground truncate">{c.name}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <EditBtn onClick={() => startEdit(c)} />
                    <DeleteBtn onClick={() => deleteMutation.mutate(c._id)} />
                  </div>
                </div>
                <AnimatePresence>
                  {expandedId === c._id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="px-3 pb-3 pt-0 border-t mx-3 mb-3 space-y-2 text-xs">
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          {c.location && <div><span className="text-muted-foreground">Location:</span> <span className="text-foreground">{c.location}</span></div>}
                          {c.phoneNumbers?.length > 0 && (
                            <div>
                              <span className="text-muted-foreground">Phone:</span>{' '}
                              {c.phoneNumbers.map((p: string, pi: number) => (
                                <span key={pi}>{pi > 0 && ', '}<a href={`tel:${p.replace(/\s/g, '')}`} className="text-primary hover:underline">{p}</a></span>
                              ))}
                            </div>
                          )}
                          {c.bookingLink && <div><span className="text-muted-foreground">Booking:</span> <a href={c.bookingLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{c.bookingLink.replace(/^https?:\/\//, '')}</a></div>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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

  const placeholders: Record<string, string> = {
    operators: `[\n  { "name": "Shyamoli Paribahan", "contactNumber": "01711...", "email": "info@shyamoli.com", "website": "https://shyamoli.com", "description": "<p>Premium intercity</p>", "scheduleType": "intercity" }\n]`,
    routes: `[\n  { "origin": "Barishal", "destination": "Dhaka", "routeType": "intercity", "distanceKm": 230, "estimatedDuration": "5h 30m", "stops": [{ "name": "Faridpur", "order": 0 }] }\n]`,
    schedules: `[\n  {\n    "route": "<routeId>",\n    "departureTime": "08:00",\n    "arrivalTime": "13:30",\n    "daysOfOperation": ["sat","sun","mon"],\n    "buses": [\n      { "operator": "<operatorId>", "busName": "Shyamoli Express", "busCategory": "ac" }\n    ]\n  }\n]`,
    counters: `[\n  { "operator": "<operatorId>", "name": "Sayedabad Counter", "location": "Sayedabad, Dhaka", "phoneNumbers": ["01711..."], "bookingLink": "https://..." }\n]`,
  };

  return (
    <FadeIn direction="up">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Bulk Import</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Paste a JSON array of records to import. Each object should match the expected fields for the selected type.
        </p>

        <select value={type} onChange={(e) => { setType(e.target.value); setResult(null); }}
          className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm mb-3">
          <option value="operators">Operators</option>
          <option value="routes">Routes</option>
          <option value="schedules">Schedules</option>
          <option value="counters">Counters</option>
        </select>

        <textarea
          placeholder={placeholders[type]}
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
