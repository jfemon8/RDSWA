import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Menu, X, Sun, Moon, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { motion, AnimatePresence } from 'motion/react';
import { GradientText } from '@/components/reactbits';

const publicLinks = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Committee', href: '/committee' },
  { label: 'Members', href: '/members' },
  { label: 'Events', href: '/events' },
  { label: 'Notices', href: '/notices' },
];

const moreLinks = [
  { label: 'University', href: '/university' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Documents', href: '/documents' },
  { label: 'Donations', href: '/donations' },
  { label: 'Voting', href: '/voting' },
  { label: 'Blood Donors', href: '/blood-donors' },
  { label: 'Bus Schedule', href: '/bus-schedule' },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const location = useLocation();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const isActive = (href: string) => location.pathname === href;

  return (
    <motion.header
      className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center space-x-2">
          <GradientText
            colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
            animationSpeed={6}
            className="text-xl font-bold"
          >
            RDSWA
          </GradientText>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center space-x-1">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
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
                  className="absolute right-0 top-full mt-1 w-48 bg-background border rounded-xl shadow-xl py-1 z-50 overflow-hidden"
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
          <motion.button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label="Toggle theme"
            whileTap={{ scale: 0.9, rotate: 180 }}
            transition={{ duration: 0.3 }}
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
          </motion.button>

          {isAuthenticated ? (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                to="/dashboard"
                className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
              >
                {user?.name || 'Dashboard'}
              </Link>
            </motion.div>
          ) : (
            <div className="hidden md:flex items-center space-x-2">
              <Link
                to="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg hover:bg-accent transition-colors"
              >
                Login
              </Link>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  to="/register"
                  className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Register
                </Link>
              </motion.div>
            </div>
          )}

          <motion.button
            className="lg:hidden p-2 rounded-lg hover:bg-accent"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            whileTap={{ scale: 0.9 }}
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
          </motion.button>
        </div>
      </div>

      {/* Mobile navigation */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t bg-background overflow-hidden"
          >
            <nav className="container mx-auto px-4 py-4 space-y-1">
              {[...publicLinks, ...moreLinks].map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    to={link.href}
                    className={`block text-sm font-medium py-2 px-3 rounded-lg transition-colors ${
                      isActive(link.href) ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              {!isAuthenticated && (
                <motion.div
                  className="flex space-x-2 pt-3 border-t mt-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2">
                    Login
                  </Link>
                  <Link to="/register" className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg">
                    Register
                  </Link>
                </motion.div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
