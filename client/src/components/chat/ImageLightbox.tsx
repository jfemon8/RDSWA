import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Shrink,
} from 'lucide-react';
import { proxyFileUrl } from '@/lib/fileProxy';
import ZoomableImage from '@/components/ui/ZoomableImage';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface Props {
  images: Array<{ url: string; name?: string }>;
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

/** Shared look for every control, with a light ring so the buttons stay visible over a bright photo. */
const CONTROL =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white ' +
  'backdrop-blur-sm transition-colors hover:bg-black/80 hover:border-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';

function Control({
  onClick,
  label,
  children,
  className = '',
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // The backdrop closes on click, so a control must not bubble up to it.
        e.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={`${CONTROL} ${className}`}
    >
      {children}
    </button>
  );
}

/** Full-screen image viewer with arrow-key + on-screen navigation. */
export default function ImageLightbox({ images, index, onClose, onIndexChange }: Props) {
  useBodyScrollLock(index >= 0 && index < images.length);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (e.key === 'ArrowRight' && index < images.length - 1) onIndexChange(index + 1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [index, images.length, onClose, onIndexChange]);

  if (index < 0 || index >= images.length) return null;
  const current = images[index];

  // Rendered into body because a transformed ancestor (a hover-animated card) would otherwise trap this fixed overlay inside it.
  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
        onClick={onClose}
      >
        {index > 0 && (
          <Control
            onClick={() => onIndexChange(index - 1)}
            label="Previous"
            className="absolute left-4 top-1/2 z-20 -translate-y-1/2"
          >
            <ChevronLeft className="h-6 w-6" />
          </Control>
        )}
        {index < images.length - 1 && (
          <Control
            onClick={() => onIndexChange(index + 1)}
            label="Next"
            className="absolute right-4 top-1/2 z-20 -translate-y-1/2"
          >
            <ChevronRight className="h-6 w-6" />
          </Control>
        )}

        <ZoomableImage
          key={current.url}
          src={current.url}
          alt={current.name || ''}
          stageClassName="h-[90vh] w-[90vw]"
          imageClassName="rounded"
          // One row holds zoom, rotate, download and close, so the viewer has a single control bar.
          toolbar={(c) => (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute z-20 flex flex-wrap items-center justify-end gap-1.5"
              style={{
                top: 'max(1rem, env(safe-area-inset-top))',
                right: 'max(1rem, env(safe-area-inset-right))',
              }}
            >
              <Control onClick={c.zoomOut} label="Zoom out"><ZoomOut className="h-5 w-5" /></Control>
              <Control onClick={c.zoomIn} label="Zoom in"><ZoomIn className="h-5 w-5" /></Control>
              <Control onClick={c.rotate} label="Rotate 90°"><RotateCw className="h-5 w-5" /></Control>
              <Control onClick={c.reset} label="Reset view"><Shrink className="h-5 w-5" /></Control>
              {/* Cross-origin Cloudinary URLs go through the backend proxy, since the HTML `download` attribute is ignored on cross-origin links. */}
              <a
                href={proxyFileUrl(current.url, current.name, false)}
                download={current.name}
                onClick={(e) => e.stopPropagation()}
                title="Download"
                aria-label="Download"
                className={CONTROL}
              >
                <Download className="h-5 w-5" />
              </a>
              <Control onClick={onClose} label="Close"><X className="h-5 w-5" /></Control>
            </div>
          )}
        />

        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/30 bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm">
            {index + 1} / {images.length}
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
