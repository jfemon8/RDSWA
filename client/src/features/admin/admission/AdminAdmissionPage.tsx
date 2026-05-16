import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Pencil, Trash2, Save, Loader2, X, Pin, Megaphone, ListChecks, Target,
  Upload, FileText, ChevronDown, Eye, Download, ExternalLink, Calendar,
  Copy, Check,
} from 'lucide-react';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useTabParam } from '@/hooks/useTabParam';
import { formatDate } from '@/lib/date';
import { proxyFileUrl } from '@/lib/fileProxy';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { FadeIn } from '@/components/reactbits';
import RichContent from '@/components/ui/RichContent';
import RichTextEditor from '@/components/ui/RichTextEditor';
import Spinner from '@/components/ui/Spinner';
import PdfPreviewModal, { type PdfPreviewTarget } from '@/components/ui/PdfPreviewModal';

/** Local copy of the PDF-detection heuristic used on the public page. */
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
  circulars: 'Circulars & Notices',
  seats: 'Available Seats',
  cutoffs: 'Cut-off Marks',
};
const TAB_ICONS: Record<Tab, typeof Megaphone> = {
  circulars: Megaphone,
  seats: ListChecks,
  cutoffs: Target,
};

export default function AdminAdmissionPage() {
  const [tab, setTab] = useTabParam<Tab>(TABS, 'circulars');

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Admission Management</h1>

        <div className="flex flex-nowrap gap-1.5 mb-6 border-b pb-2 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-thin">
          {TABS.map((t) => {
            const Icon = TAB_ICONS[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                  tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {TAB_LABELS[t]}
              </button>
            );
          })}
        </div>

        {tab === 'circulars' && <CircularsSection />}
        {tab === 'seats' && <SeatsSection />}
        {tab === 'cutoffs' && <CutoffsSection />}
      </div>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════
// Circulars CRUD
// ═══════════════════════════════════════════════════════

interface CircularForm {
  _id?: string;
  title: string;
  content: string;
  session: string;
  applicationStartDate: string;
  applicationDeadline: string;
  examDate: string;
  resultDate: string;
  attachments: Array<{ name: string; url: string; type?: string }>;
  externalLinks: Array<{ label: string; url: string }>;
  isPublished: boolean;
  pinned: boolean;
}

const emptyCircular: CircularForm = {
  title: '',
  content: '',
  session: '',
  applicationStartDate: '',
  applicationDeadline: '',
  examDate: '',
  resultDate: '',
  attachments: [],
  externalLinks: [],
  isPublished: true,
  pinned: false,
};

function CircularsSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CircularForm>(emptyCircular);
  const [uploading, setUploading] = useState(false);
  // Per-card expand state lets moderators review the rendered content +
  // attachments without leaving the admin page.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PdfPreviewTarget | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admission.circularsAdmin(),
    queryFn: async () => (await api.get('/admissions/circulars/admin')).data,
  });
  const items: any[] = data?.data || [];

  const reset = () => { setForm(emptyCircular); setShowForm(false); };

  const saveMutation = useMutation({
    mutationFn: async (payload: CircularForm) => {
      const body: Record<string, unknown> = {
        title: payload.title,
        content: payload.content || undefined,
        session: payload.session,
        attachments: payload.attachments,
        externalLinks: payload.externalLinks,
        isPublished: payload.isPublished,
        pinned: payload.pinned,
      };
      // Date fields stay null when blank so the server stores `undefined`
      // instead of "Invalid Date".
      body.applicationStartDate = payload.applicationStartDate ? new Date(payload.applicationStartDate).toISOString() : null;
      body.applicationDeadline = payload.applicationDeadline ? new Date(payload.applicationDeadline).toISOString() : null;
      body.examDate = payload.examDate ? new Date(payload.examDate).toISOString() : null;
      body.resultDate = payload.resultDate ? new Date(payload.resultDate).toISOString() : null;
      if (payload._id) {
        return api.patch(`/admissions/circulars/${payload._id}`, body);
      }
      return api.post('/admissions/circulars', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission'] });
      toast.success('Circular saved');
      reset();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admissions/circulars/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission'] });
      toast.success('Deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const handleEdit = (c: any) => {
    setForm({
      _id: c._id,
      title: c.title || '',
      content: c.content || '',
      session: c.session || '',
      applicationStartDate: c.applicationStartDate ? c.applicationStartDate.slice(0, 10) : '',
      applicationDeadline: c.applicationDeadline ? c.applicationDeadline.slice(0, 10) : '',
      examDate: c.examDate ? c.examDate.slice(0, 10) : '',
      resultDate: c.resultDate ? c.resultDate.slice(0, 10) : '',
      attachments: c.attachments || [],
      externalLinks: c.externalLinks || [],
      isPublished: c.isPublished !== false,
      pinned: !!c.pinned,
    });
    setShowForm(true);
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Attachment must be 10 MB or smaller');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload/document', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((f) => ({ ...f, attachments: [...f.attachments, { name: file.name, url: data.data.url, type: file.type }] }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Publish admission circulars, exam dates, and result notifications. Pinned circulars appear at the top of the public list.
        </p>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { setForm(emptyCircular); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New Circular
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-5 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{form._id ? 'Edit Circular' : 'New Circular'}</h3>
                <button type="button" onClick={reset} className="p-1 rounded hover:bg-accent text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Title *">
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </Field>
                <Field label="Session *" hint="e.g., 2025-26">
                  <input
                    value={form.session}
                    onChange={(e) => setForm({ ...form, session: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                </Field>
                <Field label="Application Starts">
                  <input type="date" value={form.applicationStartDate} onChange={(e) => setForm({ ...form, applicationStartDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </Field>
                <Field label="Application Deadline">
                  <input type="date" value={form.applicationDeadline} onChange={(e) => setForm({ ...form, applicationDeadline: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </Field>
                <Field label="Exam Date">
                  <input type="date" value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </Field>
                <Field label="Result Date">
                  <input type="date" value={form.resultDate} onChange={(e) => setForm({ ...form, resultDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </Field>
              </div>

              <Field label="Content">
                <RichTextEditor value={form.content} onChange={(v) => setForm({ ...form, content: v })} />
              </Field>

              {/* Attachments */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Attachments</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.attachments.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs">
                      <FileText className="h-3.5 w-3.5" /> {a.name}
                      <button type="button" onClick={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, j) => j !== i) }))}
                        className="text-muted-foreground hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border bg-background hover:bg-accent cursor-pointer">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Add file
                  <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={handleAttachmentUpload} disabled={uploading} />
                </label>
              </div>

              {/* External links */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">External Links</p>
                {form.externalLinks.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input placeholder="Label" value={l.label}
                      onChange={(e) => setForm((f) => ({ ...f, externalLinks: f.externalLinks.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))}
                      className="flex-1 px-2.5 py-1.5 border rounded-md bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    <input placeholder="https://…" value={l.url}
                      onChange={(e) => setForm((f) => ({ ...f, externalLinks: f.externalLinks.map((x, j) => j === i ? { ...x, url: e.target.value } : x) }))}
                      className="flex-[2] px-2.5 py-1.5 border rounded-md bg-background text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, externalLinks: f.externalLinks.filter((_, j) => j !== i) }))}
                      className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setForm((f) => ({ ...f, externalLinks: [...f.externalLinks, { label: '', url: '' }] }))}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-accent">
                  <Plus className="h-3 w-3" /> Add link
                </button>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="rounded" />
                  Published (visible on public page)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="rounded" />
                  Pin to top
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => saveMutation.mutate(form)}
                  disabled={saveMutation.isPending || !form.title || !form.session}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {form._id ? 'Update' : 'Create'}
                </motion.button>
                <button onClick={reset} className="px-4 py-2 text-sm rounded-md border hover:bg-accent">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <Spinner size="md" />
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No circulars yet — click "New Circular" above.</p>
      ) : (
        <div className="space-y-2">
          {items.map((c: any, i: number) => {
            const open = expandedId === c._id;
            return (
              <FadeIn key={c._id} delay={i * 0.04} direction="up">
                <div className="border rounded-lg bg-card overflow-hidden">
                  <div className="flex items-start justify-between gap-3 p-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : c._id)}
                      aria-expanded={open}
                      className="flex items-start gap-2 flex-1 min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-md -m-1 p-1"
                    >
                      {c.pinned && <Pin className="h-3.5 w-3.5 text-primary mt-1" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-foreground truncate">{c.title}</h4>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary">{c.session}</span>
                          {!c.isPublished && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Draft</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(c.attachments?.length || 0)} attachment{(c.attachments?.length || 0) === 1 ? '' : 's'} · {(c.externalLinks?.length || 0)} link{(c.externalLinks?.length || 0) === 1 ? '' : 's'}
                        </p>
                      </div>
                      <motion.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                        className="shrink-0 text-muted-foreground mt-1"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </motion.span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => handleEdit(c)} className="p-1.5 rounded hover:bg-accent text-foreground" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete circular?',
                            message: `"${c.title}" will be removed from the admission page. This action can't be undone.`,
                            confirmLabel: 'Delete',
                            variant: 'danger',
                          });
                          if (ok) deleteMutation.mutate(c._id);
                        }}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t bg-muted/10 px-4 py-3 space-y-3">
                          {c.publishedAt && (
                            <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> Published {formatDate(c.publishedAt)}
                            </p>
                          )}

                          {c.content && (
                            <div className="rounded-md border bg-background p-3">
                              <RichContent html={c.content} />
                            </div>
                          )}

                          {(c.applicationStartDate || c.applicationDeadline || c.examDate || c.resultDate) && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              {c.applicationStartDate && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Application Starts</p>
                                  <p className="font-medium text-foreground">{formatDate(c.applicationStartDate)}</p>
                                </div>
                              )}
                              {c.applicationDeadline && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Last Date</p>
                                  <p className="font-medium text-red-600 dark:text-red-400">{formatDate(c.applicationDeadline)}</p>
                                </div>
                              )}
                              {c.examDate && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Exam Date</p>
                                  <p className="font-medium text-foreground">{formatDate(c.examDate)}</p>
                                </div>
                              )}
                              {c.resultDate && (
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Result Date</p>
                                  <p className="font-medium text-foreground">{formatDate(c.resultDate)}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {(c.attachments?.length || 0) > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1.5">Attachments</p>
                              <div className="flex flex-wrap gap-2">
                                {(c.attachments || []).map((a: any, idx: number) => {
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
                                {(c.externalLinks || []).map((l: any, idx: number) => (
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeIn>
            );
          })}
        </div>
      )}

      <PdfPreviewModal target={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Seats CRUD
// ═══════════════════════════════════════════════════════

interface SeatForm {
  _id?: string;
  category: string;
  universityName: string;
  aUnit: number;
  bUnit: number;
  cUnit: number;
  session: string;
  sortOrder: number;
}

const emptySeat: SeatForm = {
  category: '', universityName: '', aUnit: 0, bUnit: 0, cUnit: 0, session: '', sortOrder: 0,
};

/** What the rename modal is currently targeting — either a whole session, or
 *  a category within a session. `null` means the modal is closed. */
type RenameTarget =
  | { kind: 'session'; session: string }
  | { kind: 'category'; session: string; category: string }
  | null;

function SeatsSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  // Form state — `editingSession` identifies WHICH session's accordion shows
  // the inline form. Session lives in the form too so the mutation has it,
  // but the UI never asks the admin to type or change it.
  const [form, setForm] = useState<SeatForm>(emptySeat);
  const [editingSession, setEditingSession] = useState<string | null>(null);

  // Client-only stub sessions: a session label that exists in the UI but has
  // no rows in the DB yet. Created via the "New Session" button so admins
  // can open the inline form inside a brand-new session before any row
  // exists server-side. Once a row is saved, the server data takes over.
  const [pendingSessions, setPendingSessions] = useState<string[]>([]);

  // New Session dialog state.
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newSessionLabel, setNewSessionLabel] = useState('');

  // Clone Session dialog state.
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneFrom, setCloneFrom] = useState('');
  const [cloneTo, setCloneTo] = useState('');

  // Rename modal state — shared by session-rename and category-rename so we
  // don't ship two near-identical dialogs.
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameValue, setRenameValue] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admission.seats(),
    queryFn: async () => (await api.get('/admissions/seats')).data,
  });
  const rows: any[] = data?.data || [];

  // Bucket rows by session (server data), then merge in any pending stub
  // sessions that don't yet have rows. Sort desc so newest is at the top.
  const bySession = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      if (!map.has(r.session)) map.set(r.session, []);
      map.get(r.session)!.push(r);
    }
    for (const s of pendingSessions) {
      if (!map.has(s)) map.set(s, []);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows, pendingSessions]);

  const categoriesInSession = (session: string) =>
    Array.from(new Set(rows.filter((r) => r.session === session).map((r) => r.category)));

  const closeForm = () => { setForm(emptySeat); setEditingSession(null); };

  const saveMutation = useMutation({
    mutationFn: async (payload: SeatForm) => {
      const body = {
        category: payload.category, universityName: payload.universityName,
        aUnit: payload.aUnit || 0, bUnit: payload.bUnit || 0, cUnit: payload.cUnit || 0,
        session: payload.session, sortOrder: payload.sortOrder || 0,
      };
      if (payload._id) return api.patch(`/admissions/seats/${payload._id}`, body);
      return api.post('/admissions/seats', body);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admission'] });
      toast.success('Seat row saved');
      // The session now has at least one row server-side, so drop its stub.
      setPendingSessions((prev) => prev.filter((s) => s !== variables.session));
      closeForm();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admissions/seats/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admission'] }); toast.success('Deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  // ── Bulk session / category mutations ───────────────────
  const cloneMutation = useMutation({
    mutationFn: (body: { sourceSession: string; targetSession: string }) =>
      api.post('/admissions/seats/sessions/clone', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission'] });
      toast.success('Session cloned');
      setCloneOpen(false);
      setCloneFrom('');
      setCloneTo('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Clone failed'),
  });

  const sessionRenameMutation = useMutation({
    mutationFn: (body: { from: string; to: string }) =>
      api.patch('/admissions/seats/sessions/rename', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission'] });
      toast.success('Session renamed');
      setRenameTarget(null);
      setRenameValue('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Rename failed'),
  });

  const sessionDeleteMutation = useMutation({
    mutationFn: (session: string) =>
      api.delete('/admissions/seats/sessions', { data: { session } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission'] });
      toast.success('Session deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const categoryRenameMutation = useMutation({
    mutationFn: (body: { session: string; from: string; to: string }) =>
      api.patch('/admissions/seats/categories/rename', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission'] });
      toast.success('Category renamed');
      setRenameTarget(null);
      setRenameValue('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Rename failed'),
  });

  const categoryDeleteMutation = useMutation({
    mutationFn: (body: { session: string; category: string }) =>
      api.delete('/admissions/seats/categories', { data: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission'] });
      toast.success('Category deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  // ── Handlers ────────────────────────────────────────────
  /** Open the inline form inside the given session for editing a row. */
  const handleEdit = (r: any) => {
    setForm({
      _id: r._id, category: r.category, universityName: r.universityName,
      aUnit: r.aUnit || 0, bUnit: r.bUnit || 0, cUnit: r.cUnit || 0,
      session: r.session, sortOrder: r.sortOrder || 0,
    });
    setEditingSession(r.session);
  };

  /** Open the inline form inside the given session for a new row.
   *  `category` is optional — when set (from the per-category Add button) the
   *  form's category is pre-selected so admins don't pick it again. */
  const handleAddTo = (session: string, category = '') => {
    setForm({ ...emptySeat, session, category });
    setEditingSession(session);
  };

  /** Create a brand-new session via the dialog: register it as a pending stub
   *  and open the inline form inside it so the admin can immediately add the
   *  first row. */
  const submitNewSession = () => {
    const label = newSessionLabel.trim();
    if (!label) { toast.error('Session label required'); return; }
    if (bySession.some(([s]) => s === label)) {
      toast.error(`Session "${label}" already exists`);
      return;
    }
    setPendingSessions((prev) => (prev.includes(label) ? prev : [...prev, label]));
    setNewSessionOpen(false);
    setNewSessionLabel('');
    // Open the inline form inside the new session immediately.
    handleAddTo(label);
  };

  const handleSessionDelete = async (session: string, count: number) => {
    const ok = await confirm({
      title: 'Delete entire session?',
      message: `Session "${session}" and all ${count} row${count === 1 ? '' : 's'} under it will be removed. This cannot be undone.`,
      confirmLabel: 'Delete session',
      variant: 'danger',
      requireTypeToConfirm: session,
    });
    if (ok) sessionDeleteMutation.mutate(session);
  };

  const handleCategoryDelete = async (session: string, category: string, count: number) => {
    const ok = await confirm({
      title: 'Delete category?',
      message: `Category "${category}" in session "${session}" (${count} row${count === 1 ? '' : 's'}) will be removed.`,
      confirmLabel: 'Delete category',
      variant: 'danger',
    });
    if (ok) categoryDeleteMutation.mutate({ session, category });
  };

  const openSessionRename = (session: string) => {
    setRenameTarget({ kind: 'session', session });
    setRenameValue(session);
  };
  const openCategoryRename = (session: string, category: string) => {
    setRenameTarget({ kind: 'category', session, category });
    setRenameValue(category);
  };

  const submitRename = () => {
    if (!renameTarget) return;
    const next = renameValue.trim();
    if (!next) { toast.error('Name cannot be empty'); return; }
    if (renameTarget.kind === 'session') {
      if (next === renameTarget.session) { setRenameTarget(null); return; }
      sessionRenameMutation.mutate({ from: renameTarget.session, to: next });
    } else {
      if (next === renameTarget.category) { setRenameTarget(null); return; }
      categoryRenameMutation.mutate({ session: renameTarget.session, from: renameTarget.category, to: next });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Sessions are at the top level; expand any session to manage its categories and rows. The session is
          implicit when adding rows — no need to retype it. Use <span className="font-medium text-foreground">Clone Session</span>
          to copy an existing year forward without re-entering every row.
        </p>
        <div className="flex gap-2 flex-wrap">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setCloneFrom(bySession[0]?.[0] || ''); setCloneTo(''); setCloneOpen(true); }}
            disabled={bySession.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border hover:bg-accent disabled:opacity-50"
            title={bySession.length === 0 ? 'Create a session first to clone from' : 'Clone an existing session'}
          >
            <Copy className="h-4 w-4" /> Clone Session
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { setNewSessionLabel(''); setNewSessionOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New Session
          </motion.button>
        </div>
      </div>

      {isLoading ? (
        <Spinner size="md" />
      ) : bySession.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          No seat data yet — click "New Session" above to add the first session.
        </p>
      ) : (
        <div className="space-y-3">
          {bySession.map(([session, sessionRows], idx) => {
            const formActive = editingSession === session;
            const sessionCategories = categoriesInSession(session);
            return (
              <AdminSessionAccordion
                key={session}
                session={session}
                count={sessionRows.length}
                defaultOpen={idx === 0 || formActive}
                icon={ListChecks}
                onAddRow={() => handleAddTo(session)}
                extraActions={
                  <>
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button"
                      onClick={(e) => { e.stopPropagation(); openSessionRename(session); }}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border hover:bg-accent"
                      title="Rename session"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button"
                      onClick={(e) => { e.stopPropagation(); handleSessionDelete(session, sessionRows.length); }}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete entire session"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </motion.button>
                  </>
                }
              >
                <AnimatePresence initial={false}>
                  {formActive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <InlineSeatForm
                        session={session}
                        categories={sessionCategories}
                        form={form}
                        onChange={setForm}
                        onSubmit={() => saveMutation.mutate(form)}
                        onCancel={closeForm}
                        submitting={saveMutation.isPending}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {sessionRows.length === 0 && !formActive ? (
                  <p className="text-center text-xs text-muted-foreground py-6">
                    No rows in this session yet — click "Add Row" above to add one.
                  </p>
                ) : (
                  <SeatsSessionBody
                    session={session}
                    rows={sessionRows}
                    onEdit={handleEdit}
                    onDeleteRow={async (r) => {
                      const ok = await confirm({
                        title: 'Delete seat row?',
                        message: `${r.universityName} (${r.category}) for session ${r.session} will be removed.`,
                        confirmLabel: 'Delete',
                        variant: 'danger',
                      });
                      if (ok) deleteMutation.mutate(r._id);
                    }}
                    onAddToCategory={(category) => handleAddTo(session, category)}
                    onRenameCategory={(category) => openCategoryRename(session, category)}
                    onDeleteCategory={(category, count) => handleCategoryDelete(session, category, count)}
                  />
                )}
              </AdminSessionAccordion>
            );
          })}
        </div>
      )}

      <NewSessionDialog
        open={newSessionOpen}
        value={newSessionLabel}
        existing={bySession.map(([s]) => s)}
        onChange={setNewSessionLabel}
        onClose={() => setNewSessionOpen(false)}
        onSubmit={submitNewSession}
      />

      <CloneSessionDialog
        open={cloneOpen}
        sessions={bySession.filter(([, r]) => r.length > 0).map(([s]) => s)}
        sourceSession={cloneFrom}
        targetSession={cloneTo}
        onSourceChange={setCloneFrom}
        onTargetChange={setCloneTo}
        onClose={() => setCloneOpen(false)}
        onSubmit={() => cloneMutation.mutate({ sourceSession: cloneFrom.trim(), targetSession: cloneTo.trim() })}
        submitting={cloneMutation.isPending}
      />

      <RenameDialog
        target={renameTarget}
        value={renameValue}
        onChange={setRenameValue}
        onClose={() => setRenameTarget(null)}
        onSubmit={submitRename}
        submitting={sessionRenameMutation.isPending || categoryRenameMutation.isPending}
      />
    </div>
  );
}

/** Inside-the-accordion body: groups a session's rows by category and exposes
 *  per-category actions (rename, delete, add row). The table per category
 *  drops the redundant category column since the header already says it. */
function SeatsSessionBody({
  session,
  rows,
  onEdit,
  onDeleteRow,
  onAddToCategory,
  onRenameCategory,
  onDeleteCategory,
}: {
  session: string;
  rows: any[];
  onEdit: (r: any) => void;
  onDeleteRow: (r: any) => void;
  onAddToCategory: (category: string) => void;
  onRenameCategory: (category: string) => void;
  onDeleteCategory: (category: string, count: number) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="divide-y">
      {grouped.map(([category, items]) => (
        <div key={`${session}::${category}`} className="bg-card">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex-1 truncate">
              {category}
              <span className="ml-2 text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                {items.length} row{items.length === 1 ? '' : 's'}
              </span>
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button"
              onClick={() => onAddToCategory(category)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md bg-primary/10 text-primary hover:bg-primary/20"
              title={`Add row to ${category}`}
            >
              <Plus className="h-3 w-3" /> Add
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button"
              onClick={() => onRenameCategory(category)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border hover:bg-accent"
              title="Rename category"
            >
              <Pencil className="h-3 w-3" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="button"
              onClick={() => onDeleteCategory(category, items.length)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Delete category"
            >
              <Trash2 className="h-3 w-3" />
            </motion.button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr>
                  <th className="px-3 py-2 text-left">University</th>
                  <th className="px-3 py-2 text-center w-20">A</th>
                  <th className="px-3 py-2 text-center w-20">B</th>
                  <th className="px-3 py-2 text-center w-20">C</th>
                  <th className="px-3 py-2 text-center w-20">Total</th>
                  <th className="px-3 py-2 text-center w-20">Order</th>
                  <th className="px-3 py-2 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r: any, i: number) => (
                  <motion.tr
                    key={r._id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-accent/30 transition-colors border-b last:border-b-0"
                  >
                    <td className="px-3 py-2">{r.universityName}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{r.aUnit || 0}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{r.bUnit || 0}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{r.cUnit || 0}</td>
                    <td className="px-3 py-2 text-center tabular-nums font-medium">
                      {(r.aUnit || 0) + (r.bUnit || 0) + (r.cUnit || 0)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">{r.sortOrder || 0}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => onEdit(r)} className="p-1.5 rounded hover:bg-accent" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteRow(r)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Backdrop-blurred modal for "Clone Session": pick source from existing
 *  sessions, type a new target label. Server rejects a target that already
 *  has data so admins can't silently overwrite an existing session. */

/**
 * Inline form rendered INSIDE a session accordion. The session is locked in
 * by context (the accordion's session) so the form never asks the admin to
 * pick or type a session. Category is a strict <select> of this session's
 * existing categories, plus an explicit "+ Add new category" mode that
 * swaps the select for a text input so admins can introduce a fresh one
 * without accidentally creating typos on existing categories.
 */
function InlineSeatForm({
  session,
  categories,
  form,
  onChange,
  onSubmit,
  onCancel,
  submitting,
}: {
  session: string;
  categories: string[];
  form: SeatForm;
  onChange: (next: SeatForm) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  // Default to "add new" if the session has no categories at all (otherwise
  // the dropdown would be empty and admins couldn't move forward).
  // For edits, the row's category exists in `categories`, so select mode wins.
  const [newCategoryMode, setNewCategoryMode] = useState(categories.length === 0);

  // If the session gains its first category mid-edit (after a save in a sibling),
  // switch back to select mode so the admin sees the new value.
  useEffect(() => {
    if (categories.length > 0 && !form._id && !form.category) setNewCategoryMode(false);
  }, [categories.length, form._id, form.category]);

  return (
    <div className="border-b bg-muted/20 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground text-sm">
          {form._id ? 'Edit row in' : 'Add row to'}{' '}
          <span className="text-primary">Session {session}</span>
        </h3>
        <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-accent text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Category *">
          {newCategoryMode ? (
            <div className="flex gap-1.5">
              <input
                autoFocus
                value={form.category}
                onChange={(e) => onChange({ ...form, category: e.target.value })}
                placeholder="e.g., General University"
                className="flex-1 px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => { onChange({ ...form, category: '' }); setNewCategoryMode(false); }}
                  className="px-2.5 py-2 text-xs rounded-md border hover:bg-accent text-muted-foreground"
                  title="Pick from existing categories"
                >
                  ← Existing
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-1.5">
              <select
                value={form.category}
                onChange={(e) => onChange({ ...form, category: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">Select category…</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                type="button"
                onClick={() => { onChange({ ...form, category: '' }); setNewCategoryMode(true); }}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs rounded-md border hover:bg-accent text-primary"
                title="Add a new category"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            </div>
          )}
        </Field>
        <Field label="University Name *">
          <input
            value={form.universityName}
            onChange={(e) => onChange({ ...form, universityName: e.target.value })}
            placeholder="e.g., University of Barishal"
            className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </Field>
        <Field label="A Unit Seats">
          <NumberInput value={form.aUnit} onChange={(v) => onChange({ ...form, aUnit: v })} />
        </Field>
        <Field label="B Unit Seats">
          <NumberInput value={form.bUnit} onChange={(v) => onChange({ ...form, bUnit: v })} />
        </Field>
        <Field label="C Unit Seats">
          <NumberInput value={form.cUnit} onChange={(v) => onChange({ ...form, cUnit: v })} />
        </Field>
        <Field label="Total Seats" hint="Computed — A + B + C">
          <div className="w-full px-3 py-2 border rounded-md bg-background/50 text-sm tabular-nums font-medium text-foreground">
            {(form.aUnit || 0) + (form.bUnit || 0) + (form.cUnit || 0)}
          </div>
        </Field>
        <Field label="Sort Order" hint="Lower numbers appear first within the category">
          <NumberInput value={form.sortOrder} onChange={(v) => onChange({ ...form, sortOrder: v })} />
        </Field>
      </div>

      <div className="flex gap-2 pt-1">
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={onSubmit}
          disabled={submitting || !form.category.trim() || !form.universityName.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {form._id ? 'Update' : 'Add Row'}
        </motion.button>
        <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border hover:bg-accent">Cancel</button>
      </div>
    </div>
  );
}

/** "New Session" dialog: ask for a label, validate uniqueness client-side,
 *  then add to `pendingSessions` so the empty session shows up in the list. */
function NewSessionDialog({
  open,
  value,
  existing,
  onChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  value: string;
  existing: string[];
  onChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const trimmed = value.trim();
  const collision = trimmed && existing.includes(trimmed);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-card border rounded-xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">New Session</h3>
              </div>
              <button type="button" onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (!collision) onSubmit(); }}
              className="p-5 space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                Create a new admission session. The session opens immediately with the inline form
                so you can add the first row right away.
              </p>
              <Field label="Session label *" hint="e.g., 2026-27 — must be unique">
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="2026-27"
                  className={`w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${collision ? 'border-red-500' : ''}`}
                />
                {collision && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                    Session "{trimmed}" already exists.
                  </p>
                )}
              </Field>
              <div className="flex justify-end gap-2 -mx-5 -mb-5 px-5 py-3 border-t bg-muted/20 mt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border hover:bg-accent">Cancel</button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  disabled={!trimmed || !!collision}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Create
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CloneSessionDialog({
  open,
  sessions,
  sourceSession,
  targetSession,
  onSourceChange,
  onTargetChange,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  sessions: string[];
  sourceSession: string;
  targetSession: string;
  onSourceChange: (v: string) => void;
  onTargetChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-card border rounded-xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Clone Session</h3>
              </div>
              <button type="button" onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                Every row in the source session will be copied into the new session label. The source remains untouched.
                The target session must not already exist.
              </p>
              <Field label="Source session *">
                <select
                  value={sourceSession}
                  onChange={(e) => onSourceChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">Select a session…</option>
                  {sessions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="New session label *" hint="e.g., 2026-27 — must be unique">
                <input
                  value={targetSession}
                  onChange={(e) => onTargetChange(e.target.value)}
                  placeholder="2026-27"
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t bg-muted/20">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border hover:bg-accent">Cancel</button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={onSubmit}
                disabled={submitting || !sourceSession || !targetSession.trim() || sourceSession === targetSession.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Clone
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Generic single-input rename modal used for both session and category. */
function RenameDialog({
  target,
  value,
  onChange,
  onClose,
  onSubmit,
  submitting,
}: {
  target: RenameTarget;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-card border rounded-xl shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">
                  {target.kind === 'session' ? 'Rename session' : 'Rename category'}
                </h3>
              </div>
              <button type="button" onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
              className="p-5 space-y-3"
            >
              <p className="text-xs text-muted-foreground">
                {target.kind === 'session'
                  ? `Rename "${target.session}" everywhere it's used. All rows in this session will be updated.`
                  : `Rename "${target.category}" within session "${target.session}". Only rows in this session are affected.`}
              </p>
              <Field label="New name *">
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </Field>
              <div className="flex justify-end gap-2 -mx-5 -mb-5 px-5 py-3 border-t bg-muted/20 mt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border hover:bg-accent">Cancel</button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  disabled={submitting || !value.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════
// Cut-offs CRUD
// ═══════════════════════════════════════════════════════

interface CutoffForm {
  _id?: string;
  faculty: string;
  department: string;
  unit: 'A' | 'B' | 'C';
  firstPositionMerit: string;
  firstPositionScore: string;
  lastPositionMerit: string;
  lastPositionScore: string;
  dataSource: string;
  session: string;
  sortOrder: number;
}

const emptyCutoff: CutoffForm = {
  faculty: '', department: '', unit: 'A',
  firstPositionMerit: '', firstPositionScore: '',
  lastPositionMerit: '', lastPositionScore: '',
  dataSource: '', session: '', sortOrder: 0,
};

function CutoffsSection() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CutoffForm>(emptyCutoff);

  // Faculty + Department dropdowns are driven by SiteSettings.academicConfig
  // — the same source the rest of the platform uses, so a department added
  // in Settings → Academic Config is immediately available here.
  const { data: academicResp } = useQuery({
    queryKey: ['settings', 'academic-config'],
    queryFn: async () => (await api.get('/settings/academic-config')).data,
    staleTime: 30 * 60 * 1000,
  });
  const faculties: Array<{ name: string; departments: string[] }> = academicResp?.data?.faculties || [];
  const facultyDepartments = useMemo(() => {
    const f = faculties.find((x) => x.name === form.faculty);
    return f?.departments || [];
  }, [faculties, form.faculty]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admission.cutoffs(),
    queryFn: async () => (await api.get('/admissions/cutoffs')).data,
  });
  const rows: any[] = data?.data || [];

  const bySession = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      if (!map.has(r.session)) map.set(r.session, []);
      map.get(r.session)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const reset = () => { setForm(emptyCutoff); setShowForm(false); };

  const saveMutation = useMutation({
    mutationFn: async (payload: CutoffForm) => {
      const numOrUndef = (s: string) => (s === '' || s === null || s === undefined ? undefined : Number(s));
      const body = {
        faculty: payload.faculty,
        department: payload.department,
        unit: payload.unit,
        firstPositionMerit: numOrUndef(payload.firstPositionMerit),
        firstPositionScore: numOrUndef(payload.firstPositionScore),
        lastPositionMerit: numOrUndef(payload.lastPositionMerit),
        lastPositionScore: numOrUndef(payload.lastPositionScore),
        dataSource: payload.dataSource || undefined,
        session: payload.session,
        sortOrder: payload.sortOrder || 0,
      };
      if (payload._id) return api.patch(`/admissions/cutoffs/${payload._id}`, body);
      return api.post('/admissions/cutoffs', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admission'] });
      toast.success('Cut-off row saved');
      reset();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admissions/cutoffs/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admission'] }); toast.success('Deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const handleEdit = (r: any) => {
    setForm({
      _id: r._id, faculty: r.faculty, department: r.department, unit: r.unit,
      firstPositionMerit: r.firstPositionMerit?.toString() || '',
      firstPositionScore: r.firstPositionScore?.toString() || '',
      lastPositionMerit: r.lastPositionMerit?.toString() || '',
      lastPositionScore: r.lastPositionScore?.toString() || '',
      dataSource: r.dataSource || '',
      session: r.session, sortOrder: r.sortOrder || 0,
    });
    setShowForm(true);
  };

  const handleAddTo = (session: string) => {
    setForm({ ...emptyCutoff, session });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Cut-off marks are grouped by admission session. Faculties &amp; departments come from
          <span className="font-medium text-foreground"> Settings → Academic Config</span>, so any change there is reflected here.
        </p>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => handleAddTo('')}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New Session
        </motion.button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border rounded-lg p-4 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{form._id ? 'Edit Cut-off Row' : 'New Cut-off Row'}</h3>
                <button type="button" onClick={reset} className="p-1 rounded hover:bg-accent text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Faculty *">
                  <select value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value, department: '' })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                    <option value="">Select faculty</option>
                    {faculties.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                  </select>
                </Field>
                <Field label="Department *">
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} disabled={!form.faculty}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none disabled:opacity-50">
                    <option value="">Select department</option>
                    {facultyDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Unit *">
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as 'A' | 'B' | 'C' })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none">
                    <option value="A">A Unit</option>
                    <option value="B">B Unit</option>
                    <option value="C">C Unit</option>
                  </select>
                </Field>
                <Field label="Session *" hint="e.g., 2024-25">
                  <input list="cutoffs-existing-sessions" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                  <datalist id="cutoffs-existing-sessions">
                    {bySession.map(([s]) => <option key={s} value={s} />)}
                  </datalist>
                </Field>
                <Field label="1st Position — Merit"><input type="number" value={form.firstPositionMerit}
                  onChange={(e) => setForm({ ...form, firstPositionMerit: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" /></Field>
                <Field label="1st Position — Score"><input type="number" step="0.01" value={form.firstPositionScore}
                  onChange={(e) => setForm({ ...form, firstPositionScore: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" /></Field>
                <Field label="Last Position — Merit"><input type="number" value={form.lastPositionMerit}
                  onChange={(e) => setForm({ ...form, lastPositionMerit: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" /></Field>
                <Field label="Last Position — Score"><input type="number" step="0.01" value={form.lastPositionScore}
                  onChange={(e) => setForm({ ...form, lastPositionScore: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" /></Field>
                <Field label="Data Source" hint="Contributor or reference name (optional)">
                  <input value={form.dataSource} onChange={(e) => setForm({ ...form, dataSource: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
                </Field>
                <Field label="Sort Order">
                  <NumberInput value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })} />
                </Field>
              </div>
              <div className="flex gap-2 pt-1">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => saveMutation.mutate(form)}
                  disabled={saveMutation.isPending || !form.faculty || !form.department || !form.session}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50">
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {form._id ? 'Update' : 'Create'}
                </motion.button>
                <button onClick={reset} className="px-4 py-2 text-sm rounded-md border hover:bg-accent">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <Spinner size="md" />
      ) : bySession.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">
          No cut-off data yet — click "New Session" above to add the first row.
        </p>
      ) : (
        <div className="space-y-3">
          {bySession.map(([session, sessionRows], idx) => (
            <AdminSessionAccordion
              key={session}
              session={session}
              count={sessionRows.length}
              defaultOpen={idx === 0}
              icon={Target}
              onAddRow={() => handleAddTo(session)}
            >
              <CutoffsAdminTable
                rows={sessionRows}
                onEdit={handleEdit}
                onDelete={async (r) => {
                  const ok = await confirm({
                    title: 'Delete cut-off row?',
                    message: `${r.faculty} — ${r.department} (Unit ${r.unit}) for session ${r.session} will be removed.`,
                    confirmLabel: 'Delete',
                    variant: 'danger',
                  });
                  if (ok) deleteMutation.mutate(r._id);
                }}
              />
            </AdminSessionAccordion>
          ))}
        </div>
      )}
    </div>
  );
}

/** Renderer-only table for one session's cut-off rows. */
function CutoffsAdminTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: any[];
  onEdit: (r: any) => void;
  onDelete: (r: any) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left">Faculty</th>
            <th className="px-3 py-2 text-left">Department</th>
            <th className="px-3 py-2 text-center w-16">Unit</th>
            <th className="px-3 py-2 text-center">1st Merit</th>
            <th className="px-3 py-2 text-center">1st Score</th>
            <th className="px-3 py-2 text-center">Last Merit</th>
            <th className="px-3 py-2 text-center">Last Score</th>
            <th className="px-3 py-2 text-left">Source</th>
            <th className="px-3 py-2 text-right w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <motion.tr
              key={r._id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.015 }}
              className="hover:bg-accent/30 transition-colors border-b last:border-b-0"
            >
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.faculty}</td>
              <td className="px-3 py-2">{r.department}</td>
              <td className="px-3 py-2 text-center font-medium">{r.unit}</td>
              <td className="px-3 py-2 text-center tabular-nums">{r.firstPositionMerit ?? '—'}</td>
              <td className="px-3 py-2 text-center tabular-nums">{r.firstPositionScore?.toFixed(2) ?? '—'}</td>
              <td className="px-3 py-2 text-center tabular-nums">{r.lastPositionMerit ?? '—'}</td>
              <td className="px-3 py-2 text-center tabular-nums">{r.lastPositionScore?.toFixed(2) ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{r.dataSource || '—'}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onEdit(r)} className="p-1.5 rounded hover:bg-accent" title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(r)}
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Shared form bits
// ═══════════════════════════════════════════════════════

/**
 * Collapsible session card used by both SeatsSection and CutoffsSection.
 * Latest session is open by default and shows a "Most recent" caption.
 * The header includes an "Add row" button so admins can add a row directly
 * into the session they're already looking at, without retyping the session
 * string in the form.
 */
function AdminSessionAccordion({
  session,
  count,
  defaultOpen,
  icon: Icon,
  onAddRow,
  extraActions,
  children,
}: {
  session: string;
  count: number;
  defaultOpen: boolean;
  icon: typeof Megaphone;
  onAddRow: () => void;
  /** Optional extra action buttons rendered to the LEFT of "Add Row" — used
   *  by SeatsSection to surface Rename / Delete bulk ops. */
  extraActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <FadeIn direction="up" delay={0.05}>
      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-3 flex-1 min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-md py-1 -my-1"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Session {session}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {defaultOpen && <span className="uppercase tracking-wide text-primary/80 mr-1.5">Most recent ·</span>}
                {count} row{count === 1 ? '' : 's'}
              </p>
            </div>
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="shrink-0 text-muted-foreground"
            >
              <ChevronDown className="h-5 w-5" />
            </motion.span>
          </button>
          {extraActions}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddRow(); }}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20"
            title={`Add row to session ${session}`}
          >
            <Plus className="h-3.5 w-3.5" /> Add Row
          </motion.button>
        </div>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{hint}</p>}
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      min={0}
    />
  );
}
