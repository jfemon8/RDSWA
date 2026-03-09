import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    title: '', description: '', type: 'event', status: 'draft',
    startDate: '', endDate: '', venue: '', isOnline: false,
    registrationRequired: false, maxParticipants: '', feedbackEnabled: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.events.list({ page: String(page) }),
    queryFn: async () => {
      const { data } = await api.get(`/events?page=${page}&limit=20`);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (payload.maxParticipants) payload.maxParticipants = Number(payload.maxParticipants);
      else delete payload.maxParticipants;
      if (editId) return (await api.patch(`/events/${editId}`, payload)).data;
      return (await api.post('/events', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ title: '', description: '', type: 'event', status: 'draft', startDate: '', endDate: '', venue: '', isOnline: false, registrationRequired: false, maxParticipants: '', feedbackEnabled: false });
  };

  const startEdit = (e: any) => {
    setEditId(e._id);
    setForm({
      title: e.title || '', description: e.description || '', type: e.type || 'event', status: e.status || 'draft',
      startDate: e.startDate ? new Date(e.startDate).toISOString().slice(0, 16) : '',
      endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 16) : '',
      venue: e.venue || '', isOnline: e.isOnline || false,
      registrationRequired: e.registrationRequired || false,
      maxParticipants: e.maxParticipants ? String(e.maxParticipants) : '',
      feedbackEnabled: e.feedbackEnabled || false,
    });
    setShowForm(true);
  };

  const events = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Events</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Event
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-5 bg-background mb-6">
          <h3 className="font-semibold mb-4">{editId ? 'Edit' : 'Create'} Event</h3>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
            <input placeholder="Event Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm">
                <option value="event">Event</option>
                <option value="meeting">Meeting</option>
                <option value="workshop">Workshop</option>
                <option value="seminar">Seminar</option>
                <option value="social">Social</option>
              </select>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm">
                <option value="draft">Draft</option>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Start Date</label>
                <input type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Date</label>
                <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
              </div>
            </div>
            <input placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.registrationRequired} onChange={(e) => setForm({ ...form, registrationRequired: e.target.checked })} />
                Registration Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.feedbackEnabled} onChange={(e) => setForm({ ...form, feedbackEnabled: e.target.checked })} />
                Enable Feedback
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isOnline} onChange={(e) => setForm({ ...form, isOnline: e.target.checked })} />
                Online Event
              </label>
            </div>
            {form.registrationRequired && (
              <input type="number" placeholder="Max Participants (optional)" value={form.maxParticipants}
                onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
                className="w-48 px-3 py-2 border rounded-md bg-background text-sm" />
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={saveMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
                {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : events.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No events found</p>
      ) : (
        <div className="space-y-2">
          {events.map((e: any) => (
            <div key={e._id} className="border rounded-lg p-4 bg-background flex items-center justify-between">
              <div>
                <h3 className="font-medium">{e.title}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="capitalize">{e.type}</span>
                  <span className="capitalize">{e.status}</span>
                  <span>{new Date(e.startDate).toLocaleDateString()}</span>
                  {e.registeredUsers && <span>{e.registeredUsers.length} registered</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(e)} className="p-2 hover:bg-accent rounded"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => deleteMutation.mutate(e._id)} className="p-2 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
