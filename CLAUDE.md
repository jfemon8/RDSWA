# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rangpur Divisional Student Welfare Association (RDSWA) — University of Barishal. A membership-based organization platform with RBAC, committee management, donations, voting, bus schedules, mentorship, and real-time communication. MERN stack + TypeScript monorepo using npm workspaces.

## Commands

Root-level (orchestrates workspaces):
- `npm run dev` — concurrent server + client dev servers
- `npm run dev:server` / `npm run dev:client` — single workspace
- `npm run build` — builds shared → server → client (order matters; shared must compile first so its `dist/` is available to the other two)
- `npm test` — runs tests in every workspace that has a `test` script

Per-workspace:
- Server: `npm run build --workspace=server` (tsc), `npm test --workspace=server` (Jest + mongodb-memory-server)
- Client: `npm run build --workspace=client` (`tsc -b && vite build`), `npm test --workspace=client` (Vitest)
- Server one-off: `npm run backfill:role-flags --workspace=server` — migrates legacy `role: 'alumni'|'advisor'|'senior_advisor'` users to tier role + boolean flag

**After any build-affecting change, always run `npm run build` from the root** — TypeScript errors in one workspace are only caught when the full chain compiles.

## Architecture

### Monorepo layout
```
shared/   — TS types + constants consumed by BOTH client & server via @rdswa/shared workspace reference
server/   — Express API (controller → service → model)
client/   — React 19 + Vite SPA
vercel.json — Rewrites /api/* to https://rdswa.onrender.com/api/* in production
```

Shared is the single source of truth for enums like `UserRole`, `CommitteePosition`, `PERMISSIONS`, `SUPER_ADMIN_EMAILS`, `ADMIN_AUTO_POSITIONS`. **Never duplicate these** — always import from `@rdswa/shared`.

### Role system (critical to understand)

Two orthogonal dimensions on every user:

1. **Tier role** (`user.role`) — single privilege level from `TIER_HIERARCHY`: `guest → user → member → moderator → admin → super_admin`. This controls access via `authorize()` middleware and `hasMinRole()` on the client.
2. **Tag flags** (`isAlumni`, `isAdvisor`, `isSeniorAdvisor`) — orthogonal booleans. These are NOT in the tier hierarchy. Anyone can have tags alongside any tier role.

The `ROLE_HIERARCHY` export still includes tag roles at legacy positions for backward compatibility with older DB rows. **Use `TIER_HIERARCHY` for display and tier comparisons**, `ROLE_HIERARCHY` only where legacy DB values must be handled.

**SuperAdmin emails** are hardcoded in [shared/src/constants/roles.ts](shared/src/constants/roles.ts). The auth middleware auto-promotes these emails on every request. One entry (`manikmia.phy@gmail.com`) is in `RESTRICTED_SUPER_ADMINS` — the `denyRestricted()` middleware blocks them from Settings and Backup routes.

### Auto-role assignment from committee positions

[server/src/services/committee.service.ts](server/src/services/committee.service.ts) is the source of truth:

| Position | Current committee | Archived committee |
|----------|-------------------|-------------------|
| President, General Secretary | → Admin role | → Moderator + Advisor tag (ex-officer) |
| Organizing Secretary, Treasurer | → Moderator role | → loses Moderator, base role |
| Others | no change | Advisor tag for ex-Pres/GS only |

Startup sync job [roleSyncOnStart.ts](server/src/jobs/roleSyncOnStart.ts) runs on every server boot to reconcile legacy DB state. Also handles tag-role migration for users with `role: 'alumni'/'advisor'/'senior_advisor'` (legacy tier values).

### Backend pattern

Always: **Routes → Controller → Service → Model**. Routes only wire auth/validation/audit middleware; controllers handle req/res; services hold all business logic; models are Mongoose schemas. New endpoints must follow this chain.

Auth middleware chain:
- `authenticate()` — requires JWT; `authenticate(true)` allows optional auth
- `authorize(UserRole.X)` — RBAC by tier, uses `ROLE_HIERARCHY.indexOf()` for comparisons, SuperAdmin always bypasses
- `denyRestricted()` — blocks `RESTRICTED_SUPER_ADMINS` on sensitive routes
- `validate({ body: zodSchema })` — Zod validation; returns 400 with field-level errors
- `auditLog(action, resource)` — writes to AuditLog collection

