import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Loader2 } from 'lucide-react';
import MessageBubble, { type ChatMessage } from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import ImageLightbox from './ImageLightbox';
import { formatDateCustom } from '@/lib/date';

type ListImage = { url: string; name?: string };

interface Props {
  messages: ChatMessage[];
  isLoading?: boolean;
  isGroup: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  canPin?: boolean;
  /** Set of currently typing user display names */
  typingNames?: string[];
  /** Set of message IDs whose read status should render as "delivered & read" */
  readMessageIds?: Set<string>;
  /** Handlers forwarded to each bubble */
  onReply: (msg: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onForward: (msg: ChatMessage) => void;
  onStar: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onEdit: (msg: ChatMessage) => void;
  onDeleteEveryone: (messageId: string) => void;
  onDeleteForMe: (messageId: string) => void;
  /** Called when messages are actually visible — used to post read receipts */
  onVisibleMessages?: (messageIds: string[]) => void;
  /** Cursor pagination — called when the user scrolls near the top */
  onLoadOlder?: () => void;
  hasMore?: boolean;
  isLoadingOlder?: boolean;
  editingId: string | null;
  editContent: string;
  setEditContent: (s: string) => void;
  setEditingId: (id: string | null) => void;
  onSubmitEdit: (messageId: string, content: string) => void;
}

/** Consecutive messages from the same sender within 5 minutes are grouped. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return formatDateCustom(d.toISOString(), { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * The main scrollable message area. Handles:
 *  - Empty / loading states
 *  - Date separators ("Today", "Yesterday", "Mon, 12 Mar")
 *  - Consecutive sender grouping (skip avatar/name for rapid follow-ups)
 *  - Auto-scroll to bottom on new messages (unless user scrolled up)
 *  - Scroll-to-bottom button when the user is scrolled up
 *  - Older-messages loader when scrolled to top
 *  - Read-receipt reporter (IntersectionObserver)
 *  - Global image lightbox
 */
export default function MessageList(props: Props) {
  const {
    messages, isLoading, typingNames = [], onLoadOlder, hasMore, isLoadingOlder,
    onVisibleMessages,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [lightbox, setLightbox] = useState<{ images: ListImage[]; index: number } | null>(null);
  const lastCountRef = useRef(0);
  // Track whether we've already done the initial jump-to-bottom for the
  // current conversation. Resets when the first message ID changes (i.e. the
  // user switches to a different chat).
  const initialScrollDoneRef = useRef(false);
  const firstMessageIdRef = useRef<string | null>(null);

  // Collect all images in order — used to power the lightbox "carousel".
  const allImages: ListImage[] = useMemo(() => {
    const acc: ListImage[] = [];
    for (const m of messages) {
      for (const a of m.attachments || []) {
        if (a.kind === 'image' && a.url && !a.expired) {
          acc.push({ url: a.url, name: a.name });
        }
      }
    }
    return acc;
  }, [messages]);

  const handleImageClick = useCallback((url: string) => {
    const idx = allImages.findIndex((i) => i.url === url);
    if (idx >= 0) setLightbox({ images: allImages, index: idx });
  }, [allImages]);

  // Detect conversation switch (first message ID changes) and reset scroll state.
  const currentFirstId = messages[0]?._id || null;
  if (currentFirstId !== firstMessageIdRef.current) {
    firstMessageIdRef.current = currentFirstId;
    initialScrollDoneRef.current = false;
    lastCountRef.current = 0;
  }

  /** Imperative jump to the bottom — works even with images that load later. */
  const jumpToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    // Run again on next frame in case images / lazy content shifted layout.
    if (!smooth) {
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Initial jump-to-bottom: runs synchronously after DOM commit (useLayoutEffect)
  // so the user never sees the list at the top. Uses instant scroll because
  // smooth-scrolling 50+ messages would look like "the page just opened at
  // the top" even though it's actually animating.
  //
  // The tricky part: avatars / images / link previews load asynchronously
  // after the initial render, growing the container's scrollHeight. A single
  // scrollTop = scrollHeight call leaves the user halfway up the list once
  // those images decode. To fix this we attach a ResizeObserver for ~1.5s
  // after mount and re-pin to the bottom every time the content grows.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || isLoading || messages.length === 0 || initialScrollDoneRef.current) return;

    // Immediate jump — runs before paint so the user never sees the top.
    el.scrollTop = el.scrollHeight;
    setStickToBottom(true);

    // Re-pin to bottom whenever content height changes during the
    // stabilization window (covers late-loading avatars / images).
    const observer = new ResizeObserver(() => {
      if (!initialScrollDoneRef.current && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child as Element));

    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      initialScrollDoneRef.current = true;
      lastCountRef.current = messages.length;
      observer.disconnect();
    }, 1500);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [isLoading, messages.length, currentFirstId]);

  // Auto-scroll when a new message arrives, but only if we're already near the bottom.
  useEffect(() => {
    if (!initialScrollDoneRef.current) return;
    if (messages.length > lastCountRef.current && stickToBottom) {
      jumpToBottom(true);
    }
    lastCountRef.current = messages.length;
  }, [messages.length, stickToBottom, jumpToBottom]);

  // Track whether the user is at the bottom so we can freeze auto-scroll when they scroll up.
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Ignore the synthetic scroll fired by our own jumpToBottom before the
    // initial scroll has completed — otherwise it can flip stickToBottom to
    // false on first paint when scrollHeight is still being computed.
    if (!initialScrollDoneRef.current) return;
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distanceFromBottom < 80);

