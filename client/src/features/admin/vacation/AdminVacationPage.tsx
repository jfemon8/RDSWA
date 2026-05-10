import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import {
  Plus, Pencil, Trash2, X, Calendar, Loader2, GripVertical,
  Upload, FileText, Image as ImageIcon, ExternalLink, Download,
  Save, ChevronDown, Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';
import { formatDate, toDateInput } from '@/lib/date';
import { proxyFileUrl } from '@/lib/fileProxy';
import { useAuthStore } from '@/stores/authStore';
import { hasMinRole } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';

interface Entry {
  event: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalDays?: number;
}
interface Attachment { name: string; url: string; type: string }
interface Vacation {
  _id: string;
  academicYear: string;
  notes?: string;
  entries: Array<Entry & { startDate: string; endDate: string }>;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

const blankEntry: Entry = { event: '', startDate: '', endDate: '' };
const blankForm = {
  academicYear: '',
  notes: '',
  entries: [] as Entry[],
  attachments: [] as Attachment[],
};

/** Inclusive day count between two YYYY-MM-DD strings. */
function inclusiveDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).setHours(0, 0, 0, 0);
  const e = new Date(end).setHours(0, 0, 0, 0);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

export default function AdminVacationPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { user: currentUser } = useAuthStore();
  // Page title/subtitle CRUD is locked to SuperAdmin per the requirement;
  // Moderators/Admins can still manage academic-year entries below.
  const isSuperAdmin = currentUser
    ? hasMinRole(currentUser.role, UserRole.SUPER_ADMIN)
    : false;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vacations'],
    queryFn: async () => {
      const { data } = await api.get('/vacations');
      return data;
    },
  });
  // Server already returns descending by academicYear; lock that order
  // locally too in case ordering changes upstream or on optimistic updates.
  const vacations: Vacation[] = ((data?.data || []) as Vacation[])
    .slice()
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear));

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Convert YYYY-MM-DD to a stable timezone-anchored ISO string. Using
      // `T00:00:00` (no Z) and letting the server parse it works for date-
      // only fields where time-of-day doesn't matter.
      // Sort entries ascending by start date before persisting so the DB
      // is always canonically ordered. Read paths can rely on this without
      // re-sorting; admin form opens in date order on next edit.
      const sortedEntries = [...form.entries].sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        return (a.endDate || '').localeCompare(b.endDate || '');
      });
      const payload = {
        ...form,
        entries: sortedEntries.map((e) => ({
          event: e.event.trim(),
          startDate: e.startDate,
          endDate: e.endDate,
          // Always re-derive on save so the client-displayed total can never
          // drift from what's stored.
          totalDays: inclusiveDays(e.startDate, e.endDate),
        })),
      };
      if (editId) return (await api.patch(`/vacations/${editId}`, payload)).data;
      return (await api.post('/vacations', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vacations'] });
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      resetForm();
      toast.success(editId ? 'Vacation calendar updated' : 'Vacation calendar created');
    },
    onError: (err: any) => {
      const fe = extractFieldErrors(err);
      if (fe) setErrors(fe);
      else toast.error(err.response?.data?.message || 'Failed to save vacation');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vacations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vacations'] });
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      toast.success('Vacation calendar deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(blankForm);
    setErrors({});
  };

  const startEdit = (v: Vacation) => {
    setEditId(v._id);
    // Open the editor with entries in chronological order so admins always
    // see the same canonical order, regardless of how rows were originally
    // entered. Save also re-sorts (defence in depth).
    const sortedEntries = [...(v.entries || [])].sort((a, b) => {
      const sa = new Date(a.startDate).getTime();
      const sb = new Date(b.startDate).getTime();
      if (sa !== sb) return sa - sb;
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
    setForm({
      academicYear: v.academicYear,
      notes: v.notes || '',
      entries: sortedEntries.map((e) => ({
        event: e.event,
        startDate: toDateInput(e.startDate),
        endDate: toDateInput(e.endDate),
        totalDays: e.totalDays,
      })),
      attachments: v.attachments || [],
    });
    setShowForm(true);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    if (!/^\d{4}-\d{2}$/.test(form.academicYear)) {
      errs.academicYear = 'Use YYYY-YY format (e.g. 2026-27)';
    } else {
      const [s, suffix] = form.academicYear.split('-');
      if ((Number(s) + 1) % 100 !== Number(suffix)) {
        errs.academicYear = 'Two-digit suffix must be the next year (e.g. 2026-27)';
      }
    }
    form.entries.forEach((entry, i) => {
      if (!entry.event.trim()) errs[`entries.${i}.event`] = 'Event name required';
      if (!entry.startDate) errs[`entries.${i}.startDate`] = 'Start date required';
      if (!entry.endDate) errs[`entries.${i}.endDate`] = 'End date required';
      if (entry.startDate && entry.endDate && entry.endDate < entry.startDate) {
        errs[`entries.${i}.endDate`] = 'End cannot be before start';
      }
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    saveMutation.mutate();
  };

  const updateEntry = (i: number, patch: Partial<Entry>) => {
    setForm((f) => {
      const next = [...f.entries];
      next[i] = { ...next[i], ...patch };
      return { ...f, entries: next };
    });
  };

  const addEntry = () => setForm((f) => ({ ...f, entries: [...f.entries, { ...blankEntry }] }));
  const removeEntry = (i: number) =>
    setForm((f) => ({ ...f, entries: f.entries.filter((_, idx) => idx !== i) }));

  const removeAttachment = (i: number) =>
    setForm((f) => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }));

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Vacation Calendar</h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 w-full sm:w-auto whitespace-nowrap"
        >
          <Plus className="h-4 w-4 shrink-0" /> New Academic Year
        </motion.button>
      </div>

      {/* Page-content editor — SuperAdmin only. Lives on this page so admins
          who manage vacation calendars find the related copy editor in the
          same place, instead of buried under /admin/settings. */}
      {isSuperAdmin && <VacationPageContentSection />}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-4 sm:p-5 bg-card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">
                  {editId ? 'Edit Vacation Calendar' : 'New Vacation Calendar'}
                </h2>
                <button onClick={resetForm} className="p-1 hover:bg-accent rounded" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form noValidate onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Academic Year</label>
                    <input
                      placeholder="e.g. 2026-27"
                      value={form.academicYear}
                      onChange={(e) => {
                        setForm({ ...form, academicYear: e.target.value });
                        setErrors((p) => { const { academicYear, ...rest } = p; return rest; });
                      }}
                      className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-mono ${errors.academicYear ? 'border-red-500' : ''}`}
                    />
                    <FieldError message={errors.academicYear} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
                    <input
                      placeholder="Short note shown above the table"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>

                {/* Entries */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Entries ({form.entries.length})
                    </label>
                    <button
                      type="button"
                      onClick={addEntry}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      <Plus className="h-3 w-3" /> Add Row
                    </button>
                  </div>
                  {form.entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic text-center py-4 border rounded-md bg-muted/20">
                      No entries yet. Click "Add Row" to add a vacation entry.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {form.entries.map((entry, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border rounded-md p-3 bg-background"
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-2 shrink-0" />
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2">
                              <div className="sm:col-span-5">
                                <input
                                  placeholder="Event (e.g. Eid-ul-Fitr)"
                                  value={entry.event}
                                  onChange={(e) => updateEntry(i, { event: e.target.value })}
                                  className={`w-full px-2.5 py-1.5 border rounded-md bg-card text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${errors[`entries.${i}.event`] ? 'border-red-500' : ''}`}
                                />
                                <FieldError message={errors[`entries.${i}.event`]} />
                              </div>
                              <div className="sm:col-span-3">
                                <input
                                  type="date"
                                  value={entry.startDate}
                                  onChange={(e) => updateEntry(i, { startDate: e.target.value })}
                                  className={`w-full px-2.5 py-1.5 border rounded-md bg-card text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${errors[`entries.${i}.startDate`] ? 'border-red-500' : ''}`}
                                />
                                <FieldError message={errors[`entries.${i}.startDate`]} />
                              </div>
                              <div className="sm:col-span-3">
                                <input
                                  type="date"
                                  value={entry.endDate}
                                  min={entry.startDate || undefined}
                                  onChange={(e) => updateEntry(i, { endDate: e.target.value })}
                                  className={`w-full px-2.5 py-1.5 border rounded-md bg-card text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${errors[`entries.${i}.endDate`] ? 'border-red-500' : ''}`}
                                />
                                <FieldError message={errors[`entries.${i}.endDate`]} />
                              </div>
                              <div className="sm:col-span-1 flex items-center justify-end">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {inclusiveDays(entry.startDate, entry.endDate)}d
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEntry(i)}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded shrink-0"
                              aria-label="Remove entry"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Attachments ({form.attachments.length})
                    </label>
                  </div>
                  <AttachmentUpload
                    onAdd={(att) =>
                      setForm((f) => ({ ...f, attachments: [...f.attachments, att] }))
                    }
                  />
                  {form.attachments.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {form.attachments.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 rounded-md border bg-background"
                        >
                          <div className="h-9 w-9 rounded bg-muted grid place-items-center shrink-0">
                            {/^image\//i.test(a.type) ? (
                              <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground truncate" title={a.name}>{a.name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{a.type}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            className="p-1 text-muted-foreground hover:text-destructive rounded"
                            aria-label="Remove attachment"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <motion.button
                    type="submit"
                    disabled={saveMutation.isPending}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {editId ? 'Update' : 'Create'}
                  </motion.button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <Spinner size="md" />
      ) : vacations.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No vacation calendars yet</p>
        </div>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          <div className="space-y-3">
            {vacations.map((v, i) => {
              const isExpanded = expandedId === v._id;
              return (
              <motion.div
                key={v._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="border rounded-lg bg-card overflow-hidden"
              >
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary shrink-0" />
                      Academic Year {v.academicYear}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {v.entries.length} {v.entries.length === 1 ? 'entry' : 'entries'}
                      {v.attachments.length > 0 && ` · ${v.attachments.length} attachment${v.attachments.length === 1 ? '' : 's'}`}
                      {' · updated '}
                      {formatDate(v.updatedAt)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : v._id)}
                      className="p-2 hover:bg-accent rounded text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      title={isExpanded ? 'Hide details' : 'View details'}
                      aria-expanded={isExpanded}
                    >
                      <Eye className="h-4 w-4" />
                      <motion.span
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                        className="inline-flex"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </motion.span>
                    </button>
                    <button
                      onClick={() => startEdit(v)}
                      className="p-2 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Delete Vacation Calendar',
                          message: `Delete the ${v.academicYear} academic year vacation calendar? This cannot be undone.`,
                          confirmLabel: 'Delete',
                          variant: 'danger',
                        });
                        if (ok) deleteMutation.mutate(v._id);
                      }}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden border-t bg-muted/20"
                    >
                      <VacationDetails vacation={v} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              );
            })}
          </div>
        </FadeIn>
      )}
    </div>
  );
}

/**
 * Inline file uploader for vacation attachments. Routes through the existing
 * `/upload/document` endpoint which handles PDFs/Word/Excel + images alike,
 * then returns `{ url, fileType, fileSize }`. We hand back the resulting
 * `Attachment` record to the parent.
 */
function AttachmentUpload({ onAdd }: { onAdd: (a: Attachment) => void }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [pending, setPending] = useState<Attachment | null>(null);

  // Reset the user-editable display-name when a new file is selected.
  useEffect(() => {
    if (pending && !uploadName) setUploadName(pending.name);
  }, [pending, uploadName]);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload/document', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Keep the full filename (with extension). The proxy uses `name` as
      // the Content-Disposition filename — stripping the extension here
      // would cause downloads to land as extension-less blobs that the
      // OS can't open.
      setPending({
        name: file.name,
        url: data.data.url,
        type: data.data.fileType || file.type || 'file',
      });
      setUploadName(file.name);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const commit = () => {
    if (!pending) return;
    let finalName = uploadName.trim() || pending.name;
    // If the user edited the display name and dropped the extension,
    // re-attach it from the original or from the URL — the proxy uses this
    // as the Content-Disposition filename, and an extension-less file is a
    // bad download experience.
    if (!/\.[a-z0-9]{1,8}$/i.test(finalName)) {
      const origExt = (pending.name.match(/\.[a-z0-9]{1,8}$/i) || [])[0];
      const urlExt = (pending.url.match(/\.([a-z0-9]{1,8})(?:\?|$)/i) || [])[0];
      const ext = origExt || urlExt;
      if (ext) finalName += ext.startsWith('.') ? ext : `.${ext}`;
    }
    onAdd({ ...pending, name: finalName });
    setPending(null);
    setUploadName('');
  };

  if (pending) {
    const previewUrl = proxyFileUrl(pending.url, pending.name, true);
    return (
      <div className="border rounded-md p-3 bg-muted/20">
        <p className="text-xs text-muted-foreground mb-2">Confirm and add:</p>
        <div className="flex items-center gap-2 mb-2">
          <input
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="Display name"
            className="flex-1 px-2.5 py-1.5 border rounded-md bg-background text-foreground text-sm"
          />
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title="Preview"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={commit}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 inline-flex items-center gap-1"
          >
            <Download className="h-3 w-3" /> Add Attachment
          </button>
          <button
            type="button"
            onClick={() => { setPending(null); setUploadName(''); }}
            className="px-3 py-1.5 border rounded-md text-xs hover:bg-accent text-foreground"
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  return (
    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
      {uploading ? (
        <>
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">Uploading…</span>
        </>
      ) : (
        <>
          <Upload className="h-6 w-6 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">
            Click to upload an image, PDF, or document
          </span>
        </>
      )}
      <input
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </label>
  );
}

/**
 * SuperAdmin-only editor for the public /vacation page heading and intro.
 * Persists via the dedicated /settings/vacation-page PATCH endpoint, which
 * already enforces SuperAdmin + denyRestricted on the server side.
 */
function VacationPageContentSection() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });
  const s = settingsData?.data;

  const [form, setForm] = useState({ title: '', subtitle: '' });
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const v = s?.vacationPageContent || {};
    setForm({
      title: v.title || '',
      subtitle: v.subtitle || '',
    });
  }, [s]);

  const mutation = useMutation({
    mutationFn: () => api.patch('/settings/vacation-page', { vacationPageContent: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Vacation page content saved');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save'),
  });

  return (
    <div className="border rounded-lg bg-card mb-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-accent/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Pencil className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">Page Title & Subtitle</p>
            <p className="text-xs text-muted-foreground">
              Heading and intro shown at the top of the public /vacation page.
            </p>
          </div>
        </div>
        <motion.span
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t"
          >
            <div className="p-4 space-y-3">
              {isLoading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Page Title</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Vacation Calendar"
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Page Subtitle</label>
                    <textarea
                      value={form.subtitle}
                      onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                      rows={2}
                      placeholder="Yearly vacation, holiday and break schedule for University of Barishal."
                      className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div>
                    <motion.button
                      type="button"
                      onClick={() => mutation.mutate()}
                      disabled={mutation.isPending}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {mutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Page Content
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Read-only details panel for an academic year — entries (always sorted
 * ascending by start date) + notes + attachments. Rendered inline in the
 * admin list when an item is expanded.
 */
function VacationDetails({ vacation }: { vacation: Vacation }) {
  // Always show entries in chronological order regardless of insertion
  // sequence. Stable sort by start, falls back to end if starts are equal.
  const sortedEntries = [...vacation.entries].sort((a, b) => {
    const sa = new Date(a.startDate).getTime();
    const sb = new Date(b.startDate).getTime();
    if (sa !== sb) return sa - sb;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });

  const totalDays = sortedEntries.reduce(
    (sum, e) => sum + (e.totalDays ?? inclusiveDays(e.startDate, e.endDate)),
    0,
  );

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {vacation.notes && (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap [overflow-wrap:anywhere] p-3 rounded-md bg-card border-l-2 border-primary/40">
          {vacation.notes}
        </div>
      )}

      {sortedEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-4">
          No vacation entries listed for this year.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block border rounded-md overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b">
                  <th className="text-left p-2.5 font-medium text-foreground w-10">#</th>
                  <th className="text-left p-2.5 font-medium text-foreground">Event</th>
                  <th className="text-left p-2.5 font-medium text-foreground">Date Range</th>
                  <th className="text-right p-2.5 font-medium text-foreground w-20">Days</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((e, i) => {
                  const days = e.totalDays ?? inclusiveDays(e.startDate, e.endDate);
                  const range =
                    formatDate(e.startDate) === formatDate(e.endDate)
                      ? formatDate(e.startDate)
                      : `${formatDate(e.startDate)} – ${formatDate(e.endDate)}`;
                  return (
                    <tr key={i} className="border-t hover:bg-accent/20">
                      <td className="p-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="p-2.5 text-foreground font-medium">{e.event}</td>
                      <td className="p-2.5 text-muted-foreground">{range}</td>
                      <td className="p-2.5 text-right font-semibold text-foreground tabular-nums">{days}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 border-t font-semibold">
                  <td colSpan={3} className="p-2.5 text-right text-foreground">Total</td>
                  <td className="p-2.5 text-right text-primary tabular-nums">{totalDays}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile list */}
          <div className="sm:hidden space-y-2">
            {sortedEntries.map((e, i) => {
              const days = e.totalDays ?? inclusiveDays(e.startDate, e.endDate);
              const range =
                formatDate(e.startDate) === formatDate(e.endDate)
                  ? formatDate(e.startDate)
                  : `${formatDate(e.startDate)} – ${formatDate(e.endDate)}`;
              return (
                <div key={i} className="border rounded-md p-3 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground break-words">{e.event}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{range}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                      {days}d
                    </span>
                  </div>
                </div>
              );
            })}
            <div className="text-right pt-1 px-1 text-xs font-semibold text-primary">
              Total: {totalDays} days
            </div>
          </div>
        </>
      )}

      {/* Attachments */}
      {vacation.attachments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Attachments ({vacation.attachments.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {vacation.attachments.map((a, i) => {
              const isImage = /^image\//i.test(a.type) || /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(a.url);
              const previewUrl = proxyFileUrl(a.url, a.name, true);
              const downloadUrl = proxyFileUrl(a.url, a.name, false);
              return (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md border bg-card">
                  {isImage ? (
                    <img src={a.url} alt={a.name} className="h-10 w-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted grid place-items-center shrink-0">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate" title={a.name}>{a.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{a.type}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="Preview">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <a href={downloadUrl}
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