### Client patterns

- **TanStack Query** for all server state. Query keys are centralized in [client/src/lib/queryKeys.ts](client/src/lib/queryKeys.ts) — use these, don't inline arrays.
- **Zustand** for auth/theme/UI state only ([authStore.ts](client/src/stores/authStore.ts) has `AuthUser` type — update this when adding new user fields, or TS errors will appear in consumer components).
- **Axios interceptor** in [client/src/lib/api.ts](client/src/lib/api.ts) handles token refresh on 401 with automatic retry. `API_BASE` must be trailing-slash-stripped.
- **Rich text**: Tiptap v3 via `RichTextEditor` component. StarterKit already includes Underline — **do not import `@tiptap/extension-underline` separately** (causes duplicate extension warning).
- **Privacy filtering**: User profile endpoints apply `applyVisibilityFilter()` server-side based on `profileVisibility` settings. Moderator+ bypasses the filter. Blood donor list intentionally always shows phone regardless of privacy.
- **stripHtml utility** ([client/src/lib/stripHtml.ts](client/src/lib/stripHtml.ts)) — use for list views / previews of rich-text fields to avoid raw `<p>` tags appearing as plain text.

### Critical display conventions

- **Dates/times**: always use [client/src/lib/date.ts](client/src/lib/date.ts) helpers — they force `Asia/Dhaka` (BST, UTC+6). Never write custom formatters.
- **File URLs**: Cloudinary `raw` assets (PDFs, docs) must go through the `/api/upload/proxy?url=...` route via `proxyFileUrl()` from [client/src/lib/fileProxy.ts](client/src/lib/fileProxy.ts). Direct Cloudinary URLs serve `application/octet-stream` which breaks in-browser preview and filename-keeping downloads.
- **QR codes**: per-user QR is generated client-side via `UserEventQr` component. Format: `RDSWA:CHECKIN:{eventId}:{userId}`. Scanner in `CheckInScannerPage` parses this exact format. Domain-independent by design.

### Animation conventions

Frontend changes should animate — the project has consistent patterns:
- `motion/react` primitives (`motion.div`, `AnimatePresence`, `whileHover`, `whileTap`)
- `FadeIn` with `direction="up"` and staggered `delay={i * 0.05}` for lists
- `BlurText` / `GradientText` for page headings
- Spring transitions for icons: `{ type: 'spring', stiffness: 260, damping: 20 }`

### Mentorship + Consultation groups

Accepting a mentorship auto-creates a `ChatGroup` with `type: 'consultation'` named `"{MentorName}'s Consultation"`. Mentor is creator/admin. Mentees are auto-added on accept and auto-removed on cancel/complete. Active mentorships expose mentor ↔ mentee email/phone regardless of privacy settings (mentorship implies consent). The `type` enum on ChatGroup is `'central' | 'department' | 'custom' | 'consultation'` — consultation groups follow leave-group rules similar to custom groups.

## Content is dynamic — never hardcode

ALL user-facing content must be fetched from the database (SiteSettings or relevant collection). No hardcoded arrays, text blobs, or descriptions in React components. When seeding initial values, use Mongoose schema defaults.

## Scheduled jobs (server startup)

Initialized in [server/src/app.ts](server/src/app.ts) `start()`:
- `syncRolesOnStart` — one-shot role reconciliation
- `alumniTagger` (24h), `voteCloser` (5min), `voteActivator`, `reminderSender` (1h), `paymentReminder`, `noticePublisher`, `emailDigest`, `chatMediaPurge`
- `initializeGroups` — ensures central + department groups exist with current admin memberships

## Known gotchas

- **Mongoose `type` key collision**: sub-documents with a field named `type` collapse to `[String]` unless declared as explicit `new Schema({...}, { _id: false })`. See `noticeAttachmentSchema` in [Notice.ts](server/src/models/Notice.ts).
- **Committee member display**: array contains both active and left members. Always filter `!m.leftAt` in the UI.
- **Vote list for moderators**: service returns drafts only for `MODERATOR+`. Regular users see only active/closed/published.
- **Refresh token URL**: `API_BASE` must have trailing slashes stripped to avoid `/api//auth/refresh-token`.
