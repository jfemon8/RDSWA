import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { queryKeys } from '@/lib/queryKeys';
import { Search, Users, GraduationCap, UserPlus, Briefcase, Award, Star, User, X } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/stores/authStore';
import SEO from '@/components/SEO';
import { getRoleConfig } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import EmptyState from '@/components/ui/EmptyState';
import DistrictPicker from '@/components/ui/DistrictPicker';
import { memberMeta } from '@/lib/member';
import InfiniteScrollSentinel from '@/components/ui/InfiniteScrollSentinel';
import Promo from '@/components/promo/Promo';
import { useAcademicConfig } from '@/hooks/useAcademicConfig';

// One in-feed promo per six member cards, the balance point between dominating the grid and missing short pages.
const PROMO_EVERY = 6;

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
  const debouncedSearch = useDebouncedValue(search);
  const { config: academicConfig, departments } = useAcademicConfig();
  const [batch, setBatch] = useState('');
  const [department, setDepartment] = useState('');
  const [session, setSession] = useState('');
  const [district, setDistrict] = useState('');
  const [profession, setProfession] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey>('');

  const filters: Record<string, string> = {};
  if (debouncedSearch) filters.search = debouncedSearch;
  if (batch) filters.batch = batch;
  if (department) filters.department = department;
  if (session) filters.session = session;
  if (district) filters.district = district;
  if (profession) filters.profession = profession;
  // Use persisted flag filters for alumni/advisor/senior advisor tabs
  if (categoryFilter === 'alumni') filters.isAlumni = 'true';
  else if (categoryFilter === 'advisor') filters.isAdvisor = 'true';
  else if (categoryFilter === 'senior_advisor') filters.isSeniorAdvisor = 'true';

  const {
    items: members,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteList({
    queryKey: queryKeys.users.members(filters),
    path: '/users/members',
    filters,
    limit: 20,
  });

  const showBecomeMember = isAuthenticated && user?.membershipStatus === 'none';
  const activeCategory = MEMBER_CATEGORIES.find((c) => c.key === categoryFilter) || MEMBER_CATEGORIES[0];

  return (
    <div className="container mx-auto py-8">
      <SEO
        title={`${activeCategory.label} - RDSWA Member Directory`}
        description={`Browse the RDSWA ${activeCategory.label.toLowerCase()} directory: verified students and alumni of the University of Barishal from Rangpur Division. Find members by department, batch, district, and profession. RDSWA সদস্য ডিরেক্টরি।`}
        keywords={`RDSWA members, ${activeCategory.label} RDSWA, BU Rangpur students, University of Barishal student directory, Rangpur students BU, ববি রংপুর শিক্ষার্থী, RDSWA সদস্য`}
      />
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

      <FadeIn delay={0.1} direction="up">
        <div className="flex flex-wrap gap-2 mb-6">
          {MEMBER_CATEGORIES.map((cat) => (
            <motion.button
              key={cat.key}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setCategoryFilter(cat.key); }}
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

      <FadeIn delay={0.15} direction="up">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              placeholder="Search by name, email, student ID, profession..."
              className="w-full pl-10 pr-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={batch}
            onChange={(e) => { setBatch(e.target.value); }}
            aria-label="Filter by batch"
            className="w-full sm:w-32 px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Batches</option>
            {academicConfig.batches.map((b) => (
              <option key={b} value={parseInt(b, 10) || b}>{b}</option>
            ))}
          </select>
          <select
            value={session}
            onChange={(e) => { setSession(e.target.value); }}
            aria-label="Filter by session"
            className="w-full sm:w-36 px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Sessions</option>
            {academicConfig.sessions.map((ses) => (
              <option key={ses} value={ses}>{ses}</option>
            ))}
          </select>
          <select
            value={department}
            onChange={(e) => { setDepartment(e.target.value); }}
            aria-label="Filter by department"
            className="w-full sm:w-44 px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <DistrictPicker value={district} onChange={setDistrict} className="w-full sm:w-44" />
          <input
            value={profession}
            onChange={(e) => { setProfession(e.target.value); }}
            placeholder="Profession"
            className="w-full sm:w-36 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </FadeIn>

      {/* Main and sidebar split on lg+, with the main column taking full width below lg. */}
      <div className="lg:flex lg:gap-6">
        <div className="flex-1 min-w-0">
      {isLoading ? (
        <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={activeCategory.icon}
          title={`No ${activeCategory.label} Found`}
          description={
            search || batch || department || session || district || profession
              ? 'No members match your current filters. Try clearing some filters to broaden your search.'
              : `No ${activeCategory.label.toLowerCase()} are listed yet. The directory updates as members join and admins approve applications.`
          }
          primary={
            search || batch || department || session || district || profession
              ? {
                  label: 'Clear Filters',
                  icon: X,
                  onClick: () => {
                    setSearch(''); setBatch(''); setDepartment(''); setSession('');
                    setDistrict(''); setProfession('');
                  },
                }
              : undefined
          }
          secondary={categoryFilter !== '' ? { label: 'View All Members', icon: Users, onClick: () => setCategoryFilter('') } : undefined}
          hint="Members are students, alumni and advisors who have been approved as part of the RDSWA community."
        />
      ) : (
        <>
          <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {members.map((m: any, i: number) => {
              return (
                <Fragment key={m._id}>
                <FadeIn delay={i * 0.04} direction="up">
                  <Link
                    to={`/members/${m._id}`}
                    className="block border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {m.avatar ? (
                        <img src={m.avatar} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded-full object-cover" />
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
                        <p className="text-xs text-muted-foreground">{memberMeta(m)}</p>
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {m.profession && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Briefcase className="h-3 w-3" /> {m.profession}
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
                {(i + 1) % PROMO_EVERY === 0 && i < members.length - 1 && (
                  <div className="sm:col-span-2 xl:col-span-3 empty:hidden">
                    <Promo kind="infeed" minHeight={160} />
                  </div>
                )}
                </Fragment>
              );
            })}
          </div>

          <InfiniteScrollSentinel
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            endLabel={members.length > 0 ? `All ${total} members loaded` : undefined}
          />
        </>
      )}
        </div>
        {/* Sticky right rail on lg+ only, where `self-start` keeps the promo top-aligned however tall the member list grows. */}
        <aside className="hidden lg:block lg:empty:hidden w-72 shrink-0 sticky top-20 self-start">
          <Promo kind="sidebar" minHeight={600} />
        </aside>
      </div>
    </div>
  );
}
