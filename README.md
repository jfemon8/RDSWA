<div align="center">

<img src="client/public/icons/logo-light.png" alt="RDSWA" width="220" />

# RDSWA — Rangpur Divisional Student Welfare Association

**The official membership platform for Rangpur-Division students at the University of Barishal.**

রংপুর বিভাগীয় ছাত্র কল্যাণ সংসদ, বরিশাল বিশ্ববিদ্যালয়

[![Live Site](https://img.shields.io/badge/live-rdswa.info.bd-22c55e?style=flat-square)](https://www.rdswa.vercel.app/)
[![Stack](https://img.shields.io/badge/stack-MERN%20%2B%20TypeScript-3b82f6?style=flat-square)](#-tech-stack)
[![Frontend](https://img.shields.io/badge/frontend-Vercel-black?style=flat-square&logo=vercel)](https://vercel.com)
[![Backend](https://img.shields.io/badge/backend-Render-46e3b7?style=flat-square&logo=render)](https://render.com)
[![Database](https://img.shields.io/badge/database-MongoDB%20Atlas-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/atlas)
[![PWA](https://img.shields.io/badge/PWA-installable-5a0fc8?style=flat-square)](https://web.dev/progressive-web-apps/)
[![Node](https://img.shields.io/badge/node-≥18-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-private-lightgrey?style=flat-square)](#-license)

[Live Demo](https://www.rdswa.vercel.app/) · [Android App](https://apkpure.com/p/app.vercel.rdswa.twa) · [Report Issue](https://github.com/jfemon8/RDSWA/issues)

</div>

---

## ✨ About

**RDSWA** is a full-stack community platform built for the students, alumni, and welfare officers of the Rangpur Divisional Student Welfare Association at the University of Barishal. It runs the membership directory, committee elections, event lifecycle, real-time chat, donations, alumni network, mentorship, and a dozen more day-to-day operations on a single MERN + TypeScript codebase deployed across Vercel and Render.

The platform is **publicly browsable** for non-members (committee, events, notices, blood-donor list, vacation calendar, bus schedule), gated behind RBAC for members, and centrally manageable from a unified admin panel — all in one TypeScript monorepo.

---

## 🌟 Highlights

- **One TypeScript codebase, three workspaces** — `shared/` (types & constants) compiles first, then `server/` (Express API) and `client/` (React 19 + Vite SPA) consume it via npm workspaces.
- **31 Mongoose models** across 23 route modules covering everything from user profiles to bus counters.
- **Two-dimensional role system** — orthogonal _tier roles_ (`guest → user → member → moderator → admin → super_admin`) plus _tag flags_ (`isAlumni`, `isAdvisor`, `isSeniorAdvisor`). Auto-assigned from committee positions.
- **PWA-ready** — installable on Android (TWA published on APKPure), service-worker offline shell, NetworkFirst API caching, CacheFirst fonts.
- **i18n out of the box** — full English + বাংলা translations via i18next with browser-language detection.
- **Real-time everything** — Socket.IO for notifications, chat, presence, typing indicators, group memberships.
- **Accessible by default** — semantic landmarks, skip-to-content, ARIA roles/labels, keyboard nav across modals and lightboxes.
- **SEO-optimised** — react-helmet-async, OG/Twitter cards, sitemap.xml served from the API, prerender step in the build.

---

## 🚀 Tech Stack

### Frontend (`client/`)

| Layer         | Tools                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | **React 19**, **TypeScript 5.7**, **Vite 6**                                                                                                |
| Routing       | React Router v7 (lazy + Suspense per route)                                                                                                 |
| Styling       | Tailwind CSS 3.4, Radix UI primitives, ShadCN-style components                                                                              |
| State         | **TanStack Query v5** (server state) · **Zustand v5** (auth, theme, UI)                                                                     |
| Animations    | **motion** (Framer Motion v12) + custom ReactBits library (BlurText, GradientText, CountUp, RotatingText, SpotlightCard, FadeIn, ShinyText) |
| Forms         | React Hook Form + Zod resolvers                                                                                                             |
| Rich text     | **Tiptap v3** + DOMPurify sanitisation                                                                                                      |
| Real-time     | socket.io-client v4                                                                                                                         |
| PDF / Media   | react-pdf 10, pdfjs-dist 5, jspdf, html2canvas                                                                                              |
| Charts        | Recharts 3                                                                                                                                  |
| PWA           | vite-plugin-pwa with Workbox                                                                                                                |
| Observability | Sentry, Vercel Analytics + Speed Insights, Microsoft Clarity                                                                                |
| Testing       | Vitest, @testing-library/react, jsdom                                                                                                       |

### Backend (`server/`)

| Layer              | Tools                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| Runtime            | **Node ≥18**, **Express 4**, **TypeScript 5.7**                           |
| Database           | **MongoDB Atlas** via Mongoose 8                                          |
| Auth               | JWT access + refresh tokens, bcryptjs (12 salt rounds), httpOnly cookies  |
| Validation         | Zod 3 with shared schemas                                                 |
| Real-time          | Socket.IO 4 (presence, typing, group rooms)                               |
| Cache & rate-limit | Redis (ioredis) + rate-limit-redis                                        |
| Media              | Cloudinary (image / raw / video resource types) + multer                  |
| Email              | Nodemailer over SMTP (Gmail App Password in prod)                         |
| Push               | Web Push (VAPID) for browser notifications                                |
| Security           | Helmet, CORS, request-IP, role-based access control, audit log middleware |
| Testing            | Jest, supertest, mongodb-memory-server-core                               |

### Shared (`shared/`)

- Single source of truth for `UserRole`, `CommitteePosition`, `PERMISSIONS`, `SUPER_ADMIN_EMAILS`, `ADMIN_AUTO_POSITIONS`, hierarchy helpers, derived enums.

### Deployment & Tooling

- **Vercel** — client (SPA + prerender + static assets); rewrites `/api/*` and `/sitemap.xml` to Render in production.
- **Render** — Express server, Socket.IO upgrade path.
- **MongoDB Atlas** — managed M0/M2 cluster.
- **Cloudinary** — media CDN with proxy route for inline preview of `raw` PDFs/docs.
- **Docker Compose**, **PM2 ecosystem**, **k6** load tests, **Playwright** E2E, **GitHub Actions**-ready scripts.

---

## 🧩 Features

<table>
<tr><td valign="top" width="50%">

### 👤 Membership & People

- Public registration with email + OTP verification
- Two-step membership application flow (with academic + identity document review)
- Member directory with privacy filters per field
- Blood donor registry (always-visible phone)
- Alumni / Advisor / Senior Advisor tags
- Committee management with auto-role assignment from position
- Mentorship matching with auto-created consultation chat groups
- Force-set password (SuperAdmin only) with email + in-app notification

### 🏛 Organization

- Committees (current + archived) with auto Admin/Moderator promotion
- Voting & polls (drafts, time-based auto-open/close, result publish)
- Forms workflow (membership / construction-fund / alumni)
- Donations + campaign-based donations with verification
- Expenses & multi-month budgets
- Audit log + login history for compliance

</td><td valign="top" width="50%">

### 📢 Communication

- Real-time DMs and group chat (central, department, custom, consultation)
- Forum (topics, replies, pin/lock)
- Announcements broadcast to all members
- Notifications (in-app, email, web push, SMS-ready)
- Email digest (configurable: none/daily/weekly)
- Contact messages with admin reply

### 📅 Events & Content

- Events with QR check-in scanner + manual + bulk attendance
- Photo galleries per event with user tagging
- Activity reports + feedback with rating distribution
- Notices (scheduled publish, archive, attachments)
- Documents library with role-based access control
- **Vacation calendar** (yearly, with status pills, attachments, embedded PDF/image viewer)
- Job board for alumni/members
- Bus schedules with seasonal variations + CSV import

### 🛠 Admin Power

- Unified admin panel with role-gated sidebar
- Site-settings editor (homepage, university, vacation page, legal, social, payment, academic config)
- Auto-role rules editor (SuperAdmin)
- Backup & restore, audit logs, login history
- Microsoft Clarity dashboard integration

</td></tr></table>

---

## 🏗 Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        rdswa.vercel.app  (Vercel)                      │
│  React 19 SPA · PWA · prerender · Tailwind · Radix · Tiptap · Recharts │
└─────────────────────────────┬──────────────────────────────────────────┘
                              │  /api/* + /sitemap.xml rewrites
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      rdswa.onrender.com  (Render)                      │
│  Express · Socket.IO · Mongoose · Zod · JWT · Helmet · Rate-limit      │
│                                                                        │
│  Routes  →  Controller  →  Service  →  Mongoose Model                  │
│                  │                                                     │
│                  ├─ Auth middleware (JWT, refresh)                     │
│                  ├─ RBAC middleware (tier role + denyRestricted)       │
│                  ├─ Validate middleware (Zod)                          │
│                  ├─ Audit middleware (writes AuditLog)                 │
│                  └─ Cache middleware (Redis)                           │
└──────┬────────────────┬───────────────┬────────────────┬───────────────┘
       │                │               │                │
       ▼                ▼               ▼                ▼
   MongoDB Atlas    Cloudinary       Redis           Gmail SMTP
  (29 collections)  (img/raw/video) (cache + RL)    (Nodemailer)
```

### Backend pattern (always)

```
Routes → Controller → Service → Model
         (req/res)    (business)  (Mongoose)
```

Routes only wire `authenticate → authorize → validate → auditLog`. Services hold business logic. Models stay pure.

### Auth flow

- JWT **access token** — 15 min, returned in body
- JWT **refresh token** — 365 days, httpOnly cookie, rotated on use
- Axios interceptor on the client silently refreshes and retries on 401
- Three SuperAdmin emails are hardcoded in `shared/src/constants/roles.ts` and **auto-promoted on every request** — surviving any DB tampering

### Scheduled jobs (booted from `app.ts`)

- `syncRolesOnStart` — one-shot legacy role reconciliation
- `alumniTagger` (24 h) · `voteCloser` (5 min) · `voteActivator` · `reminderSender` (1 h)
- `paymentReminder` · `noticePublisher` · `emailDigest` · `chatMediaPurge`
- `initializeGroups` — central + department chat groups synced against academic config

---

## 📁 Project Structure

```
RDSWA/
├── shared/                       # @rdswa/shared — types, constants, enums
│   └── src/
│       ├── constants/            # roles, permissions, restricted lists
│       ├── types/                # User, Event, common DTOs
│       └── utils/
│
├── server/                       # @rdswa/server — Express + Mongoose
│   └── src/
│       ├── config/               # env (Zod), db, redis, cloudinary, mail, sentry
│       ├── controllers/          # thin req/res handlers
│       ├── services/             # business logic (auth, user, committee, …)
│       ├── models/               # 31 Mongoose models
│       ├── routes/               # 23 route modules + index aggregator
│       ├── middlewares/          # auth, rbac, validate, audit, cache, rate-limit
│       ├── validators/           # per-domain Zod schemas
│       ├── jobs/                 # scheduled + startup jobs
│       ├── utils/                # ApiError, ApiResponse, asyncHandler, pagination
│       ├── sockets/              # Socket.IO handlers (presence, chat)
│       └── app.ts                # bootstrap + all wiring
│
├── client/                       # @rdswa/client — React 19 + Vite SPA
│   ├── public/                   # static assets, ads.txt, icons, manifest
│   └── src/
│       ├── app/                  # router (lazy + guards)
│       ├── components/           # ui, chat, guards, promo, reactbits, seo, shared
│       ├── features/             # 22 feature folders (one per domain)
│       │   ├── home, about, university, committee, members
│       │   ├── events, notices, documents, gallery, voting
│       │   ├── donations, mentorship, jobs, bus-schedule, vacation
│       │   ├── communication, contact, dashboard, legal, auth
│       │   └── admin/            # 32 admin sub-features
│       ├── hooks/                # useSiteSettings, usePageParam, useTabParam, …
│       ├── layouts/              # PublicLayout, DashboardLayout, AdminLayout
│       ├── lib/                  # api, queryKeys, date (BST), fileProxy, stripHtml, roles
│       ├── stores/               # Zustand (auth, theme, ui)
│       ├── i18n/                 # en + bn translations
│       └── styles/
│
├── e2e/                          # Playwright tests
├── k6/                           # Load test scripts
├── docs/                         # Architecture notes
├── nginx.conf                    # Self-host reference
├── ecosystem.config.js           # PM2 config
├── docker-compose.yml            # Full-stack dev
├── render.yaml                   # Render service config
├── vercel.json                   # SPA rewrites + cache headers
├── playwright.config.ts
└── CLAUDE.md                     # AI agent guidance
```

---

## 🔧 Getting Started

### Prerequisites

- **Node.js ≥ 18** (project tested on 18 / 20 LTS)
- **npm 9+** (workspaces support)
- **MongoDB** — Atlas cluster or local instance
- **Cloudinary account** (free tier works) — for media uploads
- **Gmail App Password** — for transactional email (forgot-password, OTP, digest)
- **Redis** _(optional)_ — falls back to in-memory rate-limit if unset
- **Web Push VAPID keys** _(optional)_ — `npx web-push generate-vapid-keys`

### 1. Clone and install

```bash
git clone https://github.com/jfemon8/RDSWA.git
cd RDSWA
npm install              # installs every workspace
```

### 2. Configure environment

Create `server/.env`:

```bash
# Server
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173,http://localhost:4173

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/rdswa?retryWrites=true&w=majority

# JWT (replace in production)
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=365d

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraddr@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx     # Gmail App Password
EMAIL_FROM=RDSWA <youraddr@gmail.com>

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Optional
REDIS_URL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
SMS_GATEWAY_URL=
SMS_API_KEY=
SENTRY_DSN=
```

Create `client/.env`:

```bash
VITE_API_URL=http://localhost:5000/api
VITE_VAPID_PUBLIC_KEY=
VITE_SENTRY_DSN=
VITE_CLARITY_PROJECT_ID=
VITE_ADSENSE_PUBLISHER_ID=
VITE_ADSENSE_SLOT_SIDEBAR=
VITE_ADSENSE_SLOT_DISPLAY_RESPONSIVE=
VITE_ADSENSE_SLOT_INFEED=
```

### 3. Run dev

```bash
npm run dev              # concurrently boots server (5000) + client (5173)

# Or individually:
npm run dev:server
npm run dev:client
```

The first request to the server triggers DB connection, schema sync, central + department chat-group initialisation, role-sync job, and SMTP verification. Watch the terminal for `[Mail] SMTP transporter verified — ready to send.`

### 4. Build for production

```bash
npm run build            # shared → server → client (order matters)
```

### 5. Test

```bash
npm test                              # all workspaces
npm test --workspace=server           # Jest + mongodb-memory-server
npm test --workspace=client           # Vitest + RTL
npx playwright test                   # E2E
```

---

## 🔑 Role System (cheat sheet)

```
Tier roles  (single value)
guest → user → member → moderator → admin → super_admin

Tag flags  (orthogonal booleans, can stack)
isAlumni · isAdvisor · isSeniorAdvisor
```

- **`authorize(UserRole.X)`** — middleware that enforces a minimum tier
- **`denyRestricted(emails)`** — blocks specific SuperAdmin emails from a scoped capability (e.g. backup or settings)
- **Auto-promotion** — `SUPER_ADMIN_EMAILS` (hardcoded in `shared/`) get `super_admin` injected on every authenticated request
- **Committee-driven roles** — President/General Secretary → Admin · Organizing Secretary/Treasurer → Moderator · ex-Pres/GS in archived committee → Moderator + Advisor

---

## 📦 Scripts

### Root

```bash
npm run dev               # start everything in parallel
npm run dev:server        # server only
npm run dev:client        # client only
npm run build             # shared → server → client
npm test                  # all workspaces
```

### Server

```bash
npm run dev --workspace=server                  # tsx watch
npm run build --workspace=server                # tsc
npm run backfill:role-flags --workspace=server  # one-off DB migration
```

### Client

```bash
npm run dev --workspace=client                  # Vite
npm run build --workspace=client                # tsc -b && vite build && prerender
npm run preview --workspace=client              # serve dist locally
npm run generate:icons --workspace=client       # PWA icons from logo
npm run generate:og --workspace=client          # OG card image
npm run generate:feature --workspace=client     # Play Store graphic
```

---

## 🚢 Deployment

| Service           | Hosts             | Notes                                                                                                                                    |
| ----------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Vercel**        | `client/dist` SPA | `vercel.json` rewrites `/api/*` → Render, `/sitemap.xml` → API. Static-file globbing excludes `ads.txt`, `robots.txt` from SPA fallback. |
| **Render**        | `server/` Express | Auto-deploys on push to `main`. Free tier sleeps after 15 min idle — use UptimeRobot or upgrade for 24/7.                                |
| **MongoDB Atlas** | All collections   | Whitelist Render egress IPs in Atlas Network Access.                                                                                     |
| **Cloudinary**    | All media         | Image / raw / video resource types. PDFs go through `/api/upload/proxy` for inline preview.                                              |

### Environment variables on hosting providers

- **Vercel**: client build picks up `VITE_*` vars at build time. Set them in the Vercel project's Environment Variables.
- **Render**: server reads `process.env.*` at boot. Set every key from `server/.env` plus `CLIENT_URL=https://www.rdswa.info.bd`.

### Troubleshooting

- **Email not sending in production** — most often Gmail App Password revoked. Generate a new one at <https://myaccount.google.com/apppasswords>, paste into Render `SMTP_PASS`, restart. `[Mail] SMTP transporter verified` should appear in logs.
- **`ads.txt` returns 404 intermittently** — service worker bug. Already fixed: `navigateFallbackDenylist` excludes static-file extensions.
- **Render cold start** — first request after 15 min idle takes ~60 s. Ping the service every 5 min via UptimeRobot, or upgrade plan.

---

## 🧪 Quality Gates

- **Type-safe end-to-end** — `shared/` types reused in client and server.
- **Zod validation at every boundary** — request bodies, query params, env vars.
- **Sentry** for runtime errors (client and server SDKs).
- **Vercel Analytics + Speed Insights** for Core Web Vitals.
- **Microsoft Clarity** for session replay and heatmaps.
- **Playwright** for E2E flows, **k6** for load tests.
- **Audit log** writes for every privileged mutation.

---

## 🤝 Contributing

This is a private project for the RDSWA organisation. If you're a member with code access:

1. Fork or branch from `main`.
2. `npm install` from the root (workspaces resolve automatically).
3. Run `npm run dev` and verify both client and server boot cleanly.
4. Make changes — keep the **Routes → Controller → Service → Model** layering on the server.
5. Run `npm run build` from the root **before opening a PR** — TypeScript errors only surface in the full chain because of the shared workspace.
6. Add tests when you touch service logic or shared utilities.
7. Match existing animation patterns: `motion/react` primitives, `FadeIn` for staggered lists, `BlurText`/`GradientText` for headings.

---

## 🙌 Credits

- Engineered by the RDSWA tech team at the **University of Barishal**.
- Logo and brand assets © RDSWA.
- Open-source dependencies are credited in their respective `package.json` files.

---

## 📜 License

This project is **private** and licensed for use by the Rangpur Divisional Student Welfare Association at the University of Barishal. All rights reserved.

External contributors who reach this repository: please ⭐ if it helped you understand a real-world MERN + TypeScript monorepo, but don't reuse brand assets or hardcoded admin emails.

---

<div align="center">

**Built with care for the Rangpur Division student community at BU.**
_রংপুর বিভাগীয় ছাত্র কল্যাণ সংসদ, বরিশাল বিশ্ববিদ্যালয়_

[🌐 rdswa.info.bd](https://www.rdswa.info.bd/) · [📱 Android App](https://apkpure.com/p/app.vercel.rdswa.twa) · [📧 emon.cse6.bu@gmail.com](mailto:emon.cse6.bu@gmail.com)

</div>
