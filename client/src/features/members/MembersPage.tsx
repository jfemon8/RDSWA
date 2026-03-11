import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Search, Users, GraduationCap, UserPlus, Briefcase, MapPin } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/authStore';
import SEO from '@/components/SEO';

export default function MembersPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState('');
  const [department, setDepartment] = useState('');
  const [session, setSession] = useState('');
  const [homeDistrict, setHomeDistrict] = useState('');
  const [profession, setProfession] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = { page: String(page), limit: '20' };
  if (search) filters.search = search;
  if (batch) filters.batch = batch;
  if (department) filters.department = department;
  if (session) filters.session = session;
  if (homeDistrict) filters.homeDistrict = homeDistrict;
  if (profession) filters.profession = profession;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.members(filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/users/members?${params}`);
      return data;
    },
  });

  const members = data?.data || [];
  const pagination = data?.pagination;

  const showBecomeMember = isAuthenticated && user?.membershipStatus === 'none';

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <SEO title="Members" description="Browse the RDSWA member directory — students and alumni from Rangpur Division at University of Barishal." />
      <div className="flex items-center justify-between mb-6">
        <BlurText text="Members" className="text-3xl md:text-4xl font-bold justify-center md:justify-start" delay={80} animateBy="words" direction="bottom" />

        {showBecomeMember && (
          <FadeIn delay={0.3}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/dashboard/forms/new"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                <UserPlus className="h-4 w-4" /> Become a Member
              </Link>
            </motion.div>
          </FadeIn>
        )}
      </div>

      {/* Filters */}
      <FadeIn delay={0.15} direction="up">
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, student ID, profession..."
              className="w-full pl-10 pr-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <input
            value={batch}
            onChange={(e) => { setBatch(e.target.value); setPage(1); }}
            placeholder="Batch"
            type="number"
            className="w-24 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            value={session}
            onChange={(e) => { setSession(e.target.value); setPage(1); }}
            placeholder="Session"
            className="w-28 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
            placeholder="Department"
            className="w-36 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            value={homeDistrict}
            onChange={(e) => { setHomeDistrict(e.target.value); setPage(1); }}
            placeholder="District"
            className="w-32 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            value={profession}
            onChange={(e) => { setProfession(e.target.value); setPage(1); }}
            placeholder="Profession"
            className="w-36 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No members found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m: any, i: number) => {
              const isAlumni = m.isAlumni || m.role === 'alumni' ||
                m.jobHistory?.some((j: any) => j.isCurrent) ||
                m.businessInfo?.some((b: any) => b.isCurrent);

              return (
                <FadeIn key={m._id} delay={i * 0.04} direction="up">
                  <motion.div
                    className="border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors"
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <div className="flex items-center gap-3">
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {m.name?.[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{m.name}</p>
                          {isAlumni && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 + i * 0.04 }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full shrink-0"
                            >
                              <GraduationCap className="h-3 w-3" /> Alumni
                            </motion.span>
                          )}
                        </div>
                        {m.department && <p className="text-sm text-muted-foreground">{m.department}</p>}
                        <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                          {m.batch && <span>Batch {m.batch}</span>}
                          {m.session && <span>{m.session}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {m.profession && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Briefcase className="h-3 w-3" /> {m.profession}
                        </p>
                      )}
                      {m.homeDistrict && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {m.homeDistrict}
                        </p>
                      )}
                    </div>

                    {m.skills?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.skills.slice(0, 3).map((s: string, j: number) => (
                          <span key={j} className="px-1.5 py-0.5 text-[10px] bg-muted rounded">{s}</span>
                        ))}
                        {m.skills.length > 3 && (
                          <span className="px-1.5 py-0.5 text-[10px] text-muted-foreground">+{m.skills.length - 3}</span>
                        )}
                      </div>
                    )}
                  </motion.div>
                </FadeIn>
              );
            })}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
