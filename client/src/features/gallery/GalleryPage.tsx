import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Image, Loader2, X } from 'lucide-react';

export default function GalleryPage() {
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const { data: albumsData, isLoading } = useQuery({
    queryKey: ['gallery', 'albums'],
    queryFn: async () => {
      const { data } = await api.get('/gallery/albums');
      return data;
    },
  });

  const { data: photosData } = useQuery({
    queryKey: ['gallery', 'album', selectedAlbum],
    queryFn: async () => {
      const { data } = await api.get(`/gallery/albums/${selectedAlbum}`);
      return data;
    },
    enabled: !!selectedAlbum,
  });

  const albums = albumsData?.data || [];
  const albumDetail = photosData?.data;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Gallery</h1>

      {selectedAlbum && albumDetail ? (
        <div>
          <button onClick={() => setSelectedAlbum(null)}
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
            ← Back to Albums
          </button>
          <h2 className="text-xl font-semibold mb-4">{albumDetail.title}</h2>
          {albumDetail.description && <p className="text-muted-foreground mb-4">{albumDetail.description}</p>}

          {albumDetail.photos?.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {albumDetail.photos.map((p: any) => (
                <div key={p._id} className="cursor-pointer group" onClick={() => setLightbox(p.url)}>
                  <img src={p.thumbnail || p.url} alt={p.caption || ''} className="w-full aspect-square object-cover rounded-lg group-hover:opacity-80 transition-opacity" />
                  {p.caption && <p className="text-xs text-muted-foreground mt-1 truncate">{p.caption}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No photos in this album</p>
          )}
        </div>
      ) : (
        <>
          {albums.length === 0 ? (
            <div className="text-center py-12">
              <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No albums yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {albums.map((a: any) => (
                <div key={a._id} onClick={() => setSelectedAlbum(a._id)}
                  className="border rounded-lg overflow-hidden bg-background cursor-pointer hover:shadow-md transition-shadow">
                  {a.coverPhoto ? (
                    <img src={a.coverPhoto} alt="" className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 bg-muted flex items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="p-3">
                    <h3 className="font-medium">{a.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{a.photoCount || 0} photos</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300" onClick={() => setLightbox(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
