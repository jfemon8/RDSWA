import { lazy, Suspense, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Calendar, Download, ExternalLink, FileText, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BlurText } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import { proxyFileUrl } from '@/lib/fileProxy';
import SEO from '@/components/SEO';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import ImageLightbox from '@/components/chat/ImageLightbox';
import Promo from '@/components/promo/Promo';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAccordionToggle } from '@/hooks/useAccordionScroll';

// Lazy-load PdfViewer so `react-pdf` and its worker stay out of the bundle for years with no PDF attachments.
const PdfViewer = lazy(() => import('@/components/ui/PdfViewer'));

interface VacationEntry {
  event: string;
  startDate: string;
  endDate: string;
  totalDays?: number;
}
interface VacationAttachment { name: string; url: string; type: string }
interface Vacation {
  _id: string;
  academicYear: string;
  notes?: string;
  entries: VacationEntry[];
  attachments: VacationAttachment[];
  createdAt: string;
  updatedAt: string;
}

/** Days between two ISO dates, inclusive on both ends. */
function inclusiveDays(start: string, end: string): number {
  const s = new Date(start).setHours(0, 0, 0, 0);
  const e = new Date(end).setHours(0, 0, 0, 0);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

/** "5 May 2026 – 9 May 2026", or single date if start == end. */
function formatRange(start: string, end: string): string {
  const a = formatDate(start);
  const b = formatDate(end);
  return a === b ? a : `${a} – ${b}`;
}

export default function VacationPage() {
  const { settings } = useSiteSettings();
  const pageTitle = settings?.vacationPageContent?.title || 'Vacation Calendar';
  const pageSubtitle =
    settings?.vacationPageContent?.subtitle ||
    'Yearly vacation, holiday and break schedule for University of Barishal.';

  const { data, isLoading } = useQuery({
    queryKey: ['vacations'],
    queryFn: async () => {
      const { data } = await api.get('/vacations');
      return data;
    },
  });

  // Server already returns descending by academicYear; lock that order locally
  // too in case ordering changes upstream.
  const vacations: Vacation[] = useMemo(() => {
    const list: Vacation[] = data?.data || [];
    return [...list].sort((a, b) => b.academicYear.localeCompare(a.academicYear));
  }, [data]);

  const [openYearId, setOpenYearId] = useState<string | null>(null);
  const toggleYear = useAccordionToggle(openYearId, setOpenYearId);
  const opened = useRef(false);

  // The list arrives after the first render, so the newest year is opened once it does.
  useEffect(() => {
    if (opened.current || vacations.length === 0) return;
    opened.current = true;
    setOpenYearId(vacations[0]._id);
  }, [vacations]);

  return (
    <div className="container mx-auto py-8">
      <SEO
        title={pageTitle}
        description={pageSubtitle}
        keywords="RDSWA vacation, BU Rangpur vacation, academic calendar, holiday schedule, Barishal university vacation"
      />

      <div className="flex items-center gap-2 mb-2">
        <Calendar className="h-6 w-6 text-primary" />
        <BlurText
          text={pageTitle}
          className="text-2xl sm:text-3xl md:text-4xl font-bold"
          delay={80}
          animateBy="words"
          direction="bottom"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {pageSubtitle}
      </p>

      {/* On lg+ a sticky right-rail promo appears, and below lg the main column takes the full container width. */}
      <div className="lg:flex lg:gap-6">
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className={i === 0 ? 'h-64 rounded-lg' : 'h-20 rounded-lg'} />
              ))}
            </div>
          ) : vacations.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Vacation Calendars Yet"
              description="The vacation calendar has not been published yet. Check back soon."
            />
          ) : (
            <div className="space-y-3">
              {vacations.map((v, i) => (
                <Fragment key={v._id}>
                  <YearPanel
                    vacation={v}
                    index={i}
                    isLatest={i === 0}
                    isOpen={openYearId === v._id}
                    // Only one year stays open, and pressing the open one closes it.
                    onToggle={() => toggleYear(v._id)}
                  />
                  {i === 0 && vacations.length > 1 && (
                    <Promo kind="displayResponsive" minHeight={250} />
                  )}
                </Fragment>
              ))}

              <Promo kind="displayResponsive" minHeight={250} />
            </div>
          )}
        </div>

        {/* Sticky right-rail promo on lg+, where `lg:empty:hidden` collapses the slot when AdSense returns no fill. */}
        <aside className="hidden lg:block lg:empty:hidden w-72 shrink-0 sticky top-20 self-start">
          <Promo kind="sidebar" minHeight={600} />
        </aside>
      </div>
    </div>
  );
}

