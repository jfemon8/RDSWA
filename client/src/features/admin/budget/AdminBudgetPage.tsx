import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { queryKeys } from '@/lib/queryKeys';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { useAuthStore } from '@/stores/authStore';
import { hasMinRole } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import { formatDate } from '@/lib/date';
import {
  Plus, Loader2, Pencil, Trash2, CheckCircle2, XCircle, PlayCircle, Wallet,
  ChevronDown, ChevronUp, FileText, AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';

interface BudgetItem {
  category: string;
  description: string;
  estimatedAmount: number;
  actualAmount?: number;
}

interface BudgetForm {
  title: string;
  description: string;
  fiscalYear: string;
  event: string;
  items: BudgetItem[];
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  executed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const emptyForm = (): BudgetForm => ({
  title: '',
  description: '',
  fiscalYear: String(new Date().getFullYear()),
  event: '',
  items: [{ category: '', description: '', estimatedAmount: 0 }],
});

export default function AdminBudgetPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuthStore();
  const isAdmin = user?.role ? hasMinRole(user.role, UserRole.ADMIN) : false;
  const isSuperAdmin = user?.role ? hasMinRole(user.role, UserRole.SUPER_ADMIN) : false;

  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetForm>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filters: Record<string, string> = {};
  if (statusFilter) filters.status = statusFilter;
  if (yearFilter) filters.fiscalYear = yearFilter;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.budgets.list(filters),
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '50', ...filters }).toString();
      const { data } = await api.get(`/budgets?${qs}`);
      return data;
    },
  });

  const budgets: any[] = data?.data || [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        fiscalYear: form.fiscalYear.trim(),
        event: form.event.trim() || undefined,
        items: form.items
          .filter((i) => i.category.trim() && i.description.trim())
          .map((i) => ({
            category: i.category.trim(),
            description: i.description.trim(),
            estimatedAmount: Number(i.estimatedAmount) || 0,
          })),
      };
      if (editId) return (await api.patch(`/budgets/${editId}`, payload)).data;
      return (await api.post('/budgets', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      resetForm();
      toast.success(editId ? 'Budget updated' : 'Budget created');
    },
    onError: (err: any) => {
      const fe = extractFieldErrors(err);
      if (fe) setErrors(fe);
      else toast.error(err.response?.data?.message || 'Failed to save budget');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (vars: { id: string; status: 'approved' | 'rejected'; reason?: string }) => {
      const { data } = await api.patch(`/budgets/${vars.id}/review`, {
        status: vars.status,
        rejectionReason: vars.reason,
      });
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      toast.success(`Budget ${vars.status}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to review budget'),
  });

  const executeMutation = useMutation({
    mutationFn: async (vars: { id: string; items: Array<{ index: number; actualAmount: number }> }) => {
      const { data } = await api.patch(`/budgets/${vars.id}/execute`, { items: vars.items });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      toast.success('Budget marked executed');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to execute budget'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
      toast.success('Budget deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete budget'),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setErrors({});
    setForm(emptyForm());
  };

  const startEdit = (b: any) => {
    setEditId(b._id);
    setErrors({});
    setForm({
      title: b.title || '',
      description: b.description || '',
      fiscalYear: b.fiscalYear || String(new Date().getFullYear()),
      event: b.event?._id || b.event || '',
      items: (b.items || []).length > 0
        ? b.items.map((i: any) => ({
            category: i.category || '',
            description: i.description || '',
            estimatedAmount: i.estimatedAmount || 0,
          }))
        : [{ category: '', description: '', estimatedAmount: 0 }],
    });
    setShowForm(true);
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { category: '', description: '', estimatedAmount: 0 }] });
  };
  const removeItem = (idx: number) => {
    if (form.items.length === 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };
  const updateItem = (idx: number, field: keyof BudgetItem, value: string | number) => {
    setForm({
      ...form,
      items: form.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    });
  };

  const totalEstimated = form.items.reduce((sum, i) => sum + (Number(i.estimatedAmount) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.fiscalYear.trim()) errs.fiscalYear = 'Fiscal year is required';
    const validItems = form.items.filter((i) => i.category.trim() && i.description.trim());
    if (validItems.length === 0) errs.items = 'At least one budget item is required';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    saveMutation.mutate();
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection (optional):') || '';
    reviewMutation.mutate({ id, status: 'rejected', reason });
  };

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Budgets
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Plan, approve and track event & operational budgets.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Budget
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md bg-card text-foreground text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="executed">Executed</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          placeholder="Fiscal year (e.g. 2026)"
          className="px-3 py-2 border rounded-md bg-card text-foreground text-sm"
        />
      </div>

      {/* Form */}
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
              <h3 className="font-semibold mb-4 text-foreground">
                {editId ? 'Edit Budget' : 'Create Budget'}
              </h3>
              <form noValidate onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <input
                    placeholder="Budget title (e.g. Annual Iftar Mahfil 2026)"
                    value={form.title}
                    onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((p) => { const { title, ...r } = p; return r; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.title ? 'border-red-500' : ''}`}
                  />
                  <FieldError message={errors.title} />
                </div>
                <textarea
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Fiscal year</label>
                    <input
                      placeholder="2026"
                      value={form.fiscalYear}
                      onChange={(e) => { setForm({ ...form, fiscalYear: e.target.value }); setErrors((p) => { const { fiscalYear, ...r } = p; return r; }); }}
                      className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.fiscalYear ? 'border-red-500' : ''}`}
                    />
                    <FieldError message={errors.fiscalYear} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Linked event ID (optional)</label>
                    <input
                      placeholder="Mongo ObjectId of an event"
                      value={form.event}
                      onChange={(e) => setForm({ ...form, event: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                    />
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-muted-foreground font-medium">Budget items</label>
                    <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Plus className="h-3 w-3" /> Add item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="grid grid-cols-12 gap-2 items-start"
                      >
                        <input
                          placeholder="Category"
                          value={item.category}
                          onChange={(e) => updateItem(idx, 'category', e.target.value)}
                          className="col-span-3 px-2 py-1.5 border rounded-md bg-card text-foreground text-sm"
                        />
                        <input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          className="col-span-6 px-2 py-1.5 border rounded-md bg-card text-foreground text-sm"
                        />
                        <input
                          type="number"
                          min="0"
                          placeholder="BDT"
                          value={item.estimatedAmount || ''}
                          onChange={(e) => updateItem(idx, 'estimatedAmount', Number(e.target.value) || 0)}
                          className="col-span-2 px-2 py-1.5 border rounded-md bg-card text-foreground text-sm text-right"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          disabled={form.items.length === 1}
                          className="col-span-1 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded disabled:opacity-30"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  <FieldError message={errors.items} />
                  <p className="text-xs text-muted-foreground mt-2 text-right">
                    Total estimated: <span className="font-semibold text-foreground">BDT {totalEstimated.toLocaleString()}</span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Create'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
          No budgets found. Click "New Budget" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((b: any, i: number) => (
            <FadeIn key={b._id} direction="up" delay={i * 0.05}>
              <BudgetRow
                budget={b}
                expanded={expandedId === b._id}
                onToggle={() => setExpandedId(expandedId === b._id ? null : b._id)}
                onEdit={() => startEdit(b)}
                onApprove={() => reviewMutation.mutate({ id: b._id, status: 'approved' })}
                onReject={() => handleReject(b._id)}
                onExecute={(items) => executeMutation.mutate({ id: b._id, items })}
                onDelete={async () => {
                  const ok = await confirm({
                    title: 'Delete Budget',
                    message: `Delete "${b.title}"? This action cannot be undone.`,
                    confirmLabel: 'Delete',
                    variant: 'danger',
                  });
                  if (ok) deleteMutation.mutate(b._id);
                }}
                isAdmin={isAdmin}
                isSuperAdmin={isSuperAdmin}
                canEdit={b.status === 'draft' || b.status === 'rejected'}
              />
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  budget: any;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onExecute: (items: Array<{ index: number; actualAmount: number }>) => void;
  onDelete: () => void;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canEdit: boolean;
}

function BudgetRow({
  budget, expanded, onToggle, onEdit, onApprove, onReject, onExecute, onDelete,
  isAdmin, isSuperAdmin, canEdit,
}: RowProps) {
  const [actuals, setActuals] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    (budget.items || []).forEach((it: any, i: number) => {
      init[i] = it.actualAmount ?? it.estimatedAmount ?? 0;
    });
    return init;
  });

  const status = budget.status as string;
  const totalActual = (budget.items || []).reduce((s: number, it: any) => s + (it.actualAmount || 0), 0);

  return (
    <div className="border rounded-lg bg-card">
      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{budget.title}</h3>
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full capitalize ${STATUS_STYLE[status] || 'bg-muted text-muted-foreground'}`}>
              {status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>FY {budget.fiscalYear}</span>
            <span>·</span>
            <span>BDT {(budget.totalAmount || 0).toLocaleString()}</span>
            {status === 'executed' && (
              <>
                <span>·</span>
                <span className="text-foreground">Actual: BDT {totalActual.toLocaleString()}</span>
              </>
            )}
            {budget.event?.title && (
              <>
                <span>·</span>
                <span>Event: {budget.event.title}</span>
              </>
            )}
            <span>·</span>
            <span>{formatDate(budget.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={onToggle} className="p-2 hover:bg-accent rounded" title="Items">
            {expanded ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
          </button>
          {canEdit && (
            <button onClick={onEdit} className="p-2 hover:bg-accent rounded" title="Edit">
              <Pencil className="h-4 w-4 text-foreground" />
            </button>
          )}
          {isAdmin && status === 'draft' && (
            <>
              <button
                onClick={onApprove}
                className="p-2 hover:bg-green-50 dark:hover:bg-green-950/30 rounded"
                title="Approve"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </button>
              <button
                onClick={onReject}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                title="Reject"
              >
                <XCircle className="h-4 w-4 text-red-600" />
              </button>
            </>
          )}
          {isSuperAdmin && (
            <button onClick={onDelete} className="p-2 hover:bg-accent rounded" title="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t p-4 space-y-3">
              {budget.description && (
                <p className="text-sm text-muted-foreground">{budget.description}</p>
              )}
              {status === 'rejected' && budget.rejectionReason && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span><span className="font-semibold">Rejection reason:</span> {budget.rejectionReason}</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-1.5 font-medium">Category</th>
                      <th className="text-left py-1.5 font-medium">Description</th>
                      <th className="text-right py-1.5 font-medium">Estimated</th>
                      <th className="text-right py-1.5 font-medium">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(budget.items || []).map((it: any, i: number) => (
                      <tr key={i} className="border-b last:border-b-0">
                        <td className="py-1.5 capitalize text-foreground">{it.category}</td>
                        <td className="py-1.5 text-muted-foreground">{it.description}</td>
                        <td className="py-1.5 text-right text-foreground">{(it.estimatedAmount || 0).toLocaleString()}</td>
                        <td className="py-1.5 text-right">
                          {isAdmin && status === 'approved' ? (
                            <input
                              type="number"
                              min="0"
                              value={actuals[i] ?? 0}
                              onChange={(e) => setActuals({ ...actuals, [i]: Number(e.target.value) || 0 })}
                              className="w-24 px-2 py-1 border rounded bg-card text-foreground text-xs text-right"
                            />
                          ) : (
                            <span className="text-foreground">{it.actualAmount != null ? it.actualAmount.toLocaleString() : '—'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="text-xs font-semibold">
                      <td colSpan={2} className="pt-2 text-right text-muted-foreground">Total</td>
                      <td className="pt-2 text-right text-foreground">{(budget.totalAmount || 0).toLocaleString()}</td>
                      <td className="pt-2 text-right text-foreground">
                        {status === 'executed'
                          ? totalActual.toLocaleString()
                          : isAdmin && status === 'approved'
                            ? Object.values(actuals).reduce((s, n) => s + n, 0).toLocaleString()
                            : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {isAdmin && status === 'approved' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => onExecute(
                      Object.entries(actuals).map(([idx, amt]) => ({ index: Number(idx), actualAmount: amt }))
                    )}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90"
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Save actuals & mark executed
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
