import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';
import { hasMinRole } from '@/lib/roles';
import { BlurText, FadeIn } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, MapPin, Clock, Search, Plus, ExternalLink, Trash2, Loader2, Users, CalendarX, Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/date';
import RichTextEditor from '@/components/ui/RichTextEditor';
import RichContent from '@/components/ui/RichContent';

function isJobExpired(job: any): boolean {
  if (!job?.deadline) return false;
  const d = new Date(job.deadline);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

/** Format a job type like "full-time" → "Full Time" */
function formatJobType(type?: string): string {
  if (!type) return '';
  return type.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const EMPTY_JOB = {
  title: '', company: '', location: '', type: 'full-time' as string,
  description: '', requirements: '', salary: '', vacancy: '', applicationLink: '', deadline: '',
};

const JOB_TYPES = ['full-time', 'part-time', 'internship', 'remote', 'contract'] as const;

export default function JobBoardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newJob, setNewJob] = useState({ ...EMPTY_JOB });

  const canManage = (job: any): boolean => {
    if (!user) return false;
    if (user._id === job.postedBy?._id) return true;
    return ['admin', 'super_admin'].includes(user.role);
  };

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.jobs.all, search, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      const { data } = await api.get(`/jobs?${params}`);
      return data;
    },
  });

  const buildPayload = (job: any) => {
    const payload: any = {
      ...job,
      requirements: (job.requirements || '').split(',').map((r: string) => r.trim()).filter(Boolean),
    };
    // Strip empty optional fields so backend sees them as undefined
    if (!payload.vacancy) delete payload.vacancy;
    if (!payload.deadline) delete payload.deadline;
    if (!payload.location) delete payload.location;
    if (!payload.salary) delete payload.salary;
    if (!payload.applicationLink) delete payload.applicationLink;
    return payload;
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setNewJob({ ...EMPTY_JOB });
  };

  const saveMutation = useMutation({
    mutationFn: async (job: any) => {
      const payload = buildPayload(job);
      if (editingId) {
        const { data } = await api.patch(`/jobs/${editingId}`, payload);
        return data;
      }
      const { data } = await api.post('/jobs', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/jobs/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
  });

  const startEdit = (job: any) => {
    setEditingId(job._id);
    setNewJob({
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      type: job.type || 'full-time',
      description: job.description || '',
      requirements: Array.isArray(job.requirements) ? job.requirements.join(', ') : '',
      salary: job.salary || '',
      vacancy: typeof job.vacancy === 'number' ? String(job.vacancy) : '',
      applicationLink: job.applicationLink || '',
      deadline: job.deadline ? new Date(job.deadline).toISOString().split('T')[0] : '',
    });
    setShowForm(true);
    // Scroll the form into view
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const jobs = data?.data || [];

  return (
    <div className="container mx-auto px-4 py-6 md:py-12">
      <BlurText
        text="Job Board"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
          Find job opportunities shared by RDSWA members and alumni.
        </p>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.3}>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex gap-2 sm:gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All Types</option>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>{formatJobType(t)}</option>
              ))}
            </select>

            {user && hasMinRole(user.role, UserRole.ALUMNI) && (
              <button
                onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg shrink-0 min-h-[44px]"
              >
                <Plus className="h-4 w-4" /> <span className="whitespace-nowrap">Post Job</span>
              </button>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 sm:mb-8 overflow-hidden"
          >
            <div className="border rounded-xl p-4 sm:p-6 bg-card space-y-3 sm:space-y-4">
              <h3 className="font-semibold text-base sm:text-lg">{editingId ? 'Edit Job' : 'Post a New Job'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <input placeholder="Job Title *" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                  className="px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input placeholder="Company *" value={newJob.company} onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                  className="px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input placeholder="Location" value={newJob.location} onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                  className="px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <select value={newJob.type} onChange={(e) => setNewJob({ ...newJob, type: e.target.value })}
                  className="px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>{formatJobType(t)}</option>
                  ))}
                </select>
                <input placeholder="Salary (optional)" value={newJob.salary} onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })}
                  className="px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input placeholder="Vacancy (optional)" type="number" min={1} value={newJob.vacancy}
                  onChange={(e) => setNewJob({ ...newJob, vacancy: e.target.value.replace(/[^0-9]/g, '') })}
                  className="px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Application Deadline (optional)</label>
                  <input type="date" value={newJob.deadline}
                    onChange={(e) => setNewJob({ ...newJob, deadline: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <input placeholder="Application Link" value={newJob.applicationLink} onChange={(e) => setNewJob({ ...newJob, applicationLink: e.target.value })}
                  className="px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <RichTextEditor value={newJob.description} onChange={(v) => setNewJob({ ...newJob, description: v })} placeholder="Job description..." minHeight="100px" />
              <input placeholder="Requirements (comma separated)" value={newJob.requirements} onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  disabled={saveMutation.isPending || !newJob.title || !newJob.company || !newJob.description}
                  onClick={() => saveMutation.mutate(newJob)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center justify-center gap-2 min-h-[44px]">
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Post Job'}
                </button>
                <button
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 py-2.5 border rounded-md hover:bg-muted min-h-[44px]">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <FadeIn>
          <p className="text-center text-muted-foreground py-12">No job posts found.</p>
        </FadeIn>
      ) : (
        <div className="space-y-4">
          {jobs.map((job: any, i: number) => {
            const expired = isJobExpired(job);
            return (
            <FadeIn key={job._id} delay={i * 0.05} direction="up">
              <Link to={`/dashboard/jobs/${job._id}`} className="block">
                <motion.div
                  whileHover={{ y: expired ? 0 : -2 }}
                  className={`relative rounded-xl border bg-card p-4 sm:p-6 transition-colors overflow-hidden ${expired ? 'opacity-75' : 'hover:border-primary/30'}`}
                >
                  {expired && (
                    <div className="absolute top-0 right-0 pointer-events-none z-10">
                      <div className="bg-red-500 text-white text-[10px] font-bold px-8 py-1 rotate-45 translate-x-6 translate-y-3 shadow-md">
                        Expired
                      </div>
                    </div>
                  )}

                  {/* Content — full width */}
                  <div className="min-w-0">
                    <div className={`flex items-center gap-2 mb-2 flex-wrap ${expired ? 'pr-16' : ''}`}>
                      <h3 className="font-semibold text-base sm:text-lg flex items-center gap-1.5 min-w-0">
                        <Briefcase className="h-4 w-4 text-primary shrink-0" />
                        <span className="break-words">{job.title}</span>
                      </h3>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium shrink-0">
                        {formatJobType(job.type)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 shrink-0" /> {job.company}</span>
                      {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /> {job.location}</span>}
                      {job.salary && <span className="flex items-center gap-1">BDT {job.salary}</span>}
                      {typeof job.vacancy === 'number' && job.vacancy > 0 && (
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 shrink-0" /> {job.vacancy} vacancy</span>
                      )}
                      {job.deadline && (
                        <span className={`flex items-center gap-1 ${expired ? 'text-red-500 font-medium' : ''}`}>
                          <CalendarX className="h-3.5 w-3.5 shrink-0" /> Deadline: {formatDate(job.deadline)}
                        </span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 shrink-0" /> {formatDate(job.createdAt)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground line-clamp-2"><RichContent html={job.description} /></div>
                    {job.requirements?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.requirements.map((r: string, j: number) => (
                          <span key={j} className="px-2 py-0.5 text-xs bg-muted rounded-md">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer — Posted by + Action buttons */}
                  {(job.postedBy || job.applicationLink || canManage(job)) && (
                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground truncate min-w-0">
                        {job.postedBy ? (
                          <>Posted by <Link to={`/members/${job.postedBy._id}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary transition-colors">{job.postedBy.name}</Link></>
                        ) : ''}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {job.applicationLink && !expired && (
                          <span
                            onClick={(e) => { e.preventDefault(); window.open(job.applicationLink, '_blank'); }}
                            className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                            title="Apply"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </span>
                        )}
                        {job.applicationLink && expired && (
                          <span
                            className="p-2 rounded-lg bg-muted text-muted-foreground cursor-not-allowed"
                            onClick={(e) => e.preventDefault()}
                            title="Application deadline has passed"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </span>
                        )}
                        {canManage(job) && (
                          <>
                            <button
                              onClick={(e) => { e.preventDefault(); startEdit(job); }}
                              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                              title="Edit job"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(job._id); }}
                              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Delete job"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </Link>
            </FadeIn>
          );
          })}
        </div>
      )}
    </div>
  );
}
