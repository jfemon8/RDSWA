import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, RotateCcw, Inbox, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { FadeIn, BlurText } from '@/components/reactbits';
import { RecordsSkeleton, CardListSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/date';

interface ResourceSummary {
  key: string;
  label: string;
  count: number;
}

interface TrashItem {
  _id: string;
  title: string;
  deletedAt: string | null;
  createdAt: string | null;
}

export default function AdminTrashPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [active, setActive] = useState<ResourceSummary | null>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['trash', 'summary'],
    queryFn: async () => (await api.get('/trash')).data.data,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['trash', active?.key],
    queryFn: async () => (await api.get(`/trash/${active!.key}?limit=100`)).data.data,
    enabled: !!active,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['trash'] });
  };

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/trash/${active!.key}/${id}/restore`),
    onSuccess: () => {
      invalidate();
      toast.success('Restored');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to restore'),
  });

  const purgeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/trash/${active!.key}/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Permanently deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete'),
  });

  const resources: ResourceSummary[] = summary?.resources || [];
  const withItems = resources.filter((r) => r.count > 0);
  const rows: TrashItem[] = items || [];

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
          <Trash2 className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <BlurText
            text="Recycle Bin"
            className="text-xl sm:text-2xl font-bold"
            delay={80}
            animateBy="words"
            direction="bottom"
          />
          <p className="text-sm text-muted-foreground">
            Deleted records, recoverable until retention clears them.
          </p>
        </div>
      </div>

      {isLoading ? (
        <CardListSkeleton />
      ) : withItems.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing deleted"
          description="Deleted records show up here, where they can be restored or removed for good."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {withItems.map((resource, i) => (
            <FadeIn key={resource.key} direction="up" delay={i * 0.05}>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActive(active?.key === resource.key ? null : resource)}
                className={`w-full flex items-center justify-between gap-3 p-4 border rounded-xl bg-card text-left transition-colors ${
                  active?.key === resource.key ? 'border-primary' : 'hover:border-primary/40'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{resource.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {resource.count} deleted
                  </p>
                </div>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    active?.key === resource.key ? 'rotate-90' : ''
                  }`}
                />
              </motion.button>
            </FadeIn>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={active.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="border rounded-xl bg-card overflow-hidden"
          >
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-foreground">{active.label}</h2>
            </div>

            {itemsLoading ? (
              <div className="p-4">
                <RecordsSkeleton />
              </div>
            ) : rows.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">
                Nothing deleted here.
              </p>
            ) : (
              <ul className="divide-y">
                {rows.map((item) => (
                  <li
                    key={item._id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.title}
                      </p>
                      {item.deletedAt && (
                        <p className="text-xs text-muted-foreground">
                          Deleted {formatDate(item.deletedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Restore',
                            message: `Restore “${item.title}”?`,
                            confirmLabel: 'Restore',
                            variant: 'warning',
                          });
                          if (ok) restoreMutation.mutate(item._id);
                        }}
                        title="Restore"
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete Permanently',
                            message: `Erase “${item.title}” from the database? This cannot be undone.`,
                            confirmLabel: 'Delete Permanently',
                            variant: 'danger',
                            requireTypeToConfirm: 'DELETE',
                          });
                          if (ok) purgeMutation.mutate(item._id);
                        }}
                        title="Delete permanently"
                        className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </motion.button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
