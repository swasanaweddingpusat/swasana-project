<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Agent Behavior — MANDATORY

## Think Hard Before Acting

Before writing ANY code:

1. **Read first** — Open and read every file you're about to change. Read files that import from it or are imported by it.
2. **Impact analysis** — If you change component A, identify ALL components that depend on A (imports, props, shared state, shared types). List them. Verify your change won't break them.
3. **Plan the change** — State what you'll do and why before doing it. If the change touches >3 files, outline the plan first.
4. **Verify after** — After making changes, run the build or check for TypeScript errors. Don't declare "done" without verification.

## No Hallucination Policy

- **Never assume an API exists** — check `node_modules/next/dist/docs/` for Next.js APIs, check the actual codebase for project utilities.
- **Never invent props, fields, or methods** — if unsure, read the source file or `prisma/schema.prisma` first.
- **Never guess file paths** — confirm a file exists before importing from it.
- **If you don't know, say so** — don't confidently write wrong code.
- **Next.js 16 is NOT your training data** — always read docs before using any Next.js API.

## Impact Analysis Protocol

When modifying any file, answer these BEFORE writing code:

- **Who imports this file?** — Search for imports of the file you're changing.
- **Does the interface change?** — If you change exported types, function signatures, or component props, every consumer must be updated.
- **Does the behavior change?** — If a function now returns a different shape, trace all callers.
- **Side effects on shared state?** — Changes to providers, contexts, or global stores affect the entire subtree.

If any of these reveals a cascade, handle ALL affected files in the same change.

## Code Quality Gates

### Absolutely Forbidden
- ❌ `console.log()` in runtime code — use `console.error()` only in catch blocks
- ❌ `any` type — use `unknown` and narrow
- ❌ `middleware.ts` — it's `proxy.ts` in Next.js 16
- ❌ `cookies()` / `headers()` without `await`
- ❌ Editing `components/ui/*` — shadcn-generated
- ❌ `findMany()` without pagination
- ❌ Skipping rate limiting on any endpoint
- ❌ Leaving unused imports or variables
- ❌ Declaring "done" without verifying build passes

### Always Required
- ✅ Read the file before editing it
- ✅ Zod validation on all inputs
- ✅ `requirePermission()` before mutations
- ✅ `db.$transaction()` for multi-table writes
- ✅ `logAudit()` for sensitive actions
- ✅ Explicit return types on exported functions
- ✅ `@/` alias for imports

## When Stuck

- Build fails? Read the actual error. Trace to source.
- Same approach failed twice? Stop. Diagnose root cause. Try a different approach.
- Unsure about Next.js 16? Read `node_modules/next/dist/docs/`.
- Unsure about Prisma/Neon? Check `prisma/schema.prisma` and `lib/db.ts`.

---

# Swasana Project — Agent Rules

## 1. Stack (authoritative)

| Layer | Tech | Version | Notes |
|---|---|---|---|
| Framework | Next.js | **16.2.3** | App Router, Turbopack default, `proxy.ts` (NOT `middleware.ts`) |
| React | React | **19.2.4** | Server Components default |
| Runtime | Node | **≥ 20.9.0** | Node 18 dropped |
| Language | TypeScript | ≥ 5.1 | strict mode |
| DB | PostgreSQL (Neon serverless) | — | HTTP adapter via `@prisma/adapter-neon` |
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

---

## 2. Folder Structure (enforced)

