import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { BlurText, FadeIn } from '@/components/reactbits';
import { motion } from 'motion/react';
import {
  ArrowLeft, Briefcase, MapPin, Clock, ExternalLink, DollarSign,
  Loader2, FileText, CheckCircle, User, Users, CalendarX,
} from 'lucide-react';
import RichContent from '@/components/ui/RichContent';
import { formatDate } from '@/lib/date';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.jobs.detail(id || ''),
    queryFn: async () => {
      const { data } = await api.get(`/jobs/${id}`);
      return data.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <FadeIn delay={0.1} direction="up">
        <div className="text-center py-20">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Job Not Found</h2>
          <p className="text-muted-foreground mb-4">This job post doesn't exist or has been removed.</p>
          <button onClick={() => navigate(-1)} className="text-primary hover:underline">Go Back</button>
        </div>
      </FadeIn>
    );
  }

  const job = data;
  const expired = !!(job.deadline && new Date(job.deadline).getTime() < Date.now());

  return (
    <div className="container mx-auto py-6 md:py-12">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Job Board
      </button>

      {/* Header */}
      <FadeIn delay={0.05} direction="up">
        <div className={`relative border rounded-xl p-6 bg-card mb-6 overflow-hidden ${expired ? 'opacity-90' : ''}`}>
          {expired && (
            <div className="absolute top-0 right-0 pointer-events-none">
              <div className="bg-red-500 text-white text-xs font-bold px-10 py-1 rotate-45 translate-x-8 translate-y-4 shadow-md">
                Expired
              </div>
            </div>
          )}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <BlurText text={job.title} className="text-2xl font-bold mb-2" delay={40} />
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4" /> {job.company}
                </span>
                {job.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {job.location}
                  </span>
                )}
                {job.salary && (
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" /> BDT {job.salary}
                  </span>
                )}
                {typeof job.vacancy === 'number' && job.vacancy > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> {job.vacancy} vacancy
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">
                  {job.type?.replace('-', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Posted {formatDate(job.createdAt)}
                </span>
                {job.deadline && (
                  <span className={`flex items-center gap-1 text-xs ${expired ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                    <CalendarX className="h-3.5 w-3.5" /> Deadline {formatDate(job.deadline)}
                  </span>
                )}
              </div>
            </div>
            {job.applicationLink && (
              expired ? (
                <button
                  disabled
                  className="flex items-center gap-2 px-5 py-2.5 bg-muted text-muted-foreground rounded-lg text-sm font-medium shrink-0 cursor-not-allowed"
                  title="Application deadline has passed"
                >
                  <ExternalLink className="h-4 w-4" /> Expired
                </button>
              ) : (
                <motion.a
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  href={job.applicationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium shrink-0"
                >
                  <ExternalLink className="h-4 w-4" /> Apply
                </motion.a>
              )
            )}
          </div>
        </div>
      </FadeIn>

      {/* Description */}
      <FadeIn delay={0.1} direction="up">
        <div className="border rounded-xl p-6 bg-card mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Job Description</h3>
          <div className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none">
            <RichContent html={job.description} />
          </div>
        </div>
      </FadeIn>

      {/* Requirements */}
      {job.requirements?.length > 0 && (
        <FadeIn delay={0.15} direction="up">
          <div className="border rounded-xl p-6 bg-card mb-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Requirements</h3>
            <ul className="space-y-2">
              {job.requirements.map((req: string, i: number) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.03 }}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  {req}
                </motion.li>
              ))}
            </ul>
          </div>
        </FadeIn>
      )}

      {/* Posted By */}
      {job.postedBy && (
        <FadeIn delay={0.2} direction="up">
          <div className="border rounded-xl p-5 bg-card">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Posted By</h3>
            <Link
              to={`/members/${job.postedBy._id}`}
              className="flex items-center gap-3 hover:bg-accent p-2 -m-2 rounded-lg transition-colors"
            >
              {job.postedBy.avatar ? (
                <img src={job.postedBy.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {job.postedBy.name?.[0]}
                </div>
              )}
              <div>
                <p className="font-medium text-sm">{job.postedBy.name}</p>
                {job.postedBy.department && (
                  <p className="text-xs text-muted-foreground">{job.postedBy.department}</p>
                )}
              </div>
            </Link>
          </div>
        </FadeIn>
      )}

      {/* Bottom Apply Button */}
      {job.applicationLink && (
        <FadeIn delay={0.25} direction="up">
          <div className="mt-6 text-center">
            {expired ? (
              <button
                disabled
                className="inline-flex items-center gap-2 px-8 py-3 bg-muted text-muted-foreground rounded-lg font-medium cursor-not-allowed"
                title="Application deadline has passed"
              >
                <CalendarX className="h-4 w-4" /> Application Closed
              </button>
            ) : (
              <motion.a
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                href={job.applicationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium"
              >
                <ExternalLink className="h-4 w-4" /> Apply for this Position
              </motion.a>
            )}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
