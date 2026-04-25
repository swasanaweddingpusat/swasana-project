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
- ❌ Renaming a file without updating every import AND verifying case-sensitivity on Linux
- ❌ `isSuperAdmin` via string match on role name — must use a boolean flag on Role row

### Always Required
- ✅ Read the file before editing it
- ✅ Zod validation on all inputs
- ✅ `requirePermission()` before mutations
- ✅ `mutationLimiter.check()` before mutations; `authLimiter` for auth flows; `apiLimiter` for GET
- ✅ `db.$transaction([...])` (array form) for multi-table writes
- ✅ `logAudit()` for sensitive actions
- ✅ Delete `db.session` rows after any password change
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
├── actions/                  # "use server" server actions, one file per domain
│   ├── auth.ts               # signup/reset/verify. Login/logout handled by NextAuth.
│   ├── user.ts
│   └── role.ts
├── app/
│   ├── (public)/auth/        # login, forgot-password, reset-password, verify
│   │   └── <route>/
│   │       ├── page.tsx
│   │       └── _components/<form>.tsx
│   ├── (private)/
│   │   ├── layout.tsx        # <AuthGate> — enforces session content (status, verified, mustChangePassword)
│   │   └── dashboard/
│   │       ├── layout.tsx    # shell (sidebar + header)
│   │       ├── _components/  # shell sub-components (sidebar, header)
│   │       └── <feature>/
│   │           ├── page.tsx
│   │           └── _components/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── <resource>/route.ts
│   │   └── <resource>/[id]/route.ts
│   ├── layout.tsx
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/                   # shadcn — kebab-case, do NOT hand-edit
│   ├── providers/            # QueryClient, Theme, Session
│   └── shared/               # cross-feature reusable (PermissionGate, Drawer, etc.)
├── emails/                   # Resend HTML templates
├── hooks/                    # TanStack Query wrappers — camelCase: useXxx.ts
├── lib/
│   ├── auth.ts               # NextAuth config (single source of truth)
│   ├── db.ts                 # Prisma singleton
│   ├── audit.ts              # logAudit() — called on every mutation
│   ├── permissions.ts        # requirePermission(), hasPermission(), isSystemSuperAdmin()
│   ├── rate-limit.ts         # In-memory limiter (authLimiter, mutationLimiter, apiLimiter)
│   ├── queries/              # server-side read helpers (no mutations here)
│   ├── validations/          # Zod schemas, one file per domain
│   ├── route-meta.ts         # URL → { title, subtitle, parent } for header/breadcrumb
│   └── utils.ts              # cn() — do not dump unrelated helpers here
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── services/                 # client-side fetch helpers (REST → TanStack Query)
├── types/                    # ambient + shared types (next-auth.d.ts etc)
├── proxy.ts                  # route protection (NOT middleware.ts)
└── next.config.ts
```

**Folder rules:**
- Never create `middleware.ts`. Next.js 16 renamed it to `proxy.ts` with `export function proxy()`.
- Server actions live in `actions/`, API routes in `app/api/`. Do not mix concerns.
- Feature components co-located under `app/(private)/dashboard/<feature>/_components/`. Move to `components/shared/` only when used across ≥2 features.
- `components/ui/` is shadcn-generated — never hand-edit. Wrap in `components/shared/` instead.
- Reads (SELECT) live in `lib/queries/`. Writes (INSERT/UPDATE/DELETE) live in `actions/` or `app/api/`.
- Email templates live in `emails/` (NOT inside `app/api/send-email/components/`).

---

## 3. File Naming Convention (enforced)

Next.js 16 has **no official recommendation** for non-special file names, but the project MUST be consistent.

### 3.1. Immutable (framework-enforced, do NOT rename)

| Category | Rule | Examples |
|---|---|---|
| Next.js special files | **lowercase kebab-case** | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`, `template.tsx`, `default.tsx`, `route.ts`, `proxy.ts` |
| Route folders | **kebab-case** | `user-management/`, `payment-methods/`, `[id]`, `[...slug]`, `(group)`, `_private`, `@slot` |
| Shadcn components | **kebab-case** (`components/ui/*`) | `button.tsx`, `dropdown-menu.tsx`, `scroll-area.tsx` — CLI regenerates using kebab-case; renaming causes duplicates |

### 3.2. Project convention (for files WE own)