```
swasana-project/
├── actions/              # "use server" server actions, one file per domain
│   ├── auth.ts           # login/logout are NextAuth — put signup/reset/verify here
│   ├── user.ts
│   └── role.ts
├── app/
│   ├── (public)/auth/    # login, signup, forgot-password, reset-password, verify
│   │   └── <route>/
│   │       ├── page.tsx
│   │       └── components/<form>.tsx   # co-located form components
│   ├── (private)/dashboard/
│   │   ├── layout.tsx                   # enforces session + mustChangePassword + status
│   │   ├── _components/                 # route-private components (header, sidebar)
│   │   └── <feature>/
│   │       ├── page.tsx
│   │       └── components/              # feature-scoped components
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth handler only
│   │   ├── <resource>/route.ts
│   │   └── <resource>/[id]/route.ts
│   ├── layout.tsx        # root layout + providers
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/               # shadcn — do NOT hand-edit
│   ├── providers/        # QueryClient, Theme, Session
│   └── shared/           # cross-feature reusable
├── emails/               # Resend HTML templates, one file per email type
├── hooks/                # client hooks: use-<thing>.ts (TanStack Query wrappers)
├── lib/
│   ├── auth.ts           # NextAuth config (single source of truth)
│   ├── db.ts             # Prisma singleton
│   ├── audit.ts          # logAudit() — call on every mutation
│   ├── permissions.ts    # hasPermission(), isSuperAdmin() — REQUIRED before mutations
│   ├── rate-limit.ts     # Upstash ratelimit singletons — REQUIRED on every endpoint
│   ├── queries/          # server-side read helpers (no mutations here)
│   ├── validations/      # Zod schemas, one file per domain
│   └── utils.ts          # cn() etc — do not dump unrelated helpers here
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── services/             # domain logic reused across actions + API routes
├── types/                # ambient + shared types (next-auth.d.ts etc)
├── proxy.ts              # route protection (NOT middleware.ts)
└── next.config.ts
```

**Rules:**
- Never create `middleware.ts`. Next.js 16 renamed it to `proxy.ts` with `export function proxy()`.
- Server actions live in `actions/`, API routes in `app/api/`. Do not mix concerns.
- Co-locate feature components under the route (`app/(private)/dashboard/<feature>/components/`). Do not move them to `components/` unless shared across ≥2 features.
- `components/ui/` is shadcn-generated — never edit by hand. Add wrappers in `components/shared/` instead.
- Read helpers (SELECT) go in `lib/queries/`. Writes (INSERT/UPDATE/DELETE) go in `actions/` or `app/api/`.

---

## 3. Auth System Rules (MANDATORY)

This project is building a **hardened auth system**. All P0/P1 rules below are non-negotiable — the reviewer will reject PRs that skip them.

### 3.1. Rate limiting — required on every endpoint

Every server action and every API route handler MUST call a rate limiter **before** any DB work.

**Implementation:** In-memory rate limiter (`lib/rate-limit.ts`) — zero external dependency, 100% free. Resets on cold start, sufficient for this app's scale. Account lockout (auth flows) also uses ActivityLog DB count so it persists across restarts.

```ts
// lib/rate-limit.ts — synchronous, no external service needed
export const authLimiter     = { check: (k: string) => check(k, 5, 15 * 60 * 1000) };
export const mutationLimiter = { check: (k: string) => check(k, 20, 60 * 1000) };
export const apiLimiter      = { check: (k: string) => check(k, 60, 60 * 1000) };
```

Tiered policies:

| Scope | Limit | Key | Example |
|---|---|---|---|
| `authLimiter` | 5 / 15 min | by email OR IP | login, forgot-password, reset-password, verify-email |
| `mutationLimiter` | 20 / min | by userId | invite, update, delete resources |
| `apiLimiter` | 60 / min | by userId OR IP | list/read endpoints |

Pattern for route handlers:

```ts
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!authLimiter.check(`login:${ip}`)) return rateLimitResponse();
  // ... rest
}
```

Pattern for server actions:

```ts
"use server";
export async function inviteUser(formData: FormData) {
  const { session, error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`invite:${session.user.id}`)) return { success: false, ...rateLimitError() };
  // ... rest
}
```

**Account lockout** (login only) uses ActivityLog — counts `auth.login_failed` entries in last 15 min. Since we log every failure via `logAudit()`, the lockout works automatically without extra state.

**Never skip rate limiting** even on seemingly harmless endpoints.

### 3.2. Transactions — required for multi-step writes

Any action that writes to **more than one table** MUST use `db.$transaction()`. Partial writes are banned.

