import { useState, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_HIERARCHY, UserRole } from '@rdswa/shared';
import {
  Megaphone, Plus, Loader2, User as UserIcon, Clock, Pencil, Trash2, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { omitFieldError } from '@/lib/formErrors';
import { stripHtml } from '@/lib/stripHtml';
import { formatDate } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';
import InfiniteScrollSentinel from '@/components/ui/InfiniteScrollSentinel';
import Promo from '@/components/promo/Promo';
import RichTextEditor from '@/components/ui/RichTextEditor';
import ImageUpload from '@/components/ui/ImageUpload';
import { parseAnnouncement } from './announcementFormat';
import { useConfirm } from '@/components/ui/ConfirmModal';


const PROMO_EVERY = 6;

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isMod = user && ROLE_HIERARCHY.indexOf(user.role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);
  // An Admin can manage every announcement, while everyone else only manages their own.
  const isAdmin = !!user && ROLE_HIERARCHY.indexOf(user.role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.ADMIN);
  // Mirrors the server: Moderator+ only, and then an Admin for any of them or the author for their own.
  const canManage = (ann: any) => !!isMod && (isAdmin || ann.sender?._id === user?._id);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['announcements'] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/communication/announcements/${id}`),
    onSuccess: () => { refresh(); toast.success('Announcement deleted'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to delete'),
  });

  const {
    items: announcements,
    total,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteList({
    queryKey: ['announcements'],
    path: '/communication/announcements',
    limit: 20,
  });

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
            <AnnouncementForm
              onSaved={() => { setShowCreate(false); refresh(); }}
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
            const { title, body } = parseAnnouncement(ann.content);
            const image = ann.attachments?.find((a: any) => a.kind === 'image');

            if (editingId === ann._id) {
              return (
                <AnnouncementForm
                  key={ann._id}
                  announcement={{ _id: ann._id, title, content: body, image }}
                  onSaved={() => { setEditingId(null); refresh(); }}
                  onCancel={() => setEditingId(null)}
                />
              );
            }

            return (
              <Fragment key={ann._id}>
              <FadeIn delay={i * 0.04} direction="up" distance={15}>
                <motion.div
                  whileHover={{ y: -2 }}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/dashboard/announcements/${ann._id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/dashboard/announcements/${ann._id}`);
                    }
                  }}
                  className="bg-card border rounded-lg p-4 sm:p-5 overflow-hidden cursor-pointer hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Megaphone className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm mb-1 break-words">{title}</h3>
                        {canManage(ann) && (
                          <div className="flex shrink-0 -mt-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingId(ann._id); setShowCreate(false); }}
                              title="Edit announcement"
                              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await confirm({
                                  title: 'Delete Announcement',
                                  message: `Delete "${title}"? Members keep the notification they already received.`,
                                  confirmLabel: 'Delete',
                                  variant: 'danger',
                                });
                                if (ok) deleteMutation.mutate(ann._id);
                              }}
                              title="Delete announcement"
                              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-accent"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <Link
                          to={`/members/${ann.sender?._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:text-primary transition-colors min-w-0"
                        >
                          <UserIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{ann.sender?.name || 'Unknown'}</span>
                        </Link>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Clock className="h-3 w-3 shrink-0" />
                          {formatDate(ann.createdAt)}
                        </span>
                        {ann.isEdited && <span className="italic">edited</span>}
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

<InfiniteScrollSentinel
        hasNextPage={!!hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        endLabel={announcements.length > 0 ? `All ${total} announcements loaded` : undefined}
      />
    </div>
  );
}

function AnnouncementForm({
  announcement,
  onSaved,
  onCancel,
}: {
  announcement?: { _id: string; title: string; content: string; image?: any };
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(announcement?.title || '');
  const [content, setContent] = useState(announcement?.content || '');
  const [imageUrl, setImageUrl] = useState<string>(announcement?.image?.url || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();
  const isEdit = !!announcement;

  const saveMutation = useMutation({
    mutationFn: () => {
      // An empty URL clears the image on edit, which the server reads as an explicit removal.
      const payload = { title, content, image: imageUrl ? { url: imageUrl } : null };
      return isEdit
        ? api.patch(`/communication/announcements/${announcement._id}`, payload)
        : api.post('/communication/announcements', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Announcement updated' : 'Announcement posted!');
      onSaved();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save announcement');
    },
  });

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    // The editor emits an empty paragraph rather than an empty string when nothing is written.
    if (!stripHtml(content).trim()) newErrors.content = 'Content is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    saveMutation.mutate();
  };

  return (
    <div className="bg-card border rounded-lg p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{isEdit ? 'Edit Announcement' : 'Post Announcement'}</h3>
        {isEdit && (
          <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-accent text-muted-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {!isEdit && (
        <p className="text-xs text-muted-foreground mb-3">This will be broadcast to all members via notifications.</p>
      )}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} noValidate className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="Announcement title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors((prev) => omitFieldError(prev, 'title')); }}
            className={`w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.title ? 'border-red-500' : ''}`}
          />
          <FieldError message={errors.title} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Image (optional)</label>
          <ImageUpload value={imageUrl} onChange={setImageUrl} folder="announcements" />
        </div>
        <div>
          <RichTextEditor
            value={content}
            onChange={(v) => { setContent(v); setErrors((prev) => omitFieldError(prev, 'content')); }}
            placeholder="Announcement content..."
            minHeight="120px"
            error={!!errors.content}
          />
          <FieldError message={errors.content} />
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Save' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
