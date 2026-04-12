import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ZoomIn, ZoomOut, Download, Loader2, ChevronUp, ChevronDown,
  Maximize2, Minimize2, FileX, RotateCw, FileText,
} from 'lucide-react';
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
  height?: number;
  allowFullscreen?: boolean;
}

/**
 * Continuous-scroll PDF viewer — all pages stacked vertically, scroll to
 * navigate. Desktop-optimized with keyboard shortcuts, spacious toolbar,
 * page separators, and fit-to-width rendering. Mobile-friendly with
 * pinch-to-zoom and responsive height.
 */
export default function PdfViewer({ url, fileName, height = 600, allowFullscreen = true }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [numPages, setNumPages] = useState(0);
  const [visiblePage, setVisiblePage] = useState(1);
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(800);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInput, setPageInput] = useState('');
  const pageInputRef = useRef<HTMLInputElement>(null);

  const viewUrl = useMemo(() => proxyFileUrl(url, fileName, true), [url, fileName]);
  const downloadUrl = useMemo(() => proxyFileUrl(url, fileName, false), [url, fileName]);
  const displayName = fileName || url.split('/').pop()?.split('?')[0] || 'document.pdf';

  // ── Container width tracking ──
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

  // ── Visible page tracking via IntersectionObserver ──
  useEffect(() => {
    if (numPages === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null;
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page);
          if (!isNaN(page) && entry.intersectionRatio > (best?.ratio ?? 0)) {
            best = { page, ratio: entry.intersectionRatio };
          }
        }
        if (best) setVisiblePage(best.page);
      },
      { root: el, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pageRefs.current.forEach((div) => observer.observe(div));
    return () => observer.disconnect();
  }, [numPages]);

  // ── Pinch-to-zoom (touch devices) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let initialDistance = 0;
    let initialScale = 1;
    const dist = (a: Touch, b: Touch) =>
      Math.sqrt((a.clientX - b.clientX) ** 2 + (a.clientY - b.clientY) ** 2);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = dist(e.touches[0], e.touches[1]);
        initialScale = scale;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const d = dist(e.touches[0], e.touches[1]);
        setScale(Math.max(0.5, Math.min(2.5, +(initialScale * d / initialDistance).toFixed(2))));
        e.preventDefault();
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, [scale]);

  // ── Keyboard shortcuts (desktop) ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle when the viewer wrapper has focus or is in fullscreen
      if (!fullscreen && !wrapperRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;

      switch (e.key) {
        case 'Escape':
          if (fullscreen) { setFullscreen(false); e.preventDefault(); }
          break;
        case '+':
        case '=':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomIn(); }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomOut(); }
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); resetZoom(); }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  // ── Document callbacks ──
  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setError(null);
  }, []);
  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('[PdfViewer] Failed to load PDF:', err);
    setError(err.message || 'Failed to load PDF');
  }, []);

  // ── Zoom helpers ──
  const zoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.25).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)));
  const resetZoom = () => setScale(1);

  // ── Page navigation ──
  const scrollToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(numPages, p));
    const div = pageRefs.current.get(clamped);
    if (div) div.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const submitPageInput = () => {
    const n = parseInt(pageInput, 10);
    if (n >= 1 && n <= numPages) scrollToPage(n);
    setShowPageInput(false);
    setPageInput('');
  };
  useEffect(() => {
    if (showPageInput) pageInputRef.current?.focus();
  }, [showPageInput]);

  // ── Computed dimensions ──
  // Desktop: use container width minus padding. Zoomed pages can overflow and scroll horizontally.
  const pageWidth = Math.min(containerWidth - 48, 1200) * scale;

  // Height: desktop caps at 70vh so the viewer doesn't push the page content
  // out of view; mobile uses 60dvh; fullscreen uses all available.
  const containerHeight = fullscreen
    ? 'calc(100dvh - 48px)'
    : typeof window !== 'undefined' && window.innerWidth < 640
      ? '60dvh'
      : `min(70vh, ${height}px)`;

  return (
    <div
      ref={wrapperRef}
      tabIndex={-1}
      className={`border rounded-xl bg-card overflow-hidden select-none outline-none ${
        fullscreen ? 'fixed inset-0 z-[100] rounded-none border-0' : ''
      }`}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b bg-muted/40">
        {/* Left: filename + page info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <FileText className="h-4 w-4 text-red-500 shrink-0 hidden sm:block" />
          <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[300px] hidden sm:block" title={displayName}>
            {displayName}
          </span>
          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Page counter / jump input */}
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
                onKeyDown={(e) => { if (e.key === 'Escape') { setShowPageInput(false); setPageInput(''); } }}
                className="w-14 px-2 py-1 text-xs text-center border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />
              <span className="text-xs text-muted-foreground">of {numPages}</span>
            </form>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollToPage(visiblePage - 1)}
                disabled={visiblePage <= 1}
                className="p-1 rounded hover:bg-accent disabled:opacity-30 text-foreground hidden sm:flex"
                aria-label="Previous page"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setShowPageInput(true); setPageInput(String(visiblePage)); }}
                className="text-xs text-muted-foreground tabular-nums px-2 py-1 rounded-md hover:bg-accent text-center"
                title="Click to jump to a page"
              >
                {numPages > 0 ? (
                  <><span className="text-foreground font-medium">{visiblePage}</span> of {numPages}</>
                ) : '—'}
              </button>
              <button
                type="button"
                onClick={() => scrollToPage(visiblePage + 1)}
                disabled={visiblePage >= numPages}
                className="p-1 rounded hover:bg-accent disabled:opacity-30 text-foreground hidden sm:flex"
                aria-label="Next page"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Center: zoom controls */}
        <div className="flex items-center gap-1">
          <button type="button" onClick={zoomOut} disabled={scale <= 0.5}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-accent disabled:opacity-30 text-foreground" aria-label="Zoom out (Ctrl+-)">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={resetZoom}
            className="text-[11px] text-muted-foreground tabular-nums px-1.5 py-1 rounded-md hover:bg-accent min-w-[40px] text-center" title="Reset zoom (Ctrl+0)">
            {Math.round(scale * 100)}%
          </button>
          <button type="button" onClick={zoomIn} disabled={scale >= 2.5}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-accent disabled:opacity-30 text-foreground" aria-label="Zoom in (Ctrl++)">
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {scale !== 1 && (
            <button type="button" onClick={resetZoom}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-accent text-foreground" aria-label="Fit to width" title="Fit to width">
              <RotateCw className="h-4 w-4" />
            </button>
          )}
          {allowFullscreen && (
            <button type="button" onClick={() => setFullscreen((v) => !v)}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-accent text-foreground"
              aria-label={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'} title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          <a href={downloadUrl} download={fileName || 'document.pdf'}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-accent text-foreground" aria-label="Download PDF" title="Download">
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>

      {/* ── Scrollable document ── */}
      <div
        ref={containerRef}
        className="overflow-auto bg-muted/20 chat-scroll overscroll-contain"
        style={{ height: containerHeight }}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-3 p-8">
            <FileX className="h-14 w-14 opacity-40" />
            <p className="font-semibold text-lg text-foreground">Could not load PDF</p>
            <p className="text-xs text-center max-w-md">{error}</p>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 mt-2">
              Open in new tab
            </a>
          </div>
        ) : (
          <Document
            file={viewUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            }
            error={
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6">
                Failed to load PDF.
              </div>
            }
            className="flex flex-col items-center py-6 sm:py-8"
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div
                key={pageNum}
                data-page={pageNum}
                ref={(el) => { if (el) pageRefs.current.set(pageNum, el); }}
                className="mb-4 sm:mb-6 last:mb-0 relative"
              >
                {/* Page shadow + border for visual separation on desktop */}
                <div className="shadow-lg sm:shadow-xl ring-1 ring-black/5 dark:ring-white/5 rounded-sm overflow-hidden">
                  <Page
                    pageNumber={pageNum}
                    width={pageWidth}
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                  />
                </div>
                {/* Page number label between pages */}
                {numPages > 1 && (
                  <div className="flex justify-center mt-2 sm:mt-3">
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground/50 tabular-nums">
                      {pageNum}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