> **Neon HTTP adapter limitation:** The `PrismaNeonHttp` adapter does NOT support the interactive callback form (`db.$transaction(async (tx) => {...})`). Use the **array form** instead — it works as an atomic batch over HTTP.

```ts
// Bad — leaves DB inconsistent if second step fails
await db.user.create({ data: {...} });
await db.profile.create({ data: {...} });

// Bad — callback form, NOT supported by Neon HTTP
await db.$transaction(async (tx) => {
  await tx.user.create({ ... });
  await tx.profile.create({ ... });
});

// Good — array form, atomic, supported by Neon HTTP
await db.$transaction([
  db.user.update({ where: { id }, data: { password: hashed } }),
  db.profile.update({ where: { userId: id }, data: { mustChangePassword: false } }),
  db.session.deleteMany({ where: { userId: id } }),
]);

// For loops (createMany doesn't work on Neon HTTP either):
await db.$transaction(
  ids.map((id) => db.rolePermission.create({ data: { roleId, permissionId: id } }))
);
```

Also wrap in a transaction:
- `inviteUser` (user + profile + token)
- `resetPassword` (user.password update + token.usedAt + audit log + session invalidation)
- `verifyEmail` (profile flag + token.usedAt + audit log)
- `updateUser` (profile + venue access deletions/creations)
- `updateRolePermissions` (deleteMany + createMany)
- `deleteUser` (cascade delete across 6 tables)

### 3.3. Authorization — every mutation checks permission

```ts
// lib/permissions.ts
export async function requirePermission(module: string, action: string) {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  const ok = await hasPermission(session.user.roleId, module, action);
  if (!ok) throw new ForbiddenError();
  return session;
}
```

Every mutating endpoint:

```ts
export async function POST(req: Request) {
  await rateLimit(...);                        // 1. rate limit
  const session = await requirePermission("users", "create");  // 2. authz
  const body = inviteUserSchema.parse(await req.json());       // 3. validate
  const result = await db.$transaction(async (tx) => { ... }); // 4. transact
  await logAudit({ userId: session.user.id, ... });            // 5. audit
  return Response.json(result);
}
```

### 3.4. Token handling

- Generate with `crypto.randomBytes(32).toString("hex")` — 256 bits, never less.
- **Store a SHA-256 hash** of the token in DB, not the plaintext. Compare hashes on lookup.
- Enforce `expiresAt` **and** `usedAt` on every check. Both conditions, always.
- One-time use: mark `usedAt` atomically in the same transaction as the effect.
- Invalidate all other outstanding tokens of the same kind for that user when one is used.

### 3.5. Password handling

- Validation schema (single source in `lib/validations/auth.ts`):
  - min 12 characters
  - contains uppercase, lowercase, number, symbol
  - cannot equal email or contain app name
- Hash with `bcrypt` rounds 12 (already configured).
- After a password change, **delete all Session rows** for that user and invalidate the JWT.
- `POST /api/user/change-password` MUST require `currentPassword` — never optional.
- Never log, email, or return a password in plaintext. The invite flow uses a **setup-password token**, not a temp password.

### 3.6. Login (`authorize` callback) — mandatory checks

In order:
1. Rate limit by email + IP.
2. Validate credentials with Zod.
3. Lookup user; **always run `bcrypt.compare` against a dummy hash if user missing** (timing-attack defense).
4. Check `profile.status === "active"`.
5. Check `profile.isEmailVerified === true`.
6. Increment failed-login counter on mismatch; lock account after 5 failures for 15 min.
7. Reset counter + set `lastLoginAt` on success.
8. Log audit event for success AND failure.

### 3.7. `proxy.ts` — route guard layer

Responsibilities (ordered):
1. Skip static assets (handled by matcher).
2. Allow PUBLIC_PATHS through; if logged in and hitting `/auth/*`, redirect to `/dashboard`.
3. No session token → redirect to `/auth/login?callbackUrl=...`.
4. Hand off to `(private)/layout.tsx` for session-content checks (status, mustChangePassword, emailVerified) — those need DB, which proxy cannot do reliably.

