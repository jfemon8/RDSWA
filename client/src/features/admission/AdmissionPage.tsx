import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, ExternalLink, Pin, Calendar, GraduationCap, Megaphone, ListChecks, Target, ChevronDown, Eye, Download } from 'lucide-react';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useTabParam } from '@/hooks/useTabParam';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import Promo from '@/components/promo/Promo';
import PdfPreviewModal, { type PdfPreviewTarget } from '@/components/ui/PdfPreviewModal';
import { proxyFileUrl } from '@/lib/fileProxy';
import { useSiteSettings } from '@/hooks/useSiteSettings';

/** True if the attachment is a PDF — used to decide between in-app modal preview and a plain link. */
function isPdfAttachment(a: { type?: string; url?: string; name?: string }): boolean {
  return (
    (a.type || '').toLowerCase().includes('pdf') ||
    (a.url || '').toLowerCase().includes('.pdf') ||
    (a.name || '').toLowerCase().endsWith('.pdf')
  );
}

type Tab = 'circulars' | 'seats' | 'cutoffs';
const TABS = ['circulars', 'seats', 'cutoffs'] as const;
const TAB_LABELS: Record<Tab, string> = {
  circulars: 'Circular & Notice',
  seats: 'Available Seats',
  cutoffs: 'Cut-off Mark',
};
const TAB_ICONS: Record<Tab, typeof Megaphone> = {
  circulars: Megaphone,
  seats: ListChecks,
  cutoffs: Target,
};

