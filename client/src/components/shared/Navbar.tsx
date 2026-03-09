import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Menu, X, Sun, Moon, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-primary">RDSWA</span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center space-x-6">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              More <ChevronDown className={`h-3.5 w-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-background border rounded-lg shadow-lg py-1 z-50">
                {moreLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="block px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setMoreOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center space-x-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              {user?.name || 'Dashboard'}
            </Link>
          ) : (
            <div className="hidden md:flex items-center space-x-2">
              <Link
                to="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Register
              </Link>
            </div>
          )}

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <div className="lg:hidden border-t bg-background">
          <nav className="container mx-auto px-4 py-4 space-y-3">
            {[...publicLinks, ...moreLinks].map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="block text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {!isAuthenticated && (
              <div className="flex space-x-2 pt-3 border-t">
                <Link
                  to="/login"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-md"
                  onClick={() => setMobileOpen(false)}
                >
                  Register
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