| Category | Convention | Examples |
|---|---|---|
| React components (.tsx) | **PascalCase** | `UsersTable.tsx`, `InviteDrawer.tsx`, `PermissionGate.tsx`, `Sidebar.tsx` |
| React hooks (.ts exporting `useXxx`) | **camelCase**, MUST start with `use` | `useUsers.ts`, `useCurrentUser.ts`, `usePermissions.ts` |
| Server actions (.ts) | **camelCase or single-word lowercase** (one per domain) | `user.ts`, `role.ts`, `paymentMethod.ts` |
| Services (client fetchers) | **camelCase** | `userService.ts`, `groupService.ts` |
| Lib utilities | **camelCase** | `rateLimit.ts`, `queryClient.ts`, `routeMeta.ts`, `avatarUtils.ts` |
| Queries (`lib/queries/`) | **camelCase or single lowercase** | `users.ts`, `groups.ts`, `paymentMethods.ts` |
| Validations (`lib/validations/`) | **single-word lowercase** | `auth.ts`, `user.ts`, `vendor.ts` |
| Zod schema exports | **camelCase** | `inviteUserSchema`, `updateGroupSchema` |
| Email templates (`emails/`) | **camelCase** | `invitationEmail.ts`, `resetPasswordEmail.ts` |
| Type files (`types/`) | **lowercase kebab or camelCase** | `next-auth.d.ts`, `user.ts` |

### 3.3. Forbidden patterns

- ❌ `UseUsers.ts` — hooks MUST start with lowercase `use`
- ❌ `User-Management/` as a route folder — URL becomes `/User-Management` (case-sensitive on Linux, SEO-unfriendly)
- ❌ Mixing conventions inside the same folder (e.g., `UsersTable.tsx` next to `invite-drawer.tsx` under the same `_components/`)
- ❌ Renaming via IDE case-change on Windows (case-insensitive FS) without `git mv --force` + verification on Linux

### 3.4. Renaming procedure (when enforcing convention on legacy files)

1. `git mv oldName.tsx NewName.tsx` — git must notice the case change
2. Update every import of the renamed file (`Grep` the old path first)
3. Build locally: `npm run build` (Turbopack is case-sensitive even on Windows)
4. Commit the move + import updates in one commit per layer (components, then hooks, then services, then lib)

---

## 4. Auth System Rules (MANDATORY)

This project runs a **hardened auth system**. P0/P1 rules below are non-negotiable.

### 4.1. Rate limiting — required on every endpoint

Every server action and every API route handler MUST call a rate limiter **before** any DB work.

**Implementation:** In-memory rate limiter (`lib/rate-limit.ts`) — zero external dependency. Resets on cold start; account lockout uses ActivityLog DB count so it persists across restarts.

```ts
// lib/rate-limit.ts — synchronous, no external service needed
export const authLimiter     = { check: (k: string) => check(k, 5, 15 * 60 * 1000) };
export const mutationLimiter = { check: (k: string) => check(k, 20, 60 * 1000) };
export const apiLimiter      = { check: (k: string) => check(k, 60, 60 * 1000) };
```

Tier selection:

| Scope | Limit | Key strategy | Use on |
|---|---|---|---|
| `authLimiter` | 5 / 15 min | by email OR IP | login, forgot-password, reset-password, verify-email, validate-reset-token |
| `mutationLimiter` | 20 / min | by `session.user.id` | every server action that writes; POST/PATCH/DELETE route handlers |
| `apiLimiter` | 60 / min | by `session.user.id` OR IP | every GET route handler (including `/api/me/permissions`) |

Pattern for route handlers:

```ts
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!authLimiter.check(`login:${ip}`)) return rateLimitResponse();
  // ...
}
```

Pattern for server actions:

```ts
"use server";
export async function inviteUser(formData: FormData) {
  const { session, error } = await requirePermission({ module: "settings", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`invite:${session.user.id}`)) return { success: false, ...rateLimitError() };
  // ...
}
```

**Account lockout** (login) uses ActivityLog — counts `auth.login_failed` entries in last 15 min via `logAudit()`. No extra state needed.

**Never skip rate limiting** — even on small GET endpoints like `/api/me/permissions`, `/api/source-of-informations`, `/api/member-statuses`.

### 4.2. Transactions — required for multi-step writes

Any action that writes to **more than one table** MUST use `db.$transaction([...])` (array form). Partial writes are banned.

> **Neon HTTP adapter supports the array form** (atomic batch over HTTP). It does NOT support the callback form (`db.$transaction(async tx => ...)`). Don't write "HTTP adapter doesn't support transaction" comments — it supports the array form.

