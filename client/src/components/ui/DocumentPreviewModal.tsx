import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, ZoomIn, ZoomOut, RotateCw, Shrink, Maximize, Minimize, Download, ExternalLink, FileText } from 'lucide-react';
import ZoomableImage from './ZoomableImage';
import { proxyFileUrl } from '@/lib/fileProxy';

// Lazy-loaded so react-pdf's worker bundle only arrives when a PDF is actually opened.
const PdfViewer = lazy(() => import('./PdfViewer'));

export interface DocumentPreviewTarget {
  url: string;
  /** Human-readable heading for the dialog. */
  title?: string;
  /** Filename used for the download, extension included. */
  fileName?: string;
}

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|avif)(\?|$)/i;
const PDF_RE = /\.pdf(\?|$)/i;

/** Shared document dialog that pinch-zooms images, hands PDFs to PdfViewer, and offers a download for anything else. */
export default function DocumentPreviewModal({
  target,
  onClose,
}: {
  target: DocumentPreviewTarget | null;
  onClose: () => void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else panel.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!target) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [target, onClose]);

  const url = target?.url || '';
  const name = target?.fileName || target?.title || 'document';
  const isImage = IMAGE_RE.test(url);
  const isPdf = PDF_RE.test(url);
  const previewUrl = proxyFileUrl(url, name, true);
  const downloadUrl = proxyFileUrl(url, name, false);

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
              className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 z-20 p-2 rounded-full bg-background text-foreground shadow-lg border hover:bg-accent"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>

            <div ref={panelRef} className={isImage ? 'border rounded-xl bg-card overflow-hidden' : undefined}>
            {isPdf ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center gap-2 py-24 border rounded-xl bg-card text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading PDF viewer…
                  </div>
                }
              >
                <PdfViewer url={url} fileName={name} height={720} />
              </Suspense>
            ) : isImage ? (
              <ZoomableImage
                src={url}
                alt={target.title || 'Document'}
                stageClassName="w-full bg-black/5 dark:bg-black/40"
                stageStyle={{ height: isFullscreen ? 'calc(100vh - 6rem)' : '70vh' }}
                toolbar={({ zoomIn, zoomOut, rotate, reset }) => (
                  <div className="flex items-center gap-2 px-3 py-2 border-b">
                    <p className="text-sm font-medium text-foreground truncate flex-1" title={target.title}>
                      {target.title || 'Document'}
                    </p>
                    <button type="button" onClick={zoomOut} title="Zoom out" aria-label="Zoom out" className="p-1.5 rounded hover:bg-accent text-foreground">
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={zoomIn} title="Zoom in" aria-label="Zoom in" className="p-1.5 rounded hover:bg-accent text-foreground">
                      <ZoomIn className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={rotate} title="Rotate 90°" aria-label="Rotate 90 degrees" className="p-1.5 rounded hover:bg-accent text-foreground">
                      <RotateCw className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={reset} title="Reset view" aria-label="Reset view" className="p-1.5 rounded hover:bg-accent text-foreground">
                      <Shrink className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                      aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                      className="p-1.5 rounded hover:bg-accent text-foreground"
                    >
                      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </button>
                    <a href={downloadUrl} title="Download" aria-label="Download" className="p-1.5 rounded hover:bg-accent text-foreground">
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                )}
              />
            ) : (
              <div className="border rounded-xl bg-card p-8 text-center">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium text-foreground break-words">{target.title || 'Document'}</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  This file type has no in-app preview.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-md text-sm hover:bg-accent text-foreground">
                    <ExternalLink className="h-4 w-4" /> Open
                  </a>
                  <a href={downloadUrl} className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm">
                    <Download className="h-4 w-4" /> Download
                  </a>
                </div>
              </div>
            )}
            {isImage && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground border-t">
                Pinch, scroll or double-tap to zoom, drag to pan, and rotate for sideways scans.
              </p>
            )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
