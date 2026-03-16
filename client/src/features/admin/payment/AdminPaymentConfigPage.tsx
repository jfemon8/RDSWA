import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { queryKeys } from '@/lib/queryKeys';
import { Save, Loader2, CreditCard } from 'lucide-react';

interface PaymentGateway {
  bkash: { number: string; isActive: boolean };
  nagad: { number: string; isActive: boolean };
  rocket: { number: string; isActive: boolean };
}

const DEFAULT_GATEWAY: PaymentGateway = {
  bkash: { number: '', isActive: false },
  nagad: { number: '', isActive: false },
  rocket: { number: '', isActive: false },
};

export default function AdminPaymentConfigPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });

  const [form, setForm] = useState<PaymentGateway>(DEFAULT_GATEWAY);

  useEffect(() => {
    if (data?.data) {
      const s = data.data;
      setForm({
        bkash: s.paymentGateway?.bkash || DEFAULT_GATEWAY.bkash,
        nagad: s.paymentGateway?.nagad || DEFAULT_GATEWAY.nagad,
        rocket: s.paymentGateway?.rocket || DEFAULT_GATEWAY.rocket,
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch('/settings/payment', { paymentGateway: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
      toast.success('Payment configuration updated');
    },
    onError: () => toast.error('Failed to update payment configuration'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <FadeIn direction="up">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <CreditCard className="h-6 w-6 text-primary" />
          </motion.div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Payment Gateway Configuration</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure mobile banking payment methods for donation collection.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {(['bkash', 'nagad', 'rocket'] as const).map((method, i) => (
            <FadeIn key={method} direction="up" delay={i * 0.08}>
              <div className="border rounded-lg p-4 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground capitalize">{method}</span>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[method].isActive}
                      onChange={(e) => setForm({
                        ...form,
                        [method]: { ...form[method], isActive: e.target.checked },
                      })}
                      className="rounded border-input"
                    />
                    Active
                  </label>
                </div>
                <input
                  placeholder={`${method.charAt(0).toUpperCase() + method.slice(1)} Number`}
                  value={form[method].number}
                  onChange={(e) => setForm({
                    ...form,
                    [method]: { ...form[method], number: e.target.value },
                  })}
                  className="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </FadeIn>
          ))}

          <motion.button
            type="submit"
            disabled={saveMutation.isPending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Configuration
          </motion.button>
        </form>
      </div>
    </FadeIn>
  );
}
