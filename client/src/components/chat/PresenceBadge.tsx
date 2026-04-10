interface Props {
  online: boolean;
  /** Size in pixels; default 10 */
  size?: number;
  /** Show a subtle ring for legibility on avatars */
  withRing?: boolean;
}

/** Small green/grey dot for presence. Designed to overlay on an avatar corner. */
export default function PresenceBadge({ online, size = 10, withRing = true }: Props) {
  return (
    <span
      className={`block rounded-full ${online ? 'bg-green-500' : 'bg-muted-foreground/40'} ${withRing ? 'ring-2 ring-card' : ''}`}
      style={{ width: size, height: size }}
      aria-label={online ? 'Online' : 'Offline'}
    />
  );
}

/** Human-readable last-seen label. */
export function formatLastSeen(iso?: string | null): string {
  if (!iso) return 'Offline';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60 * 1000) return 'Last seen just now';
  if (diff < 60 * 60 * 1000) return `Last seen ${Math.floor(diff / 60000)} min ago`;
  if (diff < 24 * 60 * 60 * 1000) return `Last seen ${Math.floor(diff / 3_600_000)} h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `Last seen ${days} d ago`;
  return `Last seen ${new Date(iso).toLocaleDateString()}`;
}
