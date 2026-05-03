import { useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageParam } from '@/hooks/usePageParam';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_HIERARCHY, UserRole } from '@rdswa/shared';
import {
  Megaphone, Plus, Loader2, User as UserIcon, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { formatDate } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import Promo from '@/components/promo/Promo';

const PROMO_EVERY = 6;

export default function AnnouncementsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = usePageParam();

  const isMod = user && ROLE_HIERARCHY.indexOf(user.role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', page],
    queryFn: async () => {
      const { data } = await api.get(`/communication/announcements?page=${page}&limit=20`);
      return data;
    },
  });

  const announcements = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <BlurText text="Announcements" className="text-xl sm:text-2xl md:text-3xl font-bold" delay={50} />
        {isMod && (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 bg-primary text-primary-foreground rounded-md text-sm w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="h-4 w-4 shrink-0" /> New Announcement
          </motion.button>
        )}
      </div>

      {/* Create Announcement Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CreateAnnouncementForm
              onCreated={() => {
                setShowCreate(false);
                queryClient.invalidateQueries({ queryKey: ['announcements'] });
              }}
              onCancel={() => setShowCreate(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Announcements list */}
      {isLoading ? (
        <Spinner size="md" />
      ) : announcements.length === 0 ? (
        <FadeIn direction="up">
          <div className="text-center py-12">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No announcements yet.</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann: any, i: number) => {
            // Parse title/content from the "**title**\n\ncontent" format
            const match = ann.content?.match(/^\*\*(.+?)\*\*\n\n([\s\S]*)$/);
            const title = match ? match[1] : 'Announcement';
            const body = match ? match[2] : ann.content;

            return (
              <Fragment key={ann._id}>
              <FadeIn delay={i * 0.04} direction="up" distance={15}>
                <motion.div
                  whileHover={{ y: -2 }}
                  className="bg-card border rounded-lg p-4 sm:p-5 overflow-hidden"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Megaphone className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm mb-1 break-words">{title}</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap [overflow-wrap:anywhere]">{body}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground pt-2 border-t flex-wrap">
                        <Link to={`/members/${ann.sender?._id}`} className="flex items-center gap-1 hover:text-primary transition-colors min-w-0">
                          <UserIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{ann.sender?.name || 'Unknown'}</span>
                        </Link>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Clock className="h-3 w-3 shrink-0" />
                          {formatDate(ann.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </FadeIn>
              {(i + 1) % PROMO_EVERY === 0 && i < announcements.length - 1 && (
                <Promo kind="infeed" minHeight={160} />
              )}
              </Fragment>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}
    </div>
  );
}

function CreateAnnouncementForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  const createMutation = useMutation({
    mutationFn: () => api.post('/communication/announcements', { title, content }),
    onSuccess: () => {
      toast.success('Announcement posted!');
      onCreated();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to post announcement');
    },
  });

  const handleSubmit = () => {
    setErrors({});
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!content.trim()) newErrors.content = 'Content is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    createMutation.mutate();
  };

  return (
    <div className="bg-card border rounded-lg p-5 mb-4">
      <h3 className="font-semibold mb-3">Post Announcement</h3>
      <p className="text-xs text-muted-foreground mb-3">This will be broadcast to all members via notifications.</p>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} noValidate className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="Announcement title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
            className={`w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.title ? 'border-red-500' : ''}`}
          />
          <FieldError message={errors.title} />
        </div>
        <div>
          <textarea
            placeholder="Announcement content..."
            value={content}
            onChange={(e) => { setContent(e.target.value); setErrors((prev) => { const { content, ...rest } = prev; return rest; }); }}
            rows={4}
            className={`w-full px-3 py-2 border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.content ? 'border-red-500' : ''}`}
          />
          <FieldError message={errors.content} />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md">
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
