import { ExternalLink, Eye, Activity, Map, Lightbulb, ShieldCheck, AlertTriangle, Copy, Check, MousePointerClick } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { useToast } from '@/components/ui/Toast';
import SEO from '@/components/SEO';
import { CLARITY_PROJECT_ID, isClarityEnabled } from '@/lib/clarity';

/**
 * User Activity dashboard surface for SuperAdmins, powered by Microsoft
 * Clarity (free behavioural analytics — session recordings, heatmaps,
 * scroll depth, dead-clicks, rage-clicks, smart insights).
 *
 * Why deep-link instead of in-app embed:
 *   Clarity blocks <iframe> embedding of clarity.microsoft.com (X-Frame
 *   denied) and does not expose a public Data API for arbitrary metric
 *   queries — the canonical workflow is "click through to the Clarity
 *   dashboard, work there, come back". This page is therefore a launcher
 *   + status surface rather than a clone — admins use the real Clarity
 *   UI for recordings/heatmaps/insights.
 *
 * Access control: gated by AdminRoleGuard with CLARITY_RESTRICTED_SUPER_
 * ADMINS in router.tsx, so the email denylist is enforced at the route
 * level — we don't re-check here.
 */
export default function AdminClarityPage() {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const enabled = isClarityEnabled();

  // Clarity dashboard URLs follow the pattern:
  //   https://clarity.microsoft.com/projects/view/<PROJECT_ID>/<SECTION>
  // When the project ID isn't configured we fall back to clarity.microsoft.com
  // so admins still land in the right place after picking their project.
  const baseUrl = CLARITY_PROJECT_ID
    ? `https://clarity.microsoft.com/projects/view/${CLARITY_PROJECT_ID}`
    : 'https://clarity.microsoft.com';
  const dashboardUrl = CLARITY_PROJECT_ID ? `${baseUrl}/dashboard` : baseUrl;
  const recordingsUrl = CLARITY_PROJECT_ID ? `${baseUrl}/recordings` : baseUrl;
  const heatmapsUrl = CLARITY_PROJECT_ID ? `${baseUrl}/heatmaps` : baseUrl;
  const insightsUrl = CLARITY_PROJECT_ID ? `${baseUrl}/impressions` : baseUrl;

  const copyProjectId = async () => {
    try {
      await navigator.clipboard.writeText(CLARITY_PROJECT_ID);
      setCopied(true);
      toast.success('Project ID copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="space-y-6">
      <SEO title="User Activity" description="Microsoft Clarity user-activity monitoring for RDSWA SuperAdmins." noindex />

      <FadeIn direction="up" delay={0}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <Eye className="h-6 w-6 text-primary" />
            </motion.div>
            <div>
              <BlurText
                text="User Activity"
                className="text-2xl sm:text-3xl font-bold"
                delay={50}
                animateBy="words"
                direction="bottom"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Watch session recordings, heatmaps, and behaviour insights powered by Microsoft Clarity.
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Status card */}
      <FadeIn direction="up" delay={0.1}>
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <AnimatePresence mode="wait">
              {enabled ? (
                <motion.div
                  key="ok"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center"
                >
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
              ) : (
                <motion.div
                  key="off"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center"
                >
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="min-w-0">
              <h2 className="font-semibold text-base">
                {enabled ? 'Tracking active' : 'Tracking not configured'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {enabled
                  ? 'Session recordings, heatmaps, and behaviour signals are being captured in real time.'
                  : 'Set VITE_CLARITY_PROJECT_ID in the deployment environment to start recording sessions.'}
              </p>
            </div>
          </div>

          {enabled && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Project ID
                </p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <code className="text-sm font-mono truncate">{CLARITY_PROJECT_ID}</code>
                  <motion.button
                    onClick={copyProjectId}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 rounded-md hover:bg-accent shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Copy project ID"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {copied ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                        >
                          <Check className="h-4 w-4 text-emerald-500" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="copy"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                        >
                          <Copy className="h-4 w-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                  Tool
                </p>
                <p className="text-sm mt-1">Microsoft Clarity · free, unlimited sessions</p>
              </div>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Quick action cards — deep links into Microsoft Clarity */}
      <FadeIn direction="up" delay={0.15}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionCard
            href={dashboardUrl}
            icon={Activity}
            title="Dashboard"
            subtitle="Live overview — sessions, top pages, browser/device split"
          />
          <ActionCard
            href={recordingsUrl}
            icon={MousePointerClick}
            title="Session Recordings"
            subtitle="Replay anonymised user sessions to see exactly how people use the site"
          />
          <ActionCard
            href={heatmapsUrl}
            icon={Map}
            title="Heatmaps"
            subtitle="Click, scroll, and area heatmaps for every page"
          />
          <ActionCard
            href={insightsUrl}
            icon={Lightbulb}
            title="Smart Insights"
            subtitle="Auto-detected rage clicks, dead clicks, excessive scrolling, JS errors"
          />
        </div>
      </FadeIn>

      {/* Help / how-this-works */}
      <FadeIn direction="up" delay={0.25}>
        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold mb-3">How this works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Every visitor session — whether they're logged in or browsing anonymously — is recorded as a replayable video. Mouse movement, clicks, scrolls, and form interactions are captured. Personal text input (passwords, fields marked sensitive) is automatically masked.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Heatmaps aggregate clicks and scrolls across all visitors — so you can see exactly which buttons get used, which sections get ignored, and where users drop off.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                To grant another SuperAdmin direct access to the Clarity dashboard, open <code className="text-xs">clarity.microsoft.com</code> → Settings → Team → <em>Add team member</em> → enter their email → role <strong>Admin</strong> or <strong>Team Member</strong> → Add. They'll get an invite email.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Local development never sends data: <code className="text-xs">VITE_CLARITY_PROJECT_ID</code> is unset in <code className="text-xs">.env</code>, so the tracker is silently disabled — your dev sessions don't pollute production recordings.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Clarity is free and unlimited — no traffic caps, no upgrade prompt. Microsoft funds it as a way to encourage AI training on UX behaviour data (anonymised).
              </span>
            </li>
          </ul>
        </div>
      </FadeIn>
    </div>
  );
}

interface ActionCardProps {
  href: string;
  icon: typeof Eye;
  title: string;
  subtitle: string;
}

function ActionCard({ href, icon: Icon, title, subtitle }: ActionCardProps) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="group bg-card border rounded-xl p-4 hover:border-primary/40 transition-colors flex items-start gap-3"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-sm">{title}</h3>
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">{subtitle}</p>
      </div>
    </motion.a>
  );
}