```ts
// Bad — sequential, not atomic
await db.user.update({ ... });
await db.passwordResetToken.update({ ... });
await db.profile.update({ ... });

// Bad — callback form, NOT supported by Neon HTTP
await db.$transaction(async (tx) => { ... });

// Good — array form, atomic, supported by Neon HTTP
await db.$transaction([
  db.user.update({ where: { id }, data: { password: hashed } }),
  db.profile.update({ where: { userId: id }, data: { mustChangePassword: false } }),
  db.passwordResetToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } }),
  db.session.deleteMany({ where: { userId: id } }),  // invalidate all other sessions
]);

// For loops (createMany doesn't work on Neon HTTP either):
await db.$transaction(
  ids.map((id) => db.rolePermission.create({ data: { roleId, permissionId: id } }))
);
```

Actions that MUST use transactions:
- `inviteUser` — user + profile + verification token + userVenueAccess (do via nested create OR transaction)
- `updateUser` — profile + user.name + userVenueAccess diff
- `resetPassword` — user.password + profile.mustChangePassword + token.usedAt + `session.deleteMany`
- `verifyEmail` — profile flag + token.usedAt + audit log
- `deleteUser` — cascade delete across all FK-linked tables
- `updateRolePermissions` — deleteMany + creates

### 4.3. Authorization — every mutation checks permission

```ts
// Standardized return shape: ALWAYS destructure { session, error }
const { session, error } = await requirePermission({ module: "settings", action: "create" });
if (error) return { success: false, error };
// session is typed non-null inside this branch
```

Do NOT use the `permResult.error` pattern — destructure always.

Every mutating endpoint follows this order:

```ts
export async function POST(req: Request) {
  // 1. Authorization
  const { session, response } = await requirePermissionForRoute({ module: "users", action: "create" });
  if (response) return response;

  // 2. Rate limit
  if (!mutationLimiter.check(`action:${session.user.id}`)) return rateLimitResponse();

  // 3. Validate
  const body = schema.parse(await req.json());

  // 4. Transact
  const result = await db.$transaction([ ... ]);

  // 5. Audit
  await logAudit({ userId: session.user.id, action: "...", entityType: "...", entityId: "..." });

  // 6. Cache invalidation
  revalidateTag("tag", "max");

  return Response.json(result);
}
```

### 4.4. Super Admin — flag, NOT string match

`isSuperAdmin` MUST be derived from a **boolean flag on the Role row**, not from `role.name.toLowerCase() === "super admin"`.

Why: a user with `role_permission:edit` could rename their role to "Super Admin" and escalate privileges. String match is a privilege escalation vector.

Schema (enforced):
```prisma
model Role {
  id            String  @id @default(cuid())
  name          String
  isSystemRole  Boolean @default(false)  // ← flag set at seed time, never user-editable
  // ...
}
```

`lib/permissions.ts`:
```ts
export async function isSystemSuperAdmin(roleId: string | null | undefined): Promise<boolean> {
  if (!roleId) return false;
  const role = await db.role.findUnique({
    where: { id: roleId },
    select: { isSystemRole: true },
  });
  return role?.isSystemRole === true;
}
```

JWT should cache `isSuperAdmin` to avoid 2 DB queries per `requirePermission` call.

### 4.5. Token handling

- Generate with `crypto.randomBytes(32).toString("hex")` — 256 bits, never less.
- Enforce `expiresAt` **and** `usedAt` on every check. Both conditions, always.
- Field is `usedAt: DateTime?` — NEVER `used: boolean`. If you see `.used` in code, it's broken.
- One-time use: mark `usedAt` atomically in the same transaction as the effect.
- Invalidate all other outstanding tokens of the same kind for that user when one is used.

### 4.6. Password handling

- Validation schema (single source in `lib/validations/auth.ts`):
  - min 12 characters
  - contains uppercase, lowercase, number, symbol
  - cannot equal email or contain app name
- Hash with `bcrypt` rounds 12.
- **After ANY password change, `db.session.deleteMany({ where: { userId } })` inside the same transaction.** JWTs continue to work until expiry otherwise.
- `POST /api/user/change-password` MUST require `currentPassword` — never optional.
- Never log, email, or return a password in plaintext. Invite flow uses a **setup-password token**, never a temp password.

### 4.7. Login (`authorize` callback) — mandatory order

1. Rate limit by email + IP.
2. Validate credentials with Zod.
3. Lookup user; **always run `bcrypt.compare` against a dummy hash if user missing** (timing-attack defense).
4. Check `profile.status === "active"`.
5. Check `profile.isEmailVerified === true`.
6. Lockout after 5 failures in 15 min (via ActivityLog count).
7. Reset counter + set `lastLoginAt` on success.
8. `logAudit` for success AND failure.

