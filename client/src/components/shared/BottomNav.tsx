import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Home, FileText, Bus, Briefcase, LayoutDashboard, Droplets, LogIn, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional extra paths that should mark this item active (e.g. /events as child of /home). */
  matchPrefixes?: string[];
}

const authenticatedItems: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Notices', href: '/notices', icon: FileText, matchPrefixes: ['/notices'] },
  { label: 'Bus', href: '/bus-schedule', icon: Bus },
  { label: 'Jobs', href: '/dashboard/jobs', icon: Briefcase, matchPrefixes: ['/dashboard/jobs'] },
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, matchPrefixes: ['/dashboard'] },
];

const guestItems: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Notices', href: '/notices', icon: FileText, matchPrefixes: ['/notices'] },
  { label: 'Bus', href: '/bus-schedule', icon: Bus },
  { label: 'Donors', href: '/blood-donors', icon: Droplets },
  { label: 'Login', href: '/login', icon: LogIn },
];

/**
 * Native-style bottom navigation bar. Rendered only on Android app builds
 * (see `useIsAndroidApp`). Items switch between guest and authenticated
 * variants based on `authStore.isAuthenticated`.
 */
export default function BottomNav() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const items = isAuthenticated ? authenticatedItems : guestItems;

  // Pick exactly one active item. Score each candidate by the longest
  // prefix that matches the current path — this way a more specific item
  // (e.g. "Jobs" at /dashboard/jobs) wins over a generic one (Dashboard
  // at /dashboard) when both would match.
  const activeIndex = (() => {
    let winner = -1;
    let winnerScore = -1;
    items.forEach((item, i) => {
      const candidates = [item.href, ...(item.matchPrefixes || [])];
      for (const p of candidates) {
        const matches = location.pathname === p || (p !== '/' && location.pathname.startsWith(`${p}/`));
        if (matches && p.length > winnerScore) {
          winner = i;
          winnerScore = p.length;
        }
      }
    });
    return winner;
  })();

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item, i) => {
          const Icon = item.icon;
          const active = i === activeIndex;
          return (
            <li key={item.href} className="flex-1">
              <Link
                to={item.href}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-[11px] font-medium transition-colors"
              >
                {active && (
                  <motion.span
                    layoutId="bottom-nav-indicator"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="absolute top-0 inset-x-[20%] h-0.5 bg-primary rounded-full"
                  />
                )}
                <Icon
                  className={`h-5 w-5 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className={active ? 'text-primary' : 'text-muted-foreground'}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
