import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Image, X } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { ImageCardSkeleton } from '@/components/ui/Skeleton';
import SEO from '@/components/SEO';

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
    return (
      <div className="container mx-auto py-8">
        <div className="h-10 w-32 mb-6" />
        <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ImageCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <SEO title="Gallery" description="Browse RDSWA photo albums — events, gatherings, and memorable moments." />
      <BlurText text="Gallery" className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 justify-center md:justify-start" delay={80} animateBy="words" direction="bottom" />

      {selectedAlbum && albumDetail ? (
        <div>
          <button onClick={() => setSelectedAlbum(null)}
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
            ← Back to Albums
          </button>
          <h2 className="text-xl font-semibold mb-4 text-foreground">{albumDetail.title}</h2>
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
            <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {albums.map((a: any, i: number) => (
                <FadeIn key={a._id} delay={i * 0.08} direction="up">
                  <div onClick={() => setSelectedAlbum(a._id)}
                    className="border rounded-xl overflow-hidden bg-card cursor-pointer hover:border-primary/30 transition-colors">
                    {a.coverPhoto ? (
                      <img src={a.coverPhoto} alt="" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-muted flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="font-medium text-foreground">{a.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{a.photoCount || 0} photos</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button className="absolute top-4 right-4 text-white hover:text-white/70" onClick={() => setLightbox(null)}>
              <X className="h-6 w-6" />
            </button>
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              src={lightbox}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
