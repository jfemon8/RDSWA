import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Plus, Loader2, Trash2, Image } from 'lucide-react';

export default function AdminGalleryPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['gallery', 'albums'],
    queryFn: async () => {
      const { data } = await api.get('/gallery/albums');
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/gallery/albums', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      setShowForm(false);
      setForm({ title: '', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gallery/albums/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gallery'] }),
  });

  const albums = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gallery</h1>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New Album
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg p-5 bg-background mb-6">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
            <input placeholder="Album Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
            <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
            <div className="flex gap-2">
              <button type="submit" disabled={createMutation.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : albums.length === 0 ? (
        <div className="text-center py-12">
          <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No albums yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((a: any) => (
            <div key={a._id} className="border rounded-lg overflow-hidden bg-background">
              {a.coverPhoto ? (
                <img src={a.coverPhoto} alt="" className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-muted flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="p-3 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm">{a.title}</h3>
                  <p className="text-xs text-muted-foreground">{a.photoCount || 0} photos</p>
                </div>
                <button onClick={() => deleteMutation.mutate(a._id)}
                  className="p-1.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
