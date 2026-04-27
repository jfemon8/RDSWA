import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Image, X, Mail, Calendar } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { ImageCardSkeleton } from '@/components/ui/Skeleton';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';
import EmptyState from '@/components/ui/EmptyState';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import Promo from '@/components/promo/Promo';

// Album grid is up to 3 cols on lg, so every 6 cards = every 2 rows. Photo
// grid is up to 4 cols, so 12 keeps the visual flow uninterrupted while
// still placing one promo per ~3 rows on long albums.
const ALBUM_PROMO_EVERY = 6;
const PHOTO_PROMO_EVERY = 12;

export default function GalleryPage() {
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  useBodyScrollLock(!!lightbox);

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
          {albumDetail.description && <RichContent html={albumDetail.description} className="text-muted-foreground mb-4" />}

          {albumDetail.photos?.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {albumDetail.photos.map((p: any, i: number) => (
                <Fragment key={p._id}>
                {/* Caption overlays the image (absolute bottom) so tiles are
                    uniformly 1:1 whether a photo has a caption or not —
                    otherwise captioned/uncaptioned tiles in the same row
                    produce different heights and the grid looks ragged. */}
                <div
                  className="relative cursor-pointer group overflow-hidden rounded-lg aspect-square bg-muted"
                  onClick={() => setLightbox(p.url)}
                >
                  <img
                    src={p.thumbnail || p.url}
                    alt={p.caption || ''}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                  />
                  {p.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 py-1.5">
                      <p className="text-[11px] text-white truncate">{p.caption}</p>
                    </div>
                  )}
                </div>
                {(i + 1) % PHOTO_PROMO_EVERY === 0 && i < albumDetail.photos.length - 1 && (
                  <div className="col-span-2 sm:col-span-3 lg:col-span-4 empty:hidden">
                    <Promo kind="infeed" minHeight={180} />
                  </div>
                )}
                </Fragment>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Image}
              title="No Photos Yet"
              description="This album doesn't have any photos yet. Check back later as new photos are added."
              hint="Once photos are uploaded to this album, they will appear here in a grid."
            />
          )}
        </div>
      ) : (
        <>
          {albums.length === 0 ? (
            <EmptyState
              icon={Image}
              title="No Albums Yet"
              description="No photo albums have been published yet. Albums with photos from events and gatherings will appear here soon."
              primary={{ label: 'Browse Events', icon: Calendar, to: '/events' }}
              secondary={{ label: 'Contact Admin', icon: Mail, to: '/contact' }}
              hint="Photos from RDSWA events, workshops, and social gatherings are organized into albums for easy browsing."
            />
          ) : (
            <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {albums.map((a: any, i: number) => (
                <Fragment key={a._id}>
                <FadeIn delay={i * 0.08} direction="up">
                  <div onClick={() => setSelectedAlbum(a._id)}
                    className="border rounded-xl overflow-hidden bg-card cursor-pointer hover:border-primary/30 transition-colors">
                    {a.coverPhoto ? (
                      <img src={a.coverPhoto} alt="" loading="lazy" decoding="async" className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-muted flex items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="font-medium text-foreground flex items-center gap-2">
                        <Image className="h-4 w-4 text-primary shrink-0" /> {a.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">{a.photoCount || 0} photos</p>
                    </div>
                  </div>
                </FadeIn>
                {(i + 1) % ALBUM_PROMO_EVERY === 0 && i < albums.length - 1 && (
                  <div className="sm:col-span-2 lg:col-span-3 empty:hidden">
                    <Promo kind="infeed" minHeight={180} />
                  </div>
                )}
                </Fragment>
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
            <button
              className="absolute tap-target flex items-center justify-center text-white hover:text-white/70 bg-black/40 rounded-full"
              style={{ top: 'max(1rem, env(safe-area-inset-top))', right: 'max(1rem, env(safe-area-inset-right))' }}
              onClick={() => setLightbox(null)}
              aria-label="Close"
            >
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
