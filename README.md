# Household Ledger

A shared finance dashboard for two people who bank separately. See the
architecture document for the full system design, database schema, and
7-day build roadmap.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase
(Auth, Postgres, Edge Functions) · Akahu · Vercel.

## Getting started

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`.env.local` is only required once Supabase and Akahu are wired up in a
later milestone — the app runs without it today.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Lint the project |

## Deployment

Connected to Vercel for automatic preview deployments on every pull
request and production deploys on merge to `main`.
