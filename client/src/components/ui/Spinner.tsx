import { motion } from 'motion/react';

export interface SpinnerProps {
  /** Visual size of the spinner — maps to preset diameters */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label shown below the spinner */
  label?: string;
  /** When true, fills its parent with min-h-[50vh] for full-page centering. When false, just renders inline-centered with sensible padding. */
  fullPage?: boolean;
  /** Extra classes on the outer wrapper */
  className?: string;
}

const SIZE_MAP = {
  sm: { outer: 'h-8 w-8', dot: 'h-1.5 w-1.5', gap: 'gap-2', text: 'text-xs' },
  md: { outer: 'h-14 w-14', dot: 'h-2.5 w-2.5', gap: 'gap-3', text: 'text-sm' },
  lg: { outer: 'h-20 w-20', dot: 'h-3.5 w-3.5', gap: 'gap-4', text: 'text-base' },
} as const;

/**
 * Attractive branded loading spinner — two counter-rotating gradient rings,
 * a pulsing center dot, and an optional animated label. Centers itself both
 * vertically and horizontally inside its container.
 */
export default function Spinner({ size = 'md', label, fullPage = false, className = '' }: SpinnerProps) {
  const s = SIZE_MAP[size];
  return (
    <div
      className={`flex flex-col items-center justify-center ${s.gap} ${fullPage ? 'min-h-[50vh] w-full' : 'py-12 w-full'} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
    >
      <div className={`relative ${s.outer}`}>
        {/* Outer ring — clockwise, primary gradient */}
        <motion.div
          className={`absolute inset-0 rounded-full border-[3px] border-transparent`}
          style={{
            borderTopColor: 'hsl(var(--primary))',
            borderRightColor: 'hsl(var(--primary) / 0.4)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
        {/* Inner ring — counter-clockwise, muted accent */}
        <motion.div
          className="absolute inset-1.5 rounded-full border-[2px] border-transparent"
          style={{
            borderBottomColor: 'hsl(var(--primary) / 0.6)',
            borderLeftColor: 'hsl(var(--primary) / 0.25)',
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />
        {/* Pulsing center dot */}
        <motion.div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ${s.dot}`}
          animate={{ scale: [1, 1.5, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Soft outer glow */}
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
      </div>
      {label && (
        <motion.p
          className={`${s.text} text-muted-foreground font-medium`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}
