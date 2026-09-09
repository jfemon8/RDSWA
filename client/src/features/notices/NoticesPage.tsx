import { useState, useEffect, Fragment } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData } from '@tanstack/react-query';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { queryKeys } from '@/lib/queryKeys';
import { FileText, AlertTriangle, Search, Archive, Mail, X } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDate } from '@/lib/date';
import { stripHtml } from '@/lib/stripHtml';
import { motion, AnimatePresence } from 'motion/react';
import { CardSkeleton } from '@/components/ui/Skeleton';
import SEO from '@/components/SEO';
import EmptyState from '@/components/ui/EmptyState';
import InfiniteScrollSentinel from '@/components/ui/InfiniteScrollSentinel';
import Promo from '@/components/promo/Promo';

// One in-feed promo per N notice cards, spaced slightly tighter than events because notices are shorter.
const PROMO_EVERY = 6;

export default function NoticesPage() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const showArchived = params.get('archived') === '1';
  const [search, setSearch] = useState(() => params.get('q') || '');
  // Debounced so the list refetches once the typing settles, not on every keystroke.
  const debouncedSearch = useDebouncedValue(search);

  const setParam = (next: Record<string, string | null>, replace = false) =>
    setParams(
      (prev) => {
        const merged = new URLSearchParams(prev);
        Object.entries(next).forEach(([k, v]) => (v ? merged.set(k, v) : merged.delete(k)));
        return merged;
      },
      { replace },
    );

  // Settled search text is mirrored into the URL by replacement, so typing leaves no history trail.
  useEffect(() => {
    const term = debouncedSearch.trim();
    if ((params.get('q') || '') !== term) setParam({ q: term || null }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filters: Record<string, string> = {};
  if (category) filters.category = category;
  if (debouncedSearch.trim()) filters.search = debouncedSearch.trim();
  if (showArchived) filters.archived = 'true';

  const {
    items: notices,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteList({
    queryKey: queryKeys.notices.list(filters),
    path: '/notices',
    filters,
    limit: 12,
    // Changing a filter keeps the current list visible instead of dropping back to skeletons.
    queryOptions: { placeholderData: keepPreviousData },
  });
  const categories = ['', 'general', 'academic', 'event', 'urgent', 'financial', 'other'];

  return (
    <div className="container mx-auto py-6 md:py-12">
      <SEO
        title="Notices & Announcements"
        description="Latest RDSWA notices, announcements, and updates for University of Barishal Rangpur students. Read official statements, exam notices, scholarship announcements, and committee notifications. RDSWA নোটিশ ও ঘোষণা।"
        keywords="RDSWA notices, RDSWA announcements, University of Barishal notice, BU Rangpur notice, ববি নোটিশ, RDSWA নোটিশ, student welfare announcements"
      />
      <BlurText
        text="Notices"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.15}>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search notices..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              // Picking a category means browsing the live board, so it leaves the archive behind.
              onClick={() => setParam({ category: c || null, archived: null })}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors capitalize ${
                category === c ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'hover:bg-accent'
              }`}
            >
              {c || 'All'}
            </button>
          ))}
          <div className="ml-auto">
            <button
              onClick={() => setParam({ archived: showArchived ? null : '1' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                showArchived ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : 'hover:bg-accent'
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              Archived
            </button>
          </div>
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : notices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? 'No Matches' : showArchived ? 'No Archived Notices' : 'No Notices Yet'}
          description={search
            ? `No notices match "${search}". Try a different search term or clear your filters.`
            : showArchived
              ? 'There are no archived notices. Older notices are archived here once they become inactive.'
              : 'No notices have been posted yet. Check back soon or contact an admin for the latest updates.'}
          primary={search
            ? { label: 'Clear Search', icon: X, onClick: () => setSearch('') }
            : { label: 'Contact Admin', icon: Mail, to: '/contact' }}
          secondary={!search && !showArchived ? { label: 'View Archived', icon: Archive, onClick: () => setParam({ archived: '1' }) } : undefined}
          hint="Important announcements, academic updates and urgent notices from RDSWA appear here."
        />
      ) : (
        <>
          <AnimatePresence>
            {search.trim() && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm text-muted-foreground mb-4"
              >
                Showing results for "<span className="font-medium text-foreground">{search}</span>"
                {` (${total} found)`}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {notices.map((n: any, i: number) => (
              <Fragment key={n._id}>
                <FadeIn delay={i * 0.04} direction="left">
                  <Link to={`/notices/${n._id}`}>
                    <div
                      className={`p-4 border rounded-xl bg-card hover:border-primary/30 transition-colors ${
                        n.priority === 'urgent' ? 'border-red-300 dark:border-red-800' : ''
                      } ${n.status === 'archived' ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {n.priority === 'urgent' ? <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                              : n.status === 'archived' ? <Archive className="h-4 w-4 text-amber-500 shrink-0" />
                              : <FileText className="h-4 w-4 text-primary shrink-0" />}
                            <h3 className="font-semibold truncate">{n.title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{stripHtml(n.content)}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="capitalize">{n.category}</span>
                            <span>{formatDate(n.publishedAt || n.createdAt)}</span>
                          </div>
                        </div>
                        {n.priority !== 'normal' && (
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            n.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {n.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </FadeIn>
                {(i + 1) % PROMO_EVERY === 0 && i < notices.length - 1 && (
                  <Promo kind="infeed" minHeight={160} />
                )}
              </Fragment>
            ))}
          </div>

          <InfiniteScrollSentinel
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            endLabel={notices.length > 0 ? `All ${total} notices loaded` : undefined}
          />
        </>
      )}
    </div>
  );
}