    // Near top? load older.
    if (el.scrollTop < 120 && hasMore && !isLoadingOlder) {
      onLoadOlder?.();
    }
  };

  // Intersection observer to detect which messages are actually visible (for read receipts).
  useEffect(() => {
    if (!onVisibleMessages || !scrollRef.current) return;
    if (observerRef.current) observerRef.current.disconnect();
    const visible = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (visible.size > 0) {
        onVisibleMessages(Array.from(visible));
        visible.clear();
      }
    };
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const id = (e.target as HTMLElement).id.replace(/^msg-/, '');
            if (id) visible.add(id);
          }
        }
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(flush, 300);
      },
      { root: scrollRef.current, threshold: 0.5 },
    );
    const nodes = scrollRef.current.querySelectorAll('[id^="msg-"]');
    nodes.forEach((n) => observerRef.current!.observe(n));
    return () => {
      observerRef.current?.disconnect();
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [messages, onVisibleMessages]);

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth-touch chat-scroll px-3 sm:px-4 py-2"
      >
        {isLoadingOlder && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg, i) => {
            const prev = messages[i - 1];
            const curDate = new Date(msg.createdAt);
            const showDateSeparator =
              !prev || !sameDay(new Date(prev.createdAt), curDate);

            const prevSenderId =
              prev && (typeof prev.sender === 'object' ? prev.sender._id : prev.sender);
            const curSenderId = typeof msg.sender === 'object' ? msg.sender._id : msg.sender;
            const groupedWithPrevious =
              !!prev &&
              !showDateSeparator &&
              prevSenderId === curSenderId &&
              curDate.getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;

            const isMine = curSenderId === props.currentUserId;
            const isRead = props.readMessageIds?.has(msg._id);

            return (
              <div key={msg._id}>
                {showDateSeparator && (
                  <div className="flex justify-center my-3">
                    <span className="px-3 py-0.5 rounded-full bg-muted/70 text-[11px] text-muted-foreground font-medium">
                      {formatDateLabel(curDate)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  msg={msg}
                  groupedWithPrevious={groupedWithPrevious}
                  isMine={isMine}
                  isGroup={props.isGroup}
                  currentUserId={props.currentUserId}
                  isAdmin={props.isAdmin}
                  canPin={props.canPin}
                  isRead={isRead}
                  onReply={props.onReply}
                  onReact={props.onReact}
                  onForward={props.onForward}
                  onStar={props.onStar}
                  onPin={props.onPin}
                  onEdit={props.onEdit}
                  onDeleteEveryone={props.onDeleteEveryone}
                  onDeleteForMe={props.onDeleteForMe}
                  onImageClick={handleImageClick}
                  editingId={props.editingId}
                  editContent={props.editContent}
                  setEditContent={props.setEditContent}
                  setEditingId={props.setEditingId}
                  onSubmitEdit={props.onSubmitEdit}
                />
              </div>
            );
          })
        )}

        <AnimatePresence>
          {typingNames.length > 0 && <TypingIndicator names={typingNames} />}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {!stickToBottom && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              setStickToBottom(true);
            }}
            className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-card border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox({ ...lightbox, index: i })}
        />
      )}
    </div>
  );
}
