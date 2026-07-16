# CollabSphere

A real-time collaborative workspace for student project teams. Each workspace has four sections — **Project** (kanban board), **Task Planner** (searchable/filterable task list), **Files Hub** (object-storage-backed uploads), and **Meetings** (scheduling) — plus live presence/cursors, edit locks, activity feed, role-based membership, and a 4-theme system (dark, light, sand, glass), all synced instantly across everyone viewing the same workspace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/collabsphere run dev` — run the frontend (artifact `collabsphere`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (provisioned), `SESSION_SECRET` (provisioned; used to derive JWT signing secrets)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Socket.IO (mounted on the same HTTP server, path `/api/socket.io/`)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT access token (short-lived, kept in memory on the client) + httpOnly rotating refresh cookie
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) → `@workspace/api-zod`, `@workspace/api-client-react`
- Frontend: React + Vite, wouter, TanStack Query, shadcn/Radix UI
- Build: esbuild (CJS bundle)

## Where things live

- OpenAPI contract: `lib/api-spec/openapi.yaml` (source of truth for all REST endpoints/schemas — edit here, then run codegen)
- DB schema: `lib/db/src/schema/` (users, refresh-tokens, workspaces, workspace-members, tasks, activity-log, files, meetings)
- API routes: `artifacts/api-server/src/routes/` (auth, workspaces, tasks, storage, files, meetings)
- Object storage helpers: `artifacts/api-server/src/lib/objectStorage.ts`, `objectAcl.ts`
- Socket.IO server (presence/cursors/locks, in-memory only): `artifacts/api-server/src/lib/socket.ts`
- Frontend auth context: `artifacts/collabsphere/src/lib/auth-context.tsx`
- Frontend theme context (4 themes, persisted to localStorage): `artifacts/collabsphere/src/lib/theme-context.tsx`
- Frontend socket hook: `artifacts/collabsphere/src/lib/socket.ts`
- Workspace section components: `artifacts/collabsphere/src/components/workspace/` (kanban-board = Project, task-planner, files-hub, meetings-panel)
- Shared header widget (theme switcher + settings/profile icons): `artifacts/collabsphere/src/components/topbar-actions.tsx`
- Profile & settings pages: `artifacts/collabsphere/src/pages/profile.tsx`, `settings.tsx`

## Architecture decisions

- Presence, live cursors, and task edit-locks are pure Socket.IO state (never persisted to Postgres) — they're inherently ephemeral and this keeps the DB schema and REST contract simple.
- All task/workspace mutations go through REST; the server broadcasts a matching Socket.IO event on success, and **every** connected client (including the actor) invalidates its React Query cache on that event. This avoids writing separate optimistic-update logic for the local vs. remote update paths.
- Task updates require a `version` field (optimistic concurrency). A stale `version` gets a 409 with the current server-side task attached, so the client can resync instead of clobbering a teammate's concurrent edit.
- JWT signing secrets are derived from the single provisioned `SESSION_SECRET` via HMAC with distinct labels (one for access tokens, one for refresh tokens) rather than requesting dedicated secrets — refresh tokens are additionally stored server-side only as a hash, and rotated on every use.
- **Any Express sub-router mounted via `router.use(subRouter)` and applying a blanket `router.use(requireAuth)` intercepts every request that reaches it, not just requests matching its own routes** (requireAuth calls `res.status(401)` without `next()`, and Express never even reaches route matching to see there's no match). This means router **mount order in `routes/index.ts` matters**: `storageRouter` (whose object-serving GET routes are intentionally public) must be mounted before `workspacesRouter`/`tasksRouter`/`filesRouter`/`meetingsRouter`, or those routers' blanket auth checks will 401 storage reads before they ever reach storageRouter. Keep any future public/optionally-public router mounted before auth-gated ones.
- Task Planner reuses the existing `tasksTable` (extended with `priority` and nullable `dueDate` columns) rather than a separate table/list model — it's the same data as the kanban board, just a different view (searchable/sortable/filterable list vs. drag-and-drop columns).
- Files Hub uses Replit object storage via a presigned-URL flow (`POST /storage/uploads/request-url` → direct browser `PUT` to the signed URL → `POST /workspaces/:id/files` to register metadata) rather than the Uppy-based client package, to avoid pulling in an extra dependency for a fairly simple manual-fetch upload.
- Object read access for files is enforced at the metadata layer (`files` table + workspace membership check in `routes/files.ts`), not via per-object ACLs on the raw storage route — the raw `GET /storage/objects/*` route streams bytes for any known object path, which is fine only because path guessing isn't feasible (UUIDs) and the app never links to files outside the owning workspace's file list.
- Theming: 4 themes (`dark`, `light`, `sand`, `glass`) are CSS-variable blocks in `index.css`, switched via a class on `<html>` (`theme-${name}`) and persisted to `localStorage`. New/rebuilt surfaces (Project sidebar+header, dashboard, Task Planner, Files Hub, Meetings, Profile, Settings) use semantic Tailwind tokens (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `bg-muted`, etc.) so they follow the active theme. `activity-feed.tsx` and `members-list.tsx` still have some legacy hardcoded dark styling — noted as a known follow-up, not yet refactored.

## Product

- Sign up / log in, see your workspaces on a dashboard, create new ones.
- Inside a workspace, four sections in the sidebar:
  - **Project** — kanban board (todo/in_progress/done) with live drag-and-drop, per-task edit locks that show "being edited by X" to teammates.
  - **Task Planner** — the same tasks as a searchable/filterable/sortable list (by status, priority, due date), with inline priority/status cycling and due-date editing.
  - **Files Hub** — upload/download/delete files backed by object storage, with membership-gated access.
  - **Meetings** — schedule/edit/delete meetings (title, description, date/time, duration, meeting link), sorted by upcoming time.
  - Plus: live presence avatars and cursor overlay, an activity feed, member list with owner/editor/viewer roles, and one-click JSON export of the whole workspace.
- Header icons (dashboard + workspace) for theme switching, settings, and profile.
- Profile page: edit display name and avatar color, change password, view account info, log out.
- Settings page: pick between 4 themes (dark, light, sand, glass) via preview cards.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Orval + this repo's Zod v3 setup: do not use `format: email` on OpenAPI string fields — it emits `zod.email()` (a Zod v4-only method) which fails to typecheck against the installed Zod v3. Keep email fields as plain `type: string`.
- Orval: avoid mixing a path param and a query param on the same operation — it can produce a Zod-schema name in `generated/api.ts` that collides with a same-named TS interface Orval writes separately for the query-only param, breaking the typecheck. Split into separate operations or drop the query param instead.
- Installing a package into a specific workspace member (e.g. `artifacts/api-server`) via the general package-install tool can fail with `ERR_PNPM_ADDING_TO_ROOT`; run `pnpm add <pkg>` directly inside that package's directory instead.

## Local VS Code / Windows setup

The project is a pnpm monorepo that needs two running servers: the Express API (`artifacts/api-server`) and the Vite React app (`artifacts/collabsphere`).

### Files added for local runs
- `.env.example` — copy to `.env` and fill in your values
- `start-windows.ps1` — PowerShell launcher that reads `.env` and opens backend + frontend in separate windows
- `package.json` preinstall script is now a Node.js one-liner so it works on Windows, Linux, and macOS

### Requirements
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL. Options:
  - **Local install on Windows:** download from https://www.postgresql.org/download/windows/ and create a `collabsphere` database with user `collab` / password `collab`
  - **Free cloud Postgres:** create a free Supabase project, copy the connection string, and put it in `.env` as `DATABASE_URL` — no code changes needed
  - **Docker (if you have it):** `docker run --name collabsphere-db -e POSTGRES_USER=collab -e POSTGRES_PASSWORD=collab -e POSTGRES_DB=collabsphere -p 5432:5432 -d postgres:16`

### Steps
1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `SESSION_SECRET`, `PORT`, `API_PORT`, `FRONTEND_PORT`, `BASE_PATH`.
2. Run `pnpm install` from the project root.
3. Push the schema: `pnpm --filter @workspace/db run push`.
4. Start the app:
   - **PowerShell:** `powershell -ExecutionPolicy Bypass -File start-windows.ps1`
   - **Manual:** open two terminals, set the env vars from `.env`, then run:
     - Backend: `pnpm --filter @workspace/api-server run dev`
     - Frontend: `pnpm --filter @workspace/collabsphere run dev`
5. Open `http://localhost:5000` (or whatever `FRONTEND_PORT` you set).

### Caveats
- On Windows use `$env:VAR_NAME="value"` in PowerShell; `export` is a Linux/macOS command.

## Customization notes

- Project name / branding: replaced with **AeroNode** across the frontend (home, dashboard, auth, profile, settings, HTML meta tags, export filename). To change it again, search-and-replace `AeroNode` in the files listed above.
- Landing page copy: edit `artifacts/collabsphere/src/pages/home.tsx`.
- Workspace Analytics: new tab in the workspace view, see `artifacts/collabsphere/src/components/workspace/workspace-analytics.tsx` and `artifacts/collabsphere/src/pages/workspace/index.tsx`.
- Local file uploads: files are now saved to `artifacts/api-server/uploads/` on the server and served from `/api/storage/uploads/:filename`. This replaces the Replit Object Storage flow for local/self-hosted setups.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
