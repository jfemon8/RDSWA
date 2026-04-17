import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { formatDate, formatTime } from '@/lib/date';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { Calendar, MapPin, Users, Loader2, UserPlus, Star, QrCode, CheckCircle2, Image, Clock, Bell, Building2 } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';
import UserEventQr from '@/components/ui/UserEventQr';
import Spinner from '@/components/ui/Spinner';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showPhotos, setShowPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.events.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/events/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const registerMutation = useMutation({
    mutationFn: () => api.post(`/events/${id}/register`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id!) }),
  });

  const selfCheckinMutation = useMutation({
    mutationFn: () => api.post(`/events/${id}/attendance/self`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id!) });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: () => api.post(`/events/${id}/feedback`, { rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id!) });
      setRating(0);
      setComment('');
    },
  });

  if (isLoading) {
    return <Spinner size="md" />;
  }

  const event = data?.data;
  if (!event) return <p className="text-center py-12 text-muted-foreground">Event not found</p>;

  const isRegistered = event.registeredUsers?.some?.((u: any) => (typeof u === 'string' ? u : u._id) === user?._id)
    || event.registeredUsers?.includes?.(user?._id);
  const canRegister = isAuthenticated && event.registrationRequired && event.status === 'upcoming' && !isRegistered;
  const myAttendance = event.attendance?.find?.((a: any) => (typeof a.user === 'string' ? a.user : a.user?._id) === user?._id);
  const isCheckedIn = myAttendance?.status === 'approved';
  const isPendingCheckin = myAttendance?.status === 'pending';
  const hasSubmittedFeedback = event.feedbacks?.some?.((f: any) => (typeof f.user === 'string' ? f.user : f.user?._id) === user?._id);
  const photos = event.photos || [];

  return (
    <div className="container mx-auto py-8">
      <SEO title={event.title} description={event.description?.slice(0, 160)} image={event.coverImage} />
      {event.coverImage && (
        <motion.img
          src={event.coverImage}
          alt=""
          className="w-full h-48 sm:h-64 object-cover rounded-lg mb-6"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        />
      )}

      <FadeIn delay={0.1} direction="up">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold">{event.title}</h1>
          <StatusBadge status={event.status} />
        </div>
      </FadeIn>

      <FadeIn delay={0.15} direction="up">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {formatDate(event.startDate, 'long')}
            {event.endDate && ` - ${formatDate(event.endDate, 'long')}`}
          </div>
          {event.venue && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {event.venue}
            </div>
          )}
          {event.registeredUsers && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {event.registeredUsers.length} registered
              {event.maxParticipants && ` / ${event.maxParticipants} max`}
            </div>
          )}
          {event.type && (
            <span className="capitalize px-2 py-0.5 bg-muted rounded text-xs">{event.type}</span>
          )}
          {event.committee && (
            <div className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              <span>Organized by </span>
              <Link to="/committee" className="text-primary hover:underline">
                {typeof event.committee === 'object' ? event.committee.name : 'Committee'}
              </Link>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Registration */}
      {canRegister && (
        <FadeIn delay={0.2} direction="up">
          <button
            onClick={() => registerMutation.mutate()}
            disabled={registerMutation.isPending}
            className="mb-6 flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Register for Event
          </button>
        </FadeIn>
      )}

      {isRegistered && (
        <FadeIn delay={0.2} direction="up">
          <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              You are registered for this event
              {myAttendance && (
                <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-800/30 rounded text-xs">
                  Checked in via {myAttendance.checkedInVia} at {formatTime(myAttendance.checkedInAt)}
                </span>
              )}
            </div>
            {event.status === 'upcoming' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-500"
              >
                <Bell className="h-3.5 w-3.5" />
                Event reminder will be sent 24 hours before the event starts
              </motion.div>
            )}
          </div>
        </FadeIn>
      )}

      {/* Per-user QR Code for check-in */}
      {event.status !== 'completed' && isRegistered && user && (
        <FadeIn delay={0.25} direction="up">
          <div className="mb-6 p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-3">
              <QrCode className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">Check-in QR Code</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Show this QR code at the venue for check-in</p>
            <div className="flex justify-center">
              <UserEventQr eventId={id!} userId={user._id} size={192} />
            </div>
          </div>
        </FadeIn>
      )}

      {/* Self Check-in */}
      {isAuthenticated && event && !['completed', 'cancelled'].includes(event.status) && (
        <FadeIn delay={0.3}>
          <div className="border rounded-xl p-4 bg-card mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Attendance</h3>
            {isCheckedIn ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">You are checked in</span>
              </div>
            ) : isPendingCheckin ? (
              <div className="flex items-center gap-2 text-amber-600">
                <Clock className="h-5 w-5" />
                <span className="text-sm font-medium">Check-in pending moderator approval</span>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => selfCheckinMutation.mutate()}
                disabled={selfCheckinMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {selfCheckinMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Request Check-in
              </motion.button>
            )}
            {selfCheckinMutation.isError && (
              <p className="text-xs text-red-500 mt-2">
                {(selfCheckinMutation.error as any)?.response?.data?.message || 'Check-in failed'}
              </p>
            )}
          </div>
        </FadeIn>
      )}

      {/* Description */}
      <FadeIn delay={0.3} direction="up">
        <div className="prose dark:prose-invert max-w-none mb-8">
          <RichContent html={event.description} />
        </div>
      </FadeIn>

      {/* Attendance Summary */}
      {event.attendance && event.attendance.length > 0 && (
        <FadeIn delay={0.35} direction="up">
          <div className="mb-8 p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Attendance</h3>
              <span className="text-sm text-muted-foreground">({event.attendance.length} checked in)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {event.attendance.slice(0, 10).map((a: any, i: number) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-2 py-1 bg-muted rounded-md text-xs"
                >
                  <Link to={`/members/${a.user?._id}`} className="hover:text-primary transition-colors">{a.user?.name || 'User'}</Link> • {a.checkedInVia}
                </motion.span>
              ))}
              {event.attendance.length > 10 && (
                <span className="px-2 py-1 text-xs text-muted-foreground">+{event.attendance.length - 10} more</span>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Event Photos */}
      {photos.length > 0 && (
        <FadeIn delay={0.4} direction="up">
          <div className="mb-8">
            <button
              onClick={() => setShowPhotos(!showPhotos)}
              className="flex items-center gap-2 mb-3 text-sm font-semibold hover:text-primary transition-colors"
            >
              <Image className="h-5 w-5" />
              Event Photos ({photos.length})
            </button>
            <AnimatePresence>
              {showPhotos && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="relative group cursor-pointer"
                        onClick={() => setSelectedPhoto(selectedPhoto === i ? null : i)}
                      >
                        <img
                          src={photo.url}
                          alt={photo.caption || ''}
                          className="w-full h-36 object-cover rounded-lg"
                        />
                        {photo.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                            {photo.caption}
                          </div>
                        )}
                        {photo.taggedUsers?.length > 0 && (
                          <span className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                            <Users className="h-2.5 w-2.5 inline mr-0.5" />{photo.taggedUsers.length}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </FadeIn>
      )}

      {/* Feedback form */}
      {event.feedbackEnabled && event.status === 'completed' && isAuthenticated && !hasSubmittedFeedback && (
        <FadeIn delay={0.45} direction="up">
          <div className="border rounded-lg p-6 bg-card mb-8">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Submit Feedback</h3>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className="p-1"
                >
                  <Star className={`h-6 w-6 ${n <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Share your thoughts..."
              className="w-full px-3 py-2 border rounded-md bg-background mb-3 focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <button
              onClick={() => feedbackMutation.mutate()}
              disabled={!rating || feedbackMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </FadeIn>
      )}

      {/* Already submitted feedback */}
      {hasSubmittedFeedback && (
        <FadeIn delay={0.45} direction="up">
          <div className="mb-8 p-3 bg-muted rounded-md text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            You have already submitted feedback for this event
          </div>
        </FadeIn>
      )}

      {/* Feedbacks list */}
      {event.feedbacks && event.feedbacks.length > 0 && (
        <FadeIn delay={0.5} direction="up">
          <div className="border rounded-lg p-6 bg-card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> Feedback ({event.feedbacks.length})</h3>
            <div className="space-y-3">
              {event.feedbacks.slice(0, 5).map((fb: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 bg-muted/50 rounded-md"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= fb.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      <Link to={`/members/${fb.user?._id}`} className="hover:text-primary transition-colors">{fb.user?.name || 'Anonymous'}</Link> • {formatDate(fb.submittedAt)}
                    </span>
                  </div>
                  {fb.comment && <p className="text-sm">{fb.comment}</p>}
                </motion.div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ongoing: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    draft: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap ${colors[status] || colors.upcoming}`}>
      {status}
    </span>
  );
}
