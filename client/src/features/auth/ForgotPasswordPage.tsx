import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn, GradientText } from '@/components/reactbits';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrors({});

    if (!email.trim()) {
      setErrors({ email: 'Email is required' });
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
      toast.success('Reset link sent', 'Please check your email inbox');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto min-h-[60vh] flex items-center justify-center">
        <FadeIn direction="up" duration={0.5} blur>
          <div className="w-full max-w-md text-center">
            <motion.div
              className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            >
              <CheckCircle className="h-6 w-6 text-green-600" />
            </motion.div>
            <motion.h1
              className="text-2xl sm:text-3xl font-bold mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Check your email
            </motion.h1>
            <motion.p
              className="text-muted-foreground mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              We've sent a password reset link to <strong>{email}</strong>. Please check your inbox.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Link to="/login" className="text-primary hover:underline text-sm">
                Back to Login
              </Link>
            </motion.div>
          </div>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-[60vh] flex items-center justify-center">
      <FadeIn direction="up" duration={0.5} blur>
        <div className="w-full max-w-md">
          <div className="bg-card border rounded-2xl p-8 shadow-lg">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Link to="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </Link>
            </motion.div>

            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                <GradientText
                  colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
                  animationSpeed={3}
                  className="text-2xl sm:text-3xl font-bold"
                >
                  Forgot Password
                </GradientText>
              </h1>
              <motion.p
                className="text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                Enter your email and we'll send you a reset link.
              </motion.p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: '' })); }}
                  className={`w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.email ? 'border-red-500' : ''}`}
                  placeholder="your@email.com"
                />
                <FieldError message={errors.email} />
              </motion.div>

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send Reset Link
              </motion.button>
            </form>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
