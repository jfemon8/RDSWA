import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { queryKeys } from '@/lib/queryKeys';
import { Save, Loader2, CreditCard, Landmark } from 'lucide-react';

interface MobileGatewayEntry { number: string; accountType: string; isActive: boolean }
interface BankEntry { bankName: string; branchName: string; accountName: string; accountNumber: string; routingNumber: string; isActive: boolean }
interface PaymentGateway {
  bkash: MobileGatewayEntry;
  nagad: MobileGatewayEntry;
  rocket: MobileGatewayEntry;
  bank: BankEntry;
}

const DEFAULT_MOBILE: MobileGatewayEntry = { number: '', accountType: 'personal', isActive: false };
const DEFAULT_BANK: BankEntry = { bankName: '', branchName: '', accountName: '', accountNumber: '', routingNumber: '', isActive: false };
const DEFAULT_GATEWAY: PaymentGateway = {
  bkash: { ...DEFAULT_MOBILE },
  nagad: { ...DEFAULT_MOBILE },
  rocket: { ...DEFAULT_MOBILE },
  bank: { ...DEFAULT_BANK },
};

const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;
const BD_ROCKET_REGEX = /^01[3-9]\d{8,9}$/;

function isValidMobileFormat(method: 'bkash' | 'nagad' | 'rocket', num: string): boolean {
  if (num === '') return true;
  return method === 'rocket' ? BD_ROCKET_REGEX.test(num) : BD_MOBILE_REGEX.test(num);
}

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
        bkash: { ...DEFAULT_MOBILE, ...s.paymentGateway?.bkash },
        nagad: { ...DEFAULT_MOBILE, ...s.paymentGateway?.nagad },
        rocket: { ...DEFAULT_MOBILE, ...s.paymentGateway?.rocket },
        bank: { ...DEFAULT_BANK, ...s.paymentGateway?.bank },
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

  const mobileErrors = (['bkash', 'nagad', 'rocket'] as const).some(
    (m) => !isValidMobileFormat(m, form[m].number)
  );

  const bankRequiredEmpty = form.bank.isActive && (
    !form.bank.bankName.trim() || !form.bank.accountName.trim() || !form.bank.accountNumber.trim()
  );

  const hasValidationErrors = mobileErrors || bankRequiredEmpty;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const method of ['bkash', 'nagad', 'rocket'] as const) {
      if (!isValidMobileFormat(method, form[method].number)) {
        const hint = method === 'rocket' ? '01XXXXXXXXX অথবা 01XXXXXXXXXX' : '01XXXXXXXXX';
        toast.error(`${method} এর জন্য সঠিক মোবাইল নম্বর দিন (${hint})`);
        return;
      }
    }
    if (bankRequiredEmpty) {
      toast.error('ব্যাংক একটিভ থাকলে ব্যাংকের নাম, অ্যাকাউন্ট নাম ও অ্যাকাউন্ট নম্বর আবশ্যক');
      return;
    }
    saveMutation.mutate();
  };

  const updateBank = (field: keyof BankEntry, value: string | boolean) => {
    setForm({ ...form, bank: { ...form.bank, [field]: value } });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const inputClass = 'w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all';

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
          Configure mobile banking and bank account payment methods for donation collection.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mobile Banking Section */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Mobile Banking
            </h2>
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
                  <div>
                    <input
                      placeholder="01XXXXXXXXX"
                      value={form[method].number}
                      maxLength={method === 'rocket' ? 12 : 11}
                      inputMode="numeric"
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setForm({
                          ...form,
                          [method]: { ...form[method], number: digits },
                        });
                      }}
                      className={`${inputClass} ${
                        !isValidMobileFormat(method, form[method].number) ? 'border-destructive' : ''
                      }`}
                    />
                    {!isValidMobileFormat(method, form[method].number) && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-destructive mt-1"
                      >
                        {method === 'rocket'
                          ? 'সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX বা 01XXXXXXXXXX)'
                          : 'সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)'}
                      </motion.p>
                    )}
                  </div>
                  <select
                    value={form[method].accountType}
                    onChange={(e) => setForm({
                      ...form,
                      [method]: { ...form[method], accountType: e.target.value },
                    })}
                    className={inputClass}
                  >
                    <option value="personal">Personal</option>
                    <option value="agent">Agent</option>
                    <option value="merchant">Merchant</option>
                  </select>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Bank Account Section */}
          <FadeIn direction="up" delay={0.3}>
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Landmark className="h-4 w-4" /> Bank Account
              </h2>
              <div className="border rounded-lg p-4 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Bank Transfer</span>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.bank.isActive}
                      onChange={(e) => updateBank('isActive', e.target.checked)}
                      className="rounded border-input"
                    />
                    Active
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Bank Name *</label>
                    <input
                      placeholder="e.g. Sonali Bank"
                      value={form.bank.bankName}
                      onChange={(e) => updateBank('bankName', e.target.value)}
                      className={`${inputClass} ${form.bank.isActive && !form.bank.bankName.trim() ? 'border-destructive' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Branch Name</label>
                    <input
                      placeholder="e.g. Barishal University Branch"
                      value={form.bank.branchName}
                      onChange={(e) => updateBank('branchName', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Account Name *</label>
                    <input
                      placeholder="Account holder name"
                      value={form.bank.accountName}
                      onChange={(e) => updateBank('accountName', e.target.value)}
                      className={`${inputClass} ${form.bank.isActive && !form.bank.accountName.trim() ? 'border-destructive' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Account Number *</label>
                    <input
                      placeholder="Account number"
                      value={form.bank.accountNumber}
                      onChange={(e) => updateBank('accountNumber', e.target.value)}
                      className={`${inputClass} ${form.bank.isActive && !form.bank.accountNumber.trim() ? 'border-destructive' : ''}`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Routing Number</label>
                    <input
                      placeholder="Routing number (optional)"
                      value={form.bank.routingNumber}
                      onChange={(e) => updateBank('routingNumber', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                {form.bank.isActive && (!form.bank.bankName.trim() || !form.bank.accountName.trim() || !form.bank.accountNumber.trim()) && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-destructive"
                  >
                    ব্যাংক একটিভ থাকলে ব্যাংকের নাম, অ্যাকাউন্ট নাম ও অ্যাকাউন্ট নম্বর আবশ্যক
                  </motion.p>
                )}
              </div>
            </div>
          </FadeIn>

          <motion.button
            type="submit"
            disabled={saveMutation.isPending || hasValidationErrors}
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
