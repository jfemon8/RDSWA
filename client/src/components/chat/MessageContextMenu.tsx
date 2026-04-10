import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

export interface ContextMenuAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  /** Render in red for destructive actions */
  destructive?: boolean;
  /** Hide the item (cleaner than filtering in the parent) */
  hidden?: boolean;
}

interface Props {
  anchor: { x: number; y: number };
  actions: ContextMenuAction[];
  onClose: () => void;
}

/**
 * Floating context menu positioned at a page coordinate.
 * Auto-clamps to the viewport so it never clips off-screen.
 */
export default function MessageContextMenu({ anchor, actions, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Clamp position so the menu fits in viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = anchor;
    if (x + rect.width > vw - 8) x = vw - rect.width - 8;
    if (y + rect.height > vh - 8) y = vh - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [anchor]);

  const visible = actions.filter((a) => !a.hidden);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      style={{ position: 'fixed', left: anchor.x, top: anchor.y, zIndex: 70 }}
      className="min-w-[180px] bg-card border rounded-xl shadow-xl py-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {visible.map((action, i) => (
        <button
          key={i}
          type="button"
          onClick={() => { action.onClick(); onClose(); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
            action.destructive ? 'text-red-600 dark:text-red-400' : 'text-foreground'
          }`}
        >
          <action.icon className="h-4 w-4 shrink-0" />
          <span>{action.label}</span>
        </button>
      ))}
    </motion.div>
  );
}