export default function AdmissionPage() {
  const [tab, setTab] = useTabParam<Tab>(TABS, 'circulars');

  return (
    <div className="container mx-auto py-8">
      <SEO
        title="Admission — RDSWA"
        description="University admission information for Rangpur Division students at University of Barishal — admission circulars, GST university seat distribution, and Barishal University cut-off marks. ভর্তি তথ্য, আসন সংখ্যা, কাট-অফ মার্ক।"
        keywords="university admission Bangladesh, GST admission, Barishal University admission, cut-off mark, seat distribution, RDSWA admission, ববি ভর্তি, GST ভর্তি"
      />

      <div className="flex items-center gap-3 mb-6">
        <FadeIn delay={0} direction="left">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
        </FadeIn>
        <div>
          <BlurText
            text="Admission"
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-0"
            delay={80}
            animateBy="words"
            direction="bottom"
          />
          <FadeIn delay={0.3} direction="up">
            <p className="text-muted-foreground text-sm sm:text-base">
              Circulars, seat distribution, and cut-off marks for university admission
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Tab bar — underline indicator pattern matches ProfilePage / ChatHubPage.
          layoutId animates the underline smoothly between tabs. */}
      <FadeIn delay={0.15} direction="up">
        <div className="flex gap-1 sm:gap-2 mb-6 border-b relative overflow-x-auto no-scrollbar -mx-3 sm:mx-0 px-3 sm:px-0">
          {TABS.map((t) => {
            const Icon = TAB_ICONS[t];
            const active = tab === t;
            return (
              <motion.button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`relative px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2 ${
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {TAB_LABELS[t]}
                {active && (
                  <motion.div
                    layoutId="admission-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </FadeIn>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'circulars' && <CircularsTab />}
          {tab === 'seats' && <SeatsTab />}
          {tab === 'cutoffs' && <CutoffsTab />}
        </motion.div>
      </AnimatePresence>

      {/* Bottom promo — single slot below the active tab. Kept distinct from
          the rest of the page so it never wraps the data tables themselves. */}
      <div className="mt-10 empty:hidden">
        <Promo kind="displayResponsive" minHeight={250} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab 1: Circulars & Notices
// ═══════════════════════════════════════════════════════

interface CircularDoc {
  _id: string;
  title: string;
  content?: string;
  session: string;
  applicationStartDate?: string;
  applicationDeadline?: string;
  examDate?: string;
  resultDate?: string;
  attachments?: Array<{ name: string; url: string; type?: string }>;
  externalLinks?: Array<{ label: string; url: string }>;
  publishedAt?: string;
  pinned?: boolean;
  createdAt?: string;
}

function CircularsTab() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admission.circulars(),
    queryFn: async () => (await api.get('/admissions/circulars')).data,
    staleTime: 5 * 60 * 1000,
  });
  const items: CircularDoc[] = data?.data || [];

  // Newest circular auto-expands; everything else stays collapsed so the
  // list stays scannable even when admins have published many circulars.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PdfPreviewTarget | null>(null);

  if (isLoading) return <Spinner size="md" />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No Admission Circulars Yet"
        description="When new admission circulars or notices are published, they will appear here."
        hint="Admin moderators can post circulars from the admin panel."
      />
    );
  }

  // First card opens by default. Once the user toggles anything, their
  // choice wins (expandedId becomes the source of truth).
  const isOpen = (id: string, idx: number) =>
    expandedId === null ? idx === 0 : expandedId === id;

  return (
    <div className="space-y-3">
      {items.map((c, i) => {
        const open = isOpen(c._id, i);
        return (
          <FadeIn key={c._id} delay={i * 0.05} direction="up">
            <div className="border rounded-xl bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : c._id)}
                aria-expanded={open}
                className="w-full flex items-start gap-3 p-4 sm:p-5 text-left hover:bg-accent/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {c.pinned && <Pin className="h-4 w-4 text-primary mt-1 shrink-0" aria-label="Pinned" />}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground text-base sm:text-lg break-words">{c.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      Session: {c.session}
                    </span>
                    {c.publishedAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Published {formatDate(c.publishedAt)}
                      </span>
                    )}
                    {(c.attachments?.length || 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {c.attachments?.length} attachment{c.attachments?.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </div>
                <motion.span
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="shrink-0 text-muted-foreground mt-1"
                >
                  <ChevronDown className="h-5 w-5" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-1 border-t bg-muted/10 space-y-4">
                      {c.content && (
                        <div className="rounded-md border bg-background p-3 mt-3">
                          <RichContent html={c.content} />
                        </div>
                      )}

                      {(c.applicationStartDate || c.applicationDeadline || c.examDate || c.resultDate) && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          {c.applicationStartDate && (
                            <KeyValue label="Application Starts" value={formatDate(c.applicationStartDate)} />
                          )}
                          {c.applicationDeadline && (
                            <KeyValue label="Last Date" value={formatDate(c.applicationDeadline)} highlight />
                          )}
                          {c.examDate && <KeyValue label="Exam Date" value={formatDate(c.examDate)} />}
                          {c.resultDate && <KeyValue label="Result Date" value={formatDate(c.resultDate)} />}
                        </div>
                      )}

                      {(c.attachments?.length || c.externalLinks?.length) ? (
                        <div className="space-y-2">
                          {(c.attachments?.length || 0) > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1.5">Attachments</p>
                              <div className="flex flex-wrap gap-2">
                                {(c.attachments || []).map((a, idx) => {
                                  const pdf = isPdfAttachment(a);
                                  return (
                                    <div key={`a-${idx}`} className="inline-flex items-center rounded-md border bg-background text-xs overflow-hidden">
                                      {pdf ? (
                                        <button
                                          type="button"
                                          onClick={() => setPreview({ fileUrl: a.url, title: a.name })}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent text-foreground transition-colors"
                                          title="Preview PDF"
                                        >
                                          <Eye className="h-3.5 w-3.5" /> {a.name}
                                        </button>
                                      ) : (
                                        <a
                                          href={proxyFileUrl(a.url, a.name, true)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent text-foreground transition-colors"
                                        >
                                          <FileText className="h-3.5 w-3.5" /> {a.name}
                                        </a>
                                      )}
                                      <a
                                        href={proxyFileUrl(a.url, a.name, false)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-1.5 border-l hover:bg-accent text-muted-foreground transition-colors"
                                        title="Download"
                                        aria-label="Download attachment"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {(c.externalLinks?.length || 0) > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1.5">External Links</p>
                              <div className="flex flex-wrap gap-2">
                                {(c.externalLinks || []).map((l, idx) => (
                                  <a
                                    key={`l-${idx}`}
                                    href={l.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border hover:bg-accent text-primary"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" /> {l.label}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </FadeIn>
        );
      })}

      <PdfPreviewModal target={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function KeyValue({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className={`font-medium ${highlight ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab 2: Available Seats
// ═══════════════════════════════════════════════════════

interface SeatRow {
  _id: string;
  category: string;
  universityName: string;
  aUnit: number;
  bUnit: number;
  cUnit: number;
  session: string;
  sortOrder?: number;
}

function SeatsTab() {
  // Fetch every published seat row in one shot — grouping + accordion is
  // done client-side so newer sessions can be added without the page needing
  // to re-query when the user expands an older year.
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admission.seats(),
    queryFn: async () => (await api.get('/admissions/seats')).data,
    staleTime: 5 * 60 * 1000,
  });
  const rows: SeatRow[] = data?.data || [];

  // Bucket rows by session, then sort sessions DESC. The newest session
  // ends up first and opens by default; older ones stay collapsed.
  const bySession = useMemo(() => {
    const map = new Map<string, SeatRow[]>();
    for (const r of rows) {
      if (!map.has(r.session)) map.set(r.session, []);
      map.get(r.session)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  if (isLoading) return <Spinner size="md" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No Seat Data Yet"
        description="Seat distribution for upcoming admission sessions will appear here once published."
      />
    );
  }

  return (
    <div className="space-y-3">
      {bySession.map(([session, sessionRows], idx) => (
        <SessionAccordion
          key={session}
          session={session}
          defaultOpen={idx === 0}
          icon={ListChecks}
          titlePrefix="গুচ্ছ বিশ্ববিদ্যালয়ের আসন সমূহ "
        >
          <SeatsTable rows={sessionRows} />
        </SessionAccordion>
      ))}
    </div>
  );
}

/** Inner seats table — pure renderer, no data fetching. */
function SeatsTable({ rows }: { rows: SeatRow[] }) {
  // Preserve category order via first-seen, matching the DB's `sortOrder`.
  const grouped = useMemo(() => {
    const map = new Map<string, SeatRow[]>();
    for (const r of rows) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          a: acc.a + (r.aUnit || 0),
          b: acc.b + (r.bUnit || 0),
          c: acc.c + (r.cUnit || 0),
        }),
        { a: 0, b: 0, c: 0 }
      ),
    [rows]
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-primary/10 text-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold border-b w-32">Category</th>
            <th className="px-3 py-2 text-left font-semibold border-b">University</th>
            <th className="px-3 py-2 text-center font-semibold border-b w-24">A Unit</th>
            <th className="px-3 py-2 text-center font-semibold border-b w-24">B Unit</th>
            <th className="px-3 py-2 text-center font-semibold border-b w-24">C Unit</th>
            <th className="px-3 py-2 text-center font-semibold border-b w-24">Total</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(([category, items], gIdx) => (
            items.map((r, rIdx) => {
              const rowTotal = (r.aUnit || 0) + (r.bUnit || 0) + (r.cUnit || 0);
              return (
                <motion.tr
                  key={r._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (gIdx * items.length + rIdx) * 0.02 }}
                  className="hover:bg-accent/30 transition-colors"
                >
                  {rIdx === 0 && (
                    <td
                      rowSpan={items.length}
                      className="px-3 py-2 border-b align-middle font-medium text-xs sm:text-sm text-muted-foreground bg-muted/30 [writing-mode:vertical-rl] sm:[writing-mode:horizontal-tb] text-center"
                    >
                      {category}
                    </td>
                  )}
                  <td className="px-3 py-2 border-b">{r.universityName}</td>
                  <td className="px-3 py-2 border-b text-center tabular-nums">{r.aUnit || '—'}</td>
                  <td className="px-3 py-2 border-b text-center tabular-nums">{r.bUnit || '—'}</td>
                  <td className="px-3 py-2 border-b text-center tabular-nums">{r.cUnit || '—'}</td>
                  <td className="px-3 py-2 border-b text-center tabular-nums font-semibold">{rowTotal || '—'}</td>
                </motion.tr>
              );
            })
          ))}
          <tr className="bg-primary/10 font-bold text-foreground">
            <td className="px-3 py-2.5" colSpan={2}>মোট / Total</td>
            <td className="px-3 py-2.5 text-center tabular-nums">{totals.a}</td>
            <td className="px-3 py-2.5 text-center tabular-nums">{totals.b}</td>
            <td className="px-3 py-2.5 text-center tabular-nums">{totals.c}</td>
            <td className="px-3 py-2.5 text-center tabular-nums">{totals.a + totals.b + totals.c}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Tab 3: Cut-off Marks
// ═══════════════════════════════════════════════════════

interface CutoffRow {
  _id: string;
  faculty: string;
  department: string;
  unit: 'A' | 'B' | 'C';
  firstPositionMerit?: number;
  firstPositionScore?: number;
  lastPositionMerit?: number;
  lastPositionScore?: number;
  dataSource?: string;
  session: string;
}

function CutoffsTab() {
  const { settings } = useSiteSettings();
  // Pull the university name from SiteSettings so the header reads
  // "University of Barishal Cut-Off Mark 2024-25" instead of "Session 2024-25".
  // Falls back to "University" if settings haven't loaded yet.
  const universityName = settings?.universityInfo?.name?.trim() || 'University';
  const cutoffTitlePrefix = `${universityName} Cut-Off Mark `;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admission.cutoffs(),
    queryFn: async () => (await api.get('/admissions/cutoffs')).data,
    staleTime: 5 * 60 * 1000,
  });
  const rows: CutoffRow[] = data?.data || [];

  const bySession = useMemo(() => {
    const map = new Map<string, CutoffRow[]>();
    for (const r of rows) {
      if (!map.has(r.session)) map.set(r.session, []);
      map.get(r.session)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  if (isLoading) return <Spinner size="md" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="No Cut-off Data Yet"
        description="When cut-off marks for an admission session are published, they will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {bySession.map(([session, sessionRows], idx) => (
        <SessionAccordion
          key={session}
          session={session}
          defaultOpen={idx === 0}
          icon={Target}
          titlePrefix={cutoffTitlePrefix}
        >
          <CutoffsTable rows={sessionRows} />
        </SessionAccordion>
      ))}
    </div>
  );
}

