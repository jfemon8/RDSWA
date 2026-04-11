import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader2, Maximize2, Minimize2, FileX } from 'lucide-react';
import { motion } from 'motion/react';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Use the bundled worker via Vite's URL import — this avoids relying on a CDN
// (which would break offline / restrictive networks) and matches our pdfjs
// version exactly.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite handles the ?url suffix at build time
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  /** Direct URL to the PDF — should be served with Content-Type: application/pdf */
  url: string;
  /** Optional filename used for the download button */
  fileName?: string;
  /** Default container height (px). The viewer is scrollable when content exceeds this. */
  height?: number;
  /** When true, exposes a fullscreen toggle button */
  allowFullscreen?: boolean;
}

/**
 * Inline PDF viewer powered by Mozilla's pdfjs (via react-pdf).
 *
 * Features:
 *  - Page navigation (prev / next + counter)
 *  - Zoom in/out (50% — 250%)
 *  - Download button
 *  - Optional fullscreen toggle
 *  - Responsive width — re-renders pages when the container resizes
 *
 * The component does NOT use an `<iframe>`, which means PDFs render natively
 * in the React tree without triggering Chrome's auto-download heuristics.
 */
export default function PdfViewer({ url, fileName, height = 720, allowFullscreen = true }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState<boolean>(false);

  // Track container width so PDF pages stay responsive on resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) setContainerWidth(width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('[PdfViewer] Failed to load PDF:', err);
    setError(err.message || 'Failed to load PDF');
  }, []);

  const goPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goNext = () => setPageNumber((p) => Math.min(numPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));

  // Compute the page width: respect zoom but cap to the available container.
  const pageWidth = Math.min(containerWidth, 1200) * scale;

  return (
    <div
      className={`border rounded-xl bg-card overflow-hidden ${
        fullscreen ? 'fixed inset-0 z-[100] rounded-none border-0' : ''
      }`}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={pageNumber <= 1}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground tabular-nums px-1 min-w-[60px] text-center">
            {numPages > 0 ? `${pageNumber} / ${numPages}` : '— / —'}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={pageNumber >= numPages}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-40 text-foreground"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground tabular-nums px-1 min-w-[44px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= 2.5}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-40 text-foreground"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {allowFullscreen && (
            <button
              type="button"
              onClick={() => setFullscreen((v) => !v)}
              className="p-1.5 rounded hover:bg-accent text-foreground"
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          <a
            href={url}
            download={fileName || 'document.pdf'}
            className="p-1.5 rounded hover:bg-accent text-foreground"
            title="Download PDF"
            aria-label="Download PDF"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* Document area */}
      <div
        ref={containerRef}
        className="overflow-auto bg-muted/30 chat-scroll"
        style={{ height: fullscreen ? 'calc(100vh - 49px)' : `${height}px` }}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2 p-6">
            <FileX className="h-10 w-10 opacity-40" />
            <p className="font-medium">Could not load PDF</p>
            <p className="text-xs text-center max-w-md">{error}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline mt-1"
            >
              Open in new tab instead
            </a>
          </div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="shadow-md"
            >
              <Page
                pageNumber={pageNumber}
                width={pageWidth}
                renderAnnotationLayer={true}
                renderTextLayer={true}
              />
            </motion.div>
          </Document>
        )}
      </div>
    </div>
  );
}
