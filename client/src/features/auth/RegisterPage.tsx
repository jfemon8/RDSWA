import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn, GradientText } from '@/components/reactbits';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/register', form);
      navigate('/login', { state: { message: 'Registration successful! Please check your email to verify your account.' } });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { id: 'name', label: 'Full Name', type: 'text', placeholder: 'Enter your full name', required: true },
    { id: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', required: true },
    { id: 'phone', label: 'Phone (optional)', type: 'tel', placeholder: '01XXXXXXXXX', required: false },
  ];

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <FadeIn direction="up" duration={0.5} blur>
        <div className="w-full max-w-md">
          <motion.div
            className="bg-card border rounded-2xl p-8 shadow-lg"
            whileHover={{ boxShadow: '0 20px 60px -15px rgba(0,0,0,0.1)' }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-2">Create account</h1>
              <p className="text-muted-foreground">
                Join the{' '}
                <GradientText
                  colors={['#3b82f6', '#8b5cf6', '#3b82f6']}
                  animationSpeed={5}
                  className="text-base"
                >
                  RDSWA
                </GradientText>
                {' '}community
              </p>
            </div>

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
              {fields.map((field, i) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                >
                  <label htmlFor={field.id} className="block text-sm font-medium mb-1">{field.label}</label>
                  <input
                    id={field.id}
                    type={field.type}
                    required={field.required}
                    value={form[field.id as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [field.id]: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                    placeholder={field.placeholder}
                  />
                </motion.div>
              ))}

              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10 transition-shadow"
                    placeholder="Min 8 chars, 1 upper, 1 lower, 1 number"
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

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {loading ? 'Creating account...' : 'Create account'}
              </motion.button>
            </form>

            <motion.p
              className="text-sm text-center text-muted-foreground mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
            </motion.p>
          </motion.div>
        </div>
      </FadeIn>
    </div>
  );
}