/** Inner cut-off table — pivots flat rows into a (faculty × department) grid with A/B/C unit cells. */
function CutoffsTable({ rows }: { rows: CutoffRow[] }) {
  const pivot = useMemo(() => {
    type Cell = { firstMerit?: number; firstScore?: number; lastMerit?: number; lastScore?: number };
    type DeptRow = { faculty: string; department: string; cells: Record<'A' | 'B' | 'C', Cell | undefined>; dataSource?: string };
    const byKey = new Map<string, DeptRow>();
    for (const r of rows) {
      const key = `${r.faculty}::${r.department}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          faculty: r.faculty,
          department: r.department,
          cells: { A: undefined, B: undefined, C: undefined },
        });
      }
      const row = byKey.get(key)!;
      row.cells[r.unit] = {
        firstMerit: r.firstPositionMerit,
        firstScore: r.firstPositionScore,
        lastMerit: r.lastPositionMerit,
        lastScore: r.lastPositionScore,
      };
      if (r.dataSource && !row.dataSource) row.dataSource = r.dataSource;
    }
    const grouped = new Map<string, DeptRow[]>();
    for (const row of byKey.values()) {
      if (!grouped.has(row.faculty)) grouped.set(row.faculty, []);
      grouped.get(row.faculty)!.push(row);
    }
    return Array.from(grouped.entries());
  }, [rows]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-primary/10 text-foreground">
          <tr>
            <th rowSpan={3} className="px-3 py-2 text-left font-semibold border-b border-r align-middle">Faculty</th>
            <th rowSpan={3} className="px-3 py-2 text-left font-semibold border-b border-r align-middle">Department</th>
            <th colSpan={4} className="px-3 py-1.5 text-center font-semibold border-b border-r">A Unit</th>
            <th colSpan={4} className="px-3 py-1.5 text-center font-semibold border-b border-r">B Unit</th>
            <th colSpan={4} className="px-3 py-1.5 text-center font-semibold border-b border-r">C Unit</th>
            <th rowSpan={3} className="px-3 py-2 text-left font-semibold border-b align-middle">Data Source</th>
          </tr>
          <tr>
            {(['A', 'B', 'C'] as const).map((u) => (
              <UnitSubHeader key={u} />
            ))}
          </tr>
          <tr>
            {(['A', 'B', 'C'] as const).map((u) => (
              <UnitMiniHeader key={u} />
            ))}
          </tr>
        </thead>
        <tbody>
          {pivot.map(([faculty, deptRows], fIdx) => (
            deptRows.map((row, dIdx) => (
              <motion.tr
                key={`${faculty}::${row.department}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: (fIdx * deptRows.length + dIdx) * 0.015 }}
                className="hover:bg-accent/30 transition-colors"
              >
                {dIdx === 0 && (
                  <td
                    rowSpan={deptRows.length}
                    className="px-3 py-2 border-b border-r align-middle font-medium text-xs text-muted-foreground bg-muted/30"
                  >
                    {faculty}
                  </td>
                )}
                <td className="px-3 py-2 border-b border-r">{row.department}</td>
                {(['A', 'B', 'C'] as const).map((u) => {
                  const c = row.cells[u];
                  return <CellGroup key={u} cell={c} />;
                })}
                <td className="px-3 py-2 border-b">{row.dataSource || '—'}</td>
              </motion.tr>
            ))
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnitSubHeader() {
  return (
    <>
      <th colSpan={2} className="px-2 py-1 text-center font-medium text-xs border-b">1st Position</th>
      <th colSpan={2} className="px-2 py-1 text-center font-medium text-xs border-b border-r">Last Position</th>
    </>
  );
}

