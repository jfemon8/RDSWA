import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { GraduationCap, Award, Star, Crown, History } from 'lucide-react';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { getRoleConfig } from '@/lib/roles';
import { committeePostBadges } from '@/lib/committee';

interface ProfileBadgesProps {
  user: {
    _id?: string;
    role?: string;
    isAlumni?: boolean;
    isAdvisor?: boolean;
    isSeniorAdvisor?: boolean;
  };
  className?: string;
}

const PILL = 'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full';

/** The badge row on a profile, where each group collapses to its highest level so nobody wears the same standing twice. */
export default function ProfileBadges({ user, className = '' }: ProfileBadgesProps) {
  const { data } = useQuery({
    queryKey: queryKeys.committees.all,
    queryFn: async () => {
      const { data } = await api.get('/committees');
      return data;
    },
    enabled: !!user._id,
  });

  const roleConfig = user.role ? getRoleConfig(user.role) : null;
  // Senior Advisor already implies Advisor, so only the higher of the two tags is worn.
  const advisorTag = user.isSeniorAdvisor
    ? { label: 'Senior Advisor', icon: Star, classes: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' }
    : user.isAdvisor
      ? { label: 'Advisor', icon: Award, classes: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' }
      : null;
  const postBadges = committeePostBadges(data?.data || [], user._id);

  const pop = (delay: number) => ({
    initial: { scale: 0 },
    animate: { scale: 1 },
    transition: { type: 'spring' as const, stiffness: 260, damping: 20, delay },
  });

  return (
    <div className={`flex flex-wrap items-center justify-center sm:justify-start gap-1.5 ${className}`}>
      {roleConfig && (
        <motion.span {...pop(0)} className={`${PILL} ${roleConfig.bg} ${roleConfig.text}`}>
          {roleConfig.label}
        </motion.span>
      )}

      {advisorTag && (
        <motion.span {...pop(0.04)} className={`${PILL} ${advisorTag.classes}`}>
          <advisorTag.icon className="h-3 w-3" /> {advisorTag.label}
        </motion.span>
      )}

      {user.isAlumni && (
        <motion.span {...pop(0.08)} className={`${PILL} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`}>
          <GraduationCap className="h-3 w-3" /> Alumni
        </motion.span>
      )}

      {postBadges.map((badge, i) => (
        <motion.span
          key={badge.label}
          {...pop(0.12 + i * 0.04)}
          title={badge.tooltip}
          className={`${PILL} ${
            badge.isCurrent
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
          }`}
        >
          {badge.isCurrent ? <Crown className="h-3 w-3" /> : <History className="h-3 w-3" />}
          {badge.label}
        </motion.span>
      ))}
    </div>
  );
}
