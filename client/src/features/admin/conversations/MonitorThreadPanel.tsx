import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InlineListSkeleton } from '@/components/ui/Skeleton';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ChevronUp,
  Copy,
  CornerDownRight,
  CornerUpLeft,
  Eye,
  EyeOff,
  Paperclip,
  Pencil,
  RefreshCw,
  Search,
  SearchX,
  Trash2,
  Users,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/date";
import { proxyFileUrl } from "@/lib/fileProxy";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useGroupMonitorSocket } from "@/hooks/useSocket";
import { useConfirm, usePrompt } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { MonitorAvatar, type MonitorUser } from "./monitorShared";

interface Props {
  /** The monitored member, whose messages are shown on the right-hand side. */
  memberId?: string;
  dmPartnerId?: string;
  groupId?: string;
  onClose: () => void;
}

const PAGE_SIZE = 60;

/** The header drops down one panel at a time, so the two never fight for the same strip of space. */
type HeaderPanel = "search" | "members" | null;

/** Split text around a search term so matches can be tinted without dangerouslySetInnerHTML. */
function Highlighted({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const parts = text.split(
    new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"),
  );
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-300/60 dark:bg-yellow-500/40 text-inherit rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function MonitorThreadPanel({
  memberId,
  dmPartnerId,
  groupId,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [panel, setPanel] = useState<HeaderPanel>(null);
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());

  const togglePanel = (next: Exclude<HeaderPanel, null>) => {
    // Leaving the search panel drops the term, so the list is never filtered by a box nobody can see.
    if (panel === "search") setSearch("");
    setPanel(panel === next ? null : next);
  };

  const clearSearch = () => {
    setSearch("");
    setPanel(null);
  };

  /** Leaves the result list for the conversation itself, positioned on the chosen message. */
  const jumpToMessage = (id: string) => {
    nearBottom.current = false;
    setSearch("");
    setPanel(null);
    setJumpTarget(id);
  };

  const isDm = !!dmPartnerId;
  const threadId = isDm ? `${memberId}:${dmPartnerId}` : groupId || "";
  const basePath = isDm
    ? `/communication/monitor/dm/${memberId}/${dmPartnerId}`
    : `/communication/monitor/groups/${groupId}`;

  const queryKey = ["admin", "monitor", "thread", threadId];

  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
  } = useInfiniteQuery<any>({
    queryKey: [...queryKey, debouncedSearch, includeDeleted],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(pageParam),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (includeDeleted) params.set("includeDeleted", "true");
      return (await api.get(`${basePath}?${params.toString()}`)).data.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any, all: any[]) => {
      const loaded = all.reduce((n, p) => n + (p.messages?.length || 0), 0);
      return loaded < (lastPage.total || 0) ? all.length + 1 : undefined;
    },
    // Keeps the previous thread on screen while a filter changes, instead of flashing a spinner.
    placeholderData: keepPreviousData,
    // A DM between two other people reaches no room this session is in, so it is polled instead.
    refetchInterval: isDm ? 20000 : false,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, threadId]);

  useGroupMonitorSocket(isDm ? undefined : groupId, invalidate);

  // Page 1 is the newest slice, so pages read back-to-front, and skip-based paging over a live collection can repeat one.
  const messages: any[] = useMemo(() => {
    const seen = new Set<string>();
    return [...(data?.pages || [])]
      .reverse()
      .flatMap((p: any) => p.messages || [])
      .filter((m: any) => !seen.has(m._id) && seen.add(m._id));
  }, [data]);

  const head: any = data?.pages?.[0];
  const total: number = head?.total || 0;

  // ── Scrolling: stay pinned to the newest message unless the reader has scrolled up ──
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    nearBottom.current = true;
    setPanel(null);
    setSearch("");
    setJumpTarget(null);
    setFlashId(null);
  }, [threadId]);

  // A match can sit far behind the loaded pages, so history is pulled in until the message is on screen.
  useEffect(() => {
    // Waiting out the placeholder keeps the jump from landing on result rows that are about to be replaced.
    if (!jumpTarget || debouncedSearch || isPlaceholderData) return;
    const node = messageRefs.current.get(jumpTarget);
    if (node) {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
      setFlashId(jumpTarget);
      setJumpTarget(null);
    } else if (hasNextPage) {
      if (!isFetchingNextPage) fetchNextPage();
    } else {
      setJumpTarget(null);
      toast.error("Could not reach that message", "It may have been removed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    jumpTarget,
    debouncedSearch,
    isPlaceholderData,
    messages,
    hasNextPage,
    isFetchingNextPage,
  ]);

  useEffect(() => {
    if (!flashId) return;
    const timer = setTimeout(() => setFlashId(null), 2600);
    return () => clearTimeout(timer);
  }, [flashId]);

  useEffect(() => {
    if (nearBottom.current) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (el)
      nearBottom.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  /** Older messages prepend, which would shove the reader down the list, so the offset from the bottom is restored. */
  const loadOlder = () => {
    const el = scrollRef.current;
    const anchor = el ? el.scrollHeight - el.scrollTop : 0;
    fetchNextPage().then(() => {
      requestAnimationFrame(() => {
        const node = scrollRef.current;
        if (node) node.scrollTop = node.scrollHeight - anchor;
      });
    });
  };

  // ── Moderation ──
  const messagePath = (id: string) =>
    isDm
      ? `/communication/dm/messages/${id}`
      : `/communication/groups/${groupId}/messages/${id}`;

  // Moderating a message also changes the previews in the lists beside it, so the whole monitor is refreshed.
  const refreshMonitor = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "monitor"] });

  const editMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.patch(messagePath(id), { content }),
    onSuccess: () => {
      toast.success("Message updated");
      refreshMonitor();
    },
    onError: (err: any) =>
      toast.error("Could not edit", err?.response?.data?.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(messagePath(id)),
    onSuccess: () => {
      toast.success("Message deleted");
      refreshMonitor();
    },
    onError: (err: any) =>
      toast.error("Could not delete", err?.response?.data?.message),
  });

  const handleEdit = async (message: any) => {
    const content = await prompt({
      title: "Edit message",
      label: "Message",
      defaultValue: message.content || "",
      multiline: true,
      required: true,
      confirmLabel: "Save",
    });
    if (content && content !== message.content)
      editMutation.mutate({ id: message._id, content });
  };

  const handleDelete = async (message: any) => {
    const ok = await confirm({
      title: "Delete this message?",
      message:
        "It disappears for everyone in the conversation and cannot be restored.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (ok) deleteMutation.mutate(message._id);
  };

  const handleCopy = async (message: any) => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      toast.success("Copied");
    } catch {
      toast.error("Could not copy", "Clipboard access was blocked.");
    }
  };

  const participants: MonitorUser[] = head?.participants || [];
  const group = head?.group;
  // The lookup returns the pair in no particular order, so the monitored member is pulled to the front.
  const ordered = memberId
    ? [...participants].sort((a, b) =>
        a._id === memberId ? -1 : b._id === memberId ? 1 : 0,
      )
    : participants;
  const title = isDm
    ? ordered.map((p) => p.name).join("  ↔  ") || "Private conversation"
    : group?.name || "Group";
  const subtitle = isDm
    ? "Private conversation"
    : `${group?.type || ""} group · ${group?.members?.length || 0} members`;

  // Day headings only where the date actually turns over.
  const rows = useMemo(
    () =>
      messages.map((m, i) => ({
        message: m,
        dayLabel:
          i === 0 ||
          formatDate(m.createdAt) !== formatDate(messages[i - 1].createdAt)
            ? formatDate(m.createdAt)
            : null,
      })),
    [messages],
  );

  return (
    <div className="bg-card border rounded-xl flex flex-col overflow-hidden h-[calc(100dvh-13rem)] min-h-[22rem] lg:h-[40rem]">
      <div className="shrink-0 border-b">
        <div className="flex items-center gap-2 px-2 py-2 sm:px-3">
          <button
            onClick={onClose}
            className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground shrink-0"
            title="Close conversation"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {title}
            </p>
            <p className="text-[11px] text-muted-foreground truncate capitalize">
              {subtitle} · {total} messages
            </p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {!isDm && (
              <button
                onClick={() => togglePanel("members")}
                className={`p-1.5 sm:p-2 rounded-md hover:bg-accent ${panel === "members" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                title="Members"
              >
                <Users className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => togglePanel("search")}
              className={`p-1.5 sm:p-2 rounded-md hover:bg-accent ${panel === "search" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title="Search in conversation"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIncludeDeleted((v) => !v)}
              className={`p-1.5 sm:p-2 rounded-md hover:bg-accent ${includeDeleted ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              title={
                includeDeleted
                  ? "Hide deleted messages"
                  : "Show deleted messages"
              }
            >
              {includeDeleted ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => refetch()}
              className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Both panels share this slot, so each needs its own key for AnimatePresence to tell them apart. */}
        <AnimatePresence initial={false}>
          {panel === "search" && (
            <motion.div
              key="search"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 sm:px-3">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search in this conversation..."
                    className="w-full pl-9 pr-9 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {panel === "members" && group?.members?.length > 0 && (
            <motion.div
              key="members"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-2 sm:px-3 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {group.members.map((m: MonitorUser) => (
                  <Link
                    key={m._id}
                    to={`/members/${m._id}`}
                    title={`View ${m.name}'s profile`}
                    className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border bg-muted/40 text-xs text-foreground hover:bg-accent hover:border-primary/40 transition-colors"
                  >
                    <MonitorAvatar user={m} size="h-5 w-5" />
                    <span className="truncate max-w-[9rem]">{m.name}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <InlineListSkeleton />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
          <p>This conversation could not be loaded.</p>
          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 rounded-md border text-xs hover:bg-accent hover:text-foreground"
          >
            Try again
          </button>
        </div>
      ) : debouncedSearch && isPlaceholderData ? (
        /* The previous query's messages are still in hand, and none of them were matched against this term. */
        <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Searching…
        </div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
          {debouncedSearch ? (
            <>
              <SearchX className="h-8 w-8 text-muted-foreground/40" />
              <p>
                No message matches{" "}
                <span className="font-medium text-foreground">
                  “{debouncedSearch}”
                </span>
                .
              </p>
              <button
                onClick={clearSearch}
                className="px-3 py-1.5 rounded-md border text-xs hover:bg-accent hover:text-foreground"
              >
                Clear search
              </button>
            </>
          ) : (
            <p>Nothing has been said here yet.</p>
          )}
        </div>
      ) : debouncedSearch ? (
        <div className="flex-1 overflow-y-auto scroll-smooth-touch">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 border-b bg-card/95 backdrop-blur text-xs">
            <span className="text-muted-foreground truncate">
              <span className="font-semibold text-foreground">{total}</span>{" "}
              {total === 1 ? "result" : "results"} for{" "}
              <span className="font-medium text-foreground">
                “{debouncedSearch}”
              </span>
            </span>
            <button
              onClick={clearSearch}
              className="shrink-0 px-2 py-1 rounded-md border text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              Clear
            </button>
          </div>

          {/* Newest first, the order a result list is scanned in. */}
          <div className="divide-y">
            {[...messages].reverse().map((m: any) => (
              <button
                key={m._id}
                onClick={() => jumpToMessage(m._id)}
                title="Jump to this message"
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-accent transition-colors"
              >
                <MonitorAvatar user={m.sender} size="h-8 w-8" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {m.sender?.name || "Unknown"}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDateTime(m.createdAt)}
                    </span>
                  </span>
                  <span className="block text-xs text-muted-foreground line-clamp-2 break-words">
                    <Highlighted
                      text={m.content || ""}
                      term={debouncedSearch}
                    />
                  </span>
                </span>
                <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
              </button>
            ))}
          </div>

          {hasNextPage && (
            <div className="p-3">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full py-2 rounded-md border text-xs text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
              >
                {isFetchingNextPage
                  ? "Loading…"
                  : `Load more results (${total - messages.length} left)`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2 py-3 sm:px-4 space-y-3 scroll-smooth-touch"
        >
          {hasNextPage && (
            <button
              onClick={loadOlder}
              disabled={isFetchingNextPage}
              className="mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              {isFetchingNextPage
                ? "Loading…"
                : `Load older (${total - messages.length} more)`}
            </button>
          )}

          {rows.map(({ message: m, dayLabel }) => {
            const mine = !!memberId && m.sender?._id === memberId;
            return (
              <div key={m._id}>
                {dayLabel && (
                  <div className="flex justify-center my-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-muted text-[11px] text-muted-foreground">
                      {dayLabel}
                    </span>
                  </div>
                )}

                <div
                  ref={(el) => {
                    if (el) messageRefs.current.set(m._id, el);
                    else messageRefs.current.delete(m._id);
                  }}
                  className={`group flex items-start gap-2 rounded-xl p-1 transition-colors ${mine ? "flex-row-reverse" : ""} ${
                    flashId === m._id
                      ? "ring-2 ring-primary/60 bg-primary/5"
                      : ""
                  }`}
                >
                  <MonitorAvatar user={m.sender} size="h-7 w-7 sm:h-8 sm:w-8" />

                  <div
                    className={`min-w-0 max-w-[calc(100%-4.5rem)] sm:max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`flex items-baseline gap-2 flex-wrap px-1 ${mine ? "flex-row-reverse" : ""}`}
                    >
                      <span className="text-xs font-medium text-foreground truncate max-w-[10rem]">
                        {m.sender?.name || "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(m.createdAt)}
                      </span>
                      {m.isEdited && (
                        <span className="text-[10px] italic text-muted-foreground">
                          edited
                        </span>
                      )}
                    </div>

                    <div
                      className={`mt-0.5 rounded-2xl border px-3 py-2 text-sm break-words ${
                        m.isDeleted
                          ? "border-dashed border-red-500/40 bg-red-500/5 text-muted-foreground"
                          : mine
                            ? "bg-primary/10 border-primary/25 text-foreground"
                            : "bg-muted border-transparent text-foreground"
                      }`}
                    >
                      {m.isDeleted && (
                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 mb-1">
                          <Trash2 className="h-3 w-3" /> Deleted for everyone
                        </p>
                      )}

                      {m.replyTo && (
                        <div className="mb-1.5 pl-2 border-l-2 border-primary/40 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground/80">
                            <CornerUpLeft className="h-3 w-3" />{" "}
                            {m.replyTo.senderName}
                          </span>
                          <span className="line-clamp-2">
                            {m.replyTo.content ||
                              (m.replyTo.attachmentKind
                                ? `[${m.replyTo.attachmentKind}]`
                                : "")}
                          </span>
                        </div>
                      )}

                      {m.content && (
                        <p className="whitespace-pre-wrap">
                          <Highlighted
                            text={m.content}
                            term={debouncedSearch}
                          />
                        </p>
                      )}

                      {m.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {m.attachments.map((a: any, i: number) =>
                            a.kind === "image" && a.url ? (
                              <a
                                key={i}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={a.url}
                                  alt=""
                                  loading="lazy"
                                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-lg object-cover border"
                                />
                              </a>
                            ) : (
                              <a
                                key={i}
                                href={
                                  a.url
                                    ? proxyFileUrl(a.url, a.name)
                                    : undefined
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border bg-background/60 text-xs text-muted-foreground hover:text-foreground max-w-full"
                              >
                                <Paperclip className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {a.name || a.contact?.name || a.kind}
                                </span>
                              </a>
                            ),
                          )}
                        </div>
                      )}

                      {!m.content && !m.attachments?.length && !m.isDeleted && (
                        <p className="italic text-muted-foreground">
                          Empty message
                        </p>
                      )}
                    </div>

                    {m.reactions?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 px-1">
                        {m.reactions.map((r: any, i: number) => (
                          <span
                            key={i}
                            title={r.user?.name}
                            className="text-xs px-1.5 py-0.5 rounded-full bg-muted border"
                          >
                            {r.emoji}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Touch devices have no hover, so the controls stay visible, stacked, to spend width on the message. */}
                  <div className="flex flex-col lg:flex-row items-center gap-0.5 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
                    {m.content && (
                      <button
                        onClick={() => handleCopy(m)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Copy text"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {!m.isDeleted && (
                      <>
                        <button
                          onClick={() => handleEdit(m)}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Edit message"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                          title="Delete message"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {jumpTarget && (
        <p className="shrink-0 border-t px-3 py-1.5 text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <RefreshCw className="h-3 w-3 animate-spin" /> Loading history to
          reach that message…
        </p>
      )}
    </div>
  );
}
