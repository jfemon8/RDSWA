import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Users, Crown, Loader2 } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';

export default function CommitteePage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.committees.all,
    queryFn: async () => {
      const { data } = await api.get('/committees');
      return data;
    },
  });

  const committees = data?.data || [];

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <BlurText
        text="Committees"
        className="text-3xl md:text-4xl font-bold mb-8 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      {committees.length === 0 ? (
        <FadeIn>
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No committees found</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-8">
          {committees.map((c: any, idx: number) => (
            <FadeIn key={c._id} delay={idx * 0.1} direction="up">
              <div className="border rounded-xl overflow-hidden bg-card">
                <div className="p-6 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">{c.name}</h2>
                    {c.isCurrent && (
                      <motion.span
                        className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        Current
                      </motion.span>
                    )}
                  </div>
                  {c.tenure && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(c.tenure.startDate).getFullYear()}
                      {c.tenure.endDate ? ` - ${new Date(c.tenure.endDate).getFullYear()}` : ' - Present'}
                    </p>
                  )}
                  {c.description && <p className="text-sm text-muted-foreground mt-2">{c.description}</p>}
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {c.members?.map((m: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i }}
                        whileHover={{ scale: 1.02, y: -2 }}
                      >
                        <MemberCard member={m} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: any }) {
  const isLeader = ['president', 'general_secretary'].includes(member.position);
  return (
    <div className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${isLeader ? 'border-primary/30 bg-primary/5' : 'hover:bg-accent'}`}>
      {member.user?.avatar ? (
        <img src={member.user.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
          {member.user?.name?.[0] || '?'}
        </div>
      )}
      <div className="min-w-0">
        <p className="font-medium text-sm truncate flex items-center gap-1">
          {isLeader && <Crown className="h-3 w-3 text-yellow-500" />}
          {member.user?.name || 'Unknown'}
        </p>
        <p className="text-xs text-muted-foreground capitalize">{member.position?.replace('_', ' ')}</p>
      </div>
    </div>
  );
}
