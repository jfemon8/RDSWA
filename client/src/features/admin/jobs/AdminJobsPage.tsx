import { Fragment, useState } from 'react';
import { RecordsSkeleton } from '@/components/ui/Skeleton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useAccordionToggle } from '@/hooks/useAccordionScroll';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors, omitFieldError } from '@/lib/formErrors';
import { Search, Trash2, ExternalLink, Briefcase, Pencil, ChevronDown, ChevronUp, X } from 'lucide-react';
import { FadeIn } from '@/components/reactbits';
import { formatDate, toDateInput } from '@/lib/date';
import InfiniteScrollSentinel from '@/components/ui/InfiniteScrollSentinel';
import RichTextEditor from '@/components/ui/RichTextEditor';
import RichContent from '@/components/ui/RichContent';
import ImageUpload from '@/components/ui/ImageUpload';
import ImageThumbnail from '@/components/ui/ImageThumbnail';

const JOB_TYPES = ['full-time', 'part-time', 'internship', 'remote', 'contract'] as const;

const EMPTY_JOB = {
  title: '',
  company: '',
  location: '',
  type: 'full-time' as string,
  description: '',
  image: '',
  requirements: '',
  salary: '',
  vacancy: '',
  applicationLink: '',
  deadline: '',
};

type JobForm = typeof EMPTY_JOB;

