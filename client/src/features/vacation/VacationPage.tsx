import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Calendar, Download, ExternalLink, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import { proxyFileUrl } from '@/lib/fileProxy';
import SEO from '@/components/SEO';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import ImageLightbox from '@/components/chat/ImageLightbox';

// PdfViewer pulls in `react-pdf` + the worker — lazy-load so the bundle stays
// small for visitors viewing years that have no PDF attachments. Same pattern
// used by NoticeDetailPage.
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

  const latest = vacations[0];
  const older = vacations.slice(1);
  const [openYearId, setOpenYearId] = useState<string | null>(null);

  return (
    <div className="container mx-auto py-8">
      <SEO
        title="Vacation Calendar"
        description="Academic year vacation calendar for RDSWA — University of Barishal Rangpur students. Yearly holiday schedules, breaks, and observed days with date ranges and total days."
        keywords="RDSWA vacation, BU Rangpur vacation, academic calendar, holiday schedule, Barishal university vacation"
      />

      <div className="flex items-center gap-2 mb-2">
        <Calendar className="h-6 w-6 text-primary" />
        <BlurText
          text="Vacation Calendar"
          className="text-2xl sm:text-3xl md:text-4xl font-bold"
          delay={80}
          animateBy="words"
          direction="bottom"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Yearly vacation, holiday and break schedule for RDSWA members.
      </p>

      {isLoading ? (
        <Spinner size="md" />
      ) : vacations.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No Vacation Calendars Yet"
          description="The vacation calendar has not been published yet. Check back soon."
        />
      ) : (
        <div className="space-y-8">
          {/* Latest year — table + attachments shown directly. */}
          <FadeIn direction="up">
            <YearCard vacation={latest} highlight />
          </FadeIn>

          {/* Older years — collapsible buttons. */}
          {older.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Previous Academic Years
              </p>
              <div className="space-y-2">
                {older.map((v, i) => {
                  const isOpen = openYearId === v._id;
                  return (
                    <FadeIn key={v._id} direction="up" delay={i * 0.04}>
                      <div className="border rounded-lg overflow-hidden bg-card">
                        <button
                          type="button"
                          onClick={() => setOpenYearId(isOpen ? null : v._id)}
                          aria-expanded={isOpen}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Calendar className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                Academic Year {v.academicYear}
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
                      </div>
                    </FadeIn>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function YearCard({ vacation, highlight = false }: { vacation: Vacation; highlight?: boolean }) {
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
    <div className={highlight ? 'border-2 border-primary/30 rounded-lg bg-card p-4 sm:p-6' : ''}>
      {highlight && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Academic Year {vacation.academicYear}
          </h2>
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
            Latest
          </span>
        </div>
      )}

      {vacation.notes && (
        <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {vacation.notes}
        </p>
      )}

      {vacation.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          No vacation entries listed yet for this year.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-medium text-foreground w-12">#</th>
                  <th className="text-left p-3 font-medium text-foreground">Event</th>
                  <th className="text-left p-3 font-medium text-foreground">Date Range</th>
                  <th className="text-right p-3 font-medium text-foreground w-28">Total Days</th>
                </tr>
              </thead>
              <tbody>
                {vacation.entries.map((e, i) => (
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
                    {vacation.entries.reduce(
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
            {vacation.entries.map((e, i) => (
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

      {/* Attachments — rendered directly so members can read them in place.
          Images use a thumbnail grid that opens ImageLightbox on click;
          PDFs use the project's PdfViewer (lazy-loaded react-pdf with zoom,
          fullscreen, page jump); other docs fall back to a card with
          Open + Download buttons. */}
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
              fallback={
                <div className="flex items-center justify-center gap-2 py-12 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading PDF viewer…
                </div>
              }
            >
              <PdfViewer url={pdf.url} fileName={pdf.name} height={720} allowFullscreen />
            </Suspense>
          ))}

          {/* Other formats — fallback card with Open + Download. */}
          {classified.filter((a) => !a.isImage && !a.isPdf).map((other, i) => (
            <OtherAttachmentCard key={`other-${i}`} attachment={other} />
          ))}
        </div>
      )}

      {/* Lightbox renders in a portal-like fixed overlay; controlled here so
          arrow-key navigation cycles only through this year's images. */}
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

/**
 * Ensure the filename ends with a recognisable extension. The proxy uses
 * this as the Content-Disposition filename — without an extension the OS
 * can't open the downloaded file. Falls back to deriving the extension
 * from the URL or the MIME type.
 */
function ensureExt(name: string, url: string, type: string): string {
  if (/\.[a-z0-9]{1,8}$/i.test(name)) return name;
  const fromUrl = (url.match(/\.([a-z0-9]{1,8})(?:\?|$)/i) || [])[1];
  const fromType = (type.match(/\/([a-z0-9.+-]+)$/i) || [])[1];
  const ext = fromUrl || (fromType && fromType.replace(/^.*\./, '')) || '';
  return ext ? `${name}.${ext}` : name;
}

/** Word / Excel / archives — formats the browser can't embed inline. */
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

