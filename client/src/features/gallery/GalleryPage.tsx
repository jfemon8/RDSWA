import { useCallback, useEffect, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import {
  Image, X, Mail, Calendar, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, RotateCw, Shrink,
} from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { ImageCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';
import EmptyState from '@/components/ui/EmptyState';
import ZoomableImage from '@/components/ui/ZoomableImage';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import Promo from '@/components/promo/Promo';

// Cadences chosen so a promo lands every two album rows and roughly every three photo rows.
const ALBUM_PROMO_EVERY = 6;
const PHOTO_PROMO_EVERY = 12;

export default function GalleryPage() {
  // Album and open photo live in the URL, so Back leaves the album or closes the viewer.
  const [params, setParams] = useSearchParams();
  const albumId = params.get('album') || '';
  const photoId = params.get('photo') || '';

  const setParam = (next: Record<string, string | null>, replace = false) =>
    setParams(
      (prev) => {
        const merged = new URLSearchParams(prev);
        Object.entries(next).forEach(([k, v]) => (v ? merged.set(k, v) : merged.delete(k)));
        return merged;
      },
      { replace },
    );

  const { data: albumsData, isLoading } = useQuery({
    queryKey: ['gallery', 'albums'],
    queryFn: async () => (await api.get('/gallery/albums')).data,
  });

  const { data: albumData, isLoading: albumLoading } = useQuery({
    queryKey: ['gallery', 'album', albumId],
    queryFn: async () => (await api.get(`/gallery/albums/${albumId}`)).data,
    enabled: !!albumId,
  });

  const albums = albumsData?.data || [];
  // The endpoint answers with { album, photos }, so the album's own fields sit one level down.
  const album = albumData?.data?.album;
  const photos = albumData?.data?.photos || [];

  const photoIndex = photoId ? photos.findIndex((p: any) => p._id === photoId) : -1;
  const openPhoto = photoIndex >= 0 ? photos[photoIndex] : null;
  useBodyScrollLock(!!openPhoto);

  const closeLightbox = useCallback(() => setParam({ photo: null }), [params]);

  // Stepping through photos replaces the entry, so Back closes the viewer instead of walking it backwards.
  const step = useCallback(
    (delta: number) => {
      if (photoIndex < 0 || photos.length === 0) return;
      const next = (photoIndex + delta + photos.length) % photos.length;
      setParam({ photo: photos[next]._id }, true);
    },
    [photoIndex, photos, params],
  );

  useEffect(() => {
    if (!openPhoto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPhoto, closeLightbox, step]);

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
      <SEO
        title="Gallery"
        description="RDSWA photo gallery: events, cultural programs, sports, social gatherings, and memorable moments of Rangpur Division students at the University of Barishal. RDSWA গ্যালারি ও ছবি।"
        keywords="RDSWA gallery, RDSWA photos, BU Rangpur photos, University of Barishal events photos, RDSWA গ্যালারি, RDSWA ছবি"
      />
      <BlurText text="Gallery" className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 justify-center md:justify-start" delay={80} animateBy="words" direction="bottom" />

      {albumId ? (
        <div>
          <button
            onClick={() => setParam({ album: null, photo: null })}
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
          >
            ← Back to Albums
          </button>

          {albumLoading && !album ? (
            <div className="space-y-4">
              <Skeleton className="h-7 w-56" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-4 text-foreground">{album?.title}</h2>
              {album?.description && (
                <RichContent html={album.description} className="text-muted-foreground mb-4" />
              )}

              {photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {photos.map((p: any, i: number) => (
                    <Fragment key={p._id}>
                      {/* The caption overlays the image so every tile stays 1:1 and the grid never goes ragged. */}
                      <button
                        type="button"
                        onClick={() => setParam({ photo: p._id })}
                        className="relative cursor-pointer group overflow-hidden rounded-lg aspect-square bg-muted text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <img
                          src={p.thumbnail || p.url}
                          alt={p.caption || ''}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                        />
                        {p.caption && (
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 py-1.5">
                            <span className="block text-[11px] text-white truncate">{p.caption}</span>
                          </span>
                        )}
                      </button>
                      {(i + 1) % PHOTO_PROMO_EVERY === 0 && i < photos.length - 1 && (
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
            </>
          )}
        </div>
      ) : albums.length === 0 ? (
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
                <div
                  onClick={() => setParam({ album: a._id })}
                  className="border rounded-xl overflow-hidden bg-card cursor-pointer hover:border-primary/30 transition-colors"
                >
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

      <AnimatePresence>
        {openPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={openPhoto.caption || 'Photo viewer'}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          >
            <div className="relative flex-1 min-h-0">
              <ZoomableImage
                src={openPhoto.url}
                alt={openPhoto.caption || ''}
                stageClassName="h-full w-full"
                // One cluster holds zoom, rotate and close, so nothing can hide the way out.
                toolbar={(c) => (
                  <div
                    className="absolute z-20 flex items-center gap-1"
                    style={{
                      top: 'max(0.75rem, env(safe-area-inset-top))',
                      right: 'max(0.75rem, env(safe-area-inset-right))',
                    }}
                  >
                    <ToolbarButton onClick={c.zoomOut} label="Zoom out"><ZoomOut className="h-5 w-5" /></ToolbarButton>
                    <ToolbarButton onClick={c.zoomIn} label="Zoom in"><ZoomIn className="h-5 w-5" /></ToolbarButton>
                    <ToolbarButton onClick={c.rotate} label="Rotate 90 degrees"><RotateCw className="h-5 w-5" /></ToolbarButton>
                    <ToolbarButton onClick={c.reset} label="Reset view"><Shrink className="h-5 w-5" /></ToolbarButton>
                    <ToolbarButton onClick={closeLightbox} label="Close viewer"><X className="h-5 w-5" /></ToolbarButton>
                  </div>
                )}
              />

              {photos.length > 1 && (
                <>
                  <ToolbarButton
                    onClick={() => step(-1)}
                    label="Previous photo"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </ToolbarButton>
                  <ToolbarButton
                    onClick={() => step(1)}
                    label="Next photo"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </ToolbarButton>
                </>
              )}
            </div>

            <div
              className="shrink-0 px-4 py-3 text-center text-white/80 text-sm"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              {openPhoto.caption && <p className="mb-1 break-words">{openPhoto.caption}</p>}
              {photos.length > 1 && (
                <p className="text-xs text-white/50">{photoIndex + 1} / {photos.length}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  className = '',
  children,
}: {
  onClick: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`tap-target flex items-center justify-center rounded-full border border-white/40 bg-black/60 text-white backdrop-blur-sm transition-colors hover:border-white/70 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${className}`}
    >
      {children}
    </button>
  );
}
