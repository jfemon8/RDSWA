import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, UserCheck, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors, omitFieldError } from '@/lib/formErrors';
import { toDateInput } from '@/lib/date';

const TYPES = ['one-time', 'monthly', 'event-based', 'construction-fund', 'membership'];
const METHODS = ['bkash', 'nagad', 'rocket', 'bank', 'cash', 'other'];
const STATUSES = ['pending', 'completed', 'failed', 'refunded', 'revision'];

interface DonationFormModalProps {
  /** Existing record to edit, or null to record a new donation. */
  donation: any | null;
  onClose: () => void;
}

/** Admin form for recording a donation manually, or correcting an existing one in any status. */
export default function DonationFormModal({ donation, onClose }: DonationFormModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const isEdit = !!donation?._id;

  const [form, setForm] = useState({
    donor: (typeof donation?.donor === 'object' ? donation?.donor?._id : donation?.donor) || '',
    donorName: donation?.donorName || (typeof donation?.donor === 'object' ? donation?.donor?.name : '') || '',
    donorEmail: donation?.donorEmail || '',
    donorPhone: donation?.donorPhone || '',
    amount: donation?.amount ? String(donation.amount) : '',
    type: donation?.type || 'one-time',
    campaign: (typeof donation?.campaign === 'object' ? donation?.campaign?._id : donation?.campaign) || '',
    event: (typeof donation?.event === 'object' ? donation?.event?._id : donation?.event) || '',
    paymentMethod: donation?.paymentMethod || 'cash',
    senderNumber: donation?.senderNumber || '',
    transactionId: donation?.transactionId || '',
    senderBankName: donation?.senderBankName || '',
    senderAccountNumber: donation?.senderAccountNumber || '',
    donationDate: donation?.donationDate ? toDateInput(donation.donationDate) : '',
    paymentStatus: donation?.paymentStatus || 'completed',
    visibility: donation?.visibility || 'public',
    note: donation?.note || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState('');

  // Editing a field clears its message, so the error disappears as the user fixes it.
  const set = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => Object.keys(patch).reduce((acc, field) => omitFieldError(acc, field), prev));
  };

  const { data: campaignsData } = useQuery({
    queryKey: ['donation-campaigns'],
    queryFn: async () => (await api.get('/donations/campaigns')).data,
  });
  const campaigns: any[] = campaignsData?.data || [];

  const { data: eventsData } = useQuery({
    queryKey: ['donation-event-options'],
    queryFn: async () => (await api.get('/events?limit=100')).data,
  });
  const events: any[] = eventsData?.data || [];

  const { data: usersData, isFetching: searchingUsers } = useQuery({
    queryKey: ['donation-donor-search', userSearch],
    queryFn: async () => (await api.get(`/users?search=${encodeURIComponent(userSearch)}&limit=8`)).data,
    enabled: userSearch.trim().length >= 2,
  });
  const candidates: any[] = usersData?.data || [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        donor: form.donor,
        donorName: form.donorName.trim(),
        donorEmail: form.donorEmail.trim(),
        donorPhone: form.donorPhone.trim(),
        amount: Number(form.amount),
        type: form.type,
        campaign: form.campaign,
        event: form.event,
        paymentMethod: form.paymentMethod,
        senderNumber: form.senderNumber.trim(),
        transactionId: form.transactionId.trim(),
        senderBankName: form.senderBankName.trim(),
        senderAccountNumber: form.senderAccountNumber.trim(),
        paymentStatus: form.paymentStatus,
        visibility: form.visibility,
        note: form.note.trim(),
      };
      // An omitted date lets the server stamp today.
      if (form.donationDate) payload.donationDate = form.donationDate;

      if (isEdit) return (await api.patch(`/donations/${donation._id}`, payload)).data;
      return (await api.post('/donations', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation-campaigns'] });
      toast.success(isEdit ? 'Donation updated' : 'Donation recorded');
      onClose();
    },
    onError: (err: any) => {
      const fe = extractFieldErrors(err);
      if (fe) setErrors(fe);
      else toast.error(err.response?.data?.message || 'Failed to save donation');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Amount must be greater than zero';
    if (!form.donor && !form.donorName.trim()) errs.donorName = 'Pick a registered user or type a donor name';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    saveMutation.mutate();
  };

  const selectUser = (u: any) => {
    set({
      donor: u._id,
      donorName: u.name || '',
      donorEmail: u.email || form.donorEmail,
      donorPhone: u.phone || form.donorPhone,
    });
    setUserSearch('');
  };

  const field = 'w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';
  const label = 'block text-xs font-medium text-muted-foreground mb-1';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl my-8 rounded-xl border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h3 className="font-semibold text-foreground">
              {isEdit ? 'Edit Donation' : 'Add Donation'}
            </h3>
            <button type="button" onClick={onClose} className="p-1 rounded hover:bg-accent" aria-label="Close">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <form noValidate onSubmit={submit} className="p-5 space-y-4">
            {/* Donor: a registered account, or plain text when they have none. */}
            <div className="rounded-lg border p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">Donor</p>

              {form.donor ? (
                <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-card text-sm mb-2">
                  <UserCheck className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-foreground">{form.donorName || 'Registered user'}</span>
                  <button
                    type="button"
                    onClick={() => set({ donor: '' })}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Unlink
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search registered users by name or email..."
                      className={`${field} pl-9`}
                    />
                    {searchingUsers && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
                    )}
                  </div>

                  {userSearch.trim().length >= 2 && candidates.length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                      {candidates.map((u) => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => selectUser(u)}
                          className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-xs hover:bg-accent"
                        >
                          <span className="font-medium text-foreground">{u.name}</span>
                          {u.email && <span className="text-muted-foreground truncate">{u.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className={label}>Name</label>
                  <input value={form.donorName} onChange={(e) => set({ donorName: e.target.value })} className={field} />
                  <FieldError message={errors.donorName} />
                </div>
                <div>
                  <label className={label}>Email</label>
                  <input value={form.donorEmail} onChange={(e) => set({ donorEmail: e.target.value })} className={field} />
                  <FieldError message={errors.donorEmail} />
                </div>
                <div>
                  <label className={label}>Phone</label>
                  <input value={form.donorPhone} onChange={(e) => set({ donorPhone: e.target.value })} className={field} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>Amount (BDT)</label>
                <input type="number" min="1" value={form.amount} onChange={(e) => set({ amount: e.target.value })} className={field} />
                <FieldError message={errors.amount} />
              </div>
              <div>
                <label className={label}>Type</label>
                <select value={form.type} onChange={(e) => set({ type: e.target.value })} className={field}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Campaign</label>
                <select value={form.campaign} onChange={(e) => set({ campaign: e.target.value })} className={field}>
                  <option value="">None</option>
                  {campaigns.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={label}>Event</label>
              <select value={form.event} onChange={(e) => set({ event: e.target.value })} className={field}>
                <option value="">None</option>
                {events.map((e: any) => <option key={e._id} value={e._id}>{e.title}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={label}>Payment Method</label>
                <select value={form.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} className={field}>
                  {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Donation Date</label>
                <input
                  type="date"
                  value={form.donationDate}
                  max={toDateInput(new Date())}
                  onChange={(e) => set({ donationDate: e.target.value })}
                  className={field}
                />
                <FieldError message={errors.donationDate} />
              </div>
              <div>
                <label className={label}>Status</label>
                <select value={form.paymentStatus} onChange={(e) => set({ paymentStatus: e.target.value })} className={field}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {['bkash', 'nagad', 'rocket'].includes(form.paymentMethod) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={label}>Sender Number</label>
                  <input value={form.senderNumber} onChange={(e) => set({ senderNumber: e.target.value })} className={field} />
                </div>
                <div>
                  <label className={label}>Transaction ID</label>
                  <input value={form.transactionId} onChange={(e) => set({ transactionId: e.target.value })} className={field} />
                </div>
              </div>
            )}

            {form.paymentMethod === 'bank' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={label}>Sender Bank</label>
                  <input value={form.senderBankName} onChange={(e) => set({ senderBankName: e.target.value })} className={field} />
                </div>
                <div>
                  <label className={label}>Sender A/C No</label>
                  <input value={form.senderAccountNumber} onChange={(e) => set({ senderAccountNumber: e.target.value })} className={field} />
                </div>
                <div>
                  <label className={label}>Transaction ID</label>
                  <input value={form.transactionId} onChange={(e) => set({ transactionId: e.target.value })} className={field} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Visibility</label>
                <select value={form.visibility} onChange={(e) => set({ visibility: e.target.value })} className={field}>
                  <option value="public">public</option>
                  <option value="private">private</option>
                </select>
              </div>
              <div>
                <label className={label}>Note</label>
                <input value={form.note} onChange={(e) => set({ note: e.target.value })} className={field} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 border rounded-md text-sm hover:bg-accent">
                Cancel
              </button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Add Donation'}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
