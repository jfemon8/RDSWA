import { useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2 } from 'lucide-react';

// Lazy-load PdfViewer so its ~600 KB of react-pdf and worker code arrives only when a preview is opened.
const PdfViewer = lazy(() => import('./PdfViewer'));

export interface PdfPreviewTarget {
  fileUrl: string;
  title?: string;
}

/** Project-wide PDF preview dialog, closed by passing `null`, that every caller shares so behaviour and improvements stay consistent. */
export default function PdfPreviewModal({
  target,
  onClose,
}: {
  target: PdfPreviewTarget | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!target) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [target, onClose]);

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 z-10 p-2 rounded-full bg-background text-foreground shadow-lg border hover:bg-accent"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            <Suspense
              fallback={
                <div className="flex items-center justify-center gap-2 py-24 border rounded-xl bg-card text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading PDF viewer…
                </div>
              }
            >
              <PdfViewer url={target.fileUrl} fileName={target.title} height={720} />
            </Suspense>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
