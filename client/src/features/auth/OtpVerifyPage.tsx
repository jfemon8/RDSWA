import { useState, useRef, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Loader2, CheckCircle, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, GradientText } from '@/components/reactbits';
import { useToast } from '@/components/ui/Toast';

export default function OtpVerifyPage() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'email' | 'otp' | 'success'>(emailParam ? 'otp' : 'email');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-send OTP if email provided via URL
  useEffect(() => {
    if (emailParam) {
      handleSendOtp(emailParam);
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendOtp = async (targetEmail?: string) => {
    const sendTo = targetEmail || email;
    if (!sendTo.trim()) {
      toast.error('Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/send-otp', { email: sendTo });
      toast.success('OTP sent to your email');
      setStep('otp');
      setResendCooldown(60);
      // Focus first OTP input after transition
      setTimeout(() => inputRefs.current[0]?.focus(), 300);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newOtp.every((d) => d !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || '';
    }
    setOtp(newOtp);
    if (pasted.length === 6) {
      handleVerify(pasted);
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  const handleVerify = async (otpCode: string) => {
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email, otp: otpCode });
      setStep('success');
      toast.success('Email verified successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid or expired OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto min-h-[80vh] flex items-center justify-center">
      <FadeIn direction="up" duration={0.5} blur>
        <div className="w-full max-w-md">
          <div className="bg-card border rounded-2xl p-8 shadow-lg">
            <AnimatePresence mode="wait">
              {/* Step 1: Enter email */}
              {step === 'email' && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-6">
                    <motion.div
                      className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                      <Mail className="h-7 w-7 text-primary" />
                    </motion.div>
                    <h1 className="text-2xl font-bold mb-1">
                      <GradientText colors={['#3b82f6', '#8b5cf6', '#3b82f6']} animationSpeed={5} className="text-2xl font-bold">
                        Verify Email
                      </GradientText>
                    </h1>
                    <p className="text-muted-foreground text-sm">Enter your email to receive a verification OTP</p>
                  </div>

                  <div className="space-y-4">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                      <label htmlFor="otp-email" className="block text-sm font-medium mb-1">Email</label>
                      <input
                        id="otp-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                        placeholder="you@example.com"
                        onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                      />
                    </motion.div>

                    <motion.button
                      onClick={() => handleSendOtp()}
                      disabled={loading}
                      className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Send OTP'}
                    </motion.button>
                  </div>

                  <p className="text-sm text-center text-muted-foreground mt-6">
                    Already verified?{' '}
                    <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
                  </p>
                </motion.div>
              )}

              {/* Step 2: Enter OTP */}
              {step === 'otp' && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-6">
                    <motion.div
                      className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                      <Mail className="h-7 w-7 text-primary" />
                    </motion.div>
                    <h1 className="text-2xl font-bold mb-1">Enter OTP</h1>
                    <p className="text-muted-foreground text-sm">
                      We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
                    </p>
                  </div>

                  {/* OTP Input Grid */}
                  <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
                    {otp.map((digit, i) => (
                      <motion.input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        className="w-12 h-14 text-center text-xl font-bold border-2 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      />
                    ))}
                  </div>

                  {loading && (
                    <div className="flex justify-center mb-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}

                  {/* Resend */}
                  <div className="text-center text-sm text-muted-foreground">
                    {resendCooldown > 0 ? (
                      <span>Resend OTP in {resendCooldown}s</span>
                    ) : (
                      <button
                        onClick={() => handleSendOtp()}
                        disabled={loading}
                        className="text-primary hover:underline font-medium disabled:opacity-50"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); }}
                    className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Change email
                  </button>
                </motion.div>
              )}

              {/* Step 3: Success */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  <motion.div
                    className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <CheckCircle className="h-7 w-7 text-green-600" />
                  </motion.div>
                  <motion.h1
                    className="text-2xl font-bold mb-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    Email Verified!
                  </motion.h1>
                  <motion.p
                    className="text-muted-foreground mb-6"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    Your email has been verified successfully. You can now sign in.
                  </motion.p>
                  <motion.button
                    onClick={() => navigate('/login', { state: { message: 'Email verified! Please sign in.' } })}
                    className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-semibold hover:bg-primary/90 shadow-md shadow-primary/20"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    Go to Login
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
