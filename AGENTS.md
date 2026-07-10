# CRM-GE — Agent instructions

## Project structure

Two independent packages (no workspace monorepo):

- **`server/`** — Express + TypeScript + Prisma + PostgreSQL. Entry: `src/index.ts`. Port `3001`.
- **`client/`** — React 19 + Vite 8 + TypeScript 6 + Tailwind CSS v4 + React Router 7. Dev server at `:5173`, proxies `/api` → `:3001`.

## Setup & commands

```bash
# Start Postgres (Docker)
docker compose up -d

# Server
cd server
cp .env.production .env      # or create .env with DATABASE_URL
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed            # creates admin@crmge.com / admin123
npm run dev                   # tsx watch src/index.ts

# Client
cd client
npm install
npm run dev                   # vite dev server at :5173
```

| Command | Location | Notes |
|---|---|---|
| `npm run dev` | server | `tsx watch` (not ts-node, not nodemon) |
| `npm run dev` | client | `vite` |
| `npm run build` | server | `tsc` → `dist/` (CommonJS) |
| `npm run build` | client | `tsc -b && vite build` (typecheck + build) |
| `npm run lint` | client | ESLint only (no server lint) |
| `npm run preview` | client | `vite preview` |

## Prisma

- Provider: PostgreSQL (`DATABASE_URL` env var)
- Commands: `npx prisma generate`, `npx prisma migrate dev`, `npx prisma db seed`
- Seed: `prisma/seed.ts` via `tsx` (configured in package.json `"prisma": { "seed": "tsx prisma/seed.ts" }`)
- Default admin: `admin@crmge.com` / `admin123`

## Client quirks

- **Tailwind v4**: uses `@tailwindcss/vite` plugin. No `tailwind.config`, no `@tailwind` directives — import `index.css` directly.
- **tsconfig.app.json** enforces: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for type-only imports), `erasableSyntaxOnly` (no enums/namespaces).
- Build runs `tsc -b` first — type errors break the build.
- ESLint: `eslint-plugin-react-refresh` requires that components are exported as named (not default) exports when a file ends in `.tsx`.

## Auth

- JWT in `localStorage('token')`. `api.ts` interceptor adds `Authorization: Bearer <token>`.
- 401/403 clears token and redirects to `/login`.
- Admin role required for `/api/admin/*` routes (`server/src/middleware/admin.ts`).

## Routes

| Path | Access | Notes |
|---|---|---|
| `/login` | public | |
| `/captacion` | public | Public lead capture form |
| `/` | auth | Dashboard |
| `/leads` | auth | Lead list (filters: source, status, search) |
| `/leads/:id` | auth | Lead detail + activity timeline |
| `/pipeline` | auth | Kanban pipeline |
| `/admin/users` | auth + admin | User management |

## Lead lifecycle

`nuevo` → `contactado` → `negociacion` → `cerrado` | `perdido`

Sources: `web`, `ig_ads`, `whatsapp`, `otro`. Activity types: `llamada`, `email`, `reunion`, `nota`.

## No tests

No test runner, no test files. No CI/CD config.

## Production deploy

- `deploy.sh` expects absolute path `/apps/crmge/`. Runs `npm install && npm run build` in both packages.
- `ecosystem.config.js` runs the server via PM2.
- `nginx-crmge.conf` serves `client/dist/` and proxies `/api/` to `:3001`.
