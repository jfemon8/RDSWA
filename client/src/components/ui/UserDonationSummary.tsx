import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { HandCoins, Lock } from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/date";
import { FadeIn } from "@/components/reactbits";

const money = (n: number) => `BDT ${(n || 0).toLocaleString()}`;

/** Rows shown before the list starts scrolling, sized so the next row is half-visible and the scroll is obvious. */
const SCROLL_AFTER_ROWS = 6;

const TYPE_LABELS: Record<string, string> = {
  "one-time": "One-time",
  monthly: "Monthly",
  "event-based": "Event",
  "construction-fund": "Construction Fund",
  membership: "Membership",
};

/** Donation total on any member's profile, opened up into the individual records for the member and Admin+. */
export default function UserDonationSummary({
  userId,
  className = "",
}: {
  userId: string;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: ["user-donations", userId],
    queryFn: async () => (await api.get(`/users/${userId}/donations`)).data,
    enabled: !!userId,
  });

  const summary = data?.data;
  if (!summary || summary.count === 0) return null;

  const donations: any[] = summary.donations || [];
  const byType: any[] = summary.byType || [];

  return (
    <FadeIn direction="up">
      <div className={`border rounded-lg p-4 sm:p-5 bg-card ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <HandCoins className="h-5 w-5 text-emerald-600" />
          <h3 className="font-semibold text-foreground">Contributions</h3>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">
            {money(summary.total)}
          </p>
          <p className="text-xs text-muted-foreground">
            Across {summary.count} donation{summary.count === 1 ? "" : "s"}
            {summary.lastDonationAt &&
              ` · Last on ${formatDate(summary.lastDonationAt)}`}
          </p>
        </div>

        {byType.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {byType.map((t: any) => (
              <span
                key={t._id || "other"}
                className="px-2 py-0.5 rounded-full bg-muted text-xs text-foreground"
              >
                {TYPE_LABELS[t._id] || t._id || "Other"} · {money(t.total)}
              </span>
            ))}
          </div>
        )}

        {summary.canSeeDetails && (
          <div
            className={`space-y-1 ${
              donations.length > SCROLL_AFTER_ROWS
                ? "max-h-[13rem] overflow-y-auto overscroll-contain pr-1"
                : ""
            }`}
          >
            {donations.map((d: any, i: number) => (
              <motion.div
                key={d._id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="flex flex-wrap items-center gap-2 py-1.5 px-2.5 bg-muted rounded text-xs"
              >
                <span className="text-muted-foreground whitespace-nowrap">
                  {formatDate(d.donationDate || d.createdAt)}
                </span>
                <span className="text-foreground">
                  {TYPE_LABELS[d.type] || d.type}
                </span>
                {d.campaign?.title && (
                  <span className="text-muted-foreground truncate">
                    {d.campaign.title}
                  </span>
                )}
                {d.event?.title && (
                  <span className="text-muted-foreground truncate">
                    {d.event.title}
                  </span>
                )}
                <span className="text-muted-foreground capitalize">
                  {d.paymentMethod}
                </span>
                {d.visibility === "private" && (
                  <span
                    title="Hidden"
                    className="inline-flex items-center gap-1 text-muted-foreground"
                  >
                    <Lock className="h-3 w-3" /> Private
                  </span>
                )}
                <span className="ml-auto font-medium text-emerald-600 whitespace-nowrap tabular-nums">
                  {money(d.amount)}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {summary.canSeeDetails && summary.count > donations.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the latest {donations.length} of {summary.count} donations.
          </p>
        )}
      </div>
    </FadeIn>
  );
}