export default function AdminJobsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  // Debounced so the list refetches once the typing settles, not on every keystroke.
  const debouncedSearch = useDebouncedValue(search);
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpand = useAccordionToggle(expandedId, setExpandedId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JobForm>({ ...EMPTY_JOB });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    items: jobs,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteList({
    queryKey: ['admin-jobs', debouncedSearch, typeFilter],
    path: '/jobs',
    filters: { search: debouncedSearch, type: typeFilter },
    limit: 20,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/jobs/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-jobs'] }); toast.success('Job deleted'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        ...form,
        // Requirements are stored as a list, and the form edits them as one comma-separated line.
        requirements: form.requirements.split(',').map((r) => r.trim()).filter(Boolean),
      };
      for (const key of ['vacancy', 'deadline', 'location', 'salary', 'applicationLink'] as const) {
        if (!payload[key]) delete payload[key];
      }
      payload.image = form.image || '';
      return api.patch(`/jobs/${editingId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
      closeEdit();
      toast.success('Job updated');
    },
    onError: (err: any) => {
      const fe = extractFieldErrors(err);
      if (fe) setErrors(fe);
      else toast.error(err.response?.data?.message || 'Failed to update job');
    },
  });

  const startEdit = (j: any) => {
    setEditingId(j._id);
    setExpandedId(null);
    setErrors({});
    setForm({
      title: j.title || '',
      company: j.company || '',
      location: j.location || '',
      type: j.type || 'full-time',
      description: j.description || '',
      image: j.image || '',
      requirements: Array.isArray(j.requirements) ? j.requirements.join(', ') : '',
      salary: j.salary || '',
      vacancy: typeof j.vacancy === 'number' ? String(j.vacancy) : '',
      applicationLink: j.applicationLink || '',
      deadline: j.deadline ? toDateInput(j.deadline) : '',
    });
  };

  const closeEdit = () => {
    setEditingId(null);
    setForm({ ...EMPTY_JOB });
    setErrors({});
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.company.trim()) errs.company = 'Company is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    saveMutation.mutate();
  };

  const setField = (key: keyof JobForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => omitFieldError(prev, key));
  };

  const isExpired = (j: any) => !!(j.deadline && new Date(j.deadline).getTime() < Date.now());

  const renderStatus = (j: any, small = false) => (
    <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${small ? 'text-[10px]' : 'text-xs'} ${
      isExpired(j)
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    }`}>
      {isExpired(j) ? 'Expired' : 'Active'}
    </span>
  );

  const renderActions = (j: any) => (
    <div className="flex items-center justify-end gap-1">
      {j.applicationLink && (
        <a href={j.applicationLink} target="_blank" rel="noopener noreferrer" title="Application link"
          className="p-1.5 text-primary hover:bg-primary/10 rounded">
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
      <button onClick={() => startEdit(j)} title="Edit" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded">
        <Pencil className="h-4 w-4" />
      </button>
      <button onClick={async () => {
        const ok = await confirm({ title: 'Delete Job', message: `Delete job listing "${j.title}"? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
        if (ok) deleteMutation.mutate(j._id);
      }} title="Delete" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-accent rounded">
        <Trash2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => toggleExpand(j._id)}
        title={expandedId === j._id ? 'Hide details' : 'View details'}
        aria-expanded={expandedId === j._id}
        className="p-1.5 text-muted-foreground hover:bg-accent rounded"
      >
        {expandedId === j._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
    </div>
  );

  /** Everything the table has no column for, so a job can be read without leaving the panel. */
  const renderDetails = (j: any) => (
    <div className="space-y-2 text-left">
      {j.image && (
        <ImageThumbnail
          src={j.image}
          alt={`${j.title} circular`}
          name={j.title}
          fit="contain"
          className="h-56 w-full max-w-sm bg-muted/40 border"
        />
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Company: {j.company}</span>
        {j.location && <span>Location: {j.location}</span>}
        <span className="capitalize">Type: {j.type?.replace('-', ' ')}</span>
        {typeof j.vacancy === 'number' && j.vacancy > 0 && <span>Vacancy: {j.vacancy}</span>}
        {j.salary && <span>Salary: {j.salary}</span>}
        <span>Deadline: {j.deadline ? formatDate(j.deadline) : 'None'}</span>
        <span>Posted: {formatDate(j.createdAt)}</span>
        {j.postedBy?.name && <span>By: {j.postedBy.name}</span>}
      </div>
      {j.requirements?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {j.requirements.map((r: string, i: number) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground">{r}</span>
          ))}
        </div>
      )}
      {j.description && <RichContent html={j.description} className="text-xs text-muted-foreground" />}
      <div className="flex flex-wrap gap-3 pt-1 text-xs">
        <Link to={`/dashboard/jobs/${j._id}`} className="text-primary hover:underline">Open public page</Link>
        {j.applicationLink && (
          <a href={j.applicationLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
            {j.applicationLink}
          </a>
        )}
      </div>
    </div>
  );

  const inputClass = 'w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm';

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-foreground">Job Board Management</h1>

      <FadeIn direction="up">
        <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); }}
              placeholder="Search jobs..." className="w-full pl-10 pr-3 py-2.5 border rounded-md bg-card text-sm" />
          </div>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); }}
            className="w-full sm:w-auto px-3 py-2.5 border rounded-md bg-card text-sm">
            <option value="">All Types</option>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">{t.replace('-', ' ')}</option>
            ))}
          </select>
        </div>
      </FadeIn>

      <AnimatePresence>
        {editingId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-4 sm:p-5 bg-card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Edit Job</h3>
                <button type="button" onClick={closeEdit} className="p-1 rounded hover:bg-accent text-muted-foreground" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form noValidate onSubmit={submitEdit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
                    <input value={form.title} onChange={(e) => setField('title', e.target.value)}
                      className={`${inputClass} ${errors.title ? 'border-red-500' : ''}`} />
                    <FieldError message={errors.title} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Company *</label>
                    <input value={form.company} onChange={(e) => setField('company', e.target.value)}
                      className={`${inputClass} ${errors.company ? 'border-red-500' : ''}`} />
                    <FieldError message={errors.company} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Location</label>
                    <input value={form.location} onChange={(e) => setField('location', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                    <select value={form.type} onChange={(e) => setField('type', e.target.value)} className={`${inputClass} capitalize`}>
                      {JOB_TYPES.map((t) => (
                        <option key={t} value={t} className="capitalize">{t.replace('-', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Salary</label>
                    <input value={form.salary} onChange={(e) => setField('salary', e.target.value)} placeholder="e.g. 40,000 BDT/month" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Vacancy</label>
                    <input type="number" min="1" value={form.vacancy} onChange={(e) => setField('vacancy', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Deadline</label>
                    <input type="date" value={form.deadline} onChange={(e) => setField('deadline', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Application link</label>
                    <input value={form.applicationLink} onChange={(e) => setField('applicationLink', e.target.value)} placeholder="https://..." className={inputClass} />
                  </div>
                </div>

                <ImageUpload
                  value={form.image}
                  onChange={(url) => setField('image', url)}
                  type="image"
                  folder="jobs"
                  label="Job Image / Circular"
                  fullWidth
                />

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Requirements</label>
                  <input value={form.requirements} onChange={(e) => setField('requirements', e.target.value)}
                    placeholder="Comma separated, e.g. React, Node.js, 2 years experience" className={inputClass} />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Description *</label>
                  <RichTextEditor
                    value={form.description}
                    onChange={(v) => setField('description', v)}
                    placeholder="Job description..."
                    minHeight="120px"
                    error={!!errors.description}
                  />
                  <FieldError message={errors.description} />
                </div>

                <div className="flex gap-2">
                  <button type="submit" disabled={saveMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
                    {saveMutation.isPending ? 'Saving...' : 'Update Job'}
                  </button>
                  <button type="button" onClick={closeEdit} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <RecordsSkeleton />
      ) : jobs.length === 0 ? (
        <FadeIn><p className="text-center text-muted-foreground py-12">No jobs found.</p></FadeIn>
      ) : (
        <FadeIn direction="up" delay={0.1}>
          {/* Desktop table — the columns a job is scanned by, with the rest behind the details toggle. */}
          <div className="hidden lg:block border rounded-lg overflow-x-auto">
            <table className="w-full text-sm table-fixed min-w-[760px]">
              <colgroup>
                <col className="w-[27%]" />
                <col className="w-[19%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[19%]" />
              </colgroup>
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left p-3 font-medium">Title</th>
                  <th className="text-left p-3 font-medium">Company</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Deadline</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j: any) => (
                  <Fragment key={j._id}>
                    <tr data-accordion-item={j._id} className="border-t hover:bg-accent/30">
                      <td className="p-3 truncate">
                        <div className="flex items-center gap-2 min-w-0">
                          {j.image && (
                            <ImageThumbnail
                              src={j.image}
                              alt=""
                              name={j.title}
                              showZoomHint={false}
                              className="h-9 w-9 shrink-0 border"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => toggleExpand(j._id)}
                            title="View details"
                            className="font-medium hover:text-primary transition-colors inline-flex items-center gap-1.5 min-w-0 text-left"
                          >
                            <Briefcase className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate">{j.title}</span>
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground truncate" title={j.company}>{j.company}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize whitespace-nowrap">{j.type?.replace('-', ' ')}</span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {j.deadline ? formatDate(j.deadline) : '-'}
                      </td>
                      <td className="p-3">{renderStatus(j)}</td>
                      <td className="p-3">{renderActions(j)}</td>
                    </tr>

                    {/* A row of its own, because an extra cell here would fall outside the six fixed columns. */}
                    <tr>
                      <td colSpan={6} className="p-0">
                        <AnimatePresence initial={false}>
                          {expandedId === j._id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 py-2 border-t bg-muted/30">{renderDetails(j)}</div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="lg:hidden space-y-3">
            {jobs.map((j: any) => (
              <div key={j._id} data-accordion-item={j._id} className="border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-2 mb-2">
                  {j.image && (
                    <ImageThumbnail
                      src={j.image}
                      alt=""
                      name={j.title}
                      showZoomHint={false}
                      className="h-11 w-11 shrink-0 border"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpand(j._id)}
                    className="font-medium hover:text-primary transition-colors flex items-start gap-1.5 min-w-0 flex-1 text-left"
                  >
                    <Briefcase className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="break-words">{j.title}</span>
                  </button>
                  {renderStatus(j, true)}
                </div>
                <p className="text-sm text-muted-foreground break-words mb-2">{j.company}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
                  <span className="px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary capitalize whitespace-nowrap">{j.type?.replace('-', ' ')}</span>
                  {j.deadline && <span>Deadline: {formatDate(j.deadline)}</span>}
                </div>
                <div className="pt-2 border-t">{renderActions(j)}</div>
                <AnimatePresence initial={false}>
                  {expandedId === j._id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2">{renderDetails(j)}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      <InfiniteScrollSentinel
        hasNextPage={!!hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        endLabel={jobs.length > 0 ? `All ${total} jobs loaded` : undefined}
      />
    </div>
  );
}
