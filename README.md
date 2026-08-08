# Stora monorepo

Two Next.js apps sharing one Supabase/Postgres database, managed as npm workspaces.

- `apps/dashboard` — vendor dashboard (inventory, orders, POS, deliveries, services)
- `apps/store` — customer-facing storefront

## Setup

```bash
npm install
```

Each app keeps its own `.env.local` (see `.env.example` in each app directory).

## Development

```bash
npm run dev:dashboard   # http://localhost:3000
npm run dev:store       # run with PORT=3001 if running both at once
```

## Build

```bash
npm run build:dashboard
npm run build:store
```

## Deployment

Each app deploys independently (e.g. two Vercel projects pointing at
`apps/dashboard` and `apps/store` respectively as their root directory) from
this single repo.