### 4.8. JWT / session refresh

JWT carries: `id`, `profileId`, `roleId`, `isSuperAdmin`, `status`, `isEmailVerified`, `mustChangePassword`.

Refresh from DB every **10 minutes** (`PROFILE_CACHE_TTL_MS` in `lib/auth.ts`). If the DB row is gone (user deleted/truncated), return `{}` to invalidate the JWT.

Client `SessionProvider`:
```tsx
<NextAuthSessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
```
Polling `/api/auth/session` adds zero value with JWT strategy — the cookie already has the claims.

### 4.9. `proxy.ts` — route guard layer

Responsibilities (in order):
1. Skip static assets (handled by matcher).
2. Allow `PUBLIC_EXACT` + `PUBLIC_PREFIXES`. If logged in and hitting `PUBLIC_EXACT` auth page → redirect `/dashboard`.
3. No session cookie → redirect `/auth/login?callbackUrl=...`.
4. Hand off to `(private)/_components/auth-gate.tsx` for session-content checks (status, isEmailVerified, mustChangePassword).

Proxy MUST NOT query the DB. DB-dependent checks live in `AuthGate`.

### 4.10. Audit logging — what needs `logAudit()`

Required for every:
- Login (success AND failure)
- Password change / reset / force reset
- Email verification
- Invite / update / delete user
- Role create / update / delete
- Permission grant / revoke (`updateRolePermissions`)
- User suspension / status change
- Group member add / remove
- Payment method / venue / brand CUD

Required fields: `userId`, `action` (e.g., `user.invited`), `result` (`success`/`failure`), `entityType`, `entityId`, `ipAddress`, `userAgent`. Wrap inside the same `db.$transaction` as the effect when possible.

### 4.11. API responses — never leak

