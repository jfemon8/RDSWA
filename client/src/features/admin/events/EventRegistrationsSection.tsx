import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  ClipboardList, Search, UserPlus, X, Loader2, FileDown, FileText,
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';
import { formatDate } from '@/lib/date';
import { downloadCsv } from '@/lib/downloadCsv';
import { downloadTablePdf } from '@/lib/downloadPdf';

const STATUSES = ['confirmed', 'waitlisted', 'interested', 'cancelled'] as const;

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  waitlisted: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  interested: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
};

/** Organiser view of who signed up for an event, with status control and CSV/PDF export. */
export default function EventRegistrationsSection({ event }: { event: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [memberSearch, setMemberSearch] = useState('');
  const [exporting, setExporting] = useState('');

  const eventId = event._id;
  const fields: any[] = event.registrationFields || [];

  const { data, isLoading } = useQuery({
    queryKey: ['event-registrations', eventId],
    queryFn: async () => (await api.get(`/events/${eventId}/registrations`)).data,
  });
  const registrations: any[] = data?.data || [];

  const { data: membersData } = useQuery({
    queryKey: ['users', 'members', 'search', memberSearch],
    queryFn: async () => (await api.get(`/users/members?search=${encodeURIComponent(memberSearch)}&limit=8`)).data,
    enabled: memberSearch.trim().length >= 2,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['event-registrations', eventId] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const addMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/events/${eventId}/registrations`, { userId }),
    onSuccess: () => { refresh(); setMemberSearch(''); toast.success('Registration added'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to add'),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { userId: string; status: string }) =>
      api.patch(`/events/${eventId}/registrations/${vars.userId}`, { status: vars.status }),
    onSuccess: () => { refresh(); toast.success('Status updated'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/events/${eventId}/registrations/${userId}`),
    onSuccess: () => { refresh(); toast.success('Registration removed'); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to remove'),
  });

  const runExport = async (kind: 'csv' | 'pdf') => {
    setExporting(kind);
    try {
      const csv = await downloadCsv(
        `/events/${eventId}/registrations/export`,
        `${event.title || 'event'}-registrations.csv`
      );
      if (kind === 'pdf') {
        await downloadTablePdf(csv, `${event.title} — Registrations`, `${event.title}-registrations`);
      }
      toast.success(kind === 'pdf' ? 'PDF download started' : 'CSV downloaded');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting('');
    }
  };

  const countOf = (status: string) => registrations.filter((r) => r.status === status).length;
  const registeredIds = new Set(registrations.map((r) => r.user?._id || r.user));

  return (
    <div className="md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
          <ClipboardList className="h-4 w-4 text-primary" /> Registrations ({registrations.length})
        </h4>
        <div className="flex gap-1.5">
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => runExport('csv')}
            disabled={!!exporting || registrations.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-xs hover:bg-accent disabled:opacity-50 text-foreground"
          >
            {exporting === 'csv' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            CSV
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => runExport('pdf')}
            disabled={!!exporting || registrations.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-md text-xs hover:bg-accent disabled:opacity-50 text-foreground"
          >
            {exporting === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            PDF
          </motion.button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {STATUSES.map((s) => (
          <span key={s} className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_STYLES[s]}`}>
            {countOf(s)} {s}
          </span>
        ))}
        {event.maxParticipants && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
            {countOf('confirmed')} / {event.maxParticipants} seats
          </span>
        )}
      </div>

      {/* Register a member on their behalf. */}
      <div className="mb-4 border rounded-lg p-3 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground mb-2">Add Registration</p>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Search members by name..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        {memberSearch.trim().length >= 2 && (membersData?.data || []).length > 0 && (
          <div className="max-h-40 overflow-y-auto space-y-1">
            {(membersData?.data || []).map((m: any) => {
              const already = registeredIds.has(m._id);
              return (
                <button
                  key={m._id}
                  type="button"
                  disabled={already || addMutation.isPending}
                  onClick={() => addMutation.mutate(m._id)}
                  className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-xs ${
                    already ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent'
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium text-foreground">{m.name}</span>
                  {m.batch && <span className="text-muted-foreground">Batch {m.batch}</span>}
                  {already && <span className="ml-auto text-green-600 text-[10px]">Already registered</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading registrations...</p>
      ) : registrations.length === 0 ? (
        <p className="text-xs text-muted-foreground">No one has registered yet.</p>
      ) : (
        <div className="space-y-1.5">
          {registrations.map((r, i) => {
            const u = r.user || {};
            const userId = u._id || r.user;
            return (
              <motion.div
                key={userId || i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="flex flex-wrap items-center gap-2 py-2 px-2.5 bg-muted rounded text-xs group"
              >
                <span className="font-medium text-foreground">{u.name || 'Unknown member'}</span>
                {u.department && <span className="text-muted-foreground">{u.department}</span>}
                {u.batch && <span className="text-muted-foreground">Batch {u.batch}</span>}

                <span className="text-muted-foreground">
                  {r.registeredAt ? formatDate(r.registeredAt) : 'Time not recorded'}
                </span>

                {fields.map((f) => r.responses?.[f.key] && (
                  <span key={f.key} className="text-muted-foreground">
                    {f.label}: <span className="text-foreground">{r.responses[f.key]}</span>
                  </span>
                ))}

                <select
                  value={r.status}
                  onChange={(e) => statusMutation.mutate({ userId, status: e.target.value })}
                  className={`ml-auto px-2 py-0.5 rounded-full text-[11px] font-medium capitalize border-0 outline-none cursor-pointer ${STATUS_STYLES[r.status]}`}
                >
                  {/* Options need their own colours, or they inherit the pill's tint and vanish against the dark popup. */}
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-card text-foreground">
                      {s}
                    </option>
                  ))}
                </select>

                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Remove Registration',
                      message: `Remove ${u.name || 'this member'} from the registration list?`,
                      confirmLabel: 'Remove',
                      variant: 'danger',
                    });
                    if (ok) removeMutation.mutate(userId);
                  }}
                  title="Remove registration"
                  className="p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
