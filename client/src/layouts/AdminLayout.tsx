import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import {
  LayoutDashboard, Users, Building2, Calendar, FileText, Image,
  DollarSign, Vote, Bus, Bell, Settings, ScrollText, Shield,
  LogOut, Menu, X, ChevronLeft,
} from 'lucide-react';
import { useState } from 'react';

const adminLinks = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Committees', href: '/admin/committees', icon: Building2 },
  { label: 'Events', href: '/admin/events', icon: Calendar },
  { label: 'Notices', href: '/admin/notices', icon: FileText },
  { label: 'Gallery', href: '/admin/gallery', icon: Image },
  { label: 'Finance', href: '/admin/finance', icon: DollarSign },
  { label: 'Voting', href: '/admin/voting', icon: Vote },
  { label: 'Forms', href: '/admin/forms', icon: ScrollText },
  { label: 'Bus Schedules', href: '/admin/bus', icon: Bus },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
  { label: 'Audit Logs', href: '/admin/logs', icon: Shield },
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
          <Link to="/admin" className="text-xl font-bold text-primary">RDSWA Admin</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Dashboard
          </Link>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full capitalize">
            {user?.role?.replace('_', ' ')}
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
            {adminLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
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

        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <main className="flex-1 p-4 lg:p-6 min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