- `validate-reset-token` returns `{ valid: boolean }` ONLY. Never echo email.
- `forgot-password` always returns success, whether or not the email exists.
- Login failure messages are generic ("Email atau password salah"). Never distinguish "user not found" vs "wrong password" vs "email not verified".
- `/api/users`, `/api/users/[id]` require `settings:view` permission.
- `/api/me/permissions` requires authenticated session (no `requirePermission` because it's about the caller themselves).

---

## 5. Permission Module Naming

Permission `(module, action)` tuples used across the app — keep consistent:

| Module | Actions |
|---|---|
| `settings` | `view`, `create`, `update`, `delete` (users, groups, venues, brands, source-of-info) |
| `customers` | `view`, `create`, `update`, `delete`, `read` |
| `vendor` | `view`, `create`, `edit`, `delete` |
| `package` | `view`, `create`, `edit`, `delete` |
| `payment_methods` | `view`, `create`, `edit`, `delete` |
| `role_permission` | `view`, `create`, `edit`, `delete` |

**Note inconsistency:** some modules use `update` (settings, customers) vs `edit` (vendor, package, payment_methods, role_permission). Pick ONE per module and stick with it. Don't mix `update` and `edit` within the same module.

---

## 6. Code Conventions

- **Server actions** start with `"use server"`, return `{ success, data? }` or `{ success: false, error }` — never throw to client.
- **Zod schemas** in `lib/validations/<domain>.ts`. Reuse between client form and server action.
- **Prisma**: always `select` only needed fields. `findMany()` without pagination is forbidden.
- **Errors**: typed errors caught at boundary. Don't let internal errors leak to responses.
- **No `any`** — use `unknown` and narrow. For Prisma promise arrays: `Prisma.PrismaPromise<unknown>[]`.
- **No default exports** for utilities. Named exports only. Pages/layouts keep `export default` (Next.js requires it).
- **Env vars** read via `process.env.X` typed in `types/env.d.ts`. Never read in components.
- **Imports** use `@/` alias for project root. Relative imports only within the same feature folder.
- **`revalidateTag`** — use the `"max"` profile argument consistently: `revalidateTag("users", "max")`.

---

## 7. Common pitfalls (DO NOT do these)

- ❌ Creating `middleware.ts` — it's `proxy.ts` in Next.js 16.
- ❌ `cookies()` / `headers()` without `await`.
- ❌ Duplicating logic between `actions/auth.ts` and `app/api/auth/*/route.ts` (or between `actions/user.ts` and `app/api/send-email/*`). Pick one; delete the other.
- ❌ Using `resetToken.used` — the field is `resetToken.usedAt` (DateTime, nullable).
- ❌ `isSuperAdmin` via role name string match — use `role.isSystemRole` flag.
- ❌ Password change without `db.session.deleteMany({ where: { userId } })` in the same transaction.
- ❌ `bcrypt.hash` rounds > 12 on serverless — risks Vercel 10s timeout.
- ❌ Returning emails, IDs, or enumerable data on auth error paths.
- ❌ `db.$transaction` with `async` callback on Neon HTTP — use array form.
- ❌ Seeding secrets via plain env. Use `AUTH_SECRET` generated with `openssl rand -base64 32`.
- ❌ Skipping `profile.status` check at login or in AuthGate.
- ❌ Secret comparison with `!==` — use `crypto.timingSafeEqual` for admin webhook auth.
- ❌ Secret fallback (`CLEANUP_SECRET ?? AUTH_SECRET`) — secrets must NOT be reused across roles.
- ❌ `SessionProvider` with `refetchInterval > 0` — JWT is self-contained, polling wastes DB round-trips.

---

## 8. Checklist — before marking any auth/permission task done

- [ ] Rate limiter called first in the handler (tier: auth / mutation / api)
- [ ] Zod validation on input
- [ ] `requirePermission()` (mutations) or `requirePermissionForRoute()` (route handlers) called
- [ ] `db.$transaction([...])` wraps multi-table writes (array form)
- [ ] For password changes: `db.session.deleteMany({ where: { userId } })` included in the transaction
- [ ] Token checks enforce `expiresAt` AND `usedAt`
- [ ] `logAudit` called (inside transaction when possible)
- [ ] Error response is generic (no enumeration, no email echo)
- [ ] Password (if any) never logged, emailed, or returned
- [ ] `revalidateTag("<tag>", "max")` called after successful mutation
- [ ] `{ session, error }` destructuring used (not `permResult.error`)
- [ ] No duplicate endpoint for same feature (actions/ vs api/)
- [ ] Tested golden path + one failure path in dev

---

## 9. Env vars (required)

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
CLEANUP_SECRET=                  # dedicated secret for /api/admin/cleanup-logs (do NOT reuse AUTH_SECRET)
```

> Rate limiting uses in-memory store — no Redis or external service needed.

Secrets never land in git. `.env` is gitignored; `.env.example` ships placeholder values only.

---

## 10. Design System — Monochrome (STRICT)

swasana-project = strict monochrome. Semua warna grayscale (oklch chroma 0).

### shadcn Config
- Style: base-nova (base-ui primitives, BUKAN radix)
- Base color: neutral
- Tailwind v4 (`@import` syntax)
- Icon: Lucide
- Font: Open Sans (sans), Geist Mono (mono)

### Color Tokens — HANYA pake ini:
| Token | Kapan Pake |
|---|---|
| `primary` | CTA utama, button default, text emphasis |
| `secondary` | Button secondary, background subtle |
| `muted` / `muted-foreground` | Disabled state, placeholder, helper text |
| `accent` | Hover state, active background |
| `destructive` | Error, delete, danger — SATU-SATUNYA warna non-gray |
| `border` | Borders, dividers |
| `foreground` | Body text |
| `background` | Page background |
| `card` / `card-foreground` | Card surfaces |

### DILARANG:
- ❌ Hardcode warna (bg-blue-500, text-green-600, dll) — pake CSS variable tokens
- ❌ Warna selain grayscale + destructive red
- ❌ Edit file di `components/ui/` — itu shadcn generated
- ❌ Bikin component baru kalau shadcn udah provide

---

## 11. Tailwind v4 Syntax (STRICT)

- `data-[attr]:class` → `data-attr:class`
  - `data-[disabled]:opacity-50` → `data-disabled:opacity-50`
  - `data-[inset]:pl-8` → `data-inset:pl-8`
  - `data-[variant=destructive]:class` → tetap pakai bracket kalau ada value
- Important modifier: `!text-x` → `text-x!` (suffix, bukan prefix)
- Berlaku di semua file **kecuali** `components/ui/` (shadcn generated — JANGAN edit manual)
- WAJIB pake canonical Tailwind classes — JANGAN pake arbitrary `[Npx]` kalau ada padanannya
  - `w-[20px]` → `w-5` | `min-w-[240px]` → `min-w-60` | `max-w-[300px]` → `max-w-75`

---

## 12. ESLint Rules (STRICT)

- ❌ DILARANG ternary sebagai statement: `condition ? a() : b()` → ESLint error
- ✅ Side-effect → WAJIB pake `if/else`: `if (condition) { a() } else { b() }`
- ✅ Ternary boleh HANYA sebagai value/assignment: `const x = condition ? a : b`
