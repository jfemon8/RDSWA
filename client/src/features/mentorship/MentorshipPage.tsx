import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useTabParam } from "@/hooks/useTabParam";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/stores/authStore";
import { BlurText, FadeIn } from "@/components/reactbits";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  GraduationCap,
  Award,
  Star,
  Mail,
  Phone,
  Users,
  MessagesSquare,
  Calendar,
  ArrowRight,
  AlertTriangle,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/date";
import { useConfirm } from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";

type MentorshipTab = "mentors" | "my-mentors" | "my-trainees";
const MENTORSHIP_TABS: readonly MentorshipTab[] = [
  "mentors",
  "my-mentors",
  "my-trainees",
];

function daysSince(date: string | Date): number {
  return Math.floor(
    (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function timeAgo(date: string | Date): string {
  const days = daysSince(date);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

export default function MentorshipPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useTabParam<MentorshipTab>(MENTORSHIP_TABS, "mentors");
  const [areaSearch, setAreaSearch] = useState("");
  const [requestArea, setRequestArea] = useState("");
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const isMentorEligible =
    user?.isAlumni || user?.isAdvisor || user?.isSeniorAdvisor;

  const { data: configData } = useQuery({
    queryKey: ["mentorship-config"],
    queryFn: async () => (await api.get("/mentorships/config")).data,
    staleTime: 5 * 60_000,
  });
  const config = configData?.data;
  const areas: string[] = config?.areas || [];
  const maxActiveMentees: number = config?.maxActiveMentees ?? 0;
  const myActiveMentees: number = config?.myActiveMentees ?? 0;
  const staleRequestDays: number = config?.staleRequestDays ?? 0;
  const myDerivedAreas: string[] = config?.myDerivedAreas || [];

  /** A request left unanswered past the configured window, which is when the mentor starts getting nudged. */
  const isStale = (m: any) =>
    m.status === "pending" &&
    staleRequestDays > 0 &&
    daysSince(m.requestedAt || m.createdAt) >= staleRequestDays;

  const { data: mentorsData, isLoading: mentorsLoading } = useQuery({
    queryKey: [...queryKeys.mentorships.mentors, areaSearch],
    queryFn: async () => {
      const params = areaSearch ? `?area=${areaSearch}` : "";
      const { data } = await api.get(`/mentorships/mentors${params}`);
      return data;
    },
    enabled: tab === "mentors",
  });

  const role = tab === "my-trainees" ? "mentor" : "mentee";
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: [...queryKeys.mentorships.my, role],
    queryFn: async () => {
      const { data } = await api.get(`/mentorships/my?role=${role}&limit=100`);
      return data;
    },
    enabled: tab === "my-mentors" || tab === "my-trainees",
  });

  // The tab badge has to be right while another tab is open, so pending requests are counted separately.
  const { data: pendingData } = useQuery({
    queryKey: [...queryKeys.mentorships.my, "pending-count"],
    queryFn: async () =>
      (await api.get("/mentorships/my?role=mentor&status=pending&limit=1"))
        .data,
    enabled: !!isMentorEligible,
  });

  const requestMutation = useMutation({
    mutationFn: async ({
      mentorId,
      area,
    }: {
      mentorId: string;
      area: string;
    }) => {
      const { data } = await api.post("/mentorships", { mentorId, area });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mentorships.all });
      toast.success("Mentorship request sent!");
      setRequestingId(null);
      setRequestArea("");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Request failed"),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const { data } = await api.patch(`/mentorships/${id}/${action}`);
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mentorships.all });
      queryClient.invalidateQueries({ queryKey: ["mentorship-config"] });
      const msg =
        vars.action === "accept"
          ? "Mentorship accepted! Consultation group created."
          : vars.action === "complete"
            ? "Mentorship completed."
            : "Mentorship cancelled.";
      toast.success(msg);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Action failed"),
  });

  const mentors = mentorsData?.data || [];
  const myMentors = role === "mentee" ? myData?.data || [] : [];
  const myTrainees = role === "mentor" ? myData?.data || [] : [];
  const pendingRequests = pendingData?.pagination?.total ?? 0;

  const tabs = [
    { key: "mentors" as const, label: "Find Mentors", icon: Search },
    { key: "my-mentors" as const, label: "My Mentors", icon: GraduationCap },
    ...(isMentorEligible
      ? [
          {
            key: "my-trainees" as const,
            label: `My Trainees${pendingRequests ? ` (${pendingRequests})` : ""}`,
            icon: Users,
          },
        ]
      : []),
  ];

  function getMentorTag(mentor: any): {
    label: string;
    icon: typeof GraduationCap;
    color: string;
    bgColor: string;
  } {
    if (mentor.isSeniorAdvisor)
      return {
        label: "Senior Advisor",
        icon: Star,
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
      };
    if (mentor.isAdvisor)
      return {
        label: "Advisor",
        icon: Award,
        color: "text-teal-600 dark:text-teal-400",
        bgColor: "bg-teal-100 dark:bg-teal-900/30",
      };
    return {
      label: "Alumni",
      icon: GraduationCap,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    };
  }

  const statusConfig: Record<
    string,
    { color: string; bg: string; label: string }
  > = {
    pending: {
      color: "text-yellow-700 dark:text-yellow-400",
      bg: "bg-yellow-100 dark:bg-yellow-900/20",
      label: "Pending",
    },
    active: {
      color: "text-green-700 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/20",
      label: "Active",
    },
    completed: {
      color: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/20",
      label: "Completed",
    },
    cancelled: {
      color: "text-red-700 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/20",
      label: "Cancelled",
    },
  };

  function renderMentorshipCard(m: any, isMentor: boolean, index: number) {
    const other = isMentor ? m.mentee : m.mentor;
    const sc = statusConfig[m.status] || statusConfig.pending;
    const stale = isStale(m);

    return (
      <motion.div
        key={m._id}
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -1 }}
        transition={{ duration: 0.25, delay: index * 0.04 }}
        className="rounded-xl border bg-card overflow-hidden"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link to={`/members/${other?._id}`} className="shrink-0">
                {other?.avatar ? (
                  <img
                    src={other.avatar}
                    alt=""
                    className="w-11 h-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                    {other?.name?.charAt(0) || "?"}
                  </div>
                )}
              </Link>
              <div className="min-w-0">
                <Link
                  to={`/members/${other?._id}`}
                  className="font-medium hover:text-primary transition-colors truncate block"
                >
                  {other?.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {other?.profession || other?.department || ""}
                  {other?.batch ? ` • Batch ${other.batch}` : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span
                className={`px-2.5 py-0.5 text-[11px] rounded-full font-medium ${sc.bg} ${sc.color}`}
              >
                {sc.label}
              </span>
              {stale && (
                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full font-medium bg-orange-100 dark:bg-orange-900/25 text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="h-3 w-3" />
                  {isMentor ? "Needs a reply" : "Still waiting"}
                </span>
              )}
              {m.area && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  {m.area}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Requested{" "}
              {timeAgo(m.requestedAt || m.createdAt)}
            </span>
            {m.acceptedAt && (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" /> Accepted{" "}
                {formatDate(m.acceptedAt)}
              </span>
            )}
            {m.completedAt && (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-blue-500" /> Completed{" "}
                {formatDate(m.completedAt)}
              </span>
            )}
          </div>

          {m.closeReason && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
              <span>
                Closed by {m.closedBy?.name || "an administrator"}:{" "}
                {m.closeReason}
              </span>
            </p>
          )}

          {m.status === "active" && (other?.email || other?.phone) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-3 rounded-lg bg-muted/50 space-y-1.5"
            >
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Contact Info
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                {other.email && (
                  <a
                    href={`mailto:${other.email}`}
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" /> {other.email}
                  </a>
                )}
                {other.phone && (
                  <a
                    href={`tel:${other.phone}`}
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {other.phone}
                  </a>
                )}
              </div>
            </motion.div>
          )}

          {m.status === "active" && (
            <div className="flex flex-wrap gap-2 mt-3">
              <Link
                to={`/dashboard/messages?with=${other?._id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md hover:bg-accent transition-colors"
              >
                <MessagesSquare className="h-3.5 w-3.5" /> Message
              </Link>
              <Link
                to={
                  m.consultationGroupId
                    ? `/dashboard/groups/${m.consultationGroupId}`
                    : "/dashboard/chat"
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-md hover:bg-accent transition-colors"
              >
                <Users className="h-3.5 w-3.5" /> Consultation Group
              </Link>
            </div>
          )}
        </div>

        {!["completed", "cancelled"].includes(m.status) && (
          <div className="flex flex-wrap gap-2 px-5 py-3 border-t bg-muted/20">
            {m.status === "pending" && isMentor && (
              <>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    actionMutation.mutate({ id: m._id, action: "accept" })
                  }
                  disabled={actionMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Accept
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Decline Request",
                      message:
                        "Decline this mentorship request? The mentee will be notified.",
                      confirmLabel: "Decline",
                      variant: "danger",
                    });
                    if (ok)
                      actionMutation.mutate({ id: m._id, action: "cancel" });
                  }}
                  disabled={actionMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" /> Decline
                </motion.button>
              </>
            )}
            {m.status === "pending" && !isMentor && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5 animate-pulse" />
                Waiting for mentor's response
                {stale && " — a reminder has been sent"}
              </span>
            )}
            {m.status === "active" && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Complete Mentorship",
                    message:
                      "Mark this mentorship as complete? This will close the consultation group.",
                    confirmLabel: "Complete",
                    variant: "info",
                  });
                  if (ok)
                    actionMutation.mutate({ id: m._id, action: "complete" });
                }}
                disabled={actionMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle className="h-3.5 w-3.5" /> Mark Complete
              </motion.button>
            )}
            {(m.status === "active" ||
              (m.status === "pending" && !isMentor)) && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  const ok = await confirm({
                    title:
                      m.status === "active"
                        ? "Cancel Mentorship"
                        : "Withdraw Request",
                    message:
                      m.status === "active"
                        ? "Cancel this active mentorship? The consultation group will be closed."
                        : "Withdraw this mentorship request?",
                    confirmLabel:
                      m.status === "active" ? "Yes, cancel" : "Withdraw",
                    cancelLabel: "Keep",
                    variant: "danger",
                  });
                  if (ok)
                    actionMutation.mutate({ id: m._id, action: "cancel" });
                }}
                disabled={actionMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {m.status === "active" ? "Cancel" : "Withdraw"}
              </motion.button>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="container mx-auto py-6 md:py-12">
      <BlurText
        text="Mentorship"
        className="text-3xl md:text-4xl font-bold mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-muted-foreground mb-8">
          Connect with experienced Alumni, Advisors, and Senior Advisors for
          guidance and career mentorship.
        </p>
      </FadeIn>

      <div className="flex gap-1 mb-6 border-b relative overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <motion.button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                tab === t.key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {tab === t.key && (
                <motion.div
                  layoutId="mentorship-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ── Find Mentors Tab ── */}
      {tab === "mentors" && (
        <FadeIn direction="up" duration={0.4}>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <select
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              aria-label="Filter mentors by area"
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All mentorship areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {mentorsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : mentors.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No Mentors Found"
              description="No mentors match your search. Try a different skill area or clear your filters to see all available mentors."
              hint="Alumni and senior members volunteer as mentors to guide students in careers, research and personal growth."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mentors.map((mentor: any, i: number) => {
                const tag = getMentorTag(mentor);
                const TagIcon = tag.icon;
                return (
                  <motion.div
                    key={mentor._id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    className="rounded-xl border bg-card p-5 h-full flex flex-col"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <Link to={`/members/${mentor._id}`} className="shrink-0">
                        {mentor.avatar ? (
                          <img
                            src={mentor.avatar}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/10"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg ring-2 ring-primary/10">
                            {mentor.name?.charAt(0)}
                          </div>
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/members/${mentor._id}`}
                            className="font-semibold hover:text-primary transition-colors"
                          >
                            {mentor.name}
                          </Link>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${tag.bgColor} ${tag.color}`}
                          >
                            <TagIcon className="h-3 w-3" /> {tag.label}
                          </span>
                          {mentor.atCapacity && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-orange-100 dark:bg-orange-900/25 text-orange-700 dark:text-orange-400">
                              <AlertTriangle className="h-3 w-3" /> Full
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {mentor.profession || mentor.department || ""}{" "}
                          {mentor.batch ? `• Batch ${mentor.batch}` : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                          <Users className="h-3 w-3" />
                          {mentor.maxActiveMentees
                            ? `${mentor.activeMentees || 0} of ${mentor.maxActiveMentees} mentee slots filled`
                            : `Mentoring ${mentor.activeMentees || 0} ${mentor.activeMentees === 1 ? "trainee" : "trainees"}`}
                        </p>
                        {mentor.areas?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {mentor.areas.map((a: string) => {
                              const auto =
                                mentor.derived?.includes(a) &&
                                !mentor.mentorAreas?.includes(a);
                              return (
                                <span
                                  key={a}
                                  title={
                                    auto
                                      ? "Matched from their profession and skills"
                                      : "Chosen by this mentor"
                                  }
                                  className={`px-2 py-0.5 text-[11px] rounded-md border ${
                                    auto
                                      ? "border-dashed border-muted-foreground/40 text-muted-foreground"
                                      : "border-primary/30 text-primary"
                                  }`}
                                >
                                  {a}
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {mentor.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {mentor.skills
                              .slice(0, 5)
                              .map((s: string, j: number) => (
                                <span
                                  key={j}
                                  className="px-2 py-0.5 text-[11px] bg-primary/10 text-primary rounded-md"
                                >
                                  {s}
                                </span>
                              ))}
                            {mentor.skills.length > 5 && (
                              <span className="text-[11px] text-muted-foreground">
                                +{mentor.skills.length - 5}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {user && user._id !== mentor._id && (
                      <div className="mt-4 pt-3 border-t">
                        {mentor.atCapacity ? (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Info className="h-3.5 w-3.5" /> Not taking new
                            mentees right now
                          </p>
                        ) : (
                          <AnimatePresence mode="wait">
                            {requestingId === mentor._id ? (
                              <motion.div
                                key="form"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2"
                              >
                                <select
                                  value={requestArea}
                                  onChange={(e) =>
                                    setRequestArea(e.target.value)
                                  }
                                  aria-label="Area of mentorship"
                                  className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                  <option value="">Choose an area...</option>
                                  {/* A mentor with areas of their own is only asked about those. */}
                                  {(mentor.areas?.length
                                    ? mentor.areas
                                    : areas
                                  ).map((a: string) => (
                                    <option key={a} value={a}>
                                      {a}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex gap-2">
                                  <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    disabled={requestMutation.isPending}
                                    onClick={() =>
                                      requestMutation.mutate({
                                        mentorId: mentor._id,
                                        area: requestArea,
                                      })
                                    }
                                    className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center gap-1.5"
                                  >
                                    {requestMutation.isPending && (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    )}
                                    Send Request
                                  </motion.button>
                                  <button
                                    onClick={() => {
                                      setRequestingId(null);
                                      setRequestArea("");
                                    }}
                                    className="px-4 py-1.5 text-sm border rounded-md hover:bg-muted"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.button
                                key="btn"
                                onClick={() => setRequestingId(mentor._id)}
                                className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                                whileHover={{ x: 4 }}
                              >
                                <UserPlus className="h-4 w-4" /> Request
                                Mentorship <ArrowRight className="h-3 w-3" />
                              </motion.button>
                            )}
                          </AnimatePresence>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </FadeIn>
      )}

      {/* ── My Mentors Tab ── */}
      {tab === "my-mentors" && (
        <FadeIn direction="up" duration={0.4}>
          {myLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : myMentors.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No Mentors Yet"
              description="You haven't requested mentorship yet. Browse available mentors and send a request to get started."
              primary={{
                label: "Find Mentors",
                icon: Search,
                onClick: () => setTab("mentors"),
              }}
              hint="Once a mentor accepts your request, they will appear here and you can chat with them directly."
            />
          ) : (
            <div className="space-y-4">
              {myMentors.map((m: any, i: number) =>
                renderMentorshipCard(m, false, i),
              )}
            </div>
          )}
        </FadeIn>
      )}

      {/* ── My Trainees Tab (Mentor view) ── */}
      {tab === "my-trainees" && isMentorEligible && (
        <FadeIn direction="up" duration={0.4}>
          <MentorOptIn
            areas={areas}
            derivedAreas={myDerivedAreas}
            activeCount={myActiveMentees}
            maxActiveMentees={maxActiveMentees}
          />
          {myLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : myTrainees.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Trainee Requests Yet"
              description="No members have requested your mentorship yet. They will find you in the mentor directory based on your skills."
              hint="Make sure your profile lists the skills and areas you can mentor so members can discover you easily."
            />
          ) : (
            <div className="space-y-4">
              {[...myTrainees]
                .sort((a: any, b: any) => {
                  const order: Record<string, number> = {
                    pending: 0,
                    active: 1,
                    completed: 2,
                    cancelled: 3,
                  };
                  return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                })
                .map((m: any, i: number) => renderMentorshipCard(m, true, i))}
            </div>
          )}
        </FadeIn>
      )}
    </div>
  );
}

/** Every Alumni, Advisor and Senior Advisor is listed by default, so this is the switch that pauses it. */
function MentorOptIn({
  areas,
  derivedAreas,
  activeCount,
  maxActiveMentees,
}: {
  areas: string[];
  derivedAreas: string[];
  activeCount: number;
  maxActiveMentees: number;
}) {
  const { user, setUser } = useAuthStore();
  const toast = useToast();
  // An eligible member with no stored preference is listed, matching how the directory queries it.
  const isMentor = user?.isMentor !== false;
  const myAreas: string[] = user?.mentorAreas || [];

  const mutation = useMutation({
    mutationFn: (patch: { isMentor?: boolean; mentorAreas?: string[] }) =>
      api.patch(`/users/${user?._id}/profile`, patch),
    onSuccess: (res, patch) => {
      // The store drives the toggle, so it has to reflect the saved value immediately.
      setUser({ ...user!, ...patch });
      toast.success(
        patch.isMentor === undefined
          ? "Mentoring areas updated"
          : patch.isMentor
            ? "You are now listed as a mentor"
            : "Your mentor listing is paused",
      );
      return res;
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to update"),
  });

  const atCapacity = maxActiveMentees > 0 && activeCount >= maxActiveMentees;

  const toggleArea = (area: string) => {
    const next = myAreas.includes(area)
      ? myAreas.filter((a) => a !== area)
      : [...myAreas, area];
    mutation.mutate({ mentorAreas: next });
  };

  return (
    <div className="border rounded-xl p-4 bg-card mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground text-sm">
            Mentor listing
          </h3>
          <div className="flex items-end gap-0.5 sm:gap-1 md:gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground mt-0.5">
              Your email and phone are only shared with a mentee once you accept
              theirs.
            </p>
            {isMentor && maxActiveMentees > 0 && (
              <p
                className={`mt-2 flex items-center gap-1.5 text-xs ${
                  atCapacity
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-muted-foreground"
                }`}
              >
                {atCapacity ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <Info className="h-3.5 w-3.5" />
                )}
                {activeCount} of {maxActiveMentees} mentee slots filled
                {atCapacity && ", new requests are blocked until one completes"}
              </p>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={isMentor}
            disabled={mutation.isPending}
            onChange={(e) => mutation.mutate({ isMentor: e.target.checked })}
            className="rounded border-input"
          />
          {isMentor ? "Listed" : "Paused"}
        </label>
      </div>

      <AnimatePresence initial={false}>
        {isMentor && areas.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Areas you can mentor in
              </p>
              <div className="flex flex-wrap gap-1.5">
                {areas.map((a) => {
                  const picked = myAreas.includes(a);
                  // Your profession and skills already put you here, so the listing shows it whether or not you pick it.
                  const auto = derivedAreas.includes(a);
                  return (
                    <motion.button
                      key={a}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      disabled={mutation.isPending}
                      onClick={() => toggleArea(a)}
                      title={
                        auto
                          ? "Matched from your profession and skills"
                          : undefined
                      }
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors disabled:opacity-50 ${
                        picked
                          ? "bg-primary text-primary-foreground border-primary"
                          : auto
                            ? "text-foreground border-dashed border-primary/50 hover:bg-accent"
                            : "text-foreground hover:bg-accent"
                      }`}
                    >
                      {a}
                      {auto && !picked && <span className="ml-1 opacity-60">•</span>}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
