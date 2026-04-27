import { useMemo, useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Search, Users, GraduationCap, Briefcase, MapPin, User, Award, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import SEO from '@/components/SEO';
import { districts } from '@/data/bdGeo';
import { getRoleConfig } from '@/lib/roles';
import { UserRole } from '@rdswa/shared';
import Promo from '@/components/promo/Promo';

const PROMO_EVERY = 6;

export interface MemberDirectoryPageProps {
  /** Page title shown as heading and SEO title */
  title: string;
  /** SEO description */
  description: string;
  /** Backend flag filter — which boolean to query on */
  flagFilter: 'isAlumni' | 'isAdvisor' | 'isSeniorAdvisor';
  /** Label for the empty state ("No alumni found" etc.) */
  emptyLabel: string;
}

/**
 * Reusable public member directory page.
 * Used by AlumniPage, AdvisorsPage, SeniorAdvisorsPage — they each pass a flag filter
 * that the backend uses to narrow the user list.
 */
export default function MemberDirectoryPage({
  title,
  description,
  flagFilter,
  emptyLabel,
}: MemberDirectoryPageProps) {
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState('');
  const [department, setDepartment] = useState('');
  const [homeDistrict, setHomeDistrict] = useState('');
  const [profession, setProfession] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = {
    page: String(page),
    limit: '20',
    [flagFilter]: 'true',
  };
  if (search) filters.search = search;
  if (batch) filters.batch = batch;
  if (department) filters.department = department;
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

  const allDistricts = useMemo(() => {
    const all = Object.values(districts).flat();
    return [...new Set(all)].sort((a, b) => a.localeCompare(b));
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <SEO title={title} description={description} />
      <BlurText
        text={title}
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      {/* Filters */}
      <FadeIn delay={0.1} direction="up">
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, profession..."
              className="w-full pl-10 pr-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <input
            value={batch}
            onChange={(e) => { setBatch(e.target.value); setPage(1); }}
            placeholder="Batch"
            type="number"
            className="w-full sm:w-24 px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <input
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
            placeholder="Department"
            className="w-full sm:w-36 px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select
            value={homeDistrict}
            onChange={(e) => { setHomeDistrict(e.target.value); setPage(1); }}
            className="w-full sm:w-40 px-3 py-2.5 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            className="w-full sm:w-36 px-3 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </FadeIn>

      {/* lg+ adds a sticky right-rail promo column. Below lg the layout
          collapses to full-width and behaves identically to before. */}
      <div className="lg:flex lg:gap-6">
        <div className="flex-1 min-w-0">
      {isLoading ? (
        <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No {emptyLabel} found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {members.map((m: any, i: number) => (
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
                        <TagBadge
                          visible={!!m.isAlumni}
                          icon={GraduationCap}
                          label="Alumni"
                          delay={0.2 + i * 0.04}
                          className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        />
                        <TagBadge
                          visible={!!m.isAdvisor}
                          icon={Award}
                          label="Advisor"
                          delay={0.22 + i * 0.04}
                          className="bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400"
                        />
                        <TagBadge
                          visible={!!m.isSeniorAdvisor}
                          icon={Star}
                          label="Senior Advisor"
                          delay={0.24 + i * 0.04}
                          className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                        />
                        {m.role && ![UserRole.MEMBER, UserRole.USER, UserRole.ALUMNI, UserRole.ADVISOR, UserRole.SENIOR_ADVISOR].includes(m.role) && (() => {
                          const rc = getRoleConfig(m.role);
                          return (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.25 + i * 0.04 }}
                              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded-full shrink-0 ${rc.bg} ${rc.text}`}
                            >
                              {rc.label}
                            </motion.span>
                          );
                        })()}
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
                        <Briefcase className="h-3 w-3 shrink-0" /> {m.profession}
                      </p>
                    )}
                    {m.homeDistrict && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" /> {m.homeDistrict}
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
            ))}
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
        <aside className="hidden lg:block lg:empty:hidden w-72 shrink-0 sticky top-20 self-start">
          <Promo kind="sidebar" minHeight={600} />
        </aside>
      </div>
    </div>
  );
}

function TagBadge({
  visible,
  icon: Icon,
  label,
  delay,
  className,
}: {
  visible: boolean;
  icon: LucideIcon;
  label: string;
  delay: number;
  className: string;
}) {
  if (!visible) return null;
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay }}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full shrink-0 ${className}`}
    >
      <Icon className="h-3 w-3" /> {label}
    </motion.span>
  );
}
