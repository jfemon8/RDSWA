import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Heart, Loader2, TrendingUp } from 'lucide-react';

export default function DonationsPage() {
  const [showForm, setShowForm] = useState(false);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Donations</h1>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm">
          <Heart className="h-4 w-4" /> Make a Donation
        </button>
      </div>

      {showForm && <DonationForm onClose={() => setShowForm(false)} />}

      {/* Active campaigns */}
      {campaigns.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Active Campaigns</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.filter((c: any) => c.status === 'active').map((c: any) => (
              <div key={c._id} className="border rounded-lg p-5 bg-background">
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent donations */}
      <RecentDonations />
    </div>
  );
}

function DonationForm({ onClose }: { onClose: () => void }) {
  const { isAuthenticated } = useAuthStore();
  const [form, setForm] = useState({
    amount: '',
    type: 'one-time',
    paymentMethod: 'bkash',
    transactionId: '',
    donorName: '',
    donorEmail: '',
    donorPhone: '',
    note: '',
    visibility: 'public',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, amount: Number(form.amount) };
      if (isAuthenticated) {
        delete payload.donorName;
        delete payload.donorEmail;
        delete payload.donorPhone;
      }
      const { data } = await api.post('/donations', payload);
      return data;
    },
    onSuccess: () => onClose(),
  });

  return (
    <div className="border rounded-lg p-6 bg-background mb-6">
      <h3 className="font-semibold mb-4">Make a Donation</h3>
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
        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as any)?.response?.data?.message || 'Donation failed'}</p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={mutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50">
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
          {donations.map((d: any) => (
            <div key={d._id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
