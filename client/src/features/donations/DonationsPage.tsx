import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Heart, Loader2, TrendingUp, Smartphone, Copy, Check, RefreshCw, Landmark } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import SEO from '@/components/SEO';
import { formatDate } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';
import RichContent from '@/components/ui/RichContent';

interface PaymentMethod {
  provider: string;
  number?: string;
  accountType?: string;
  bankName?: string;
  branchName?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
}

export default function DonationsPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: campaignsData } = useQuery({
    queryKey: ['donations', 'campaigns'],
    queryFn: async () => {
      const { data } = await api.get('/donations/campaigns');
      return data;
    },
  });

  const campaigns = campaignsData?.data || [];

  return (
    <div className="container mx-auto py-8">
      <SEO title="Donations" description="Support RDSWA through donations — view active campaigns and contribute to student welfare." />
      <div className="flex items-center justify-between mb-6">
        <BlurText
          text="Donations"
          className="text-2xl sm:text-3xl md:text-4xl font-bold"
          delay={80}
          animateBy="words"
          direction="bottom"
        />
        <FadeIn delay={0.3} direction="right">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
          >
            <Heart className="h-4 w-4" /> Make a Donation
          </button>
        </FadeIn>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <DonationForm
              onClose={() => setShowForm(false)}
              onSuccess={() => {
                setShowForm(false);
                queryClient.invalidateQueries({ queryKey: ['donations'] });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active campaigns */}
      {campaigns.length > 0 && (
        <FadeIn delay={0.2} direction="up">
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Active Campaigns</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campaigns.filter((c: any) => c.status === 'active').map((c: any, index: number) => (
                <FadeIn key={c._id} delay={0.1 * index} direction="up">
                  <div
                    className="border rounded-lg p-5 bg-card"
                  >
                    {c.coverImage && <img src={c.coverImage} alt="" className="w-full h-32 object-cover rounded-md mb-3" />}
                    <h3 className="font-semibold mb-2 text-foreground">{c.title}</h3>
                    {c.description && <RichContent html={c.description} className="text-sm text-muted-foreground mb-3 line-clamp-2" />}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Raised</span>
                        <span className="font-medium text-foreground">৳{c.raisedAmount?.toLocaleString()} / ৳{c.targetAmount?.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${c.targetAmount ? Math.min(100, (c.raisedAmount / c.targetAmount) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    {c.endDate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Ends {formatDate(c.endDate)}
                      </p>
                    )}
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Recent donations */}
      <FadeIn delay={0.3} direction="up">
        <RecentDonations />
      </FadeIn>
    </div>
  );
}

function DonationForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { isAuthenticated } = useAuthStore();
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: '',
    type: 'one-time',
    paymentMethod: 'bkash',
    transactionId: '',
    senderNumber: '',
    senderBankName: '',
    senderAccountNumber: '',
    cashDate: '',
    cashTime: '',
    donorName: '',
    donorEmail: '',
    donorPhone: '',
    note: '',
    visibility: 'public',
    isRecurring: false,
    recurringInterval: 'monthly' as 'monthly' | 'yearly',
  });

  const isMobile = ['bkash', 'nagad', 'rocket'].includes(form.paymentMethod);
  const isBank = form.paymentMethod === 'bank';
  const isCash = form.paymentMethod === 'cash';

  // Fetch dynamic payment methods from DB
  const { data: paymentMethodsData, isLoading: loadingMethods } = useQuery({
    queryKey: ['donations', 'payment-methods'],
    queryFn: async () => {
      const { data } = await api.get('/donations/payment-methods');
      return data;
    },
  });

  const paymentMethods: PaymentMethod[] = paymentMethodsData?.data || [];

  // Get the matching payment number for selected method
  const activePaymentInfo = paymentMethods.filter(
    (m) => m.provider.toLowerCase() === form.paymentMethod.toLowerCase()
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        amount: Number(form.amount),
        type: form.type,
        paymentMethod: form.paymentMethod,
        note: form.note,
        visibility: form.visibility,
        isRecurring: form.isRecurring,
      };
      if (isMobile) {
        payload.transactionId = form.transactionId;
        payload.senderNumber = form.senderNumber;
      } else if (isBank) {
        payload.transactionId = form.transactionId;
        payload.senderBankName = form.senderBankName;
        payload.senderAccountNumber = form.senderAccountNumber;
      } else if (isCash) {
        payload.cashDate = form.cashDate;
        payload.cashTime = form.cashTime;
      }
      if (form.isRecurring) {
        payload.recurringInterval = form.recurringInterval;
      }
      if (!isAuthenticated) {
        payload.donorName = form.donorName;
        payload.donorEmail = form.donorEmail;
        payload.donorPhone = form.donorPhone;
      }
      const { data } = await api.post('/donations', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Donation submitted!', 'It will be reviewed by a moderator.');
      onSuccess();
    },
    onError: (err: any) => {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        setErrors(fieldErrors);
      } else {
        toast.error(err?.response?.data?.message || 'Donation failed');
      }
    },
  });

  const copyNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  return (
    <div className="border rounded-lg p-6 bg-card mb-6">
      <h3 className="font-semibold mb-4 text-foreground">Make a Donation</h3>

      {/* Step 1: Payment instructions */}
      <div className="mb-5 p-4 rounded-lg bg-muted border border-dashed">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-foreground">
          <Smartphone className="h-4 w-4" />
          Step 1: Send Money to
        </h4>
        {loadingMethods ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading payment numbers...
          </div>
        ) : paymentMethods.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment methods configured. Contact admin.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {paymentMethods.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`p-2.5 rounded-md border text-sm ${
                  m.provider.toLowerCase() === form.paymentMethod.toLowerCase()
                    ? 'border-primary bg-primary/5'
                    : 'border'
                } ${m.provider === 'bank' ? 'sm:col-span-2' : ''}`}
              >
                {m.provider === 'bank' ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">Bank Transfer</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div><span className="text-muted-foreground">Bank:</span> <span className="text-foreground">{m.bankName}</span></div>
                      {m.branchName && <div><span className="text-muted-foreground">Branch:</span> <span className="text-foreground">{m.branchName}</span></div>}
                      <div><span className="text-muted-foreground">A/C Name:</span> <span className="text-foreground">{m.accountName}</span></div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">A/C No:</span>
                        <span className="font-mono text-foreground">{m.accountNumber}</span>
                        <button type="button" onClick={() => copyNumber(m.accountNumber!)} className="p-0.5 rounded hover:bg-accent" title="Copy account number">
                          {copiedNumber === m.accountNumber ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                      {m.routingNumber && <div><span className="text-muted-foreground">Routing:</span> <span className="font-mono text-foreground">{m.routingNumber}</span></div>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium capitalize text-foreground">{m.provider}</span>
                      <span className="text-muted-foreground ml-1 text-xs">({m.accountType})</span>
                      <p className="font-mono text-sm text-foreground">{m.number}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyNumber(m.number!)}
                      className="p-1.5 rounded hover:bg-accent"
                      title="Copy number"
                    >
                      {copiedNumber === m.number ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {activePaymentInfo.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-primary mt-2"
          >
            Send money to the <strong className="capitalize">{form.paymentMethod}</strong> number above, then fill the form below.
          </motion.p>
        )}
      </div>

      {/* Step 2: Payment form */}
      <h4 className="text-sm font-medium mb-3 text-foreground">Step 2: Fill Payment Details</h4>
      <form onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        const newErrors: Record<string, string> = {};
        if (!isAuthenticated) {
          if (!form.donorName.trim()) newErrors.donorName = 'Name is required';
          if (!form.donorEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.donorEmail)) newErrors.donorEmail = 'Valid email is required';
        }
        if (!form.amount || Number(form.amount) <= 0) newErrors.amount = 'Amount must be greater than 0';
        if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
        mutation.mutate();
      }} noValidate className="space-y-3">
        {!isAuthenticated && (
          <>
            <div>
              <input placeholder="Your Name" value={form.donorName} onChange={(e) => { setForm({ ...form, donorName: e.target.value }); setErrors((prev) => { const { donorName, ...rest } = prev; return rest; }); }}
                className={`w-full px-3 py-2 border rounded-md bg-background text-sm ${errors.donorName ? 'border-red-500' : ''}`} required />
              <FieldError message={errors.donorName} />
            </div>
            <div>
              <input placeholder="Email" type="email" value={form.donorEmail} onChange={(e) => { setForm({ ...form, donorEmail: e.target.value }); setErrors((prev) => { const { donorEmail, ...rest } = prev; return rest; }); }}
                className={`w-full px-3 py-2 border rounded-md bg-background text-sm ${errors.donorEmail ? 'border-red-500' : ''}`} required />
              <FieldError message={errors.donorEmail} />
            </div>
            <input placeholder="Phone" value={form.donorPhone} onChange={(e) => setForm({ ...form, donorPhone: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
          </>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <input placeholder="Amount (BDT)" type="number" value={form.amount} onChange={(e) => { setForm({ ...form, amount: e.target.value }); setErrors((prev) => { const { amount, ...rest } = prev; return rest; }); }}
              className={`w-full px-3 py-2 border rounded-md bg-background text-sm ${errors.amount ? 'border-red-500' : ''}`} required />
            <FieldError message={errors.amount} />
          </div>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="px-3 py-2 border rounded-md bg-background text-sm">
            <option value="one-time">One-time</option>
            <option value="monthly">Monthly</option>
            <option value="membership">Membership</option>
            <option value="event-based">Event-based</option>
            <option value="construction-fund">Construction Fund</option>
          </select>
        </div>
        <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm">
          <option value="bkash">bKash</option>
          <option value="nagad">Nagad</option>
          <option value="rocket">Rocket</option>
          <option value="bank">Bank Transfer</option>
          <option value="cash">Cash</option>
        </select>

        <AnimatePresence mode="wait">
          {isMobile && (
            <motion.div key="mobile-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
              <input placeholder="Transaction ID" value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
              <input placeholder="Sender Number (your mobile banking number)" value={form.senderNumber} onChange={(e) => setForm({ ...form, senderNumber: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
            </motion.div>
          )}
          {isBank && (
            <motion.div key="bank-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
              <input placeholder="Transaction ID / Reference" value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Sender Bank Name" value={form.senderBankName} onChange={(e) => setForm({ ...form, senderBankName: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-background text-sm" />
                <input placeholder="Sender Account Number" value={form.senderAccountNumber} onChange={(e) => setForm({ ...form, senderAccountNumber: e.target.value })}
                  className="px-3 py-2 border rounded-md bg-background text-sm" />
              </div>
            </motion.div>
          )}
          {isCash && (
            <motion.div key="cash-fields" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date of Payment</label>
                  <input type="date" value={form.cashDate} onChange={(e) => setForm({ ...form, cashDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Time of Payment</label>
                  <input type="time" value={form.cashTime} onChange={(e) => setForm({ ...form, cashTime: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recurring toggle */}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
              className="rounded"
            />
            <RefreshCw className="h-3.5 w-3.5" />
            Recurring donation
          </label>
          <AnimatePresence>
            {form.isRecurring && (
              <motion.select
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                value={form.recurringInterval}
                onChange={(e) => setForm({ ...form, recurringInterval: e.target.value as 'monthly' | 'yearly' })}
                className="px-2 py-1 border rounded-md bg-background text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </motion.select>
            )}
          </AnimatePresence>
        </div>

        <textarea placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="visibility" checked={form.visibility === 'public'} onChange={() => setForm({ ...form, visibility: 'public' })} />
            Public
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="visibility" checked={form.visibility === 'private'} onChange={() => setForm({ ...form, visibility: 'private' })} />
            Private (hide name)
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Submitting...' : 'Submit Donation'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">Cancel</button>
        </div>
      </form>
    </div>
  );
}

function RecentDonations() {
  const { data, isLoading } = useQuery({
    queryKey: ['donations', 'recent'],
    queryFn: async () => {
      const { data } = await api.get('/donations?limit=10&paymentStatus=completed');
      return data;
    },
  });

  const donations = data?.data || [];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
        <TrendingUp className="h-5 w-5" /> Recent Donations
      </h2>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : donations.length === 0 ? (
        <p className="text-muted-foreground text-sm">No donations yet</p>
      ) : (
        <div className="space-y-2">
          {donations.map((d: any, index: number) => (
            <FadeIn key={d._id} delay={0.05 * index} direction="up">
              <div
                className="flex items-center justify-between p-3 border rounded-lg text-sm bg-card"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {d.visibility === 'private' ? 'Anonymous' : d.donor?._id ? (
                      <Link to={`/members/${d.donor._id}`} className="hover:text-primary transition-colors">{d.donor.name || d.donorName || 'Unknown'}</Link>
                    ) : (d.donorName || 'Unknown')}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{d.type?.replace('-', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">৳{d.amount?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(d.createdAt, 'short')}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
