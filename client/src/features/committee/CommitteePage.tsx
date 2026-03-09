import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Users, Crown, Loader2 } from 'lucide-react';

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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Committees</h1>

      {committees.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No committees found</p>
        </div>
      ) : (
        <div className="space-y-8">
          {committees.map((c: any) => (
            <div key={c._id} className="border rounded-lg overflow-hidden bg-background">
              <div className="p-6 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{c.name}</h2>
                  {c.isCurrent && (
                    <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                      Current
                    </span>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {c.members?.map((m: any, i: number) => (
                    <MemberCard key={i} member={m} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: any }) {
  const isLeader = ['president', 'general_secretary'].includes(member.position);
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
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
