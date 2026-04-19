import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import {
  LayoutDashboard, Users, Building2, Calendar, FileText, Image, FolderOpen,
  Banknote, Vote, Bus, Bell, Settings, ScrollText, Shield, GraduationCap,
  LogOut, Menu, X, ChevronLeft, Crown, UserCog, UserCheck, BarChart3, KeyRound, CreditCard, Settings2,
  Briefcase, MessageSquare, Heart, Award, Star, Wallet, Database, Inbox,
} from 'lucide-react';
import { Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GradientText } from '@/components/reactbits';
import { UserRole, BACKUP_RESTRICTED_SUPER_ADMINS, SETTINGS_RESTRICTED_SUPER_ADMINS } from '@rdswa/shared';
import { hasMinRole, getPrimaryRoleLabel } from '@/lib/roles';
import type { LucideIcon } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import NotificationBell from '@/components/shared/NotificationBell';
import MessageBell from '@/components/shared/MessageBell';
import Spinner from '@/components/ui/Spinner';

interface AdminLink {
  label: string;
  href: string;
  icon: LucideIcon;
  minRole: UserRole;
}

const adminLinks: AdminLink[] = [
  // ── Overview ──
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, minRole: UserRole.MODERATOR },
  { label: 'Users', href: '/admin/users', icon: Users, minRole: UserRole.MODERATOR },
  { label: 'Members', href: '/admin/members', icon: UserCheck, minRole: UserRole.MODERATOR },

  // ── Content Management (Moderator+) ──
  { label: 'Notices', href: '/admin/notices', icon: FileText, minRole: UserRole.MODERATOR },
  { label: 'Events', href: '/admin/events', icon: Calendar, minRole: UserRole.MODERATOR },
  { label: 'Documents', href: '/admin/documents', icon: FolderOpen, minRole: UserRole.MODERATOR },
  { label: 'Gallery', href: '/admin/gallery', icon: Image, minRole: UserRole.MODERATOR },
  { label: 'Forum', href: '/admin/forum', icon: MessageSquare, minRole: UserRole.MODERATOR },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell, minRole: UserRole.MODERATOR },
  { label: 'Contact Messages', href: '/admin/contact-messages', icon: Inbox, minRole: UserRole.MODERATOR },

  // ── Operations (Moderator+) ──
  { label: 'Donations', href: '/admin/donations', icon: Heart, minRole: UserRole.MODERATOR },
  { label: 'Forms', href: '/admin/forms', icon: ScrollText, minRole: UserRole.MODERATOR },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3, minRole: UserRole.MODERATOR },
  { label: 'Payment Config', href: '/admin/payment', icon: CreditCard, minRole: UserRole.MODERATOR },

  // ── Organization (Admin+) ──
  { label: 'Committees', href: '/admin/committees', icon: Building2, minRole: UserRole.ADMIN },
  { label: 'Voting', href: '/admin/voting', icon: Vote, minRole: UserRole.ADMIN },
  { label: 'Finance', href: '/admin/finance', icon: Banknote, minRole: UserRole.ADMIN },
  { label: 'Budgets', href: '/admin/budgets', icon: Wallet, minRole: UserRole.ADMIN },
  { label: 'Bus Schedules', href: '/admin/bus', icon: Bus, minRole: UserRole.ADMIN },
  { label: 'Jobs', href: '/admin/jobs', icon: Briefcase, minRole: UserRole.ADMIN },
  { label: 'Mentorship', href: '/admin/mentorship', icon: Users, minRole: UserRole.ADMIN },

  // ── Role & User Management (Admin+) ──
  { label: 'Roles', href: '/admin/roles', icon: KeyRound, minRole: UserRole.ADMIN },
  { label: 'Moderators', href: '/admin/moderators', icon: UserCog, minRole: UserRole.ADMIN },
  { label: 'Alumni', href: '/admin/alumni-monitor', icon: GraduationCap, minRole: UserRole.ADMIN },
  { label: 'Advisors', href: '/admin/advisors', icon: Award, minRole: UserRole.ADMIN },
  { label: 'Senior Advisors', href: '/admin/senior-advisors', icon: Star, minRole: UserRole.ADMIN },
  { label: 'System Config', href: '/admin/system-config', icon: Settings2, minRole: UserRole.ADMIN },

  // ── SuperAdmin Only ──
  { label: 'Admins', href: '/admin/admins', icon: Crown, minRole: UserRole.SUPER_ADMIN },
  { label: 'Settings', href: '/admin/settings', icon: Settings, minRole: UserRole.SUPER_ADMIN },
  { label: 'Logs & Security', href: '/admin/logs', icon: Shield, minRole: UserRole.SUPER_ADMIN },
  { label: 'Backup & Restore', href: '/admin/backup', icon: Database, minRole: UserRole.SUPER_ADMIN },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  const { settings: siteSettings } = useSiteSettings();
  const email = user?.email;
  const deniedPaths: Record<string, string[]> = {
    '/admin/backup': BACKUP_RESTRICTED_SUPER_ADMINS,
    '/admin/settings': SETTINGS_RESTRICTED_SUPER_ADMINS,
  };
  const visibleLinks = adminLinks.filter((link) => {
    if (!user?.role || !hasMinRole(user.role, link.minRole)) return false;
    const denied = deniedPaths[link.href];
    if (denied && email && denied.includes(email)) return false;
    return true;
  });

  useBodyScrollLock(sidebarOpen);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 h-16 border-b bg-background flex items-center justify-between px-3 sm:px-4 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            className="lg:hidden tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/admin" className="text-base sm:text-xl font-bold truncate min-w-0">
            <GradientText colors={['#5227FF', '#FF9FFC', '#B19EEF']} animationSpeed={6}>
              {siteSettings?.siteName || 'RDSWA'}<span className="hidden min-[400px]:inline"> Admin</span>
            </GradientText>
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
          <Link to="/dashboard" className="sm:hidden tap-target flex items-center justify-center rounded-md hover:bg-accent" aria-label="Back to dashboard">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <NotificationBell />
          <MessageBell />
          <span className="text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-[160px]">{user?.nickName || user?.name}</span>
          <span className="hidden sm:inline-block text-[10px] sm:text-xs bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap">
            {user?.role ? getPrimaryRoleLabel(user.role) : 'User'}
          </span>
        </div>
      </header>

      <div className="flex">
        <aside
          className={`
            fixed lg:sticky top-16 left-0 z-40 h-[calc(100dvh-4rem)] w-[80vw] max-w-[280px] lg:w-64 border-r bg-background overflow-y-auto scroll-smooth-touch
            transition-transform duration-200 ease-out lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          `}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <nav className="p-3 sm:p-4 space-y-1">
            {visibleLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.href;
              return (
                <div key={link.href}>
                  <Link
                    to={link.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 lg:py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                </div>
              );
            })}
            <div className="pt-4 border-t mt-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 lg:py-2 rounded-md text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Logout
              </button>
            </div>
          </nav>
        </aside>

        {/* Overlay for mobile */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 top-16 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6 min-h-[calc(100dvh-4rem)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <Suspense fallback={<Spinner size="md" fullPage />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
