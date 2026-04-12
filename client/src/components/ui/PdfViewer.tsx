import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2,
  Maximize2, Minimize2, FileX, RotateCw,
} from 'lucide-react';
import { motion, useAnimation, type PanInfo } from 'motion/react';
import { proxyFileUrl } from '@/lib/fileProxy';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite handles the ?url suffix at build time
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  url: string;
  fileName?: string;
  /** Container height. On mobile (<640px) this is overridden to 70vh for
   *  better usability with soft keyboards and smaller screens. */
  height?: number;
  allowFullscreen?: boolean;
}

/**
 * Mobile-first PDF viewer.
 *
 *  - Swipe left/right to navigate pages (touch + mouse drag)
 *  - Pinch-to-zoom on touch devices
 *  - Tap page counter to type a page number directly
 *  - Responsive toolbar that stacks neatly on small screens
 *  - Fullscreen mode uses 100dvh for proper mobile viewport handling
 *  - All buttons are ≥44px tap targets for thumb-friendly interaction
 */
export default function PdfViewer({ url, fileName, height = 720, allowFullscreen = true }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(800);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const pageInputRef = useRef<HTMLInputElement>(null);

  // Swipe animation controller
  const controls = useAnimation();

  // Proxy URLs
  const viewUrl = useMemo(() => proxyFileUrl(url, fileName, true), [url, fileName]);
  const downloadUrl = useMemo(() => proxyFileUrl(url, fileName, false), [url, fileName]);

  // Responsive container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setContainerWidth(w);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Pinch-to-zoom on touch devices
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let initialDistance = 0;
    let initialScale = 1;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches[0], e.touches[1]);
        initialScale = scale;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = getDistance(e.touches[0], e.touches[1]);
        const ratio = dist / initialDistance;
        const next = Math.max(0.5, Math.min(2.5, +(initialScale * ratio).toFixed(2)));
        setScale(next);
        e.preventDefault(); // prevent browser native zoom
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [scale]);

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('[PdfViewer] Failed to load PDF:', err);
    setError(err.message || 'Failed to load PDF');
  }, []);

  const goToPage = (p: number) => setPageNumber(Math.max(1, Math.min(numPages, p)));
  const goPrev = () => goToPage(pageNumber - 1);
  const goNext = () => goToPage(pageNumber + 1);
  const zoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
  const resetZoom = () => setScale(1);

  // Swipe to navigate pages
  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 60;
    if (info.offset.x < -threshold && pageNumber < numPages) {
      goNext();
    } else if (info.offset.x > threshold && pageNumber > 1) {
      goPrev();
    }
    controls.start({ x: 0 });
  };

  // Page number input submit
  const submitPageInput = () => {
    const n = parseInt(pageInput, 10);
    if (n >= 1 && n <= numPages) goToPage(n);
    setShowPageInput(false);
    setPageInput('');
  };

  // Focus page input when shown
  useEffect(() => {
    if (showPageInput) pageInputRef.current?.focus();
  }, [showPageInput]);

  const pageWidth = Math.min(containerWidth - 16, 1200) * scale;

  // Responsive height: on small screens use vh-based height
  const containerHeight = fullscreen
    ? 'calc(100dvh - 52px)'
    : typeof window !== 'undefined' && window.innerWidth < 640
      ? '70dvh'
      : `${height}px`;

  return (
    <div
      className={`border rounded-xl bg-card overflow-hidden select-none ${
        fullscreen ? 'fixed inset-0 z-[100] rounded-none border-0' : ''
      }`}
    >
      {/* Toolbar — responsive layout */}
      <div className="flex items-center justify-between gap-1 px-2 sm:px-3 py-1.5 sm:py-2 border-b bg-muted/40">
        {/* Page navigation */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={goPrev}
            disabled={pageNumber <= 1}
            className="tap-target p-2 rounded-lg hover:bg-accent disabled:opacity-30 text-foreground"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>

          {showPageInput ? (
            <form
              onSubmit={(e) => { e.preventDefault(); submitPageInput(); }}
              className="flex items-center gap-1"
            >
              <input
                ref={pageInputRef}
                type="number"
                min={1}
                max={numPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={submitPageInput}
                className="w-12 px-1.5 py-1 text-xs text-center border rounded bg-background text-foreground"
              />
              <span className="text-xs text-muted-foreground">/ {numPages}</span>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => { setShowPageInput(true); setPageInput(String(pageNumber)); }}
              className="text-xs text-muted-foreground tabular-nums px-1.5 py-1 rounded hover:bg-accent min-w-[52px] text-center"
              title="Tap to go to a page"
            >
              {numPages > 0 ? `${pageNumber} / ${numPages}` : '—'}
            </button>
          )}

          <button
            type="button"
            onClick={goNext}
            disabled={pageNumber >= numPages}
            className="tap-target p-2 rounded-lg hover:bg-accent disabled:opacity-30 text-foreground"
            aria-label="Next page"
          >
            <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="tap-target p-2 rounded-lg hover:bg-accent disabled:opacity-30 text-foreground"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="text-[11px] text-muted-foreground tabular-nums px-1 py-1 rounded hover:bg-accent min-w-[36px] text-center"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= 2.5}
            className="tap-target p-2 rounded-lg hover:bg-accent disabled:opacity-30 text-foreground"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {scale !== 1 && (
            <button
              type="button"
              onClick={resetZoom}
              className="tap-target p-2 rounded-lg hover:bg-accent text-foreground sm:hidden"
              aria-label="Reset zoom"
            >
              <RotateCw className="h-5 w-5" />
            </button>
          )}
          {allowFullscreen && (
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              className="tap-target p-2 rounded-lg hover:bg-accent text-foreground"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="h-5 w-5 sm:h-4 sm:w-4" /> : <Maximize2 className="h-5 w-5 sm:h-4 sm:w-4" />}
            </button>
          )}
          <a
            href={downloadUrl}
            download={fileName || 'document.pdf'}
            className="tap-target p-2 rounded-lg hover:bg-accent text-foreground"
            aria-label="Download PDF"
          >
            <Download className="h-5 w-5 sm:h-4 sm:w-4" />
          </a>
        </div>
      </div>

      {/* Document area — swipeable on touch */}
      <div
        ref={containerRef}
        className="overflow-auto bg-muted/20 chat-scroll overscroll-contain"
        style={{ height: containerHeight }}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-3 p-6">
            <FileX className="h-12 w-12 opacity-40" />
            <p className="font-medium text-base">Could not load PDF</p>
            <p className="text-xs text-center max-w-md">{error}</p>
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
            >
              Open in new tab
            </a>
          </div>
        ) : (
          <Document
            file={viewUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Loading PDF...</p>
              </div>
            }
            error={
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6">
                Failed to load PDF.
              </div>
            }
            className="flex flex-col items-center py-4"
          >
            <motion.div
              key={pageNumber}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={handleDragEnd}
              animate={controls}
              initial={{ opacity: 0, x: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="shadow-lg rounded-sm cursor-grab active:cursor-grabbing touch-pan-y"
            >
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                renderAnnotationLayer={true}
                renderTextLayer={true}
              />
            </motion.div>

            {/* Swipe hint — only on first visit */}
            {numPages > 1 && pageNumber === 1 && (
              <p className="text-[10px] text-muted-foreground/60 mt-3 sm:hidden animate-pulse">
                Swipe left/right to navigate pages
              </p>
            )}
          </Document>
        )}
      </div>
    </div>
  );
}