function UnitMiniHeader() {
  return (
    <>
      <th className="px-2 py-1 text-center font-medium text-[10px] border-b text-muted-foreground">Merit</th>
      <th className="px-2 py-1 text-center font-medium text-[10px] border-b text-muted-foreground">Score</th>
      <th className="px-2 py-1 text-center font-medium text-[10px] border-b text-muted-foreground">Merit</th>
      <th className="px-2 py-1 text-center font-medium text-[10px] border-b border-r text-muted-foreground">Score</th>
    </>
  );
}

function CellGroup({ cell }: { cell?: { firstMerit?: number; firstScore?: number; lastMerit?: number; lastScore?: number } }) {
  if (!cell) {
    return (
      <>
        <td className="px-2 py-2 border-b text-center text-muted-foreground/50">×</td>
        <td className="px-2 py-2 border-b text-center text-muted-foreground/50">×</td>
        <td className="px-2 py-2 border-b text-center text-muted-foreground/50">×</td>
        <td className="px-2 py-2 border-b border-r text-center text-muted-foreground/50">×</td>
      </>
    );
  }
  return (
    <>
      <td className="px-2 py-2 border-b text-center tabular-nums">{cell.firstMerit ?? '—'}</td>
      <td className="px-2 py-2 border-b text-center tabular-nums">{cell.firstScore?.toFixed(2) ?? '—'}</td>
      <td className="px-2 py-2 border-b text-center tabular-nums">{cell.lastMerit ?? '—'}</td>
      <td className="px-2 py-2 border-b border-r text-center tabular-nums">{cell.lastScore?.toFixed(2) ?? '—'}</td>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// Shared: session accordion (latest open by default, others collapsed)
// ═══════════════════════════════════════════════════════

/**
 * One collapsible session block. Renders a header row with the session label
 * and a row count, then the table (children) inside an animated drawer.
 * `defaultOpen` is honored once on mount — the user's expand/collapse choice
 * wins afterwards. Visual style mirrors the document/notice expandable cards
 * elsewhere in the project.
 */
function SessionAccordion({
  session,
  defaultOpen,
  icon: Icon,
  titlePrefix = 'Session ',
  children,
}: {
  session: string;
  defaultOpen: boolean;
  icon: typeof Megaphone;
  /** Literal text shown before the session label in the header.
   *  Each tab passes its own (e.g., "গুচ্ছ বিশ্ববিদ্যালয়ের আসন সমূহ " for Seats). */
  titlePrefix?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <FadeIn direction="up" delay={0.05}>
      <div className="border rounded-xl bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground break-words">{titlePrefix}{session}</p>
            {defaultOpen && (
              <p className="text-[11px] uppercase tracking-wide text-primary/80 mt-0.5">Most recent</p>
            )}
          </div>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="shrink-0 text-muted-foreground"
          >
            <ChevronDown className="h-5 w-5" />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="border-t">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
}
