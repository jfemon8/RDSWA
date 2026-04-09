import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { Plus, Loader2, Trash2, Image, ArrowLeft, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import ImageUpload from '@/components/ui/ImageUpload';

export default function AdminGalleryPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', coverPhoto: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);

  // ── Album queries ──
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
      setForm({ title: '', description: '', coverPhoto: '' });
      toast.success('Album created');
    },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to create album'); } },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/gallery/albums/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gallery'] }); toast.success('Album deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete album'); },
  });

  const updateCoverMutation = useMutation({
    mutationFn: ({ id, coverPhoto }: { id: string; coverPhoto: string }) =>
      api.patch(`/gallery/albums/${id}`, { coverPhoto }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      toast.success('Cover photo updated');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update cover'),
  });

  const albums = data?.data || [];

  if (selectedAlbum) {
    return (
      <AlbumPhotos
        albumId={selectedAlbum}
        onBack={() => setSelectedAlbum(null)}
        onSetCover={(url) => updateCoverMutation.mutate({ id: selectedAlbum, coverPhoto: url })}
      />
    );
  }

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Gallery</h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setShowForm(true); setForm({ title: '', description: '', coverPhoto: '' }); setErrors({}); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Album
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-4 sm:p-5 bg-card mb-6">
              <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); if (!form.title.trim()) { setErrors({ title: 'Album title is required' }); return; } createMutation.mutate(); }} className="space-y-3">
                <div>
                  <input placeholder="Album Title" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.title ? 'border-red-500' : ''}`} required />
                  <FieldError message={errors.title} />
                </div>
                <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                <ImageUpload
                  value={form.coverPhoto}
                  onChange={(url) => setForm({ ...form, coverPhoto: url })}
                  folder="gallery"
                  label="Cover Photo (optional, max 5MB)"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={createMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    Create
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : albums.length === 0 ? (
        <div className="text-center py-12">
          <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No albums yet</p>
        </div>
      ) : (
        <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {albums.map((a: any, i: number) => (
            <FadeIn key={a._id} direction="up" delay={i * 0.06}>
              <motion.div
                whileHover={{ y: -2 }}
                className="border rounded-lg overflow-hidden bg-card cursor-pointer"
                onClick={() => setSelectedAlbum(a._id)}
              >
                {a.coverPhoto ? (
                  <img src={a.coverPhoto} alt="" className="w-full h-32 object-cover" />
                ) : (
                  <div className="w-full h-32 bg-muted flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm text-foreground">{a.title}</h3>
                    <p className="text-xs text-muted-foreground">{a.photoCount || 0} photos</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(a._id); }}
                    className="p-1.5 hover:bg-destructive/10 text-destructive rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Album Photos Sub-view ──
function AlbumPhotos({ albumId, onBack, onSetCover }: { albumId: string; onBack: () => void; onSetCover: (url: string) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showUpload, setShowUpload] = useState(false);
  const [photoForm, setPhotoForm] = useState({ url: '', caption: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['gallery', 'album', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/gallery/albums/${albumId}`);
      return data.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: () => api.post(`/gallery/albums/${albumId}/photos`, { url: photoForm.url, caption: photoForm.caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      setPhotoForm({ url: '', caption: '' });
      setShowUpload(false);
      toast.success('Photo added');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add photo'),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => api.delete(`/gallery/photos/${photoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      toast.success('Photo deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete photo'),
  });

  const album = data?.album;
  const photos = data?.photos || [];

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onBack}
            className="p-2 rounded-lg hover:bg-accent transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </motion.button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{album?.title || 'Album'}</h1>
            {album?.description && <p className="text-sm text-muted-foreground">{album.description}</p>}
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Upload className="h-4 w-4" /> Add Photo
        </motion.button>
      </div>

      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-4 bg-card mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm text-foreground">Add Photo</h2>
                <button onClick={() => setShowUpload(false)} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <ImageUpload
                  value={photoForm.url}
                  onChange={(url) => setPhotoForm({ ...photoForm, url: url })}
                  folder="gallery"
                  label="Photo (max 5MB)"
                />
                <input placeholder="Caption (optional)" value={photoForm.caption}
                  onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                <div className="flex gap-2">
                  <motion.button type="button" disabled={uploadMutation.isPending || !photoForm.url}
                    onClick={() => uploadMutation.mutate()}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Photo'}
                  </motion.button>
                  <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12">
          <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No photos in this album</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((p: any, i: number) => (
            <FadeIn key={p._id} direction="up" delay={i * 0.04}>
              <motion.div whileHover={{ y: -2 }} className="group relative border rounded-lg overflow-hidden bg-card">
                <img src={p.url} alt={p.caption || ''} className="w-full h-36 object-cover" />
                {p.caption && (
                  <div className="absolute bottom-8 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1">
                    <p className="text-xs text-white truncate">{p.caption}</p>
                  </div>
                )}
                <div className="flex items-center justify-between p-1.5">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onSetCover(p.url)}
                    className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    Set Cover
                  </motion.button>
                  <button
                    onClick={() => deletePhotoMutation.mutate(p._id)}
                    className="p-1 hover:bg-destructive/10 text-destructive rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
