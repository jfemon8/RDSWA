import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** Shown once everything is loaded, or nothing when the list is short enough not to need saying. */
  endLabel?: string;
  className?: string;
}

/** Watches the end of a list and pulls the next page in as it comes into view. */
export default function InfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  endLabel,
  className = '',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !hasNextPage) return;

    // The margin starts the fetch before the sentinel is on screen, so scrolling rarely stalls.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '300px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={ref} className={`flex justify-center py-4 ${className}`}>
      {isFetchingNextPage ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : hasNextPage ? (
        <button
          type="button"
          onClick={fetchNextPage}
          className="px-4 py-1.5 border rounded-lg text-sm text-muted-foreground hover:bg-accent"
        >
          Load more
        </button>
      ) : endLabel ? (
        <span className="text-xs text-muted-foreground">{endLabel}</span>
      ) : null}
    </div>
  );
}
