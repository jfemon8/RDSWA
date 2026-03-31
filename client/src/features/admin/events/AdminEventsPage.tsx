import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { FieldError } from '@/components/ui/FieldError';
import { extractFieldErrors } from '@/lib/formErrors';
import { formatDate, formatTime, toDateTimeLocal } from '@/lib/date';
import { queryKeys } from '@/lib/queryKeys';
import { Plus, Loader2, Pencil, Trash2, QrCode, Users, Image, ChevronDown, ChevronUp, UserCheck, X, ScanLine, Star, MessageCircle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import ImageUpload from '@/components/ui/ImageUpload';
import RichTextEditor from '@/components/ui/RichTextEditor';

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    title: '', description: '', type: 'event', status: 'draft',
    startDate: '', endDate: '', venue: '', isOnline: false,
    registrationRequired: false, maxParticipants: '', feedbackEnabled: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.events.list({ page: String(page) }),
    queryFn: async () => {
      const { data } = await api.get(`/events?page=${page}&limit=20`);
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      if (payload.maxParticipants) payload.maxParticipants = Number(payload.maxParticipants);
      else delete payload.maxParticipants;
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

  const qrMutation = useMutation({
    mutationFn: (id: string) => api.post(`/events/${id}/qr`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['events'] }); toast.success('QR code generated'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to generate QR code'); },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ title: '', description: '', type: 'event', status: 'draft', startDate: '', endDate: '', venue: '', isOnline: false, registrationRequired: false, maxParticipants: '', feedbackEnabled: false });
  };

  const startEdit = (e: any) => {
    setEditId(e._id);
    setForm({
      title: e.title || '', description: e.description || '', type: e.type || 'event', status: e.status || 'draft',
      startDate: e.startDate ? toDateTimeLocal(e.startDate) : '',
      endDate: e.endDate ? toDateTimeLocal(e.endDate) : '',
      venue: e.venue || '', isOnline: e.isOnline || false,
      registrationRequired: e.registrationRequired || false,
      maxParticipants: e.maxParticipants ? String(e.maxParticipants) : '',
      feedbackEnabled: e.feedbackEnabled || false,
    });
    setShowForm(true);
  };

  const events = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Events</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Event
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
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="px-3 py-2 border rounded-md bg-card text-foreground text-sm">
                    <option value="draft">Draft</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
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
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
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
                    <h3 className="font-medium text-foreground">{e.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="capitalize">{e.type}</span>
                      <span className="capitalize">{e.status}</span>
                      <span>{formatDate(e.startDate)}</span>
                      {e.registeredUsers && <span>{e.registeredUsers.length} registered</span>}
                      {e.attendance && <span>{e.attendance.length} attended</span>}
                      {e.qrCode && <span className="text-green-600">QR ✓</span>}
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
                      onClick={() => qrMutation.mutate(e._id)}
                      disabled={qrMutation.isPending}
                      className="p-2 hover:bg-accent rounded"
                      title="Generate QR Code"
                    >
                      <QrCode className="h-4 w-4 text-foreground" />
                    </button>
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
                      onClick={() => deleteMutation.mutate(e._id)}
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
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 text-foreground">Prev</button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 text-foreground">Next</button>
        </div>
      )}
    </div>
  );
}

/** Expanded panel for each event — shows QR, attendance list, photos management */
function EventDetailPanel({ event }: { event: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [manualUserId, setManualUserId] = useState('');
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

  const checkinMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/events/${event._id}/checkin`, { userId, method: 'manual' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setManualUserId('');
      toast.success('User checked in');
    },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Check-in failed'); },
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

  const removeAttendanceMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/events/${event._id}/attendance/${userId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(event._id) }); toast.success('Attendance removed'); },
    onError: (err: any) => { toast.error(err.response?.data?.message || 'Failed to remove'); },
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
      {/* QR Code Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <QrCode className="h-4 w-4 text-primary" /> QR Code
          </h4>
          {fullEvent.qrCode ? (
            <motion.img
              src={fullEvent.qrCode}
              alt="QR Code"
              className="w-40 h-40 border rounded-lg"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            />
          ) : (
            <p className="text-xs text-muted-foreground">No QR code generated. Click the QR icon above to generate one.</p>
          )}
        </div>

        {/* Attendance Section */}
        <div className="md:col-span-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2 text-foreground">
            <Users className="h-4 w-4 text-primary" /> Attendance ({attendance.length})
          </h4>

          {/* Manual check-in */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              placeholder="User ID for manual check-in"
              value={manualUserId}
              onChange={(e) => setManualUserId(e.target.value)}
              className="flex-1 px-3 py-1.5 border rounded-md bg-card text-foreground text-sm"
            />
            <button
              onClick={() => manualUserId && checkinMutation.mutate(manualUserId)}
              disabled={!manualUserId || checkinMutation.isPending}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 disabled:opacity-50"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {checkinMutation.isPending ? '...' : 'Check In'}
            </button>
          </div>

          {attendance.length > 0 ? (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {attendance.map((a: any, i: number) => (
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
                      onClick={() => removeAttendanceMutation.mutate(a.user?._id || a.user)}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {photos.map((photo: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="relative group"
              >
                <img src={photo.url} alt={photo.caption || ''} className="w-full h-24 object-cover rounded" />
                <button
                  onClick={() => removePhotoMutation.mutate(i)}
                  className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
                {photo.caption && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{photo.caption}</p>
                )}
              </motion.div>
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
                  onClick={() => removeReportMutation.mutate(i)}
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
