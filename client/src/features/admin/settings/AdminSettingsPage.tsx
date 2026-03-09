import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Save, Loader2 } from 'lucide-react';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });

  const [form, setForm] = useState({
    siteName: '', contactEmail: '', contactPhone: '', address: '',
    aboutContent: '', missionContent: '', visionContent: '',
    socialLinks: { facebook: '', youtube: '', linkedin: '' },
    paymentGateway: {
      bkash: { number: '', isActive: false },
      nagad: { number: '', isActive: false },
      rocket: { number: '', isActive: false },
    },
  });

  useEffect(() => {
    if (data?.data) {
      const s = data.data;
      setForm({
        siteName: s.siteName || '',
        contactEmail: s.contactEmail || '',
        contactPhone: s.contactPhone || '',
        address: s.address || '',
        aboutContent: s.aboutContent || '',
        missionContent: s.missionContent || '',
        visionContent: s.visionContent || '',
        socialLinks: s.socialLinks || { facebook: '', youtube: '', linkedin: '' },
        paymentGateway: s.paymentGateway || {
          bkash: { number: '', isActive: false },
          nagad: { number: '', isActive: false },
          rocket: { number: '', isActive: false },
        },
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch('/settings', form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.settings.all }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Site Settings</h1>

      {saveMutation.isSuccess && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
          Settings saved successfully!
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="max-w-2xl space-y-6">
        {/* General */}
        <section>
          <h2 className="text-lg font-semibold mb-3">General</h2>
          <div className="space-y-3">
            <Field label="Site Name" value={form.siteName} onChange={(v) => setForm({ ...form, siteName: v })} />
            <Field label="Contact Email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} />
            <Field label="Contact Phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} />
            <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          </div>
        </section>

        {/* Content */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Content</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">About Content</label>
              <textarea value={form.aboutContent} onChange={(e) => setForm({ ...form, aboutContent: e.target.value })} rows={4}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Mission</label>
              <textarea value={form.missionContent} onChange={(e) => setForm({ ...form, missionContent: e.target.value })} rows={3}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vision</label>
              <textarea value={form.visionContent} onChange={(e) => setForm({ ...form, visionContent: e.target.value })} rows={3}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
            </div>
          </div>
        </section>

        {/* Social Links */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Social Links</h2>
          <div className="space-y-3">
            <Field label="Facebook" value={form.socialLinks.facebook}
              onChange={(v) => setForm({ ...form, socialLinks: { ...form.socialLinks, facebook: v } })} />
            <Field label="YouTube" value={form.socialLinks.youtube}
              onChange={(v) => setForm({ ...form, socialLinks: { ...form.socialLinks, youtube: v } })} />
            <Field label="LinkedIn" value={form.socialLinks.linkedin}
              onChange={(v) => setForm({ ...form, socialLinks: { ...form.socialLinks, linkedin: v } })} />
          </div>
        </section>

        {/* Payment Gateway */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Payment Gateway</h2>
          {(['bkash', 'nagad', 'rocket'] as const).map((method) => (
            <div key={method} className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 text-sm w-20 capitalize">
                <input type="checkbox" checked={form.paymentGateway[method]?.isActive || false}
                  onChange={(e) => setForm({
                    ...form,
                    paymentGateway: { ...form.paymentGateway, [method]: { ...form.paymentGateway[method], isActive: e.target.checked } },
                  })} />
                {method}
              </label>
              <input placeholder="Number" value={form.paymentGateway[method]?.number || ''}
                onChange={(e) => setForm({
                  ...form,
                  paymentGateway: { ...form.paymentGateway, [method]: { ...form.paymentGateway[method], number: e.target.value } },
                })}
                className="flex-1 px-3 py-2 border rounded-md bg-background text-sm" />
            </div>
          ))}
        </section>

        <button type="submit" disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
    </div>
  );
}
