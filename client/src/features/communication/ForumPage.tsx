import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import {
  MessageSquare, Plus, Pin, Lock, Loader2, Search,
  ChevronRight, User as UserIcon, Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { FieldError } from '@/components/ui/FieldError';
import { formatDate as formatDateUtil } from '@/lib/date';
import { useToast } from '@/components/ui/Toast';

const CATEGORIES = ['General', 'Academic', 'Events', 'Career', 'Help', 'Off-Topic'];

export default function ForumPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['forum-topics', page, filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterCategory) params.set('category', filterCategory);
      const { data } = await api.get(`/communication/forum?${params}`);
      return data;
    },
  });

  const topics = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const filteredTopics = search
    ? topics.filter((t: any) => t.title.toLowerCase().includes(search.toLowerCase()))
    : topics;

  return (
    <div className="container mx-auto">
      <div className="flex items-center justify-between mb-6">
        <BlurText text="Discussion Forum" className="text-2xl sm:text-3xl font-bold" delay={50} />
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
        >
          <Plus className="h-4 w-4" /> New Topic
        </button>
      </div>

      {/* Create Topic Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CreateTopicForm
              onCreated={() => {
                setShowCreate(false);
                queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
              }}
              onCancel={() => setShowCreate(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <FadeIn delay={0.05} direction="up" distance={15}>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search topics..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterCategory('')}
              className={`px-3 py-1.5 rounded-md text-xs ${
                !filterCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs ${
                  filterCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Topic List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTopics.length === 0 ? (
        <FadeIn direction="up">
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No topics yet. Start a discussion!</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-2">
          {filteredTopics.map((topic: any, i: number) => (
            <FadeIn key={topic._id} delay={i * 0.03} direction="up" distance={15}>
              <Link to={`/dashboard/forum/${topic._id}`}>
                <div
                  className="p-4 rounded-lg border bg-card hover:bg-accent flex items-center gap-4 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {topic.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
                      {topic.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                        {topic.category || 'General'}
                      </span>
                    </div>
                    <h3 className="font-medium text-sm truncate">{topic.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {topic.author?.name || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {topic.replyCount || 0} replies
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(topic.lastReplyAt || topic.createdAt)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-8 h-8 rounded-md text-sm ${
                page === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTopicForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  const createMutation = useMutation({
    mutationFn: () => api.post('/communication/forum', { title, content, category }),
    onSuccess: () => {
      toast.success('Topic created successfully!');
      onCreated();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create topic');
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
      <h3 className="font-semibold mb-3">Create New Topic</h3>
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} noValidate className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="Topic title"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors((prev) => { const { title, ...rest } = prev; return rest; }); }}
            className={`w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.title ? 'border-red-500' : ''}`}
          />
          <FieldError message={errors.title} />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div>
          <textarea
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => { setContent(e.target.value); setErrors((prev) => { const { content, ...rest } = prev; return rest; }); }}
            rows={4}
            className={`w-full px-3 py-2 border rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.content ? 'border-red-500' : ''}`}
          />
          <FieldError message={errors.content} />
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-md"
          >
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateUtil(d);
}
