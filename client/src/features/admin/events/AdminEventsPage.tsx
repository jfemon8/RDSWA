import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageParam } from '@/hooks/usePageParam';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { formatDate, formatTime, toDateTimeLocal } from '@/lib/date';
import { queryKeys } from '@/lib/queryKeys';
import { Plus, Pencil, Trash2, QrCode, Users, Image, ChevronDown, ChevronUp, UserCheck, X, ScanLine, Star, MessageCircle, FileText, Search, Tag, Building2, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import ImageUpload from '@/components/ui/ImageUpload';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { useConfirm } from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import { deriveEventStatus } from '@rdswa/shared';

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = usePageParam();
  const [form, setForm] = useState({
    title: '', description: '', type: 'event', status: 'upcoming',
    startDate: '', endDate: '', venue: '', isOnline: false,
    registrationRequired: false, maxParticipants: '', feedbackEnabled: false,
    committee: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.events.list({ page: String(page) }),
    queryFn: async () => {
      const { data } = await api.get(`/events?page=${page}&limit=20`);
      return data;
    },
  });

  // Committees list for the "Event Organizing Committee" dropdown.
  const { data: committeesData } = useQuery({
    queryKey: queryKeys.committees.all,
    queryFn: async () => {
      const { data } = await api.get('/committees');
      return data;
    },
  });
  const committees: Array<{ _id: string; name: string; year?: string }> = committeesData?.data || [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (payload.maxParticipants) payload.maxParticipants = Number(payload.maxParticipants);
      else delete payload.maxParticipants;
      // Empty string would fail the ObjectId cast on the server; drop it so
      // the committee simply stays unset.
      if (!payload.committee) delete payload.committee;
      if (editId) return (await api.patch(`/events/${editId}`, payload)).data;
      return (await api.post('/events', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      resetForm();
      toast.success(editId ? 'Event updated' : 'Event created');
    },
    onError: (err: any) => { const fe = extractFieldErrors(err); if (fe) { setErrors(fe); } else { toast.error(err.response?.data?.message || 'Failed to save event'); } },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['events'] }); toast.success('Event deleted'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to delete event'); },
  });


  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ title: '', description: '', type: 'event', status: 'upcoming', startDate: '', endDate: '', venue: '', isOnline: false, registrationRequired: false, maxParticipants: '', feedbackEnabled: false, committee: '' });
  };

  const startEdit = (e: any) => {
    setEditId(e._id);
    setForm({
      title: e.title || '', description: e.description || '', type: e.type || 'event', status: e.status || 'upcoming',
      startDate: e.startDate ? toDateTimeLocal(e.startDate) : '',
      endDate: e.endDate ? toDateTimeLocal(e.endDate) : '',
      venue: e.venue || '', isOnline: e.isOnline || false,
      registrationRequired: e.registrationRequired || false,
      maxParticipants: e.maxParticipants ? String(e.maxParticipants) : '',
      feedbackEnabled: e.feedbackEnabled || false,
      committee: (typeof e.committee === 'object' ? e.committee?._id : e.committee) || '',
    });
    setShowForm(true);
  };

  const events = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Events</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 w-full sm:w-auto whitespace-nowrap"
        >
          <Plus className="h-4 w-4 shrink-0" /> New Event
        </button>
      </div>

      {/* Create/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-4 sm:p-5 bg-card mb-6">
              <h3 className="font-semibold mb-4 text-foreground">{editId ? 'Edit' : 'Create'} Event</h3>
              <form noValidate onSubmit={(e) => { e.preventDefault(); setErrors({}); const errs: Record<string, string> = {}; if (!form.title.trim()) errs.title = 'Event title is required'; if (!form.description.trim()) errs.description = 'Description is required'; if (!form.startDate) errs.startDate = 'Start date is required'; if (Object.keys(errs).length) { setErrors(errs); return; } saveMutation.mutate(); }} className="space-y-3">
                <div>
                  <input placeholder="Event Title" value={form.title} onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.title ? 'border-red-500' : ''}`} required />
                  <FieldError message={errors.title} />
                </div>
                <div>
                  <RichTextEditor value={form.description} onChange={(v) => { setForm({ ...form, description: v }); setErrors((prev) => { const { description, ...rest } = prev; return rest; }); }} placeholder="Event description..." minHeight="120px" />
                  <FieldError message={errors.description} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="event">Event</option>
                    <option value="meeting">Meeting</option>
                    <option value="workshop">Workshop</option>
                    <option value="seminar">Seminar</option>
                    <option value="social">Social</option>
                  </select>
                  <select
                    value={['draft', 'cancelled'].includes(form.status) ? form.status : 'upcoming'}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                    title="Upcoming / Ongoing / Completed are determined automatically from the event's start and end dates."
                  >
                    <option value="draft">Draft</option>
                    <option value="upcoming">Published</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Start Date</label>
                    <input type="datetime-local" value={form.startDate} onChange={(e) => { setForm({ ...form, startDate: e.target.value }); setErrors((prev) => { const { startDate, ...rest } = prev; return rest; }); }}
                      className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.startDate ? 'border-red-500' : ''}`} required />
                    <FieldError message={errors.startDate} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">End Date</label>
                    <input type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                  </div>
                </div>
                <input placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                <div>
                  <label className="text-xs text-muted-foreground">Event Organizing Committee</label>
                  <select
                    value={form.committee}
                    onChange={(e) => setForm({ ...form, committee: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                  >
                    <option value="">— None —</option>
                    {committees.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}{c.year ? ` (${c.year})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={form.registrationRequired} onChange={(e) => setForm({ ...form, registrationRequired: e.target.checked })} />
                    Registration Required
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={form.feedbackEnabled} onChange={(e) => setForm({ ...form, feedbackEnabled: e.target.checked })} />
                    Enable Feedback
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={form.isOnline} onChange={(e) => setForm({ ...form, isOnline: e.target.checked })} />
                    Online Event
                  </label>
                </div>
                {form.registrationRequired && (
                  <input type="number" placeholder="Max Participants (optional)" value={form.maxParticipants}
                    onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
                    className="w-full sm:w-48 px-3 py-2 border rounded-md bg-card text-foreground text-sm" />
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Create'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground">Cancel</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events List */}
      {isLoading ? (
        <Spinner size="md" />
      ) : events.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No events found</p>
      ) : (
        <div className="space-y-2">
          {events.map((e: any, i: number) => (
            <FadeIn key={e._id} direction="up" delay={i * 0.06}>
              <div
                className="border rounded-lg bg-card"
              >
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-primary shrink-0" /> {e.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="capitalize">{e.type}</span>
                      <span className="capitalize">{deriveEventStatus(e)}</span>
                      <span>{formatDate(e.startDate)}</span>
                      {e.venue && <span className="truncate max-w-[160px]">{e.venue}</span>}
                      {e.committee && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                          <Building2 className="h-3 w-3" />
                          {typeof e.committee === 'object' ? e.committee.name : 'Committee'}
                        </span>
                      )}
                      {e.registeredUsers && <span>{e.registeredUsers.length} registered</span>}
                      {e.attendance && <span>{e.attendance.length} attended</span>}
                      {e.registeredUsers?.length > 0 && <span className="text-green-600">QR ready</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 items-center">
                    <Link to={`/admin/events/${e._id}/checkin`}>
                      <div
                        className="p-2 hover:bg-accent rounded"
                        title="Check-in Scanner"
                      >
                        <ScanLine className="h-4 w-4 text-foreground" />
                      </div>
                    </Link>
                    <button
                      onClick={() => setExpandedId(expandedId === e._id ? null : e._id)}
                      className="p-2 hover:bg-accent rounded"
                      title="Details"
                    >
                      {expandedId === e._id ? <ChevronUp className="h-4 w-4 text-foreground" /> : <ChevronDown className="h-4 w-4 text-foreground" />}
                    </button>
                    <button
                      onClick={() => startEdit(e)}
                      className="p-2 hover:bg-accent rounded"
                    >
                      <Pencil className="h-4 w-4 text-foreground" />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: 'Delete Event', message: `Delete "${e.title}"? All registrations and attendance records will be removed. This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
                        if (ok) deleteMutation.mutate(e._id);
                      }}
                      className="p-2 hover:bg-destructive/10 text-destructive rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded detail panel */}
                <AnimatePresence>
                  {expandedId === e._id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden border-t"
                    >
                      <EventDetailPanel event={e} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={page} totalPages={pagination.totalPages} onChange={setPage} />
      )}
    </div>
  );
}

/** Expanded panel for each event — shows QR, attendance list, photos management */
function EventDetailPanel({ event }: { event: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [reportName, setReportName] = useState('');
  const [reportUrl, setReportUrl] = useState('');

  // Fetch full event detail
  const { data } = useQuery({
    queryKey: queryKeys.events.detail(event._id),
    queryFn: async () => {
      const { data } = await api.get(`/events/${event._id}`);
      return data;
    },
  });

  const fullEvent = data?.data || event;

  const { data: membersData } = useQuery({
    queryKey: ['users', 'members', 'search', memberSearch],
    queryFn: async () => {
      const { data } = await api.get(`/users/members?search=${memberSearch}&limit=10`);
      return data;
    },
    enabled: memberSearch.length >= 2,
  });

  const addPhotoMutation = useMutation({
    mutationFn: () => api.post(`/events/${event._id}/photos`, { url: photoUrl, caption: photoCaption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) });
      setPhotoUrl('');
      setPhotoCaption('');
      toast.success('Photo added');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to add photo'); },
  });

  const removePhotoMutation = useMutation({
    mutationFn: (index: number) => api.delete(`/events/${event._id}/photos/${index}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) }); toast.success('Photo removed'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to remove photo'); },
  });

  const tagPhotoMutation = useMutation({
    mutationFn: (vars: { photoIndex: number; userIds: string[] }) =>
      api.post(`/events/${event._id}/photos/${vars.photoIndex}/tag`, { userIds: vars.userIds }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) }); toast.success('Users tagged'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to tag users'); },
  });

  const untagPhotoMutation = useMutation({
    mutationFn: (vars: { photoIndex: number; userId: string }) =>
      api.delete(`/events/${event._id}/photos/${vars.photoIndex}/tag`, { data: { userId: vars.userId } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) }); toast.success('Tag removed'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to remove tag'); },
  });

  const removeAttendanceMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/events/${event._id}/attendance/${userId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) }); toast.success('Attendance removed'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to remove'); },
  });

  const bulkAttendanceMutation = useMutation({
    mutationFn: (userIds: string[]) => api.post(`/events/${event._id}/attendance/bulk`, { userIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) });
      setSelectedUserIds(new Set());
      setMemberSearch('');
      toast.success('Attendance recorded');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  const approveAttendanceMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/events/${event._id}/attendance/${userId}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) }); toast.success('Approved'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  const rejectAttendanceMutation = useMutation({
    mutationFn: (userId: string) => api.patch(`/events/${event._id}/attendance/${userId}/reject`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) }); toast.success('Rejected'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  const addReportMutation = useMutation({
    mutationFn: (report: { name: string; url: string }) => api.post(`/events/${event._id}/reports`, report),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) });
      setReportName('');
      setReportUrl('');
      toast.success('Report uploaded');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  const removeReportMutation = useMutation({
    mutationFn: (index: number) => api.delete(`/events/${event._id}/reports/${index}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) }); toast.success('Report removed'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed'); },
  });

  const photos = fullEvent.photos || [];
  const attendance = fullEvent.attendance || [];
  const reports = fullEvent.reports || [];

  return (
    <div className="p-4 space-y-6">
      {/* Event Meta — mirrors the public detail view so admins see the same
          committee / venue / schedule context while managing the event. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pb-3 border-b">
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(fullEvent.startDate)} {formatTime(fullEvent.startDate)}
          {fullEvent.endDate && ` – ${formatDate(fullEvent.endDate)}`}
        </span>
        {fullEvent.venue && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {fullEvent.venue}
          </span>
        )}
        {fullEvent.committee && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            <span>Organized by </span>
            <span className="text-foreground font-medium">
              {typeof fullEvent.committee === 'object' ? fullEvent.committee.name : 'Committee'}
            </span>
          </span>
        )}
        {fullEvent.type && (
          <span className="capitalize px-2 py-0.5 bg-muted rounded">{fullEvent.type}</span>
        )}
      </div>

      {/* QR Code Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <QrCode className="h-4 w-4 text-primary" /> QR Check-in
          </h4>
          <p className="text-xs text-muted-foreground">Each registered user gets a unique QR code on the event page. Use the scanner to check them in.</p>
          <Link
            to={`/admin/events/${fullEvent._id}/checkin`}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90"
          >
            <ScanLine className="h-3.5 w-3.5" /> Open Scanner
          </Link>
        </div>

        {/* Attendance Section */}
        <div className="md:col-span-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3 text-foreground">
            <Users className="h-4 w-4 text-primary" /> Attendance ({attendance.filter((a: any) => a.status === 'approved').length} approved, {attendance.filter((a: any) => a.status === 'pending').length} pending)
          </h4>

          {/* Member search + bulk check-in */}
          <div className="mb-4 border rounded-lg p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">Add Attendance</p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Search members by name..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {memberSearch.length >= 2 && (membersData?.data || []).length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                {(membersData?.data || []).map((m: any) => {
                  const alreadyIn = attendance.some((a: any) => (a.user?._id || a.user) === m._id);
                  return (
                    <label
                      key={m._id}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded text-xs cursor-pointer transition-colors ${
                        alreadyIn ? 'opacity-40 cursor-not-allowed' : selectedUserIds.has(m._id) ? 'bg-primary/10' : 'hover:bg-accent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={alreadyIn}
                        checked={selectedUserIds.has(m._id)}
                        onChange={(e) => {
                          const next = new Set(selectedUserIds);
                          if (e.target.checked) next.add(m._id);
                          else next.delete(m._id);
                          setSelectedUserIds(next);
                        }}
                        className="rounded"
                      />
                      <span className="font-medium text-foreground">{m.name}</span>
                      {m.batch && <span className="text-muted-foreground">Batch {m.batch}</span>}
                      {m.department && <span className="text-muted-foreground">· {m.department}</span>}
                      {alreadyIn && <span className="ml-auto text-green-600 text-[10px]">Already in</span>}
                    </label>
                  );
                })}
              </div>
            )}

            {selectedUserIds.size > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => bulkAttendanceMutation.mutate([...selectedUserIds])}
                disabled={bulkAttendanceMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5" />
                {bulkAttendanceMutation.isPending ? 'Processing...' : `Check In ${selectedUserIds.size} Selected`}
              </motion.button>
            )}
          </div>

          {/* Pending attendance requests */}
          {attendance.filter((a: any) => a.status === 'pending').length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">Pending Requests</p>
              <div className="space-y-1">
                {attendance.filter((a: any) => a.status === 'pending').map((a: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between py-1.5 px-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded text-xs"
                  >
                    <span className="text-foreground">{a.user?.name || 'Unknown'}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground mr-2">{formatTime(a.checkedInAt)}</span>
                      <button
                        onClick={() => approveAttendanceMutation.mutate(a.user?._id || a.user)}
                        className="px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 text-[10px]"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await confirm({ title: 'Reject Attendance', message: `Reject the attendance request from ${a.user?.name || 'this user'}?`, confirmLabel: 'Reject', variant: 'danger' });
                          if (ok) rejectAttendanceMutation.mutate(a.user?._id || a.user);
                        }}
                        className="px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 text-[10px]"
                      >
                        Reject
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Approved attendance list */}
          {attendance.filter((a: any) => a.status !== 'pending').length > 0 ? (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {attendance.filter((a: any) => a.status !== 'pending').map((a: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between py-1.5 px-2 bg-muted rounded text-xs group"
                >
                  <span className="text-foreground">{a.user?.name || a.user || 'Unknown'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {a.checkedInVia} • {formatTime(a.checkedInAt)}
                    </span>
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: 'Remove Attendance', message: `Remove attendance record for ${a.user?.name || 'this user'}?`, confirmLabel: 'Remove', variant: 'danger' });
                        if (ok) removeAttendanceMutation.mutate(a.user?._id || a.user);
                      }}
                      title="Remove attendance"
                      className="p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No attendance records yet</p>
          )}
        </div>
      </div>

      {/* Photos Management */}
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
          <Image className="h-4 w-4 text-primary" /> Photos ({photos.length})
        </h4>

        {/* Add photo form */}
        <div className="space-y-2 mb-3">
          <ImageUpload
            value={photoUrl}
            onChange={(url) => setPhotoUrl(url)}
            folder="events"
            label="Upload Photo (max 5MB)"
          />
          {photoUrl && (
            <div className="flex gap-2">
              <input
                placeholder="Caption (optional)"
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                className="flex-1 px-3 py-1.5 border rounded-md bg-card text-foreground text-sm"
              />
              <button
                onClick={() => addPhotoMutation.mutate()}
                disabled={addPhotoMutation.isPending}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 disabled:opacity-50"
              >
                {addPhotoMutation.isPending ? '...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo: any, i: number) => (
              <PhotoCard
                key={i}
                photo={photo}
                index={i}
                onRemove={async () => {
                  const ok = await confirm({ title: 'Remove Photo', message: 'Remove this photo from the event? This cannot be undone.', confirmLabel: 'Remove', variant: 'danger' });
                  if (ok) removePhotoMutation.mutate(i);
                }}
                onTag={(userIds) => tagPhotoMutation.mutate({ photoIndex: i, userIds })}
                onUntag={(userId) => untagPhotoMutation.mutate({ photoIndex: i, userId })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reports / Documents */}
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
          <FileText className="h-4 w-4 text-primary" /> Activity Reports ({reports.length})
        </h4>

        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <input
            placeholder="Report name"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            className="flex-1 px-3 py-1.5 border rounded-md bg-card text-foreground text-sm"
          />
          <input
            placeholder="Document URL"
            value={reportUrl}
            onChange={(e) => setReportUrl(e.target.value)}
            className="flex-1 px-3 py-1.5 border rounded-md bg-card text-foreground text-sm"
          />
          <button
            onClick={() => reportName && reportUrl && addReportMutation.mutate({ name: reportName, url: reportUrl })}
            disabled={!reportName || !reportUrl || addReportMutation.isPending}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 disabled:opacity-50"
          >
            {addReportMutation.isPending ? '...' : 'Upload'}
          </button>
        </div>

        {reports.length > 0 && (
          <div className="space-y-1">
            {reports.map((r: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between py-1.5 px-2 bg-muted rounded text-xs group"
              >
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">
                  {r.name}
                </a>
                <button
                  onClick={async () => {
                    const ok = await confirm({ title: 'Remove Report', message: `Remove report "${r.name}"?`, confirmLabel: 'Remove', variant: 'danger' });
                    if (ok) removeReportMutation.mutate(i);
                  }}
                  className="p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback Review */}
      {fullEvent.feedbackEnabled && (
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <MessageCircle className="h-4 w-4 text-primary" /> Feedback ({(fullEvent.feedback || []).length})
          </h4>

          {/* Stats Summary */}
          {(fullEvent.feedback || []).length > 0 && (
            <div className="flex flex-col sm:flex-row gap-4 mb-3">
              <div className="border rounded-lg px-3 py-2 bg-muted/30">
                <span className="text-xs text-muted-foreground">Avg Rating</span>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-foreground">
                    {((fullEvent.feedback || []).reduce((sum: number, f: any) => sum + (f.rating || 0), 0) / (fullEvent.feedback || []).length).toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 5</span>
                </div>
              </div>
              <div className="border rounded-lg px-3 py-2 bg-muted/30">
                <span className="text-xs text-muted-foreground">Responses</span>
                <p className="font-bold text-foreground">{(fullEvent.feedback || []).length}</p>
              </div>
              {/* Rating distribution */}
              <div className="border rounded-lg px-3 py-2 bg-muted/30 flex-1">
                <span className="text-xs text-muted-foreground mb-1 block">Distribution</span>
                <div className="flex items-end gap-1 h-6">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = (fullEvent.feedback || []).filter((f: any) => f.rating === star).length;
                    const total = (fullEvent.feedback || []).length;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div key={star} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full bg-yellow-400/80 rounded-sm" style={{ height: `${Math.max(pct * 0.24, 2)}px` }} />
                        <span className="text-[9px] text-muted-foreground">{star}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Feedback List */}
          {(fullEvent.feedback || []).length > 0 ? (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {(fullEvent.feedback || []).map((fb: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border rounded-md p-3 bg-muted/20"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{fb.user?.name || 'Anonymous'}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-3 w-3 ${s <= (fb.rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {fb.createdAt ? formatDate(fb.createdAt) : ''}
                    </span>
                  </div>
                  {fb.comment && <p className="text-sm text-muted-foreground">{fb.comment}</p>}
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No feedback submitted yet</p>
          )}
        </div>
      )}
    </div>
  );
}

/** A single photo tile with hover-actions for tagging users + removing. */
function PhotoCard({
  photo, index, onRemove, onTag, onUntag,
}: {
  photo: any;
  index: number;
  onRemove: () => void;
  onTag: (userIds: string[]) => void;
  onUntag: (userId: string) => void;
}) {
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [search, setSearch] = useState('');

  const taggedUsers: any[] = photo.taggedUsers || [];
  const taggedIds = new Set(taggedUsers.map((u) => (typeof u === 'object' ? u._id : u)));

  const { data: searchData } = useQuery({
    queryKey: ['users', 'members', 'tag-search', search],
    queryFn: async () => {
      const { data } = await api.get(`/users/members?search=${encodeURIComponent(search)}&limit=8`);
      return data;
    },
    enabled: showTagPanel && search.length >= 2,
  });

  const candidates: any[] = (searchData?.data || []).filter((u: any) => !taggedIds.has(u._id));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className="relative group border rounded-md overflow-hidden bg-background"
    >
      <div className="relative">
        <img src={photo.url} alt={photo.caption || ''} className="w-full h-28 object-cover" />
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowTagPanel((v) => !v)}
            title="Tag users"
            className={`p-1 rounded-full text-white ${showTagPanel ? 'bg-primary' : 'bg-black/60 hover:bg-black/80'}`}
          >
            <Tag className="h-3 w-3" />
          </button>
          <button
            onClick={onRemove}
            title="Remove photo"
            className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        {taggedUsers.length > 0 && (
          <div className="absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-[10px]">
            <Users className="h-2.5 w-2.5" /> {taggedUsers.length}
          </div>
        )}
      </div>

      <div className="p-1.5 space-y-1">
        {photo.caption && (
          <p className="text-[10px] text-muted-foreground truncate">{photo.caption}</p>
        )}

        {/* Tagged users pills */}
        {taggedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {taggedUsers.map((u: any, i: number) => {
              const id = typeof u === 'object' ? u._id : u;
              const name = typeof u === 'object' ? u.name : id;
              return (
                <motion.span
                  key={id || i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded-full bg-primary/10 text-primary"
                >
                  {name}
                  <button
                    onClick={() => onUntag(id)}
                    className="hover:text-destructive"
                    title="Remove tag"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </motion.span>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showTagPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t bg-muted/30"
          >
            <div className="p-2 space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full pl-7 pr-2 py-1 border rounded bg-card text-foreground text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
              {search.length >= 2 && candidates.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-1">No matches</p>
              )}
              {candidates.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {candidates.map((m: any) => (
                    <button
                      key={m._id}
                      onClick={() => { onTag([m._id]); setSearch(''); }}
                      className="w-full flex items-center gap-1.5 px-1.5 py-1 text-[11px] text-left text-foreground hover:bg-accent rounded"
                    >
                      {m.avatar ? (
                        <img src={m.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-semibold">
                          {m.name?.[0]}
                        </div>
                      )}
                      <span className="truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
