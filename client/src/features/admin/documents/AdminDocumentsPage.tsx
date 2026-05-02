import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageParam } from '@/hooks/usePageParam';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { Plus, Loader2, Trash2, Edit2, FileText, Download, X, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { stripHtml } from '@/lib/stripHtml';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

const CATEGORIES = ['policy', 'resolution', 'report', 'form', 'other'] as const;
const ROLES = ['user', 'member', 'alumni', 'advisor', 'senior_advisor', 'moderator', 'admin'] as const;

// Common file extensions we recognize when swapping the title's extension.
// If the title currently ends with one of these and the user uploads a
// different format, the extension is replaced cleanly instead of stacking.
const KNOWN_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.txt', '.csv', '.zip', '.rar', '.7z',
]);

/** Lowercase extension with leading dot, or empty string if none. */
function getExt(filename: string): string {
  if (!filename) return '';
  const idx = filename.lastIndexOf('.');
  if (idx <= 0 || idx === filename.length - 1) return '';
  return filename.slice(idx).toLowerCase();
}

function stripExt(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(0, idx) : filename;
}

/** "annual-report_2025" → "Annual Report 2025" */
function humanize(name: string): string {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Ensure the title ends with the given extension. If the title already
 * ends with a different KNOWN extension, swap it. If it ends with the
 * same extension (case-insensitive), leave alone. Otherwise append.
 */
function applyExt(title: string, ext: string): string {
  const t = title.trim();
  if (!ext || !t) return t;
  if (t.toLowerCase().endsWith(ext)) return t;
  const lastDot = t.lastIndexOf('.');
  if (lastDot > 0) {
    const existing = t.slice(lastDot).toLowerCase();
    if (KNOWN_EXTS.has(existing)) return t.slice(0, lastDot) + ext;
  }
  return t + ext;
}

function fmtSize(bytes: number): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const defaultForm = {
  title: '', description: '', category: 'other' as string,
  fileUrl: '', fileType: '', fileSize: 0, isPublic: true, accessRoles: [] as string[],
};

export default function AdminDocumentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  // UI-only: original filename of the just-uploaded file, for display.
  // Not persisted to the server (existing docs don't have this on edit).
  const [originalFileName, setOriginalFileName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = usePageParam();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-documents', page],
    queryFn: async () => {
      const { data } = await api.get(`/documents?page=${page}&limit=20`);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form };
      if (editId) return api.patch(`/documents/${editId}`, payload);
      return api.post('/documents', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-documents'] });
      resetForm();
      toast.success(editId ? 'Document updated' : 'Document created');
    },
    onError: (err: any) => {
      const fe = extractFieldErrors(err);
      if (fe) setErrors(fe);
      else toast.error(err.response?.data?.message || 'Failed to save document');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-documents'] });
      toast.success('Document deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(defaultForm);
    setOriginalFileName('');
    setErrors({});
  };

  const startEdit = (doc: any) => {
    setEditId(doc._id);
    setForm({
      title: doc.title || '',
      description: doc.description || '',
      category: doc.category || 'other',
      fileUrl: doc.fileUrl || '',
      fileType: doc.fileType || '',
      fileSize: doc.fileSize || 0,
      isPublic: doc.isPublic ?? true,
      accessRoles: doc.accessRoles || [],
    });
    setOriginalFileName('');
    setShowForm(true);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.fileUrl.trim()) errs.fileUrl = 'File URL is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    saveMutation.mutate();
  };

  const docs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Documents</h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 w-full sm:w-auto whitespace-nowrap"
        >
          <Plus className="h-4 w-4 shrink-0" /> Add Document
        </motion.button>
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
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm text-foreground">{editId ? 'Edit Document' : 'New Document'}</h2>
                <button onClick={resetForm} className="p-1 hover:bg-accent rounded"><X className="h-4 w-4" /></button>
              </div>
              <form noValidate onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <input placeholder="Title" value={form.title}
                    onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((p) => { const { title, ...r } = p; return r; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${errors.title ? 'border-red-500' : ''}`} />
                  <FieldError message={errors.title} />
                </div>
                <RichTextEditor value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Document description..." minHeight="80px" />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Upload File (max 10MB — PDF, Word, Excel, or Image)</p>
                  {form.fileUrl ? (
                    <div className="flex items-center gap-2 p-2.5 border rounded-md bg-muted/50">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground truncate" title={originalFileName || form.fileUrl}>
                          {originalFileName || form.fileUrl.split('/').pop() || form.fileUrl}
                        </p>
                        {(form.fileType || form.fileSize > 0) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {form.fileType?.toUpperCase()}{form.fileType && form.fileSize > 0 ? ' · ' : ''}{fmtSize(form.fileSize)}
                          </p>
                        )}
                      </div>
                      <button type="button"
                        onClick={() => { setForm({ ...form, fileUrl: '', fileType: '', fileSize: 0 }); setOriginalFileName(''); }}
                        className="p-1 hover:bg-accent rounded shrink-0"
                        title="Remove file">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground/40" />
                      <span className="text-xs text-muted-foreground">Click to select file</span>
                      <input type="file" className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setErrors((p) => { const { fileUrl, ...r } = p; return r; });
                          const fd = new FormData();
                          fd.append('file', file);
                          try {
                            const { data } = await api.post('/upload/document', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                            const ext = getExt(file.name);
                            setForm((f) => {
                              // Smart title logic:
                              //  - If title is empty → derive a humanized title from the filename + extension.
                              //  - If title already has the same extension → leave as-is.
                              //  - If title has a different known extension → swap it.
                              //  - Otherwise → append the extension.
                              const nextTitle = f.title.trim()
                                ? applyExt(f.title, ext)
                                : applyExt(humanize(stripExt(file.name)), ext);
                              return {
                                ...f,
                                title: nextTitle,
                                fileUrl: data.data.url,
                                fileType: data.data.fileType || file.type.split('/').pop() || '',
                                fileSize: data.data.fileSize || file.size,
                              };
                            });
                            setOriginalFileName(file.name);
                            setErrors((p) => { const { title, ...r } = p; return r; });
                          } catch (err: any) {
                            setErrors({ fileUrl: err.response?.data?.message || 'Upload failed' });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  <FieldError message={errors.fileUrl} />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={form.isPublic}
                      onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                      className="rounded border-input" />
                    Public
                  </label>
                  {!form.isPublic && (
                    <div className="flex flex-wrap gap-2">
                      {ROLES.map((r) => (
                        <label key={r} className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                          <input type="checkbox" checked={form.accessRoles.includes(r)}
                            onChange={(e) => setForm({
                              ...form,
                              accessRoles: e.target.checked
                                ? [...form.accessRoles, r]
                                : form.accessRoles.filter((x) => x !== r),
                            })}
                            className="rounded border-input" />
                          {r}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <motion.button type="submit" disabled={saveMutation.isPending}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50">
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? 'Update' : 'Create'}
                  </motion.button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <Spinner size="md" />
      ) : docs.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No documents yet</p>
        </div>
      ) : (
        <>
          <FadeIn direction="up" delay={0.1}>
            {/* Desktop table */}
            <div className="hidden lg:block border rounded-lg overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[13%]" />
                  <col className="w-[15%]" />
                  <col className="w-[18%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">Title</th>
                    <th className="text-left p-3 font-medium text-foreground">Category</th>
                    <th className="text-left p-3 font-medium text-foreground">Type</th>
                    <th className="text-left p-3 font-medium text-foreground">Access</th>
                    <th className="text-left p-3 font-medium text-foreground">Downloads</th>
                    <th className="text-left p-3 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc: any, i: number) => (
                    <motion.tr
                      key={doc._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-t hover:bg-accent/30"
                    >
                      <td className="p-3">
                        <p className="font-medium text-foreground flex items-start gap-1.5 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span className="truncate" title={doc.title}>{doc.title}</span>
                        </p>
                        {doc.description && <p className="text-xs text-muted-foreground line-clamp-1">{stripHtml(doc.description)}</p>}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize whitespace-nowrap">{doc.category}</span>
                      </td>
                      <td className="p-3 text-muted-foreground truncate" title={doc.fileType || undefined}>{doc.fileType || '-'}</td>
                      <td className="p-3 truncate" title={doc.isPublic ? 'Public' : (doc.accessRoles?.join(', ') || 'Restricted')}>
                        {doc.isPublic ? (
                          <span className="text-xs text-green-600">Public</span>
                        ) : (
                          <span className="text-xs text-amber-600 truncate block">{doc.accessRoles?.join(', ') || 'Restricted'}</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap"><Download className="h-3 w-3" /> {doc.downloadCount || 0}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(doc)} title="Edit"
                            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={async () => {
                              const ok = await confirm({ title: 'Delete Document', message: `Delete "${doc.title}"? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
                              if (ok) deleteMutation.mutate(doc._id);
                            }} title="Delete"
                            className="p-1.5 hover:bg-destructive/10 text-destructive rounded">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="lg:hidden space-y-3">
              {docs.map((doc: any, i: number) => (
                <motion.div
                  key={doc._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border rounded-lg p-4 bg-card"
                >
                  <div className="flex items-start gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary shrink-0 mt-1" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground break-words">{doc.title}</p>
                      {doc.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{stripHtml(doc.description)}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize whitespace-nowrap">{doc.category}</span>
                    {doc.fileType && <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground break-all">{doc.fileType}</span>}
                    {doc.isPublic ? (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Public</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 break-words">
                        {doc.accessRoles?.join(', ') || 'Restricted'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Download className="h-3 w-3" /> {doc.downloadCount || 0} downloads
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(doc)} title="Edit"
                        className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={async () => {
                          const ok = await confirm({ title: 'Delete Document', message: `Delete "${doc.title}"? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
                          if (ok) deleteMutation.mutate(doc._id);
                        }} title="Delete"
                        className="p-1.5 hover:bg-destructive/10 text-destructive rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </FadeIn>

          {pagination && pagination.totalPages > 1 && (
            <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
