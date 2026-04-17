import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Menu, X, Sun, Moon, ChevronDown, LogOut } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@/stores/themeStore';
import { motion, AnimatePresence } from 'motion/react';
import { GradientText } from '@/components/reactbits';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import api from '@/lib/api';

const publicLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'University', href: '/university' },
  { label: 'Bus Schedule', href: '/bus-schedule' },
  { label: 'Job Board', href: '/dashboard/jobs' },
  { label: 'Notices', href: '/notices' },
];

const moreLinks = [
  { label: 'Committee', href: '/committee' },
  { label: 'Members', href: '/members' },
  { label: 'Alumni', href: '/alumni' },
  { label: 'Advisors', href: '/advisors' },
  { label: 'Senior Advisors', href: '/senior-advisors' },
  { label: 'Events', href: '/events' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Documents', href: '/documents' },
  { label: 'Donations', href: '/donations' },
  { label: 'Voting', href: '/voting' },
  { label: 'Blood Donors', href: '/blood-donors' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { settings } = useSiteSettings();
  const navLogo = theme === 'dark' ? (settings?.logoDark || settings?.logo) : settings?.logo;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useBodyScrollLock(mobileOpen);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const isActive = (href: string) => location.pathname === href;

  // Unread badges for the profile dropdown — only fetched when authenticated.
  const { data: notifCountData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      return data.data as { count: number };
    },
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });
  const { data: msgCountData } = useQuery({
    queryKey: ['message-unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/communication/messages/unread-count');
      return data.data as { count: number };
    },
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });
  const notifUnread = notifCountData?.count || 0;
  const msgUnread = msgCountData?.count || 0;

  return (
    <>
    <header
      role="banner"
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto px-4 flex h-16 items-center justify-between gap-2">
        <Link to="/" className="flex items-center space-x-2">
          {navLogo ? (
            <img src={navLogo} alt={settings?.siteName || 'RDSWA'} className="h-9 object-contain" />
          ) : (
            <GradientText
              colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
              animationSpeed={6}
              className="text-xl font-bold"
            >
              {settings?.siteName || 'RDSWA'}
            </GradientText>
          )}
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Main navigation" className="hidden lg:flex items-center space-x-1">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={`relative text-sm font-medium px-3 py-2 rounded-lg transition-colors ${
                isActive(link.href) ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {link.label}
              {isActive(link.href) && (
                <motion.div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full"
                  layoutId="navbar-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          ))}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="flex items-center gap-1 text-sm font-medium px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              More
              <motion.div animate={{ rotate: moreOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="h-3.5 w-3.5" />
              </motion.div>
            </button>
            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-48 bg-background border rounded-xl shadow-xl py-1 z-50"
                >
                  {moreLinks.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link
                        to={link.href}
                        aria-current={isActive(link.href) ? 'page' : undefined}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          isActive(link.href) ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                        onClick={() => setMoreOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleTheme}
            className="tap-target flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </motion.div>
            </AnimatePresence>
          </button>

          {isAuthenticated ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover border-2 border-primary/30" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
              </button>
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1rem)] bg-background border rounded-xl shadow-xl py-1 z-50"
                  >
                    <div className="px-4 py-3 border-b">
                      <p className="text-sm font-medium text-foreground truncate">{user?.nickName || user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-3 sm:py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/dashboard/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-3 sm:py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      Profile
                    </Link>
                    <Link
                      to="/dashboard/notifications"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center justify-between gap-2 px-4 py-3 sm:py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <span>Notifications</span>
                      {notifUnread > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                          className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5"
                        >
                          {notifUnread > 99 ? '99+' : notifUnread}
                        </motion.span>
                      )}
                    </Link>
                    <Link
                      to="/dashboard/chat"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center justify-between gap-2 px-4 py-3 sm:py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <span>Messages</span>
                      {msgUnread > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                          className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5"
                        >
                          {msgUnread > 99 ? '99+' : msgUnread}
                        </motion.span>
                      )}
                    </Link>
                    <button
                      onClick={async () => {
                        setUserMenuOpen(false);
                        try { await api.post('/auth/logout'); } catch {}
                        logout();
                        navigate('/');
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 sm:py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="hidden md:flex items-center space-x-2">
              <Link
                to="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-accent transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                Register
              </Link>
            </div>
          )}

          <button
            className="lg:hidden tap-target flex items-center justify-center rounded-lg hover:bg-accent"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mobileOpen ? 'close' : 'open'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </motion.div>
            </AnimatePresence>
          </button>
        </div>
      </div>
    </header>

    {/* Mobile navigation — rendered OUTSIDE <header> so it is not constrained
        by any parent transform/containing-block and fills the viewport */}
    <AnimatePresence>
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="lg:hidden fixed inset-x-0 top-16 bottom-0 border-t bg-background overflow-y-auto z-[45]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <nav aria-label="Mobile navigation" className="container mx-auto px-4 py-4 space-y-1">
            {[...publicLinks, ...moreLinks].map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={link.href}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  className={`flex items-center text-base font-medium py-3 px-3 rounded-lg transition-colors ${
                    isActive(link.href) ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
            {!isAuthenticated && (
              <motion.div
                className="grid grid-cols-2 gap-2 pt-4 border-t mt-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Link to="/login" className="flex items-center justify-center text-base font-medium border rounded-lg py-3 text-foreground hover:bg-accent transition-colors">
                  Login
                </Link>
                <Link to="/register" className="flex items-center justify-center text-base font-medium bg-primary text-primary-foreground rounded-lg py-3 hover:bg-primary/90 transition-colors">
                  Register
                </Link>
              </motion.div>
            )}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
