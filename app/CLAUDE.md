# CLAUDE.md

## What This Is

Next.js 14 frontend for Deep Copy — AI content generation SaaS. Full-stack app with API routes, authentication, and dashboard.

## Project Map

```
app/                      # Next.js App Router
  api/                    # Backend API routes
  dashboard/              # Main user dashboard
  admin/                  # Admin pages
  create/                 # Content creation flows
  jobs/                   # Job management
  results/                # Results display
  layout.tsx              # Root layout with providers

components/               # React components
  ui/                     # Base UI (Radix + shadcn/ui)
  landing/                # Marketing pages
  dashboard/              # Dashboard-specific
  [feature]/              # Feature components

lib/                      # Core utilities
  services/               # Business logic
  validation/             # Zod schemas
  db/                     # Database utilities
  auth/                   # Auth helpers

stores/                   # Zustand stores (auth, jobs, templates)
hooks/                    # Custom hooks (polling, auth, mobile)
contexts/                 # React Context (app state, sidebar, loading)
```

## How to Build & Run

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npm run clean` — clear caches

## Tech Stack

| Purpose | Tech |
|---------|------|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, Radix UI, shadcn/ui |
| State | Zustand (stores), React Query (server state), Context (UI state) |
| Forms | React Hook Form + Zod |
| Auth | Custom auth with middleware protection |
