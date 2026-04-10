import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  images: Array<{ url: string; name?: string }>;
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

/** Full-screen image viewer with arrow-key + on-screen navigation. */
export default function ImageLightbox({ images, index, onClose, onIndexChange }: Props) {
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
        onClick={onClose}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <a
          href={current.url}
          download={current.name}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-4 right-16 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Download"
        >
          <Download className="h-5 w-5" />
        </a>

        {index > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onIndexChange(index - 1); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {index < images.length - 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onIndexChange(index + 1); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <motion.img
          key={current.url}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          src={current.url}
          alt={current.name || ''}
          className="max-h-[90vh] max-w-[90vw] object-contain rounded"
          onClick={(e) => e.stopPropagation()}
        />
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-xs">
            {index + 1} / {images.length}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
