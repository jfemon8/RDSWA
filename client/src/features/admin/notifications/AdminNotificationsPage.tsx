import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { Send, Loader2, Bell, Radio } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@rdswa/shared';
import { hasMinRole } from '@/lib/roles';

export default function AdminNotificationsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role ? hasMinRole(user.role, UserRole.ADMIN) : false;
  const [type, setType] = useState<'broadcast' | 'targeted'>('targeted');
  const toast = useToast();
  const [form, setForm] = useState({ title: '', message: '', link: '', targetRole: '', targetBatch: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (type === 'broadcast') {
        const { data } = await api.post('/notifications/broadcast', { title: form.title, message: form.message, link: form.link });
        return data;
      }
      const payload: any = { title: form.title, message: form.message, link: form.link };
      if (form.targetRole) payload.targetRole = form.targetRole;
      if (form.targetBatch) payload.targetBatch = Number(form.targetBatch);
      const { data } = await api.post('/notifications/targeted', payload);
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Notification sent!');
      setForm({ title: '', message: '', link: '', targetRole: '', targetBatch: '' });
    },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to send notification'); } },
  });

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Send Notifications</h1>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
          <button
            onClick={() => setType('targeted')}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md border ${
              type === 'targeted' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
            }`}>
            <Bell className="h-4 w-4" /> Targeted
          </button>
          {isAdmin && (
            <button
              onClick={() => setType('broadcast')}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md border ${
                type === 'broadcast' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
              }`}>
              <Radio className="h-4 w-4" /> Broadcast (All)
            </button>
          )}
        </div>

        <FadeIn direction="up" delay={0.1}>
          <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.title.trim()) errs.title = 'Notification title is required'; if (!form.message.trim()) errs.message = 'Notification message is required'; if (Object.keys(errs).length) { setErrors(errs); return; } sendMutation.mutate(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title</label>
              <input value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
                className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.title ? 'border-red-500' : ''}`} required />
              <FieldError message={errors.title} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Message</label>
              <textarea value={form.message} onChange={(e) => { setForm({ ...form, message: e.target.value }); setErrors((prev) => { const { message, ...rest } = prev; return rest; }); }} rows={4}
                className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${errors.message ? 'border-red-500' : ''}`} required />
              <FieldError message={errors.message} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Link (optional)</label>
              <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/events/..."
                className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>

            {type === 'targeted' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Target Role</label>
                  <select value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="">All roles</option>
                    <option value="user">User</option>
                    <option value="member">Member</option>
                    <option value="alumni">Alumni</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Target Batch</label>
                  <input type="number" value={form.targetBatch} onChange={(e) => setForm({ ...form, targetBatch: e.target.value })}
                    placeholder="e.g. 5" className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={sendMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Notification
            </button>
          </form>
        </FadeIn>
      </div>
    </FadeIn>
  );
}
