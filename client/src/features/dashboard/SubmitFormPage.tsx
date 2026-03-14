import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { Loader2, Send, UserPlus, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { useToast } from '@/components/ui/Toast';

export default function SubmitFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const toast = useToast();
  const [type, setType] = useState('membership');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isMembershipForm = type === 'membership';
  const alreadyMember = user?.membershipStatus === 'approved';
  const alreadyPending = user?.membershipStatus === 'pending';

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/forms', {
        type,
        data: { reason },
      });
      return data;
    },
    onSuccess: async () => {
      // Refresh user data to pick up membershipStatus change
      if (isMembershipForm) {
        try {
          const { data } = await api.get('/users/me');
          setUser(data.data);
        } catch {}
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
      toast.success('Form submitted successfully!');
      navigate('/dashboard/forms');
    },
    onError: (err: any) => {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
      } else {
        toast.error(err.response?.data?.message || 'Submission failed');
      }
    },
  });

  return (
    <FadeIn direction="up" blur duration={0.5}>
      <div className="container mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">
          {isMembershipForm ? 'Membership Application' : 'Submit Form'}
        </h1>

        {/* Membership info banner */}
        <AnimatePresence>
          {isMembershipForm && !alreadyMember && !alreadyPending && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 rounded-xl border bg-primary/5 border-primary/20"
            >
              <div className="flex items-start gap-3">
                <UserPlus className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Join RDSWA</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submit your membership application below. After review by the admin team, you'll receive a notification about the decision. Make sure your profile is complete before applying.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          if (!reason.trim()) {
            setErrors({ reason: isMembershipForm ? 'Please explain why you want to join' : 'Please provide details' });
            return;
          }
          mutation.mutate();
        }} noValidate className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <label className="block text-sm font-medium mb-1">Form Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="membership">Membership Application</option>
              <option value="construction_fund">Construction Fund</option>
              <option value="alumni">Alumni Registration</option>
              <option value="other">Other</option>
            </select>
          </motion.div>

          {isMembershipForm && (alreadyMember || alreadyPending) ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="p-4 rounded-md border bg-muted"
            >
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {alreadyMember
                    ? 'You are already an approved member.'
                    : 'You already have a pending membership application. Please wait for admin review.'}
                </span>
              </div>
            </motion.div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <label className="block text-sm font-medium mb-1">
                  {isMembershipForm ? 'Why do you want to join RDSWA?' : 'Details / Reason'}
                </label>
                <textarea value={reason} onChange={(e) => { setReason(e.target.value); setErrors((prev) => { const { reason, ...rest } = prev; return rest; }); }} rows={5}
                  className={`w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.reason ? 'border-red-500' : ''}`}
                  placeholder={isMembershipForm
                    ? 'Tell us about yourself — your district, department, why you want to join...'
                    : 'Provide details about your application...'}
                  required />
                <FieldError message={errors.reason} />
              </motion.div>

              <motion.button
                type="submit"
                disabled={mutation.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isMembershipForm ? 'Submit Application' : 'Submit'}
              </motion.button>
            </>
          )}
        </form>
      </div>
    </FadeIn>
  );
}
