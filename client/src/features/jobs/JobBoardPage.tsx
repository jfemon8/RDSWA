import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { BlurText, FadeIn } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, MapPin, Clock, Search, Plus, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/date';

const JOB_TYPES = ['full-time', 'part-time', 'internship', 'remote', 'contract'] as const;

export default function JobBoardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newJob, setNewJob] = useState({
    title: '', company: '', location: '', type: 'full-time' as string,
    description: '', requirements: '', salary: '', applicationLink: '',
  });

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

  const createMutation = useMutation({
    mutationFn: async (job: any) => {
      const payload = { ...job, requirements: job.requirements.split(',').map((r: string) => r.trim()).filter(Boolean) };
      const { data } = await api.post('/jobs', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      setShowForm(false);
      setNewJob({ title: '', company: '', location: '', type: 'full-time', description: '', requirements: '', salary: '', applicationLink: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/jobs/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
  });

  const jobs = data?.data || [];

  return (
    <div className="mx-auto py-12 px-4">
      <BlurText
        text="Job Board"
        className="text-3xl md:text-4xl font-bold mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-muted-foreground mb-8">
          Find job opportunities shared by RDSWA members and alumni.
        </p>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.3}>
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Types</option>
            {JOB_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
            ))}
          </select>

          {user && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              <Plus className="h-4 w-4" /> Post Job
            </button>
          )}
        </div>
      </FadeIn>

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="border rounded-xl p-6 bg-card space-y-4">
              <h3 className="font-semibold text-lg">Post a New Job</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input placeholder="Job Title *" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input placeholder="Company *" value={newJob.company} onChange={(e) => setNewJob({ ...newJob, company: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input placeholder="Location" value={newJob.location} onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <select value={newJob.type} onChange={(e) => setNewJob({ ...newJob, type: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
                <input placeholder="Salary (optional)" value={newJob.salary} onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                <input placeholder="Application Link" value={newJob.applicationLink} onChange={(e) => setNewJob({ ...newJob, applicationLink: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <textarea placeholder="Description *" value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px]" />
              <input placeholder="Requirements (comma separated)" value={newJob.requirements} onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <div className="flex gap-3">
                <button
                  disabled={createMutation.isPending || !newJob.title || !newJob.company || !newJob.description}
                  onClick={() => createMutation.mutate(newJob)}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center gap-2">
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Post Job
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 border rounded-md hover:bg-muted">
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
          {jobs.map((job: any, i: number) => (
            <FadeIn key={job._id} delay={i * 0.05} direction="up">
              <div
                className="rounded-xl border bg-card p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{job.title}</h3>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                        {job.type?.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" /> {job.company}</span>
                      {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>}
                      {job.salary && <span className="flex items-center gap-1">BDT {job.salary}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDate(job.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                    {job.requirements?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.requirements.map((r: string, j: number) => (
                          <span key={j} className="px-2 py-0.5 text-xs bg-muted rounded-md">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    {job.applicationLink && (
                      <a
                        href={job.applicationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {user && (user._id === job.postedBy?._id || ['admin', 'super_admin'].includes(user.role)) && (
                      <button
                        onClick={() => deleteMutation.mutate(job._id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {job.postedBy && (
                  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                    Posted by {job.postedBy.name}
                  </p>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
