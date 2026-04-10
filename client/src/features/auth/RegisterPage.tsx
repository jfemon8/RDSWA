import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn, GradientText } from '@/components/reactbits';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrors({});

    if (!form.name.trim()) {
      setErrors({ name: 'Full name is required' });
      return;
    }
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
    if (form.password.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters' });
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/register', form);
      navigate('/login', { state: { message: 'Registration successful! Please check your email to verify your account, or verify later from your profile.' } });
    } catch (err: any) {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
      } else {
        toast.error(err.response?.data?.message || 'Registration failed');
      }
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
    <div className="container mx-auto min-h-[80vh] flex items-center justify-center py-8">
      <FadeIn direction="up" duration={0.5} blur>
        <div className="w-full max-w-md">
          <div className="bg-card border rounded-2xl p-5 sm:p-8 shadow-lg">
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Create account</h1>
              <div className="text-muted-foreground">
                Join the{' '}
                <GradientText
                  colors={['#3b82f6', '#8b5cf6', '#3b82f6']}
                  animationSpeed={5}
                  className="text-base"
                >
                  RDSWA
                </GradientText>
                {' '}community
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                    value={form[field.id as keyof typeof form]}
                    onChange={(e) => { setForm({ ...form, [field.id]: e.target.value }); setErrors(prev => ({ ...prev, [field.id]: '' })); }}
                    className={`w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors[field.id] ? 'border-red-500' : ''}`}
                    placeholder={field.placeholder}
                  />
                  <FieldError message={errors[field.id]} />
                </motion.div>
              ))}

              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors(prev => ({ ...prev, password: '' })); }}
                    className={`w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary pr-10 transition-shadow ${errors.password ? 'border-red-500' : ''}`}
                    placeholder="Minimum 6 characters"
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

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
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
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
