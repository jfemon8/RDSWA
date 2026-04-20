import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Sparkles, type LucideIcon } from 'lucide-react';
import { FadeIn } from '@/components/reactbits';

interface Action {
  label: string;
  icon?: LucideIcon;
  /** Internal route (react-router Link). */
  to?: string;
  /** External URL or anchor (regular <a>). */
  href?: string;
  /** Click handler (renders a <button>). */
  onClick?: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional secondary hint shown beneath the CTAs. */
  hint?: string;
  primary?: Action;
  secondary?: Action;
  /** Suppress the outer FadeIn wrapper when the parent already animates in. */
  noWrapper?: boolean;
  className?: string;
}

/**
 * Consistent illustrated empty state used across the app when no data is available.
 * Animated pulsing rings, a sparkle accent, heading, description and up to two actions.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  hint,
  primary,
  secondary,
  noWrapper,
  className = '',
}: EmptyStateProps) {
  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden border rounded-2xl bg-gradient-to-br from-primary/5 via-card to-card px-6 py-10 sm:py-14 text-center ${className}`}
    >
      <div className="relative inline-flex items-center justify-center mb-5">
        <motion.span
          className="absolute inline-flex h-28 w-28 rounded-full bg-primary/10"
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="absolute inline-flex h-20 w-20 rounded-full bg-primary/15"
          animate={{ scale: [1, 1.2, 1], opacity: [0.7, 0.3, 0.7] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        />
        <motion.div
          className="relative h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"
          animate={{ rotate: [0, -6, 6, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
        >
          <Icon className="h-8 w-8" />
          <motion.span
            className="absolute -top-1 -right-1 text-yellow-500"
            animate={{ scale: [0.8, 1.1, 0.8], rotate: [0, 15, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="h-4 w-4" />
          </motion.span>
        </motion.div>
      </div>

      <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-6">
        {description}
      </p>

      {(primary || secondary) && (
        <div className="flex flex-wrap justify-center gap-2">
          {primary && <ActionButton action={primary} variant="primary" />}
          {secondary && <ActionButton action={secondary} variant="secondary" />}
        </div>
      )}

      {hint && (
        <p className="text-xs text-muted-foreground/70 mt-6 max-w-sm mx-auto">{hint}</p>
      )}
    </motion.div>
  );

  if (noWrapper) return content;
  return <FadeIn direction="up" delay={0.1}>{content}</FadeIn>;
}

function ActionButton({ action, variant }: { action: Action; variant: 'primary' | 'secondary' }) {
  const Icon = action.icon;
  const classes =
    variant === 'primary'
      ? 'inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium shadow-sm hover:bg-primary/90'
      : 'inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground';

  const inner = (
    <>
      {Icon && <Icon className="h-4 w-4" />}
      {action.label}
    </>
  );

  const wrapper = (child: React.ReactNode) => (
    <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="inline-block">
      {child}
    </motion.div>
  );

  if (action.to) return wrapper(<Link to={action.to} className={classes}>{inner}</Link>);
  if (action.href) return wrapper(<a href={action.href} className={classes}>{inner}</a>);
  if (action.onClick) return wrapper(<button type="button" onClick={action.onClick} className={classes}>{inner}</button>);
  return wrapper(<span className={classes}>{inner}</span>);
}
