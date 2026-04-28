import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import {
  Home, User, Bell, FileText, LogOut, Menu, X, Shield,
  MessageSquare, MessagesSquare, Settings, Briefcase, Megaphone, GraduationCap,
} from 'lucide-react';
import { Suspense, useState, useEffect } from 'react';
import { UserRole } from '@rdswa/shared';
import { hasMinRole, getPrimaryRoleLabel } from '@/lib/roles';
import { AnimatePresence, motion } from 'motion/react';
import { GradientText } from '@/components/reactbits';
import NotificationBell from '@/components/shared/NotificationBell';
import MessageBell from '@/components/shared/MessageBell';
import Spinner from '@/components/ui/Spinner';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useThemeStore } from '@/stores/themeStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useIsAndroidApp } from '@/hooks/usePlatform';
import BottomNav from '@/components/shared/BottomNav';

const sidebarLinks = [
  { label: 'Dashboard', href: '/dashboard', icon: Home },
  { label: 'Profile', href: '/dashboard/profile', icon: User },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { label: 'Forum', href: '/dashboard/forum', icon: MessageSquare },
  { label: 'Chat', href: '/dashboard/chat', icon: MessagesSquare },
  { label: 'Announcements', href: '/dashboard/announcements', icon: Megaphone },
  { label: 'My Forms', href: '/dashboard/forms', icon: FileText },
  { label: 'Mentorship', href: '/dashboard/mentorship', icon: GraduationCap },
  { label: 'Job Board', href: '/dashboard/jobs', icon: Briefcase },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    logout();
    navigate('/login');
  };
  const { settings: siteSettings } = useSiteSettings();
  const { theme } = useThemeStore();
  const fallbackLogo = theme === 'dark' ? '/icons/logo-dark.png' : '/icons/logo-light.png';
  const navLogo = (theme === 'dark' ? (siteSettings?.logoDark || siteSettings?.logo) : siteSettings?.logo) || fallbackLogo;
  const isAndroidApp = useIsAndroidApp();

  // Lock body scroll on mobile when sidebar is open
  useBodyScrollLock(sidebarOpen);

  // Close sidebar when route changes (mobile UX)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className={`${sidebarOpen ? 'fixed inset-x-0' : 'sticky'} top-0 z-50 h-16 border-b bg-background flex items-center justify-between px-3 sm:px-4 gap-2`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            className="lg:hidden tap-target flex items-center justify-center rounded-md hover:bg-accent shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex items-center text-lg sm:text-xl font-bold truncate min-w-0">
            {navLogo ? (
              <img
                src={navLogo}
                alt={siteSettings?.siteName || 'RDSWA'}
                className="h-9 object-contain"
              />
            ) : (
              <GradientText colors={['#5227FF', '#FF9FFC', '#B19EEF']} animationSpeed={6}>
                {siteSettings?.siteName || 'RDSWA'}
              </GradientText>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificationBell />
          <MessageBell />
          <span className="text-sm text-muted-foreground truncate max-w-[120px] sm:max-w-[160px]">{user?.nickName || user?.name}</span>
          <span className="hidden sm:inline-block text-[10px] sm:text-xs bg-primary/10 text-primary px-2 py-1 rounded-full whitespace-nowrap">
            {user?.role ? getPrimaryRoleLabel(user.role) : 'User'}
          </span>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-16 left-0 z-40 h-[calc(100dvh-4rem)] w-[80vw] max-w-[280px] lg:w-64 border-r bg-background overflow-y-auto scroll-smooth-touch
            transition-transform duration-200 ease-out lg:translate-x-0
            ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          `}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <nav className="p-3 sm:p-4 space-y-1">
            {sidebarLinks.map((link) => {
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

            {/* Admin panel link for moderator+ */}
            {user && hasMinRole(user.role, UserRole.MODERATOR) && (
              <div>
                <Link
                  to="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 lg:py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  Admin Panel
                </Link>
              </div>
            )}

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

        {/* Main content */}
        <main className={`flex-1 min-w-0 p-3 sm:p-4 lg:p-6 min-h-[calc(100dvh-4rem)] ${isAndroidApp ? 'pb-24' : ''}`}>
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
      {isAndroidApp && <BottomNav />}
    </div>
  );
}
