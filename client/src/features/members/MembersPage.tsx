import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Search, Users, GraduationCap, UserPlus, Briefcase, MapPin, Award, Star, User } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/authStore';
import SEO from '@/components/SEO';
import { districts } from '@/data/bdGeo';
import { getRoleConfig } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';

type CategoryKey = '' | 'alumni' | 'advisor' | 'senior_advisor';

const MEMBER_CATEGORIES: ReadonlyArray<{ key: CategoryKey; label: string; icon: typeof Users }> = [
  { key: '', label: 'All Members', icon: Users },
  { key: 'alumni', label: 'Alumni', icon: GraduationCap },
  { key: 'advisor', label: 'Advisors', icon: Award },
  { key: 'senior_advisor', label: 'Senior Advisors', icon: Star },
];

export default function MembersPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState('');
  const [department, setDepartment] = useState('');
  const [session, setSession] = useState('');
  const [homeDistrict, setHomeDistrict] = useState('');
  const [profession, setProfession] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = { page: String(page), limit: '20' };
  if (search) filters.search = search;
  if (batch) filters.batch = batch;
  if (department) filters.department = department;
  if (session) filters.session = session;
  if (homeDistrict) filters.homeDistrict = homeDistrict;
  if (profession) filters.profession = profession;
  // Use persisted flag filters for alumni/advisor/senior advisor tabs
  if (categoryFilter === 'alumni') filters.isAlumni = 'true';
  else if (categoryFilter === 'advisor') filters.isAdvisor = 'true';
  else if (categoryFilter === 'senior_advisor') filters.isSeniorAdvisor = 'true';

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

  const allDistricts = useMemo(() => {
    const all = Object.values(districts).flat();
    return [...new Set(all)].sort((a, b) => a.localeCompare(b));
  }, []);

  const showBecomeMember = isAuthenticated && user?.membershipStatus === 'none';
  const activeCategory = MEMBER_CATEGORIES.find((c) => c.key === categoryFilter) || MEMBER_CATEGORIES[0];

  return (
    <div className="container mx-auto py-8">
      <SEO title={activeCategory.label} description="Browse the RDSWA member directory — students and alumni from Rangpur Division at University of Barishal." />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <BlurText text={activeCategory.label} className="text-2xl sm:text-3xl md:text-4xl font-bold justify-center md:justify-start" delay={80} animateBy="words" direction="bottom" />

        {showBecomeMember && (
          <FadeIn delay={0.3}>
            <Link
              to="/dashboard/forms/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
            >
              <UserPlus className="h-4 w-4" /> Become a Member
            </Link>
          </FadeIn>
        )}
      </div>

      {/* Category Tabs */}
      <FadeIn delay={0.1} direction="up">
        <div className="flex flex-wrap gap-2 mb-6">
          {MEMBER_CATEGORIES.map((cat) => (
            <motion.button
              key={cat.key}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setCategoryFilter(cat.key); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                categoryFilter === cat.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              <cat.icon className="h-3.5 w-3.5" />
              {cat.label}
            </motion.button>
          ))}
        </div>
      </FadeIn>

      {/* Filters */}
      <FadeIn delay={0.15} direction="up">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
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
            className="w-full sm:w-24 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            value={session}
            onChange={(e) => { setSession(e.target.value); setPage(1); }}
            placeholder="Session"
            className="w-full sm:w-28 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
            placeholder="Department"
            className="w-full sm:w-36 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select
            value={homeDistrict}
            onChange={(e) => { setHomeDistrict(e.target.value); setPage(1); }}
            className="w-full sm:w-40 px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Districts</option>
            {allDistricts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <input
            value={profession}
            onChange={(e) => { setProfession(e.target.value); setPage(1); }}
            placeholder="Profession"
            className="w-full sm:w-36 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No {activeCategory.label.toLowerCase()} found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m: any, i: number) => {
              return (
                <FadeIn key={m._id} delay={i * 0.04} direction="up">
                  <Link
                    to={`/members/${m._id}`}
                    className="block border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors"
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium truncate flex items-center gap-1">
                            <User className="h-3.5 w-3.5 text-primary shrink-0" /> {m.nickName || m.name}
                          </p>
                          {m.role && m.role !== UserRole.MEMBER && m.role !== UserRole.USER && m.role !== UserRole.ALUMNI && m.role !== UserRole.ADVISOR && m.role !== UserRole.SENIOR_ADVISOR && (() => {
                            const rc = getRoleConfig(m.role);
                            return (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 + i * 0.04 }}
                                className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full shrink-0 ${rc.bg} ${rc.text}`}
                              >
                                {rc.label}
                              </motion.span>
                            );
                          })()}
                          {m.isAlumni && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.22 + i * 0.04 }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full shrink-0"
                            >
                              <GraduationCap className="h-3 w-3" /> Alumni
                            </motion.span>
                          )}
                          {m.isAdvisor && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.24 + i * 0.04 }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 rounded-full shrink-0"
                            >
                              <Award className="h-3 w-3" /> Advisor
                            </motion.span>
                          )}
                          {m.isSeniorAdvisor && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.26 + i * 0.04 }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-full shrink-0"
                            >
                              <Star className="h-3 w-3" /> Senior Advisor
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
                  </Link>
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