function YearPanel({
  vacation: v,
  index,
  isLatest,
  isOpen,
  onToggle,
}: {
  vacation: Vacation;
  index: number;
  isLatest: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const bodyId = `vacation-body-${v._id}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.3) }}
      data-accordion-item={v._id}
      className={`border rounded-lg overflow-hidden bg-card ${isOpen ? 'border-primary/30' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-accent/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Calendar className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-foreground flex items-center gap-2 flex-wrap">
              Academic Year {v.academicYear}
              {isLatest && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                  Latest
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {v.entries.length} {v.entries.length === 1 ? 'entry' : 'entries'}
              {v.attachments.length > 0 && ` · ${v.attachments.length} attachment${v.attachments.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="body"
            id={bodyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t"
          >
            <div className="p-4">
              <YearCard vacation={v} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function YearCard({ vacation }: { vacation: Vacation }) {
  // Sort entries chronologically by start with end as the tie-breaker, whatever order the admin entered them.
  const sortedEntries = useMemo(() => {
    return [...vacation.entries].sort((a, b) => {
      const sa = new Date(a.startDate).getTime();
      const sb = new Date(b.startDate).getTime();
      if (sa !== sb) return sa - sb;
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
  }, [vacation.entries]);

  // Pre-classify so the lightbox gets a flat list of just the images (with
  // proper extensions) and PDFs/others stay rendered inline below.
  const classified = useMemo(() => {
    return vacation.attachments.map((a) => {
      const name = ensureExt(a.name, a.url, a.type);
      const isImage = /^image\//i.test(a.type) || /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(a.url);
      const isPdf = /pdf/i.test(a.type) || /\.pdf(\?|$)/i.test(a.url);
      return { ...a, name, isImage, isPdf };
    });
  }, [vacation.attachments]);

  const images = classified.filter((a) => a.isImage);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  return (
    <div>
      {vacation.notes && (
        <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {vacation.notes}
        </p>
      )}

      {sortedEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          No vacation entries listed yet for this year.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-medium text-foreground w-12">#</th>
                  <th className="text-left p-3 font-medium text-foreground">Event</th>
                  <th className="text-left p-3 font-medium text-foreground">Date Range</th>
                  <th className="text-right p-3 font-medium text-foreground w-28">Total Days</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((e, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-t hover:bg-accent/30"
                  >
                    <td className="p-3 text-muted-foreground">{i + 1}</td>
                    <td className="p-3 text-foreground">{e.event}</td>
                    <td className="p-3 text-muted-foreground">{formatRange(e.startDate, e.endDate)}</td>
                    <td className="p-3 text-right font-medium text-foreground">
                      {e.totalDays ?? inclusiveDays(e.startDate, e.endDate)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 border-t font-medium">
                  <td colSpan={3} className="p-3 text-right text-foreground">Total</td>
                  <td className="p-3 text-right text-foreground">
                    {sortedEntries.reduce(
                      (sum, e) => sum + (e.totalDays ?? inclusiveDays(e.startDate, e.endDate)),
                      0
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {sortedEntries.map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="border rounded-lg p-3 bg-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground break-words">{e.event}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatRange(e.startDate, e.endDate)}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                    {e.totalDays ?? inclusiveDays(e.startDate, e.endDate)} days
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Attachments render in place, with a thumbnail grid for images, PdfViewer for PDFs, and an Open or Download card for anything else. */}
      {classified.length > 0 && (
        <div className="mt-6 space-y-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Attachments
          </p>

          {/* Image grid → opens ImageLightbox on click. */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {images.map((img, i) => (
                <button
                  key={`img-${i}`}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="group relative aspect-square overflow-hidden rounded-md border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  title={img.name}
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="absolute inset-x-0 bottom-0 px-2 py-1 text-[11px] text-white bg-gradient-to-t from-black/70 to-transparent truncate">
                    {img.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* PDFs → full PdfViewer instances, one per file. */}
          {classified.filter((a) => a.isPdf).map((pdf, i) => (
            <Suspense
              key={`pdf-${i}`}
              fallback={<Skeleton className="h-[720px] w-full rounded-lg" />}
            >
              <PdfViewer url={pdf.url} fileName={pdf.name} height={720} allowFullscreen />
            </Suspense>
          ))}

          {/* Other formats: fallback card with Open + Download. */}
          {classified.filter((a) => !a.isImage && !a.isPdf).map((other, i) => (
            <OtherAttachmentCard key={`other-${i}`} attachment={other} />
          ))}
        </div>
      )}

      {/* Controlled here so arrow-key navigation cycles only through this year's images. */}
      {lightboxIndex >= 0 && (
        <ImageLightbox
          images={images.map((i) => ({ url: i.url, name: i.name }))}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(-1)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}

/** Ensure the filename carries an extension, derived from the URL or MIME type, since the proxy uses it as the download name. */
function ensureExt(name: string, url: string, type: string): string {
  if (/\.[a-z0-9]{1,8}$/i.test(name)) return name;
  const fromUrl = (url.match(/\.([a-z0-9]{1,8})(?:\?|$)/i) || [])[1];
  const fromType = (type.match(/\/([a-z0-9.+-]+)$/i) || [])[1];
  const ext = fromUrl || (fromType && fromType.replace(/^.*\./, '')) || '';
  return ext ? `${name}.${ext}` : name;
}

/** Word / Excel / archives: formats the browser can't embed inline. */
function OtherAttachmentCard({ attachment }: { attachment: { name: string; url: string; type: string } }) {
  const { name, url, type } = attachment;
  const previewUrl = proxyFileUrl(url, name, true);
  const downloadUrl = proxyFileUrl(url, name, false);
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
      <div className="h-12 w-12 rounded bg-muted grid place-items-center shrink-0">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate" title={name}>{name}</p>
        <p className="text-[11px] text-muted-foreground uppercase">{type}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border hover:bg-accent text-foreground"
          title="Preview"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open
        </a>
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          title="Download"
        >
          <Download className="h-3.5 w-3.5" /> Download
        </a>
      </div>
    </div>
  );
}

