import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { Send, Loader2, Bell, Radio } from 'lucide-react';

export default function AdminNotificationsPage() {
  const [type, setType] = useState<'broadcast' | 'targeted'>('targeted');
  const [form, setForm] = useState({ title: '', message: '', link: '', targetRole: '', targetBatch: '' });
  const [success, setSuccess] = useState('');

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
      setSuccess(data?.message || 'Notification sent!');
      setForm({ title: '', message: '', link: '', targetRole: '', targetBatch: '' });
    },
  });

  return (
    <FadeIn direction="up">
      <div>
        <h1 className="text-2xl font-bold mb-6">Send Notifications</h1>

        <div className="flex gap-4 mb-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setType('targeted')}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md border ${
              type === 'targeted' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
            }`}>
            <Bell className="h-4 w-4" /> Targeted
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setType('broadcast')}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md border ${
              type === 'broadcast' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
            }`}>
            <Radio className="h-4 w-4" /> Broadcast (All)
          </motion.button>
        </div>

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        <FadeIn direction="up" delay={0.1}>
          <form onSubmit={(e) => { e.preventDefault(); setSuccess(''); sendMutation.mutate(); }} className="max-w-xl space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={4}
                className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Link (optional)</label>
              <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/events/..."
                className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>

            {type === 'targeted' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Target Role</label>
                  <select value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm">
                    <option value="">All roles</option>
                    <option value="user">User</option>
                    <option value="member">Member</option>
                    <option value="alumni">Alumni</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Target Batch</label>
                  <input type="number" value={form.targetBatch} onChange={(e) => setForm({ ...form, targetBatch: e.target.value })}
                    placeholder="e.g. 5" className="w-full px-3 py-2 border rounded-md bg-background text-sm" />
                </div>
              </div>
            )}

            {sendMutation.isError && (
              <p className="text-sm text-red-600">{(sendMutation.error as any)?.response?.data?.message || 'Failed to send'}</p>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={sendMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Notification
            </motion.button>
          </form>
        </FadeIn>
      </div>
    </FadeIn>
  );
}
