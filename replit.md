# Apex AI Kitchen Designer

Measurement-driven kitchen concept designer backed by an Apex product catalog. Geometry and catalog selection are deterministic; AI is used only for a short narrative and an illustrative photorealistic concept image.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server.
- `pnpm --filter @workspace/apex-designer run dev` — run the Vite client.
- `pnpm run typecheck` — typecheck all packages.
- `pnpm run build` — typecheck and build all packages.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate React Query and Zod clients after API contract changes.
- `pnpm --filter @workspace/db run push` — reconcile Drizzle schema in development.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- React + Vite + TanStack Query
- Express 5
- PostgreSQL + Drizzle ORM
- OpenAPI + Orval + Zod
- OpenAI narrative and image generation

## Production environment

Copy `.env.example` into your deployment secret manager and replace every placeholder. Production startup intentionally fails if `APEX_ADMIN_KEY`, `RATE_LIMIT_SALT`, or required AI integration variables are missing.

Important:
- `APEX_ADMIN_KEY` must be at least 32 random characters.
- `RATE_LIMIT_SALT` must be at least 16 random characters.
- Never expose either secret as a `VITE_*` variable.
- Leave `ALLOWED_ORIGINS` empty for same-origin-only deployments. Set it to a comma-separated allowlist only when needed.
- Set `TRUST_PROXY_HOPS` to the number of trusted reverse proxies in front of Express.

## Security model

- `/api/products*` and `/api/catalog-summary` require `Authorization: Bearer <APEX_ADMIN_KEY>`.
- The Catalog page asks for the admin key and stores it only in `sessionStorage`, so closing the browser tab clears it.
- Public design responses omit internal product cost, stock quantity, and internal notes.
- Design and image-generation endpoints use PostgreSQL-backed hashed rate limits, which survive restarts and work across multiple app instances.
- API responses use no-store caching and baseline browser security headers.
- Health checks verify the database, not just the Node process.
- The server handles SIGTERM/SIGINT and drains the HTTP server/database pool.

## Design integrity

The measured plan is authoritative. AI images are illustrative only and are never fabrication drawings. Product verification, inventory, slab yield, code clearances, and installation must still be confirmed by Apex.

The Open / Island Only layout intentionally creates no perimeter cabinet run, but Wall A remains a valid measured room edge for windows, openings, and fixtures.

## CI

`.github/workflows/ci.yml` runs frozen-lockfile install, typecheck, and production build on pull requests and main.
