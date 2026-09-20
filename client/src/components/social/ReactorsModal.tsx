import { useMemo, useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { User as UserIcon, X } from 'lucide-react';
import api from '@/lib/api';
import { InlineListSkeleton } from '@/components/ui/Skeleton';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useAuthStore } from '@/stores/authStore';
import { REACTIONS, reactionOf, type ReactionUser } from './reactions';

interface ReactorsModalProps {
  open: boolean;
  onClose: () => void;
  announcementId: string;
  /** Tab to open on, so pressing a single emoji lands on that reaction. */
  initialType?: string | null;
}

/** The list of everyone who reacted, split into a tab per reaction the way a social feed does. */
export default function ReactorsModal({ open, onClose, announcementId, initialType = null }: ReactorsModalProps) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<string | null>(initialType);

  // Loaded only once the list is opened, since a long reactor list has no place in the page payload.
  const { data: reactors = [], isLoading } = useQuery<ReactionUser[]>({
    queryKey: ['announcement-reactors', announcementId],
    queryFn: async () =>
      (await api.get(`/communication/announcements/${announcementId}/reactions`)).data.data,
    enabled: open && !!announcementId,
  });

  useEffect(() => {
    if (open) setTab(initialType ?? null);
  }, [open, initialType]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Only the reactions actually used get a tab, kept in the picker's order.
  const tabs = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of reactors) counts[r.type] = (counts[r.type] || 0) + 1;
    return REACTIONS.filter((r) => counts[r.type]).map((r) => ({ ...r, count: counts[r.type] }));
  }, [reactors]);

  const visible = tab ? reactors.filter((r) => r.type === tab) : reactors;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Bottom sheet on mobile, centered on desktop, matching the app's other modals. */}
          <div className="fixed inset-x-0 bottom-0 sm:inset-0 z-[201] flex justify-center sm:items-center sm:p-4 pointer-events-none">
            <motion.div
              initial={{ y: '100%', opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: '100%', opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              role="dialog"
              aria-modal="true"
              aria-label="People who reacted"
              className="relative bg-card/95 backdrop-blur-xl border border-border/60 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col pointer-events-auto"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
            >
              <div className="flex justify-center pt-2.5 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>

              <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-2">
                <h3 className="text-base font-bold text-foreground">Reactions</h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-1 px-2 sm:px-3 border-b overflow-x-auto no-scrollbar">
                <TabButton active={tab === null} onClick={() => setTab(null)}>
                  All <span className="text-muted-foreground">{reactors.length}</span>
                </TabButton>
                {tabs.map((t) => (
                  <TabButton key={t.type} active={tab === t.type} onClick={() => setTab(t.type)}>
                    <span className="text-base leading-none">{t.emoji}</span>
                    <span className="text-muted-foreground">{t.count}</span>
                  </TabButton>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-2">
                {isLoading ? (
                  <InlineListSkeleton count={4} />
                ) : visible.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No reactions yet.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {visible.map((r, i) => {
                      const meta = reactionOf(r.type);
                      return (
                        <motion.li
                          key={`${r.user?._id}-${r.type}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i, 10) * 0.03 }}
                        >
                          <Link
                            to={`/members/${r.user?._id}`}
                            onClick={onClose}
                            className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-accent transition-colors"
                          >
                            <span className="relative shrink-0">
                              {r.user?.avatar ? (
                                <img src={r.user.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                              ) : (
                                <span className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                                </span>
                              )}
                              <span
                                title={meta?.label}
                                className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-card border flex items-center justify-center text-[11px] leading-none"
                              >
                                {meta?.emoji || '👍'}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">
                              {r.user?.name || 'Unknown'}
                              {r.user?._id === user?._id && (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(You)</span>
                              )}
                            </span>
                          </Link>
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
        active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
      {active && (
        <motion.span layoutId="reactor-tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
      )}
    </button>
  );
}
