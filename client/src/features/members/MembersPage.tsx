import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Search, Users } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';
import { ListItemSkeleton } from '@/components/ui/Skeleton';

export default function MembersPage() {
  const [search, setSearch] = useState('');
  const [batch, setBatch] = useState('');
  const [department, setDepartment] = useState('');
  const [page, setPage] = useState(1);

  const filters: Record<string, string> = { page: String(page), limit: '20' };
  if (search) filters.search = search;
  if (batch) filters.batch = batch;
  if (department) filters.department = department;

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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <BlurText text="Members" className="text-3xl md:text-4xl font-bold mb-6 justify-center md:justify-start" delay={80} animateBy="words" direction="bottom" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name..."
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
          value={department}
          onChange={(e) => { setDepartment(e.target.value); setPage(1); }}
          placeholder="Department"
          className="w-40 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

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
            {members.map((m: any, i: number) => (
              <FadeIn key={m._id} delay={i * 0.04} direction="up">
              <motion.div className="border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors" whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <div className="flex items-center gap-3">
                  {m.avatar ? (
                    <img src={m.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {m.name?.[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.name}</p>
                    {m.department && <p className="text-sm text-muted-foreground">{m.department}</p>}
                    {m.batch && <p className="text-xs text-muted-foreground">Batch {m.batch}</p>}
                  </div>
                </div>
                {m.homeDistrict && (
                  <p className="text-xs text-muted-foreground mt-2">From: {m.homeDistrict}</p>
                )}
              </motion.div>
              </FadeIn>
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
  );
}
