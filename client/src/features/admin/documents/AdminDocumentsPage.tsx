import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const CATEGORIES = ['policy', 'resolution', 'report', 'form', 'other'] as const;
const ROLES = ['user', 'member', 'alumni', 'advisor', 'senior_advisor', 'moderator', 'admin'] as const;

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Documents</h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Document
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
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">{form.fileUrl.split('/').pop() || form.fileUrl}</span>
                      <button type="button" onClick={() => setForm({ ...form, fileUrl: '', fileType: '', fileSize: 0 })}
                        className="p-1 hover:bg-accent rounded"><X className="h-3.5 w-3.5" /></button>
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
                            setForm((f) => ({
                              ...f,
                              fileUrl: data.data.url,
                              fileType: data.data.fileType || file.type.split('/').pop() || '',
                              fileSize: data.data.fileSize || file.size,
                            }));
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
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No documents yet</p>
        </div>
      ) : (
        <>
          <FadeIn direction="up" delay={0.1}>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm min-w-[600px]">
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
                        <p className="font-medium text-foreground flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-primary shrink-0" /> {doc.title}
                        </p>
                        {doc.description && <p className="text-xs text-muted-foreground line-clamp-1">{stripHtml(doc.description)}</p>}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize">{doc.category}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{doc.fileType || '-'}</td>
                      <td className="p-3">
                        {doc.isPublic ? (
                          <span className="text-xs text-green-600">Public</span>
                        ) : (
                          <span className="text-xs text-amber-600">{doc.accessRoles?.join(', ') || 'Restricted'}</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {doc.downloadCount || 0}</span>
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
          </FadeIn>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent text-foreground">Prev</button>
              <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent text-foreground">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
