import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Heart, Loader2, TrendingUp, Smartphone, Copy, Check, RefreshCw } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import SEO from '@/components/SEO';

interface PaymentMethod {
  provider: string;
  number: string;
  type: string;
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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <SEO title="Donations" description="Support RDSWA through donations — view active campaigns and contribute to student welfare." />
      <div className="flex items-center justify-between mb-6">
        <BlurText
          text="Donations"
          className="text-3xl md:text-4xl font-bold"
          delay={80}
          animateBy="words"
          direction="bottom"
        />
        <FadeIn delay={0.3} direction="right">
          <motion.button
            onClick={() => setShowForm(!showForm)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
          >
            <Heart className="h-4 w-4" /> Make a Donation
          </motion.button>
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
            <h2 className="text-xl font-semibold mb-4">Active Campaigns</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.filter((c: any) => c.status === 'active').map((c: any, index: number) => (
                <FadeIn key={c._id} delay={0.1 * index} direction="up">
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="border rounded-lg p-5 bg-background"
                  >
                    {c.coverImage && <img src={c.coverImage} alt="" className="w-full h-32 object-cover rounded-md mb-3" />}
                    <h3 className="font-semibold mb-2">{c.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{c.description}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Raised</span>
                        <span className="font-medium">৳{c.raisedAmount?.toLocaleString()} / ৳{c.targetAmount?.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${Math.min(100, (c.raisedAmount / c.targetAmount) * 100)}%` }}
                        />
                      </div>
                    </div>
                    {c.endDate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Ends {new Date(c.endDate).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                      </p>
                    )}
                  </motion.div>
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
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: '',
    type: 'one-time',
    paymentMethod: 'bkash',
    transactionId: '',
    senderNumber: '',
    donorName: '',
    donorEmail: '',
    donorPhone: '',
    note: '',
    visibility: 'public',
    isRecurring: false,
    recurringInterval: 'monthly' as 'monthly' | 'yearly',
  });

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
        transactionId: form.transactionId,
        senderNumber: form.senderNumber,
        note: form.note,
        visibility: form.visibility,
        isRecurring: form.isRecurring,
      };
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
    onSuccess,
  });

  const copyNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  return (
    <div className="border rounded-lg p-6 bg-background mb-6">
      <h3 className="font-semibold mb-4">Make a Donation</h3>

      {/* Step 1: Payment instructions */}
      <div className="mb-5 p-4 rounded-lg bg-muted/50 border border-dashed">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
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
                className={`flex items-center justify-between p-2.5 rounded-md border text-sm ${
                  m.provider.toLowerCase() === form.paymentMethod.toLowerCase()
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <div>
                  <span className="font-medium capitalize">{m.provider}</span>
                  <span className="text-muted-foreground ml-1 text-xs">({m.type})</span>
                  <p className="font-mono text-sm">{m.number}</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => copyNumber(m.number)}
                  className="p-1.5 rounded hover:bg-accent"
                  title="Copy number"
                >
                  {copiedNumber === m.number ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </motion.button>
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
      <h4 className="text-sm font-medium mb-3">Step 2: Fill Payment Details</h4>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">
        {!isAuthenticated && (
          <>
            <input placeholder="Your Name" value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
            <input placeholder="Email" type="email" value={form.donorEmail} onChange={(e) => setForm({ ...form, donorEmail: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" required />
            <input placeholder="Phone" value={form.donorPhone} onChange={(e) => setForm({ ...form, donorPhone: e.target.value })}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Amount (BDT)" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="px-3 py-2 border rounded-md bg-background text-sm" required />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="px-3 py-2 border rounded-md bg-background text-sm">
            <option value="one-time">One-time</option>
            <option value="monthly">Monthly</option>
            <option value="event-based">Event-based</option>
            <option value="construction-fund">Construction Fund</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="px-3 py-2 border rounded-md bg-background text-sm">
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="rocket">Rocket</option>
            <option value="bank">Bank Transfer</option>
            <option value="cash">Cash</option>
          </select>
          <input placeholder="Transaction ID" value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
            className="px-3 py-2 border rounded-md bg-background text-sm" />
        </div>
        <input placeholder="Sender Number (your mobile banking number)" value={form.senderNumber} onChange={(e) => setForm({ ...form, senderNumber: e.target.value })}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm" />

        {/* Recurring toggle */}
        <div className="flex items-center gap-4">
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

        <AnimatePresence>
          {mutation.isError && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-600"
            >
              {(mutation.error as any)?.response?.data?.message || 'Donation failed'}
            </motion.p>
          )}
          {mutation.isSuccess && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-green-600"
            >
              Donation submitted! It will be reviewed by a moderator.
            </motion.p>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Submitting...' : 'Submit Donation'}
          </motion.button>
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
      const { data } = await api.get('/donations?limit=10');
      return data;
    },
  });

  const donations = data?.data || [];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
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
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex items-center justify-between p-3 border rounded-lg text-sm"
              >
                <div>
                  <p className="font-medium">
                    {d.visibility === 'private' ? 'Anonymous' : (d.donor?.name || d.donorName || 'Unknown')}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{d.type?.replace('-', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">৳{d.amount?.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.createdAt).toLocaleDateString('en-US', { dateStyle: 'short' })}
                  </p>
                </div>
              </motion.div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
