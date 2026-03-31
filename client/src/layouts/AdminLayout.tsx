import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import {
  LayoutDashboard, Users, Building2, Calendar, FileText, Image, FolderOpen,
  DollarSign, Vote, Bus, Bell, Settings, ScrollText, Shield, GraduationCap,
  LogOut, Menu, X, ChevronLeft, Crown, UserCog, BarChart3, KeyRound, CreditCard,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GradientText } from '@/components/reactbits';
import { UserRole } from '@rdswa/shared';
import { hasMinRole, getPrimaryRoleLabel } from '@/lib/roles';
import type { LucideIcon } from 'lucide-react';

interface AdminLink {
  label: string;
  href: string;
  icon: LucideIcon;
  minRole: UserRole;
}

const adminLinks: AdminLink[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, minRole: UserRole.MODERATOR },
  { label: 'Users', href: '/admin/users', icon: Users, minRole: UserRole.MODERATOR },
  { label: 'Roles', href: '/admin/roles', icon: KeyRound, minRole: UserRole.ADMIN },
  { label: 'Moderators', href: '/admin/moderators', icon: UserCog, minRole: UserRole.ADMIN },
  { label: 'Admins', href: '/admin/admins', icon: Crown, minRole: UserRole.SUPER_ADMIN },
  { label: 'Committees', href: '/admin/committees', icon: Building2, minRole: UserRole.MODERATOR },
  { label: 'Events', href: '/admin/events', icon: Calendar, minRole: UserRole.MODERATOR },
  { label: 'Notices', href: '/admin/notices', icon: FileText, minRole: UserRole.MODERATOR },
  { label: 'Documents', href: '/admin/documents', icon: FolderOpen, minRole: UserRole.MODERATOR },
  { label: 'Gallery', href: '/admin/gallery', icon: Image, minRole: UserRole.MODERATOR },
  { label: 'Finance', href: '/admin/finance', icon: DollarSign, minRole: UserRole.ADMIN },
  { label: 'Voting', href: '/admin/voting', icon: Vote, minRole: UserRole.MODERATOR },
  { label: 'Forms', href: '/admin/forms', icon: ScrollText, minRole: UserRole.MODERATOR },
  { label: 'Alumni Monitor', href: '/admin/alumni-monitor', icon: GraduationCap, minRole: UserRole.MODERATOR },
  { label: 'Bus Schedules', href: '/admin/bus', icon: Bus, minRole: UserRole.ADMIN },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3, minRole: UserRole.MODERATOR },
  { label: 'Payment Config', href: '/admin/payment', icon: CreditCard, minRole: UserRole.MODERATOR },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell, minRole: UserRole.MODERATOR },
  { label: 'Settings', href: '/admin/settings', icon: Settings, minRole: UserRole.SUPER_ADMIN },
  { label: 'Logs & Security', href: '/admin/logs', icon: Shield, minRole: UserRole.ADMIN },
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

  const visibleLinks = adminLinks.filter((link) =>
    user?.role ? hasMinRole(user.role, link.minRole) : false
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 h-16 border-b bg-background flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/admin" className="text-xl font-bold">
            <GradientText colors={['#5227FF', '#FF9FFC', '#B19EEF']} animationSpeed={6}>
              RDSWA Admin
            </GradientText>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
            {user?.role ? getPrimaryRoleLabel(user.role) : 'User'}
          </span>
        </div>
      </header>

      <div className="flex">
        <aside className={`
          fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-background overflow-y-auto
          transition-transform lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <nav className="p-4 space-y-1">
            {visibleLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.href;
              return (
                <div key={link.href}>
                  <Link
                    to={link.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                </div>
              );
            })}
            <div className="pt-4 border-t mt-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors"
              >
                <LogOut className="h-4 w-4" />
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
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <main className="flex-1 p-4 lg:p-6 min-h-[calc(100vh-4rem)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              }>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