Proxy does **not** query the DB. Anything needing DB goes in layouts or route handlers.

### 3.8. Audit logging — every sensitive action

Call `logAudit()` for: login (success/failure), logout, signup, invite, verify email, password reset, password change, role change, permission grant/revoke, user suspension, user deletion.

Required fields: `userId`, `action`, `result`, `entityType`, `entityId`, `ipAddress`, `userAgent`. Wrap inside the same `db.$transaction` as the effect so audit and action commit together.

### 3.9. API responses — never leak

- `validate-reset-token` returns `{ valid: boolean }` only. **Never echo the email back.**
- `forgot-password` always returns success, whether or not the email exists.
- `/api/users` and `/api/users/[id]` require authentication + `users:read` permission.
- Login failure messages are generic ("Email atau password salah") — do not distinguish "user not found" vs "wrong password" vs "email not verified".

---

## 4. Code Conventions

- **Server actions** start with `"use server"` directive, return `{ success, data }` or `{ error }` shape — never throw to client.
- **Zod schemas** live in `lib/validations/<domain>.ts`. Reuse them between client form and server action.
- **Prisma**: always select only fields you need (`select: { id, email }`). No `findMany()` without pagination.
- **Errors**: use typed errors (`UnauthorizedError`, `ForbiddenError`, `RateLimitError`) and catch them at the boundary.
- **No `any`**. If you need escape hatch, use `unknown` and narrow.
- **No default exports** for utilities. Named exports only. Pages/layouts keep default export (Next.js requires it).
- **Env vars** typed in `types/env.d.ts`. Never read `process.env.X` directly in components.
- **Imports** use `@/` alias for project root. Relative imports only within the same feature folder.

---

## 5. Common pitfalls (DO NOT do these)

- ❌ Creating `middleware.ts` — it's `proxy.ts` in Next.js 16.
- ❌ `cookies()` / `headers()` without `await` — they are async in Next.js 15+.
- ❌ Duplicating logic between `actions/auth.ts` and `app/api/auth/*/route.ts`. Pick one; the other imports from it.
- ❌ Using `resetToken.used` — the field is `resetToken.usedAt` (DateTime, nullable).
- ❌ `bcrypt.hash` without checking if function runtime > 10s (Vercel limit). For serverless, keep rounds at 12.
- ❌ Returning emails, IDs, or enumerable data on auth error paths.
- ❌ `db.$transaction` with `async` callback that does network calls (email send) inside — move external I/O outside the transaction, after commit.
- ❌ Seeding passwords or secrets via plain env. Use `AUTH_SECRET` generated with `openssl rand -base64 32`.
- ❌ Skipping the `profile.status` check at login. Suspended users bypass it if you forget.

---

## 6. When changing auth code

Checklist before marking any auth task done:
- [ ] Rate limiter called first in the handler
- [ ] Zod validation on input
- [ ] Permission check (for mutations)
- [ ] `db.$transaction` wraps multi-step writes
- [ ] Token stored as hash, not plaintext
- [ ] `usedAt` AND `expiresAt` checked
- [ ] `logAudit` called inside the same transaction
- [ ] Error response is generic (no enumeration)
- [ ] Password (if any) never logged or returned
- [ ] Session invalidated after password change
- [ ] Test the golden path + 1 failure path in dev before reporting done

---

## 7. Env vars (required)

```
DATABASE_URL=                    # Neon postgres
DIRECT_URL=                      # Neon direct (migrations)
AUTH_SECRET=                     # openssl rand -base64 32
AUTH_URL=                        # https://app.swasana.com
RESEND_API_KEY=
RESEND_FROM_EMAIL=               # noreply@yourdomain.com
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
APP_URL=                         # public base for emails/links
```

> Rate limiting menggunakan in-memory store — tidak membutuhkan Redis atau layanan eksternal apapun.

Secrets never land in git. `.env` is gitignored; `.env.example` ships placeholder values only.
