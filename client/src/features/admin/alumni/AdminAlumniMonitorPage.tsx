import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FadeIn } from '@/components/reactbits';
import { motion } from 'motion/react';
import { Loader2, GraduationCap, UserMinus, Briefcase, Building2 } from 'lucide-react';

export default function AdminAlumniMonitorPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'alumni-monitor', page],
    queryFn: async () => {
      const { data } = await api.get(`/users?isAlumni=true&limit=20&page=${page}`);
      return data;
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/users/${id}/alumni/revoke`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('Alumni approval revoked'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  const users = data?.data || [];
  const pagination = data?.pagination;

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <GraduationCap className="h-6 w-6 text-amber-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Alumni Classification Monitor</h1>
        </div>

        <FadeIn delay={0.1}>
          <div className="mb-4 p-3 rounded-lg border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
            Members are auto-tagged as Alumni when they add a current job or business, or when an admin approves their alumni form.
            You can revoke the sticky alumni form approval here — if the user still has a current job/business, they will remain alumni automatically.
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No alumni members found</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {users.map((u: any, i: number) => {
                const currentJob = u.jobHistory?.find((j: any) => j.isCurrent);
                const currentBiz = u.businessInfo?.find((b: any) => b.isCurrent);

                return (
                  <FadeIn key={u._id} delay={i * 0.04} direction="up">
                    <div className="border rounded-lg p-4 bg-card">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-medium text-sm shrink-0">
                              {u.name?.[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                            <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                              {u.batch && <span>Batch {u.batch}</span>}
                              {u.department && <span>· {u.department}</span>}
                            </div>
                          </div>
                        </div>

                        {u.alumniApproved ? (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => revokeMutation.mutate(u._id)}
                            disabled={revokeMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-md text-orange-600 border-orange-200 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 shrink-0"
                          >
                            <UserMinus className="h-3 w-3" /> Revoke Alumni Approval
                          </motion.button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic shrink-0">Auto-tagged</span>
                        )}
                      </div>

                      {/* Classification reason */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {currentJob && (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded">
                            <Briefcase className="h-3 w-3" /> {currentJob.position} at {currentJob.company}
                          </span>
                        )}
                        {currentBiz && (
                          <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded">
                            <Building2 className="h-3 w-3" /> {currentBiz.businessName} ({currentBiz.type})
                          </span>
                        )}
                        {!currentJob && !currentBiz && (
                          <span className="text-xs text-muted-foreground italic">No active job/business found — may have been manually classified</span>
                        )}
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>

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
    </FadeIn>
  );
}
