import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Plus, Loader2, Pencil, Trash2, Archive } from 'lucide-react';

export default function AdminNoticesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', content: '', category: 'general', priority: 'normal', status: 'draft', isHighlighted: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notices.all,
    queryFn: async () => {
      const { data } = await api.get('/notices?limit=50');
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) return (await api.patch(`/notices/${editId}`, form)).data;
      return (await api.post('/notices', form)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notices/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notices/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notices'] }),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ title: '', content: '', category: 'general', priority: 'normal', status: 'draft', isHighlighted: false });
  };

  const startEdit = (n: any) => {
    setEditId(n._id);
    setForm({
      title: n.title || '', content: n.content || '', category: n.category || 'general',
      priority: n.priority || 'normal', status: n.status || 'draft', isHighlighted: n.isHighlighted || false,
    });
    setShowForm(true);
  };

  const notices = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notices</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Notice
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-5 bg-background mb-6">
          <h3 className="font-semibold mb-4">{editId ? 'Edit' : 'Create'} Notice</h3>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
            <textarea placeholder="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
            <div className="grid grid-cols-3 gap-3">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm">
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="event">Event</option>
                <option value="urgent">Urgent</option>
                <option value="financial">Financial</option>
                <option value="other">Other</option>
              </select>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm">
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="px-3 py-2 border rounded-md bg-background text-sm">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isHighlighted} onChange={(e) => setForm({ ...form, isHighlighted: e.target.checked })} />
              Highlight on homepage
            </label>
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
      ) : (
        <div className="space-y-2">
          {notices.map((n: any) => (
            <div key={n._id} className="border rounded-lg p-4 bg-background flex items-center justify-between">
              <div>
                <h3 className="font-medium">{n.title}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="capitalize">{n.category}</span>
                  <span className="capitalize">{n.status}</span>
                  <span className="capitalize">{n.priority}</span>
                  <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(n)} className="p-2 hover:bg-accent rounded"><Pencil className="h-4 w-4" /></button>
                {n.status === 'published' && (
                  <button onClick={() => archiveMutation.mutate(n._id)} className="p-2 hover:bg-accent rounded"><Archive className="h-4 w-4" /></button>
                )}
                <button onClick={() => deleteMutation.mutate(n._id)} className="p-2 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
