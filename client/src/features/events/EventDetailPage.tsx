import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { Calendar, MapPin, Users, Loader2, UserPlus, Star } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'motion/react';
import { FadeIn } from '@/components/reactbits';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

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

  const feedbackMutation = useMutation({
    mutationFn: () => api.post(`/events/${id}/feedback`, { rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id!) });
      setRating(0);
      setComment('');
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const event = data?.data;
  if (!event) return <p className="text-center py-12 text-muted-foreground">Event not found</p>;

  const isRegistered = event.registeredUsers?.includes(user?._id);
  const canRegister = isAuthenticated && event.registrationRequired && event.status === 'upcoming' && !isRegistered;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {event.coverImage && (
        <motion.img
          src={event.coverImage}
          alt=""
          className="w-full h-64 object-cover rounded-lg mb-6"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        />
      )}

      <FadeIn delay={0.1} direction="up">
        <h1 className="text-3xl font-bold mb-4">{event.title}</h1>
      </FadeIn>

      <FadeIn delay={0.2} direction="up">
        <div className="flex flex-wrap gap-4 mb-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(event.startDate).toLocaleDateString('en-US', { dateStyle: 'long' })}
            {event.endDate && ` - ${new Date(event.endDate).toLocaleDateString('en-US', { dateStyle: 'long' })}`}
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
        </div>
      </FadeIn>

      {canRegister && (
        <FadeIn delay={0.25} direction="up">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => registerMutation.mutate()}
            disabled={registerMutation.isPending}
            className="mb-6 flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Register for Event
          </motion.button>
        </FadeIn>
      )}

      {isRegistered && (
        <FadeIn delay={0.25} direction="up">
          <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-sm">
            You are registered for this event
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.3} direction="up">
        <div className="prose dark:prose-invert max-w-none mb-8">
          <p className="whitespace-pre-wrap">{event.description}</p>
        </div>
      </FadeIn>

      {/* Feedback form */}
      {event.feedbackEnabled && event.status === 'completed' && isAuthenticated && (
        <FadeIn delay={0.35} direction="up">
          <div className="border rounded-lg p-6 bg-background">
            <h3 className="font-semibold mb-4">Submit Feedback</h3>
            <div className="flex gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <motion.button
                  key={n}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setRating(n)}
                  className="p-1"
                >
                  <Star className={`h-6 w-6 ${n <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                </motion.button>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Share your thoughts..."
              className="w-full px-3 py-2 border rounded-md bg-background mb-3 focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => feedbackMutation.mutate()}
              disabled={!rating || feedbackMutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
            </motion.button>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
