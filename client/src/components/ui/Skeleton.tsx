interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="border rounded-xl p-5 bg-card space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function ImageCardSkeleton() {
  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <Skeleton className="w-full h-40" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="p-4 border rounded-xl bg-card flex items-start gap-3">
      <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="border-b bg-muted/50 p-3">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b last:border-0 p-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Stacked card placeholders for the common "list of cards" loading state. */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 bg-card space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}

/** Table rows on desktop and stacked cards below lg, matching the responsive admin lists. */
export function RecordsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      <div className="hidden lg:block">
        <TableSkeleton rows={rows} />
      </div>
      <div className="lg:hidden">
        <CardListSkeleton count={rows} />
      </div>
    </>
  );
}

/** Compact avatar-and-text rows for dropdown panels, side lists and narrow columns. */
export function InlineListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Alternating bubble placeholders for a conversation that is still loading. */
export function ChatSkeleton({ count = 6 }: { count?: number }) {
  const widths = ['w-2/5', 'w-3/5', 'w-1/3', 'w-1/2', 'w-2/3', 'w-1/4'];
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
          <Skeleton className={`h-12 rounded-2xl ${widths[i % widths.length]}`} />
        </div>
      ))}
    </div>
  );
}

/** Stat tiles above a chart, matching the dashboard and report layouts. */
export function StatsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="border rounded-xl p-4 bg-card space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/** Whole-screen placeholder for route-level, guard-level and Suspense waits. */
export function PageSkeleton() {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-80" />
      <CardListSkeleton />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
