import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDate, formatTime } from '@/lib/date';
import Spinner from '@/components/ui/Spinner';

export default function AttendanceHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['events', 'my-attendance'],
    queryFn: async () => {
      const { data } = await api.get('/events/my-attendance');
      return data;
    },
  });

  const records = data?.data || [];

  return (
    <div className="container mx-auto">
      <BlurText
        text="My Attendance History"
        className="text-2xl sm:text-3xl font-bold mb-6"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      {isLoading ? (
        <Spinner size="md" />
      ) : records.length === 0 ? (
        <FadeIn>
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No attendance records yet</p>
            <p className="text-xs text-muted-foreground mt-1">Your check-in history will appear here after attending events</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-3">
          {records.map((r: any, i: number) => (
            <FadeIn key={r._id} delay={i * 0.05} direction="up">
              <Link to={`/events/${r._id}`}>
                <div
                  className="border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium mb-1 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-primary shrink-0" /> {r.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(r.startDate)}
                        </div>
                        {r.venue && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{r.venue}</span>
                          </div>
                        )}
                        <span className="capitalize px-1.5 py-0.5 bg-muted rounded">{r.type}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <motion.div
                        className="flex items-center gap-1 text-green-600 dark:text-green-400"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.05 + 0.2 }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs font-medium">Attended</span>
                      </motion.div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        via {r.checkedInVia} • {formatTime(r.checkedInAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
