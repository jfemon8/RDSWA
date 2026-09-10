import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import ImageLightbox from '@/components/chat/ImageLightbox';

interface Props {
  src: string;
  alt?: string;
  /** Download filename used by the lightbox. */
  name?: string;
  /** Sizing and shape for the frame. */
  className?: string;
  /** `object-cover` crops to the frame, `object-contain` fits a whole poster inside it. */
  fit?: 'cover' | 'contain';
  /** Hides the corner zoom badge where the frame is too small for it. */
  showZoomHint?: boolean;
}

/** Clickable image that opens the full zoom-pan-pinch viewer, safe to nest inside a link or a clickable card. */
export default function ImageThumbnail({
  src,
  alt = '',
  name,
  className = '',
  fit = 'cover',
  showZoomHint = true,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // The card around this is often a link, which would otherwise navigate instead of zooming.
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Click to view full image"
        aria-label="View full image"
        className={`group relative block overflow-hidden rounded-lg bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'} transition-transform duration-300 group-hover:scale-[1.03]`}
        />
        {showZoomHint && (
          <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Maximize2 className="h-3 w-3" />
          </span>
        )}
      </button>

      {open && (
        <ImageLightbox
          images={[{ url: src, name: name || alt || 'image' }]}
          index={0}
          onClose={() => setOpen(false)}
          onIndexChange={() => {}}
        />
      )}
    </>
  );
}
