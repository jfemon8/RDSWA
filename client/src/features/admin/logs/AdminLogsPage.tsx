import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { FadeIn } from "@/components/reactbits";
import { usePageParam } from "@/hooks/usePageParam";
import { useTabParam } from "@/hooks/useTabParam";
import api from "@/lib/api";
import {
  Shield,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDateTime } from "@/lib/date";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";

type Tab = "audit" | "login" | "suspicious";
const TABS: readonly Tab[] = ["audit", "login", "suspicious"];

export default function AdminLogsPage() {
  const [tab, setTab] = useTabParam<Tab>(TABS, "audit");

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">
          Logs & Security
        </h1>

        <div className="flex flex-col sm:flex-row gap-2 mb-6 border-b">
          <button
            onClick={() => setTab("audit")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
              tab === "audit"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="h-4 w-4" /> Audit Logs
          </button>
          <button
            onClick={() => setTab("login")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
              tab === "login"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" /> Login History
          </button>
          <button
            onClick={() => setTab("suspicious")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
              tab === "suspicious"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="h-4 w-4" /> Suspicious Activity
          </button>
        </div>

        {tab === "audit" && <AuditLogsTab />}
        {tab === "login" && <LoginHistoryTab />}
        {tab === "suspicious" && <SuspiciousActivityTab />}
      </div>
    </FadeIn>
  );
}

function AuditLogsTab() {
  const navigate = useNavigate();
  const [page, setPage] = usePageParam("auditPage");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "logs", page, action, resource],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (action) params.set("action", action);
      if (resource) params.set("resource", resource);
      const { data } = await api.get(`/admin/logs?${params}`);
      return data;
    },
  });

  const logs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <>
      <FadeIn direction="up" delay={0.05}>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6 w-full">
          <input
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            placeholder="Search actions (e.g. approve, create, delete)..."
            className="w-full sm:w-auto px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 sm:flex-1 sm:min-w-0"
          />
          <select
            value={resource}
            onChange={(e) => {
              setResource(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 border rounded-md bg-card text-foreground text-sm sm:flex-shrink-0"
          >
            <option value="">All Resources</option>
            <option value="users">Users</option>
            <option value="committees">Committees</option>
            <option value="events">Events</option>
            <option value="notices">Notices</option>
            <option value="forms">Forms</option>
            <option value="documents">Documents</option>
            <option value="albums">Albums</option>
            <option value="site_settings">Settings</option>
          </select>
        </div>
      </FadeIn>

      {isLoading ? (
        <Spinner size="md" />
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No audit logs found</p>
        </div>
      ) : (
        <>
          <FadeIn direction="up" delay={0.1}>
            <div className="space-y-2">
              {logs.map((log: any) => {
                const hasChanges =
                  log.changes && (log.changes.after || log.changes.before);
                const isExpanded = expandedId === log._id;
                const ip = log.ip || "-";

                return (
                  <div
                    key={log._id}
                    className="border rounded-lg bg-card overflow-hidden"
                  >
                    <div
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : log._id)}
                    >
                      {/* Primary info — stacks above metadata on mobile so the
                          action/actor/resource can use the full row width. */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0 flex-1">
                        {/* Action badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium shrink-0 ${
                            log.action?.includes("delete") ||
                            log.action?.includes("reject") ||
                            log.action?.includes("remove")
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : log.action?.includes("create") ||
                                  log.action?.includes("approve") ||
                                  log.action?.includes("assign")
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          }`}
                        >
                          {log.action}
                        </span>

                        {/* Actor (User Name) - clickable */}
                        {log.actor ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/members/${log.actor._id}`);
                            }}
                            className="text-sm font-medium text-primary hover:underline shrink-0 cursor-pointer"
                          >
                            {log.actor.name}
                          </button>
                        ) : (
                          <span className="text-sm font-medium text-foreground shrink-0">
                            System
                          </span>
                        )}

                        {/* Resource - clickable */}
                        <span className="text-xs text-muted-foreground min-w-0">
                          on{" "}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const resourceType = log.resource?.toLowerCase();

                              const routes: Record<string, string> = {
                                users: `/admin/users`,
                                committees: `/admin/committees`,
                                events: `/admin/events`,
                                notices: `/admin/notices`,
                                forms: `/admin/forms`,
                                documents: `/admin/documents`,
                                albums: `/admin/gallery`,
                                site_settings: `/admin/settings`,
                                votes: `/admin/voting`,
                                donations: `/admin/donations`,
                                donation_campaigns: `/admin/donations`,
                                bus_schedules: `/admin/bus`,
                                bus_routes: `/admin/bus`,
                                bus_operators: `/admin/bus`,
                                bus_counters: `/admin/bus`,
                                bus_reviews: `/admin/bus`,
                                expenses: `/admin/finance`,
                                budgets: `/admin/budgets`,
                                reports: `/admin/reports`,
                                contact_message: `/admin/contact-messages`,
                                system: `/admin/backup`,
                              };

                              const path = routes[resourceType] || `/admin`;
                              navigate(path);
                            }}
                            className="font-medium text-primary hover:underline cursor-pointer"
                          >
                            {log.resource}
                          </button>
                          {(log.resourceName || log.resourceId) && (
                            <span className="ml-1 text-[10px]">
                              —{" "}
                              <span className="font-medium text-foreground">
                                {log.resourceName?.includes("<") ? (
                                  <span
                                    dangerouslySetInnerHTML={{
                                      __html: log.resourceName,
                                    }}
                                  />
                                ) : (
                                  log.resourceName ||
                                  `#${String(log.resourceId).slice(-6)}`
                                )}
                              </span>
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Metadata — below on mobile (date never clips), right-aligned on desktop. */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-muted-foreground">
                        <span className="text-[10px] font-mono hidden sm:inline">
                          {ip}
                        </span>
                        <span className="text-xs whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </span>
                        {hasChanges && (
                          <span>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded: Show changes detail */}
                    <AnimatePresence>
                      {isExpanded && hasChanges && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t px-4 py-3 bg-muted/30 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">
                              Changed Data
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                              {Object.entries(
                                log.changes.after || log.changes || {},
                              ).map(([key, val]) => {
                                if (
                                  key === "_id" ||
                                  key === "__v" ||
                                  key === "after" ||
                                  key === "before"
                                )
                                  return null;
                                let display: React.ReactNode = null;
                                let isComplex = false;
                                let isHtmlString = false;

                                if (val === null || val === undefined) {
                                  display = "—";
                                } else if (typeof val === "boolean") {
                                  display = val ? "Yes" : "No";
                                } else if (Array.isArray(val)) {
                                  if (val.length === 0) {
                                    display = "[]";
                                  } else if (
                                    val.some(
                                      (v) =>
                                        typeof v === "object" && v !== null,
                                    )
                                  ) {
                                    isComplex = true;
                                    display = (
                                      <pre className="bg-background rounded p-2 text-[11px] overflow-auto max-h-40 font-mono border border-border">
                                        {JSON.stringify(val, null, 2)}
                                      </pre>
                                    );
                                  } else {
                                    display = val.join(", ");
                                  }
                                } else if (typeof val === "object") {
                                  isComplex = true;
                                  display = (
                                    <pre className="bg-background rounded p-2 text-[11px] overflow-auto max-h-40 font-mono border border-border">
                                      {JSON.stringify(val, null, 2)}
                                    </pre>
                                  );
                                } else if (typeof val === "string") {
                                  if (val.includes("<")) {
                                    isHtmlString = true;
                                    display = (
                                      <div
                                        className="prose prose-sm dark:prose-invert max-w-none text-xs"
                                        dangerouslySetInnerHTML={{
                                          __html: val,
                                        }}
                                      />
                                    );
                                  } else {
                                    display = val;
                                  }
                                } else {
                                  display = String(val);
                                }

                                return (
                                  <div
                                    key={key}
                                    className={
                                      isComplex || isHtmlString
                                        ? "col-span-1 sm:col-span-2"
                                        : ""
                                    }
                                  >
                                    <span className="text-muted-foreground font-medium text-xs">
                                      {key}:
                                    </span>
                                    <div
                                      className={
                                        isComplex || isHtmlString
                                          ? "mt-1"
                                          : "inline ml-2 text-foreground break-all"
                                      }
                                    >
                                      {typeof display === "string" ? (
                                        <span className="text-foreground">
                                          {display}
                                        </span>
                                      ) : (
                                        display
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* IP and User Agent in expanded view — stacked
                                so the UA string (always long) wraps cleanly
                                instead of being clipped by a max-width. */}
                            <div className="space-y-1 text-[10px] text-muted-foreground pt-2 border-t mt-2">
                              <div>
                                IP: <span className="font-mono">{ip}</span>
                              </div>
                              {log.userAgent && (
                                <div className="break-all">
                                  UA:{" "}
                                  <span className="font-mono">
                                    {log.userAgent}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </FadeIn>

          {pagination && pagination.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              onChange={setPage}
            />
          )}
        </>
      )}
    </>
  );
}

function LoginHistoryTab() {
  const navigate = useNavigate();
  const [page, setPage] = usePageParam("loginPage");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "login-history", page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (statusFilter) params.set("status", statusFilter);
      const { data } = await api.get(`/admin/login-history?${params}`);
      return data;
    },
  });

  const history = data?.data || [];
  const pagination = data?.pagination;

  return (
    <>
      <FadeIn direction="up" delay={0.05}>
        <div className="flex gap-2 mb-6">
          {["", "success", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-sm rounded-md border capitalize ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-accent"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </FadeIn>

      {isLoading ? (
        <Spinner size="md" />
      ) : history.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No login history found</p>
        </div>
      ) : (
        <>
          <FadeIn direction="up" delay={0.1}>
            {/* Desktop table */}
            <div className="hidden lg:block border rounded-lg overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">
                      User
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      IP Address
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      Device
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      Status
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      Reason
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: any) => (
                    <tr key={h._id} className="border-t hover:bg-accent/30">
                      <td className="p-3">
                        {h.user?._id ? (
                          <button
                            onClick={() => navigate(`/members/${h.user._id}`)}
                            className="font-medium text-sm text-primary hover:underline truncate text-left max-w-full cursor-pointer"
                            title={h.user?.name || "Unknown"}
                          >
                            {h.user?.name || "Unknown"}
                          </button>
                        ) : (
                          <p
                            className="font-medium text-sm text-foreground truncate"
                            title={h.user?.name || "Unknown"}
                          >
                            {h.user?.name || "Unknown"}
                          </p>
                        )}
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={h.user?.email || ""}
                        >
                          {h.user?.email || ""}
                        </p>
                      </td>
                      <td
                        className="p-3 text-xs font-mono text-muted-foreground truncate"
                        title={h.ip || ""}
                      >
                        {h.ip || "-"}
                      </td>
                      <td
                        className="p-3 text-xs text-muted-foreground truncate"
                        title={h.userAgent || ""}
                      >
                        {h.userAgent ? parseUserAgent(h.userAgent) : "-"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            h.success !== false
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {h.success !== false ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td
                        className="p-3 text-xs text-muted-foreground truncate"
                        title={h.failureReason || ""}
                      >
                        {h.failureReason || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(h.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="lg:hidden space-y-3">
              {history.map((h: any) => (
                <div key={h._id} className="border rounded-lg p-4 bg-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      {h.user?._id ? (
                        <button
                          onClick={() => navigate(`/members/${h.user._id}`)}
                          className="font-medium text-sm text-primary hover:underline break-words text-left cursor-pointer"
                        >
                          {h.user?.name || "Unknown"}
                        </button>
                      ) : (
                        <p className="font-medium text-sm text-foreground break-words">
                          {h.user?.name || "Unknown"}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground break-all">
                        {h.user?.email || ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        h.success !== false
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {h.success !== false ? "Success" : "Failed"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs pt-2 border-t">
                    <div className="flex gap-2 min-w-0">
                      <span className="text-muted-foreground shrink-0">
                        IP:
                      </span>
                      <span className="font-mono text-foreground break-all">
                        {h.ip || "-"}
                      </span>
                    </div>
                    <div className="flex gap-2 min-w-0">
                      <span className="text-muted-foreground shrink-0">
                        Device:
                      </span>
                      <span className="text-foreground break-words">
                        {h.userAgent ? parseUserAgent(h.userAgent) : "-"}
                      </span>
                    </div>
                    <div className="flex gap-2 min-w-0">
                      <span className="text-muted-foreground shrink-0">
                        Date:
                      </span>
                      <span className="text-foreground break-words">
                        {formatDateTime(h.createdAt)}
                      </span>
                    </div>
                    {h.failureReason && (
                      <div className="flex gap-2 min-w-0">
                        <span className="text-muted-foreground shrink-0">
                          Reason:
                        </span>
                        <span className="text-foreground break-words">
                          {h.failureReason}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>

          {pagination && pagination.totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={pagination.totalPages}
              onChange={setPage}
            />
          )}
        </>
      )}
    </>
  );
}

/** Parse user agent string to a readable format */
function parseUserAgent(ua: string): string {
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Postman")) return "Postman";
  return ua.slice(0, 30);
}

function SuspiciousActivityTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "suspicious-activity"],
    queryFn: async () => {
      const { data } = await api.get("/admin/suspicious-activity");
      return data;
    },
  });

  if (isLoading) return <Spinner size="md" />;

  const {
    failedByIp = [],
    failedByUser = [],
    multipleIps = [],
  } = data?.data || {};

  const hasNoData =
    failedByIp.length === 0 &&
    failedByUser.length === 0 &&
    multipleIps.length === 0;

  if (hasNoData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          No suspicious activity detected in the last 24 hours
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Failed logins by IP */}
      {failedByIp.length > 0 && (
        <FadeIn direction="up" delay={0.1}>
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Failed Logins by IP (5+ in 24h)
              </h3>
            </div>
            {/* Desktop */}
            <div className="hidden sm:block">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[20%]" />
                  <col className="w-[40%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">
                      IP Address
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      Attempts
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      Last Attempt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failedByIp.map((item: any) => (
                    <tr key={item._id} className="border-t hover:bg-accent/30">
                      <td
                        className="p-3 font-mono text-xs text-muted-foreground truncate"
                        title={item._id || ""}
                      >
                        {item._id || "-"}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {item.count}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(item.lastAttempt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y">
              {failedByIp.map((item: any) => (
                <div key={item._id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-mono text-xs text-foreground break-all flex-1 min-w-0">
                      {item._id || "-"}
                    </p>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {item.count} attempts
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last attempt: {formatDateTime(item.lastAttempt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Failed logins by user */}
      {failedByUser.length > 0 && (
        <FadeIn direction="up" delay={0.2}>
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Failed Logins by User (3+ in 24h)
              </h3>
            </div>
            {/* Desktop */}
            <div className="hidden sm:block">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[14%]" />
                  <col className="w-[34%]" />
                  <col className="w-[24%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">
                      User
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      Attempts
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      IPs
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      Last Attempt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failedByUser.map((item: any) => (
                    <tr key={item._id} className="border-t hover:bg-accent/30">
                      <td className="p-3">
                        <p
                          className="font-medium text-sm text-foreground truncate"
                          title={item.userInfo?.name || "Unknown"}
                        >
                          {item.userInfo?.name || "Unknown"}
                        </p>
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={item.userInfo?.email || ""}
                        >
                          {item.userInfo?.email || ""}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          {item.count}
                        </span>
                      </td>
                      <td
                        className="p-3 text-xs text-muted-foreground font-mono truncate"
                        title={(item.ips || []).join(", ")}
                      >
                        {(item.ips || []).join(", ")}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(item.lastAttempt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y">
              {failedByUser.map((item: any) => (
                <div key={item._id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground break-words">
                        {item.userInfo?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground break-all">
                        {item.userInfo?.email || ""}
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      {item.count} attempts
                    </span>
                  </div>
                  {(item.ips || []).length > 0 && (
                    <p className="text-xs text-muted-foreground font-mono break-all mb-1">
                      IPs: {(item.ips || []).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Last: {formatDateTime(item.lastAttempt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Multiple IP logins */}
      {multipleIps.length > 0 && (
        <FadeIn direction="up" delay={0.3}>
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Multiple IP Logins (3+ IPs in 24h)
              </h3>
            </div>
            {/* Desktop */}
            <div className="hidden sm:block">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[32%]" />
                  <col className="w-[14%]" />
                  <col className="w-[54%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">
                      User
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      IP Count
                    </th>
                    <th className="text-left p-3 font-medium text-foreground">
                      IPs
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {multipleIps.map((item: any) => (
                    <tr key={item._id} className="border-t hover:bg-accent/30">
                      <td className="p-3">
                        <p
                          className="font-medium text-sm text-foreground truncate"
                          title={item.userInfo?.name || "Unknown"}
                        >
                          {item.userInfo?.name || "Unknown"}
                        </p>
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={item.userInfo?.email || ""}
                        >
                          {item.userInfo?.email || ""}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          {(item.ips || []).length}
                        </span>
                      </td>
                      <td
                        className="p-3 text-xs text-muted-foreground font-mono truncate"
                        title={(item.ips || []).join(", ")}
                      >
                        {(item.ips || []).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y">
              {multipleIps.map((item: any) => (
                <div key={item._id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground break-words">
                        {item.userInfo?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground break-all">
                        {item.userInfo?.email || ""}
                      </p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                      {(item.ips || []).length} IPs
                    </span>
                  </div>
                  {(item.ips || []).length > 0 && (
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {(item.ips || []).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
