import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { disconnectSocket } from '@/hooks/useSocket';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn, GradientText } from '@/components/reactbits';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import SEO from '@/components/SEO';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REMEMBER_EMAIL_KEY = 'rdswa_remember_email';
const REMEMBER_PASSWORD_KEY = 'rdswa_remember_password';

/**
 * The password is Base64-encoded before being written to localStorage. This
 * is obfuscation, NOT encryption — anyone with access to localStorage can
 * decode it in one line. We accept this tradeoff because:
 *   1. The user explicitly opts in via the Remember Me checkbox.
 *   2. The main threat (plain text visible in DevTools inspection) is
 *      reduced, even if XSS can still defeat it.
 * If stronger protection is needed later, switch to the Credential Management
 * API (navigator.credentials) or fully migrate to browser-managed password
 * storage by removing this persistence entirely.
 */
const encodePassword = (p: string) => {
  try { return btoa(unescape(encodeURIComponent(p))); } catch { return ''; }
};
const decodePassword = (v: string) => {
  try { return decodeURIComponent(escape(atob(v))); } catch { return ''; }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Restore remembered credentials on first render so the form paints with
  // the values already filled. We encode the password to avoid it showing
  // up as plaintext in casual localStorage inspection (see note above).
  const remembered = (() => {
    try {
      return {
        email: localStorage.getItem(REMEMBER_EMAIL_KEY) || '',
        password: decodePassword(localStorage.getItem(REMEMBER_PASSWORD_KEY) || ''),
      };
    } catch {
      return { email: '', password: '' };
    }
  })();

  const [form, setForm] = useState({ email: remembered.email, password: remembered.password });
  const [rememberMe, setRememberMe] = useState(!!(remembered.email || remembered.password));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const message = location.state?.message;
    if (message) {
      toast.success(message);
      // Clear the state so it doesn't show again on re-render
      window.history.replaceState({}, document.title);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrors({});

    if (!form.email.trim()) {
      setErrors({ email: 'Email is required' });
      return;
    }
    if (!emailRegex.test(form.email.trim())) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }
    if (!form.password) {
      setErrors({ password: 'Password is required' });
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', form);
      localStorage.setItem('accessToken', data.data.accessToken);
      // Persist (or clear) remembered credentials for auto-fill next visit.
      // Manual logout does NOT clear these — that's intentional, so the user
      // can log back in quickly. To clear them, the user must uncheck
      // "Remember me" and log in once.
      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, form.email.trim());
          localStorage.setItem(REMEMBER_PASSWORD_KEY, encodePassword(form.password));
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
          localStorage.removeItem(REMEMBER_PASSWORD_KEY);
        }
      } catch { /* storage blocked — ignore */ }
      // Drop any pre-login (unauthenticated) socket so the next getSocket()
      // call opens a fresh, authenticated connection — otherwise presence
      // and real-time rooms stay unbound to this user.
      disconnectSocket();
      setUser(data.data.user);
      // Immediately fetch full profile to replace partial login data
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      navigate('/dashboard');
    } catch (err: any) {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
      } else {
        toast.error(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto min-h-[80vh] flex items-center justify-center py-8">
      <SEO
        title="Login"
        description="Sign in to RDSWA — Rangpur Divisional Student Welfare Association at the University of Barishal. Access events, notices, member directory, bus schedules, and more."
        noindex
      />
      <FadeIn direction="up" duration={0.5} blur>
        <div className="w-full max-w-md">
          <div
            className="bg-card border rounded-2xl p-5 sm:p-8 shadow-lg"
          >
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
              <div className="text-muted-foreground">
                Sign in to{' '}
                <GradientText
                  colors={['#3b82f6', '#8b5cf6', '#3b82f6']}
                  animationSpeed={5}
                  className="text-base"
                >
                  RDSWA
                </GradientText>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors(prev => ({ ...prev, email: '' })); }}
                  className={`w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="you@example.com"
                />
                <FieldError message={errors.email} />
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors(prev => ({ ...prev, password: '' })); }}
                    className={`w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10 transition-shadow ${errors.password ? 'border-red-500' : ''}`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FieldError message={errors.password} />
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/40 focus:ring-offset-0"
                  />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </motion.div>

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </motion.button>
            </form>

            <motion.p
              className="text-sm text-center text-muted-foreground mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:underline font-medium">Register</Link>
            </motion.p>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
