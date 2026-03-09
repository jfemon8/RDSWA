# RDSWA Web Platform

## Project Overview
Rangpur Divisional Student Welfare Association (RDSWA) — Barishal University. A membership-based organization platform with RBAC, committee management, donations, voting, bus schedules, and communication features.

## Tech Stack
- **Frontend**: React 19 + Vite + TypeScript, TanStack Query, React Router v7, Tailwind CSS + ShadCN UI, Zustand, React Hook Form + Zod
- **Backend**: Node.js + Express + TypeScript, MongoDB + Mongoose, JWT auth, Zod validation
- **Shared**: TypeScript types and constants shared between client/server via npm workspace

## Monorepo Structure
- `client/` — React frontend (Vite)
- `server/` — Express backend
- `shared/` — Shared types & constants

## Key Commands
- `npm run dev` — Run both client and server
- `npm run dev:server` — Server only
- `npm run dev:client` — Client only
- `npm run build` — Build all workspaces

## Architecture Notes
- Controller → Service → Model pattern on backend
- Zod for validation on both client and server
- JWT access + refresh token auth
- RBAC with 9 roles: guest, user, member, alumni, advisor, senior_advisor, moderator, admin, super_admin
- SuperAdmin hardcoded to specific emails — checked at login
- Moderator auto-assigned to committee President, GS, Organizing Secretary, Treasurer
