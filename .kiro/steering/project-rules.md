---
inclusion: always
---

# Swasana Project — Agent Rules

## 1. Stack (authoritative)

| Layer | Tech | Version | Notes |
|---|---|---|---|
| Framework | Next.js | **16.2.3** | App Router, Turbopack default, `proxy.ts` (NOT `middleware.ts`) |
| React | React | **19.2.4** | Server Components default |
| Runtime | Node | **≥ 20.9.0** | Node 18 dropped |
| Language | TypeScript | ≥ 5.1 | strict mode |
| DB | PostgreSQL (Neon serverless) | — | WebSocket adapter via `PrismaNeon` (`@prisma/adapter-neon`) — supports `$transaction` |
| ORM | Prisma | **7.7.0** | `prisma-client-js` generator |
| Auth | NextAuth (Auth.js) | **v5 beta** | JWT strategy, PrismaAdapter |
| UI | Shadcn v4 + Tailwind v4 | — | `components/ui` generated, do not edit directly |
| Forms | react-hook-form + Zod v4 | — | always validate with Zod schema |
| Data fetching (client) | TanStack Query v5 | — | |
| Email | Resend | — | templates in `emails/` |
| Storage | Cloudflare R2 (S3 SDK) | — | `lib/r2.ts` |

**Before writing code for any Next.js API, read** `node_modules/next/dist/docs/01-app/` **— especially:**
- `02-guides/upgrading/version-16.md` (breaking changes)
- `03-api-reference/03-file-conventions/proxy.md` (NOT middleware)
- `03-api-reference/04-functions/` (cookies, headers — these are async)

## 2. Folder Structure (enforced)

```
swasana-project/
├── actions/              # "use server" server actions, one file per domain
├── app/
│   ├── (public)/auth/    # login, forgot-password, reset-password, verify
│   ├── (private)/dashboard/
│   │   ├── layout.tsx    # enforces session + mustChangePassword + status
│   │   ├── _components/  # route-private components (header, sidebar)
│   │   └── <feature>/
│   │       ├── page.tsx
│   │       └── _components/  # feature-scoped components
│   ├── api/
│   ├── layout.tsx        # root layout + providers
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/               # shadcn — do NOT hand-edit
│   ├── providers/        # QueryClient, Theme, Session
│   └── shared/           # cross-feature reusable
├── emails/               # Resend HTML templates
├── hooks/                # client hooks: use-<thing>.ts
├── lib/
│   ├── auth.ts           # NextAuth config (single source of truth)
│   ├── db.ts             # Prisma singleton
│   ├── audit.ts          # logAudit()
│   ├── permissions.ts    # hasPermission(), requirePermission()
│   ├── rate-limit.ts     # In-memory rate limiter
│   ├── queries/          # server-side read helpers (no mutations)
│   ├── validations/      # Zod schemas
│   └── utils.ts          # cn() etc
├── prisma/
├── services/             # domain logic reused across actions + API routes
├── types/                # ambient + shared types
├── proxy.ts              # route protection (NOT middleware.ts)
└── next.config.ts
```

**Rules:**
- Never create `middleware.ts`. Next.js 16 renamed it to `proxy.ts`.
- Server actions live in `actions/`, API routes in `app/api/`. Do not mix.
- Co-locate feature components under the route. Do not move to `components/` unless shared across ≥2 features.
- `components/ui/` is shadcn-generated — never edit by hand.
- Read helpers (SELECT) go in `lib/queries/`. Writes go in `actions/` or `app/api/`.

## 3. Auth System Rules (MANDATORY)

### 3.1. Rate limiting — required on every endpoint
Every server action and API route MUST call a rate limiter before any DB work.

### 3.2. Transactions — Neon WebSocket adapter
The project uses `PrismaNeon` (WebSocket-based adapter) which supports **both** transaction forms:
```ts
// Array form — preferred for simple multi-step writes
await db.$transaction([
  db.user.update({ where: { id }, data: { password: hashed } }),
  db.profile.update({ where: { userId: id }, data: { mustChangePassword: false } }),
]);

// Interactive form — use when logic depends on intermediate results
await db.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id } });
  if (!user) throw new Error("Not found");
  await tx.profile.update({ where: { userId: id }, data: { status: "active" } });
});
```
**Do NOT use `PrismaNeonHttp`** — it does not support transactions.

### 3.3. Authorization — every mutation checks permission
```ts
const { session, error } = await requirePermission({ module: "settings", action: "create" });
if (error) return { success: false, error };
```

### 3.4. Token handling
- Generate with `crypto.randomBytes(32).toString("hex")`
- Enforce `expiresAt` AND `usedAt` on every check
- One-time use: mark `usedAt` atomically

### 3.5. Password handling
- Hash with bcrypt rounds 12
- After password change, delete all sessions
- Never log or return passwords in plaintext

### 3.6. Login — mandatory checks (in order)
1. Rate limit by email + IP
2. Validate with Zod
3. Always run bcrypt.compare (timing-attack defense)
4. Check `profile.status === "active"`
5. Check `profile.isEmailVerified === true`
6. Log audit for success AND failure

### 3.7. `proxy.ts` — route guard
- Skip static assets (matcher)
- Allow PUBLIC_PATHS; redirect logged-in users from `/auth/*` to `/dashboard`
- No session → redirect to `/auth/login?callbackUrl=...`
- Proxy does NOT query DB

### 3.8. Audit logging
Call `logAudit()` for every sensitive action. Required fields: `userId`, `action`, `result`, `entityType`, `entityId`, `ipAddress`, `userAgent`.

### 3.9. API responses — never leak
- `forgot-password` always returns success
- Login failure messages are generic
- Never echo emails back on token validation

## 4. Code Conventions

- Server actions return `{ success, data }` or `{ success: false, error }` — never throw to client
- Zod schemas in `lib/validations/<domain>.ts`
- Prisma: always `select` only needed fields. No `findMany()` without pagination
- **No `any`**. Use `unknown` and narrow
- **No default exports** for utilities. Pages/layouts keep default export (Next.js requires it)
- Imports use `@/` alias. Relative imports only within same feature folder

## 5. Common Pitfalls (DO NOT)

- ❌ Creating `middleware.ts` — it's `proxy.ts` in Next.js 16
- ❌ `cookies()` / `headers()` without `await` — async in Next.js 15+
- ❌ Using `resetToken.used` — the field is `usedAt` (DateTime, nullable)
- ❌ `redirect()` in `page.tsx` for default sub-route navigation — causes race conditions. Use `proxy.ts` instead
- ❌ `useSearchParams()` in Client Components without Suspense — causes infinite RSC re-render loops
- ❌ Using `PrismaNeonHttp` — use `PrismaNeon` (WebSocket) for transaction support
- ❌ Returning emails/IDs on auth error paths
- ❌ Skipping `profile.status` check at login

## 6. Auth Code Checklist

Before marking any auth task done:
- [ ] Rate limiter called first
- [ ] Zod validation on input
- [ ] Permission check (for mutations)
- [ ] `db.$transaction` wraps multi-step writes (array form)
- [ ] `usedAt` AND `expiresAt` checked for tokens
- [ ] `logAudit` called
- [ ] Error response is generic (no enumeration)
- [ ] Password never logged or returned
- [ ] Session invalidated after password change
