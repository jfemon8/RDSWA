import { useState, useRef, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors, getApiErrorMessage } from '@/lib/formErrors';
import { queryKeys } from '@/lib/queryKeys';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { Plus, Loader2, Pencil, Trash2, Archive, FileText, Paperclip, Image as ImageIcon, X, Eye, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import RichContent from '@/components/ui/RichContent';
import { Link } from 'react-router-dom';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';

interface NoticeAttachment {
  name: string;
  url: string;
  type: string;
}

interface NoticeForm {
  title: string;
  content: string;
  category: string;
  priority: string;
  status: string;
  isHighlighted: boolean;
  attachment: NoticeAttachment | null;
}

const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';

export default function AdminNoticesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<NoticeForm>({
    title: '', content: '', category: 'general', priority: 'normal', status: 'draft', isHighlighted: false,
    attachment: null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notices.all,
    queryFn: async () => {
      const { data } = await api.get('/notices?limit=50');
      return data;
    },
  });

  /**
   * Build the notice payload explicitly. We pick each field by name (rather
   * than spreading `form`) so any future extra UI-only state can't leak into
   * the request body and trip the backend validator.
   */
  const buildPayload = () => {
    const attachments = form.attachment
      ? [{
          name: String(form.attachment.name || 'attachment'),
          url: String(form.attachment.url || ''),
          type: String(form.attachment.type || 'application/octet-stream'),
        }]
      : [];
    return {
      title: form.title.trim(),
      content: form.content,
      category: form.category,
      priority: form.priority,
      status: form.status,
      isHighlighted: !!form.isHighlighted,
      attachments,
    };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (editId) return (await api.patch(`/notices/${editId}`, payload)).data;
      return (await api.post('/notices', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      resetForm();
      toast.success(editId ? 'Notice updated' : 'Notice created');
    },
    onError: (err: any) => {
      // Always log the full response so the actual server-side validation
      // problem is visible in the DevTools console.
      console.error('[Notice save failed]', {
        status: err?.response?.status,
        message: err?.response?.data?.message,
        errors: err?.response?.data?.errors,
        payload: buildPayload(),
      });

      const fieldErrors = extractFieldErrors(err);
      // Map server-side dotted error keys (e.g. `attachments.0.url`) to the
      // closest form-level field name so the inline FieldError renders.
      if (fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [key, msg] of Object.entries(fieldErrors)) {
          if (key.startsWith('attachments')) mapped.attachment = msg;
          else mapped[key] = msg;
        }
        setErrors(mapped);
      }

      // Build the toast message: prefer the most specific error.
      const message = getApiErrorMessage(err, 'Failed to save notice');
      // If multiple field errors exist, list them all in the description so
      // the user immediately sees what's wrong without hunting in the form.
      const description = fieldErrors && Object.keys(fieldErrors).length > 1
        ? Object.entries(fieldErrors).map(([k, m]) => `• ${k}: ${m}`).join('\n')
        : undefined;
      toast.error(message, description);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notices/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notices'] }); toast.success('Notice deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete notice'); },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notices/${id}/archive`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notices'] }); toast.success('Notice archived'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to archive notice'); },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ title: '', content: '', category: 'general', priority: 'normal', status: 'draft', isHighlighted: false, attachment: null });
    setErrors({});
  };

  const startEdit = (n: any) => {
    setEditId(n._id);
    // Notices can have at most one attachment — pull the first if present.
    // Older notices may store attachments without the `type` field; default
    // those to a sensible MIME based on the URL extension so the server-side
    // validator (which requires a non-empty type string) accepts them.
    const first = Array.isArray(n.attachments) && n.attachments.length > 0 ? n.attachments[0] : null;
    const attachment = first
      ? {
          name: first.name || 'attachment',
          url: first.url,
          type: first.type || (/(\.pdf)(\?|$)/i.test(first.url || '') ? 'application/pdf' : 'application/octet-stream'),
        }
      : null;
    // Validator only allows status='draft' or 'published' on update — clamp
    // 'archived' (or anything else) to 'draft' so editing an archived notice
    // doesn't blow up. Use the dedicated archive button to set archived state.
    const safeStatus: 'draft' | 'published' = n.status === 'published' ? 'published' : 'draft';
    setForm({
      title: n.title || '',
      content: n.content || '',
      category: n.category || 'general',
      priority: n.priority || 'normal',
      status: safeStatus,
      isHighlighted: n.isHighlighted || false,
      attachment,
    });
    setErrors({});
    setShowForm(true);
  };

  /** Upload the chosen file to /upload/document and store the metadata in form state. */
  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.error('Attachment must be 5 MB or smaller');
      return;
    }
    if (!ATTACHMENT_ACCEPT.split(',').includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF, WebP images or PDF are allowed');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload/document', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((f) => ({
        ...f,
        attachment: {
          name: file.name,
          url: data.data.url,
          type: file.type,
        },
      }));
      setErrors((p) => { const { attachment, ...r } = p; return r; });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    setForm((f) => ({ ...f, attachment: null }));
  };

  const notices = data?.data || [];

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Notices</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Notice
        </button>
      </div>

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
              <h3 className="font-semibold mb-4 text-foreground">{editId ? 'Edit' : 'Create'} Notice</h3>
              <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.title.trim()) errs.title = 'Notice title is required'; if (!form.content.trim()) errs.content = 'Notice content is required'; if (Object.keys(errs).length) { setErrors(errs); return; } saveMutation.mutate(); }} className="space-y-3">
                <div>
                  <input placeholder="Title" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.title ? 'border-red-500' : ''}`} required />
                  <FieldError message={errors.title} />
                </div>
                <div>
                  <RichTextEditor value={form.content} onChange={(v) => { setForm({ ...form, content: v }); setErrors((prev) => { const { content, ...rest } = prev; return rest; }); }} placeholder="Notice content..." minHeight="150px" />
                  <FieldError message={errors.content} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="general">General</option>
                    <option value="academic">Academic</option>
                    <option value="event">Event</option>
                    <option value="urgent">Urgent</option>
                    <option value="financial">Financial</option>
                    <option value="other">Other</option>
                  </select>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={form.isHighlighted} onChange={(e) => setForm({ ...form, isHighlighted: e.target.checked })} />
                  Highlight on homepage
                </label>

                {/* Attachment — single image or PDF, up to 5 MB, optional */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1.5">
                    Attachment <span className="opacity-70">(optional — image or PDF, max 5 MB)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    onChange={handleAttachmentSelect}
                    className="hidden"
                  />
                  {form.attachment ? (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-2.5 border rounded-md bg-muted/40"
                    >
                      {form.attachment.type === 'application/pdf' ? (
                        <FileText className="h-5 w-5 text-red-600 shrink-0" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-primary shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{form.attachment.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {form.attachment.type === 'application/pdf' ? 'PDF document' : 'Image'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeAttachment}
                        className="p-1 hover:bg-destructive/10 text-destructive rounded"
                        title="Remove attachment"
                        aria-label="Remove attachment"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-md text-sm text-muted-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                        </>
                      ) : (
                        <>
                          <Paperclip className="h-4 w-4" /> Attach image or PDF
                        </>
                      )}
                    </button>
                  )}
                  <FieldError message={errors.attachment} />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saveMutation.isPending || uploading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Create'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <Spinner size="md" />
      ) : (
        <div className="space-y-2">
          {notices.map((n: any, i: number) => {
            const isViewing = viewId === n._id;
            const att = Array.isArray(n.attachments) && n.attachments.length > 0 ? n.attachments[0] : null;
            const attIsImage = att?.type?.startsWith('image/');
            const attIsPdf = att?.type === 'application/pdf' || /\.pdf($|\?)/i.test(att?.url || '');

            return (
              <FadeIn key={n._id} direction="up" delay={i * 0.06}>
                <div className="border rounded-lg bg-card">
                  <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-primary shrink-0" /> {n.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="capitalize">{n.category}</span>
                        <span className="capitalize">{n.status}</span>
                        <span className="capitalize">{n.priority}</span>
                        {att && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {attIsPdf ? 'PDF' : attIsImage ? 'Image' : 'File'}
                          </span>
                        )}
                        <span>{formatDate(n.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setViewId(isViewing ? null : n._id)}
                        className={`p-2 rounded ${isViewing ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground'}`}
                        title="View notice"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <Link
                        to={`/notices/${n._id}`}
                        className="p-2 hover:bg-accent rounded text-foreground"
                        title="Open public page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => startEdit(n)}
                        className="p-2 hover:bg-accent rounded"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4 text-foreground" />
                      </button>
                      {n.status === 'published' && (
                        <button
                          onClick={async () => {
                            const ok = await confirm({ title: 'Archive Notice', message: `Archive notice "${n.title}"? It will be removed from the active list.`, confirmLabel: 'Archive', variant: 'warning' });
                            if (ok) archiveMutation.mutate(n._id);
                          }}
                          className="p-2 hover:bg-accent rounded"
                          title="Archive"
                        >
                          <Archive className="h-4 w-4 text-foreground" />
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          const ok = await confirm({ title: 'Delete Notice', message: `Delete notice "${n.title}"? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
                          if (ok) deleteMutation.mutate(n._id);
                        }}
                        className="p-2 hover:bg-destructive/10 text-destructive rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inline view panel */}
                  <AnimatePresence>
                    {isViewing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t p-4 sm:p-5 space-y-4">
                          {n.titleBn && (
                            <p className="text-lg text-muted-foreground">{n.titleBn}</p>
                          )}
                          <RichContent html={n.content} />

                          {att && attIsImage && (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                              <img
                                src={att.url}
                                alt={att.name || 'Notice attachment'}
                                loading="lazy"
                                className="max-w-full max-h-[480px] rounded-lg object-contain border bg-muted/30"
                              />
                              {att.name && (
                                <p className="text-xs text-muted-foreground mt-1">{att.name}</p>
                              )}
                            </a>
                          )}

                          {att && attIsPdf && (
                            <div className="max-w-3xl">
                              <NoticeInlinePdf url={att.url} name={att.name} />
                            </div>
                          )}

                          {att && !attIsImage && !attIsPdf && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <Paperclip className="h-4 w-4" /> {att.name || 'Attachment'}
                            </a>
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
    </div>
  );
}

const PdfViewer = lazy(() => import('@/components/ui/PdfViewer'));

function NoticeInlinePdf({ url, name }: { url: string; name?: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[300px] border rounded-xl bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PdfViewer url={url} fileName={name} height={500} />
    </Suspense>
  );
}
