import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Mail, Phone, MapPin, Send, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { FadeIn, BlurText, GradientText, SpotlightCard } from '@/components/reactbits';
import SEO from '@/components/SEO';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const { data } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });
  const settings = data?.data;

  const sendMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post('/settings/contact', payload),
    onSuccess: (res: any) => {
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
      toast.success(res.data?.message || 'Message sent');
    },
    onError: (err: any) => {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
      } else {
        toast.error(err.response?.data?.message || 'Failed to send message. Please try again.');
      }
    },
  });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim() || form.name.trim().length < 2) next.name = 'Please enter your name';
    if (!form.email.trim()) next.email = 'Email is required';
    else if (!emailRegex.test(form.email.trim())) next.email = 'Please enter a valid email';
    if (!form.subject.trim() || form.subject.trim().length < 5) next.subject = 'Subject must be at least 5 characters';
    if (!form.message.trim() || form.message.trim().length < 10) next.message = 'Message must be at least 10 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    sendMutation.mutate(form);
  };

  const details = [
    settings?.contactEmail && {
      icon: Mail,
      label: 'Email',
      value: settings.contactEmail,
      href: `mailto:${settings.contactEmail}`,
      color: 'rgba(59, 130, 246, 0.15)',
    },
    settings?.contactPhone && {
      icon: Phone,
      label: 'Phone',
      value: settings.contactPhone,
      href: `tel:${settings.contactPhone}`,
      color: 'rgba(139, 92, 246, 0.15)',
    },
    settings?.address && {
      icon: MapPin,
      label: 'Address',
      value: settings.address,
      color: 'rgba(236, 72, 153, 0.15)',
    },
  ].filter(Boolean) as Array<{ icon: typeof Mail; label: string; value: string; href?: string; color: string }>;

  const setField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="container mx-auto py-6 md:py-12">
      <SEO
        title="Contact Us"
        description="Get in touch with the Rangpur Divisional Student Welfare Association at University of Barishal."
      />

      <BlurText
        text="Contact Us"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />
      <FadeIn delay={0.1}>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Have a question, suggestion, or need help? Send us a message and we'll get back to you soon.
        </p>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8">
        <div className="lg:col-span-3">
          <FadeIn direction="up" delay={0.15} blur>
            <div className="bg-card border rounded-2xl p-5 sm:p-8 shadow-lg">
              <h2 className="text-xl font-semibold mb-1">
                <GradientText
                  colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
                  animationSpeed={3}
                  className="text-xl font-semibold"
                >
                  Send us a message
                </GradientText>
              </h2>
              <p className="text-sm text-muted-foreground mb-6">We'll reply to the email you provide.</p>

              <AnimatePresence mode="wait">
                {sent ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center text-center py-8"
                  >
                    <motion.div
                      className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                      <CheckCircle className="h-7 w-7 text-green-600" />
                    </motion.div>
                    <h3 className="text-lg font-semibold mb-1">Message sent</h3>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                      Thank you for reaching out. Our team will review your message and respond by email.
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSent(false)}
                      className="text-sm text-primary hover:underline"
                    >
                      Send another message
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    noValidate
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                        <label className="block text-sm font-medium mb-1">Your name</label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={setField('name')}
                          className={`w-full px-3 py-2.5 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.name ? 'border-red-500' : ''}`}
                          placeholder="Jane Doe"
                          autoComplete="name"
                        />
                        <FieldError message={errors.name} />
                      </motion.div>
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={setField('email')}
                          className={`w-full px-3 py-2.5 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.email ? 'border-red-500' : ''}`}
                          placeholder="you@example.com"
                          autoComplete="email"
                        />
                        <FieldError message={errors.email} />
                      </motion.div>
                    </div>

                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                      <label className="block text-sm font-medium mb-1">Subject</label>
                      <input
                        type="text"
                        value={form.subject}
                        onChange={setField('subject')}
                        className={`w-full px-3 py-2.5 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.subject ? 'border-red-500' : ''}`}
                        placeholder="How can we help?"
                        maxLength={200}
                      />
                      <FieldError message={errors.subject} />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                      <label className="block text-sm font-medium mb-1">Message</label>
                      <textarea
                        value={form.message}
                        onChange={setField('message')}
                        rows={6}
                        className={`w-full px-3 py-2.5 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow resize-y ${errors.message ? 'border-red-500' : ''}`}
                        placeholder="Tell us what's on your mind..."
                        maxLength={5000}
                      />
                      <div className="flex justify-between items-center">
                        <FieldError message={errors.message} />
                        <span className="text-xs text-muted-foreground ml-auto">{form.message.length}/5000</span>
                      </div>
                    </motion.div>

                    <motion.button
                      type="submit"
                      disabled={sendMutation.isPending}
                      whileHover={{ scale: sendMutation.isPending ? 1 : 1.02 }}
                      whileTap={{ scale: sendMutation.isPending ? 1 : 0.98 }}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sendMutation.isPending ? 'Sending...' : 'Send Message'}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </FadeIn>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {details.length > 0 ? (
            details.map((detail, i) => {
              const Icon = detail.icon;
              return (
                <FadeIn key={detail.label} direction="up" delay={0.2 + i * 0.06}>
                  <SpotlightCard className="bg-card border-border p-5" spotlightColor={detail.color}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm mb-1">{detail.label}</h3>
                        {detail.href ? (
                          <a
                            href={detail.href}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors break-all"
                          >
                            {detail.value}
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground break-words">{detail.value}</p>
                        )}
                      </div>
                    </div>
                  </SpotlightCard>
                </FadeIn>
              );
            })
          ) : (
            <FadeIn direction="up" delay={0.2}>
              <div className="bg-card border rounded-xl p-5 text-center">
                <Mail className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Contact details will appear here once configured by an administrator.
                </p>
              </div>
            </FadeIn>
          )}
        </div>
      </div>
    </div>
  );
}
