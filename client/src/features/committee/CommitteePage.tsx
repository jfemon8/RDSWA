import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Users, Crown, Mail, ChevronDown, CalendarDays } from 'lucide-react';
import { BlurText } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { Skeleton } from '@/components/ui/Skeleton';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';
import EmptyState from '@/components/ui/EmptyState';
import Promo from '@/components/promo/Promo';
import { formatDate } from '@/lib/date';
import {
  committeeDisplayName,
  isCurrentCommittee,
  memberDisplayPosition,
  sortedActiveMembers,
  sortedCommittees,
} from '@/lib/committee';

export default function CommitteePage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.committees.all,
    queryFn: async () => {
      const { data } = await api.get('/committees');
      return data;
    },
  });

  const committees = useMemo<any[]>(() => sortedCommittees<any>(data?.data || []), [data]);

  const [openId, setOpenId] = useState<string | null>(null);
  const opened = useRef(false);

  // The list arrives after the first render, so the running committee is opened once it does.
  useEffect(() => {
    if (opened.current || committees.length === 0) return;
    opened.current = true;
    setOpenId(committees[0]._id);
  }, [committees]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 md:py-12 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border rounded-xl bg-card overflow-hidden">
            <div className="p-5 space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
            {i === 0 && (
              <div className="p-5 pt-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3 p-3 border rounded-xl">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 md:py-12">
      <SEO
        title="Committee"
        description="RDSWA committees and leadership team at the University of Barishal — President, General Secretary, Organizing Secretary, Treasurer and full executive lineup of every committee. Meet the people leading the Rangpur Divisional Student Welfare Association. RDSWA কমিটি ও নেতৃত্ব।"
        keywords="RDSWA committee, RDSWA president, RDSWA general secretary, BU Rangpur committee, University of Barishal student committee, RDSWA executive, ববি কমিটি, RDSWA কমিটি"
      />
      <BlurText
        text="Committees"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-8 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      {/* On lg+ the committee cards split against a sticky promo, and smaller screens keep the original full-width grid. */}
      <div className="lg:flex lg:gap-6">
        <div className="flex-1 min-w-0">
          {committees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Committees Yet"
              description="No committee information has been published yet. Once a committee is formed, members and positions will appear here."
              primary={{ label: 'Contact Admin', icon: Mail, to: '/contact' }}
              hint="Committees are elected teams that lead RDSWA activities — President, General Secretary, Organizing Secretary, and more."
            />
          ) : (
            <div className="space-y-3">
              {committees.map((c: any, idx: number) => (
                <CommitteeCard
                  key={c._id}
                  committee={c}
                  index={idx}
                  isOpen={openId === c._id}
                  // Only one body is open, and pressing the open card closes it again.
                  onToggle={() => setOpenId((current) => (current === c._id ? null : c._id))}
                />
              ))}
            </div>
          )}
        </div>
        <aside className="hidden lg:block lg:empty:hidden w-72 shrink-0 sticky top-20 self-start">
          <Promo kind="sidebar" minHeight={600} />
        </aside>
      </div>
    </div>
  );
}

function CommitteeCard({
  committee: c,
  index,
  isOpen,
  onToggle,
}: {
  committee: any;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isCurrent = isCurrentCommittee(c);
  const members = useMemo(() => sortedActiveMembers(c.members || []), [c.members]);
  const bodyId = `committee-body-${c._id}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.3) }}
      className={`border rounded-xl bg-card overflow-hidden ${isOpen ? 'border-primary/30' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        className="w-full text-left p-4 sm:p-5 flex items-start gap-3 hover:bg-accent/40 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg sm:text-xl font-semibold break-words">{committeeDisplayName(c)}</h2>
            {isCurrent && (
              <span className="px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full shrink-0">
                Current
              </span>
            )}
          </div>
          {c.tenure?.startDate && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDate(c.tenure.startDate)}</span>
              <span aria-hidden="true">→</span>
              <span>{c.tenure.endDate ? formatDate(c.tenure.endDate) : 'Present'}</span>
            </p>
          )}
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground shrink-0 mt-1"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="body"
            id={bodyId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 sm:px-5 border-t pt-4">
              {c.description && (
                <RichContent html={c.description} className="text-sm text-muted-foreground mb-4" />
              )}

              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sitting members listed for this committee.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {members.map((m: any, i: number) => (
                    <MemberCard key={m._id || i} member={m} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MemberCard({ member }: { member: any }) {
  const isLeader = ['president', 'general_secretary'].includes(member.position);
  return (
    <Link
      to={`/members/${member.user?._id}`}
      className={`flex items-center gap-3 p-3 border rounded-xl transition-colors h-full ${isLeader ? 'border-primary/30 bg-primary/5' : 'hover:bg-accent hover:border-primary/30'}`}
    >
      {member.user?.avatar ? (
        <img src={member.user.avatar} alt="" loading="lazy" decoding="async" className="h-10 w-10 rounded-full object-cover shrink-0" />
      ) : (
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm shrink-0">
          {member.user?.name?.[0] || '?'}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-medium text-sm truncate flex items-center gap-1">
          {isLeader ? <Crown className="h-3 w-3 text-yellow-500" /> : <Users className="h-3 w-3 text-primary" />}
          {member.user?.name || 'Unknown'}
        </p>
        <p className="text-xs text-muted-foreground capitalize">{memberDisplayPosition(member)}</p>
        {member.positionBn && <p className="text-xs text-muted-foreground/70">{member.positionBn}</p>}
        {member.responsibilities && (
          <RichContent html={member.responsibilities} className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-2" />
        )}
      </div>
    </Link>
  );
}
