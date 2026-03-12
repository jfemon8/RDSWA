import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn, GradientText } from '@/components/reactbits';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage] = useState(location.state?.message || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', form);
      localStorage.setItem('accessToken', data.data.accessToken);
      setUser(data.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <FadeIn direction="up" duration={0.5} blur>
        <div className="w-full max-w-md">
          <motion.div
            className="bg-card border rounded-2xl p-8 shadow-lg"
            whileHover={{ boxShadow: '0 20px 60px -15px rgba(0,0,0,0.1)' }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
              <p className="text-muted-foreground">
                Sign in to{' '}
                <GradientText
                  colors={['#3b82f6', '#8b5cf6', '#3b82f6']}
                  animationSpeed={5}
                  className="text-base"
                >
                  RDSWA
                </GradientText>
              </p>
            </div>

            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/10 text-green-600 dark:text-green-400 text-sm p-3 rounded-lg mb-4"
              >
                {successMessage}
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-4"
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                  placeholder="you@example.com"
                />
              </motion.div>

              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10 transition-shadow"
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
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-between">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </motion.div>

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
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
          </motion.div>
        </div>
      </FadeIn>
    </div>
  );
}
