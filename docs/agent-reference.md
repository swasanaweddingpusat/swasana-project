# Agent Reference — Detail Tabel

> File ini **bukan** auto-load. AGENTS.md nunjuk ke sini buat detail yang jarang
> dibutuhin (lookup tabel panjang, env var, CI/CD). Baca on-demand pakai `Read`
> pas emang perlu — jangan di-`@import` ke AGENTS.md/CLAUDE.md, biar context
> auto-load tiap sesi tetep ringan.

---

## 1. Permission Module — full table

Sumber kebenaran = `moduleActions` di `prisma/seeders/roles-permissions.ts`. Format `(module, action)` kebab-case.

| Module | Actions |
|---|---|
| `booking` | `view`, `create`, `edit`, `delete`, `print`, `approve`, `mark-lost`, `restore`, `cancel`, `transfer`, `transfer-manager`, `reject`, `comment`, `client-agreement`, `term-&-condition`, `edit-package`, `edit-set-harga`, `reset-approval`, `dealing-date` |
| `booking-mice` | `view`, `create`, `edit`, `delete`, `print`, `approve`, `mark-lost`, `restore`, `transfer`, `reject`, `comment`, `client-agreement` |
| `customers` | `view`, `create`, `edit`, `delete` |
| `finance-ar` | `view`, `create`, `edit`, `delete` |
| `finance-ap` | `view`, `create`, `edit`, `delete` |
| `groups` | `view`, `view-all`, `create`, `edit`, `delete` |
| `package` | `view`, `create`, `edit`, `delete`, `set-harga`, `term-&-condition`, `set-status` |
| `package-mice` | `view`, `create`, `edit`, `delete`, `set-harga`, `set-status`, `term-&-condition` |
| `vendor` | `view`, `create`, `edit`, `delete` |
| `vendor-specialist` | `view`, `create`, `edit`, `delete` |
| `settings-brands` | `view`, `create`, `edit`, `delete` |
| `settings-venues` | `view`, `create`, `edit`, `delete` |
| `settings-users` | `view`, `create`, `edit`, `delete` |
| `settings-education-level` | `view`, `create`, `edit`, `delete` |
| `settings-event-types` | `view`, `create`, `edit`, `delete` |
| `settings-order-status` | `view`, `create`, `edit`, `delete` |
| `settings-payment-methods` | `view`, `create`, `edit`, `delete` |
| `settings-quotation-templates` | `view`, `create`, `edit`, `delete` |
| `settings-role-permission` | `view`, `create`, `edit`, `delete` |
| `settings-source-of-information` | `view`, `create`, `edit`, `delete` |
| `settings-tutorial` | `view`, `create`, `edit`, `delete` |
| `complimentary` | `view`, `create`, `edit`, `delete` |
| `daily-activity` | `view`, `create`, `edit`, `delete` |
| `settings-lead-status` | `view`, `create`, `edit`, `delete` |
| `settings-daily-activity-segment` | `view`, `create`, `edit`, `delete` |
| `quotations` | `view`, `create`, `edit`, `delete` |
| `maintenance` | `view`, `create`, `edit`, `delete` |
| `settings-maintenance-category` | `view`, `create`, `edit`, `delete` |
| `settings-maintenance-priority` | `view`, `create`, `edit`, `delete` |
| `settings-maintenance-status` | `view`, `create`, `edit`, `delete` |
| `promo` | `view`, `create`, `edit`, `delete` |
| `procurement` | `view`, `create`, `edit`, `delete`, `approve` |
| `procurement-summary` | `view` |
| `procurement-announcement` | `view`, `create`, `edit`, `delete` |
| `procurement-budget` | `view`, `create`, `edit`, `delete` |
| `guestbook` | `view`, `create`, `edit`, `delete` |
| `bitrix` | `view` |
| `hr` | `view`, `create`, `edit`, `delete`, `approve` |
| `hr-attendance` | `view`, `create`, `edit`, `delete` |
| `hr-recruitment` | `view`, `create`, `edit`, `delete`, `hire` |
| `daily-report-manager` | `view`, `create`, `edit`, `delete` |

Module yang sudah **dihapus** (jangan dipakai di kode baru): `leads` (→ `daily-activity`), `settings-lead-segment` (→ `settings-daily-activity-segment`), `brand_management`, `calendar_event`, `catering`, `dashboard`, `decoration`, `finance_ap`, `notification`, `user_management`, `venue_management`. Daftar lengkap ada di `REMOVED_MODULES`.

---

## 2. Env vars (full, annotated)

```
DB_NEON=                        # true → Neon adapter; false → native pg (self-hosted/Dokploy)
DATABASE_URL=                   # pooled connection (runtime app)
DIRECT_URL=                     # direct connection (migrations)
AUTH_SECRET=                    # openssl rand -base64 32
AUTH_URL=                       # https://app.swasana.com
AUTH_TRUST_HOST=                # true when behind reverse proxy (Dokploy/Traefik)
RESEND_API_KEY=
RESEND_FROM_EMAIL=              # noreply@yourdomain.com
S3_ENDPOINT=                    # S3-compatible endpoint (MinIO/Railway/R2)
S3_REGION=                      # auto
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
S3_PUBLIC_URL=                  # public base URL for objects
NEXT_PUBLIC_S3_PUBLIC_URL=      # same as S3_PUBLIC_URL, inlined at build time
APP_URL=                        # public base for emails/links
CLEANUP_SECRET=                 # dedicated secret for /api/admin/cleanup-logs (do NOT reuse AUTH_SECRET)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # web-push (PWA notifications)
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=                  # mailto:noreply@swasana.com
PERURI_USERNAME=                # e-meterai (Peruri)
PERURI_PASSWORD=
PERURI_ENV=                     # staging | production
BITRIX_WEBHOOK_BASE=            # Bitrix24 inbound webhook base URL
```

> Rate limiting uses in-memory store — no Redis or external service needed.

Secrets never land in git. `.env` is gitignored; `.env.example` ships placeholder values only.

---

## 3. CI/CD Pipeline (full)

### Workflow Structure
```
.github/workflows/
└── ci.yml              → PR validation (generate → lint → typecheck → build)
```

> Catatan: deployment (staging/production) belum diotomasi lewat GitHub Actions
> saat dokumen ini ditulis. Satu-satunya workflow aktif adalah CI. Kalau nanti ada
> `cd-staging.yml` / `cd-production.yml`, ikuti pola migrate → build → deploy di bawah.

### Deploy Flow (target)
- Push ke `main` → auto migrate staging DB → build → deploy staging
- Push ke `production` → auto migrate prod DB → build → deploy prod
- Migration failure = deploy blocked (separate jobs)
- `prisma generate` explicit in every job
- No lint/typecheck in CD (already validated in CI)

### Branch Strategy
- `main` = staging
- `production` = production
- Feature branches: `feat/<name>`, `fix/<name>`
- PR required to merge into `main` or `production`

---

## 4. File Naming Convention — full tables

### 4.1. Immutable (framework-enforced, do NOT rename)

| Category | Rule | Examples |
|---|---|---|
| Next.js special files | **lowercase kebab-case** | `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `global-error.tsx`, `template.tsx`, `default.tsx`, `route.ts`, `proxy.ts` |
| Route folders | **kebab-case** | `user-management/`, `payment-methods/`, `[id]`, `[...slug]`, `(group)`, `_private`, `@slot` |
| Shadcn components | **kebab-case** (`components/ui/*`) | `button.tsx`, `dropdown-menu.tsx`, `scroll-area.tsx` — CLI regenerates using kebab-case; renaming causes duplicates |

### 4.2. Project convention (for files WE own)

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

### 4.3. Forbidden patterns

- ❌ `UseUsers.ts` — hooks MUST start with lowercase `use`
- ❌ `User-Management/` as a route folder — URL becomes `/User-Management` (case-sensitive on Linux, SEO-unfriendly)
- ❌ Mixing conventions inside the same folder (e.g., `UsersTable.tsx` next to `invite-drawer.tsx` under the same `_components/`)
- ❌ Renaming via IDE case-change on Windows (case-insensitive FS) without `git mv --force` + verification on Linux

### 4.4. Renaming procedure (when enforcing convention on legacy files)

1. `git mv oldName.tsx NewName.tsx` — git must notice the case change
2. Update every import of the renamed file (`Grep` the old path first)
3. Build locally: `npm run build` (Turbopack is case-sensitive even on Windows)
4. Commit the move + import updates in one commit per layer (components, then hooks, then services, then lib)

---

## 5. Design System — full detail

### Brand Palette
| Token | Hex | Pemakaian |
|---|---|---|
| `--brand-ink` | `#0F4159` | Foreground text (auto via `text-foreground`), heading, icon color |
| `--brand-gold` | `#D4A547` | Focus ring (auto via `ring`), CTA accent, highlight |
| `--brand-cream` | `#FAF7F2` | Foreground dark mode, soft section background |

### shadcn Config
- Style: base-nova (base-ui primitives, BUKAN radix)
- Base color: neutral
- Tailwind v4 (`@import` syntax)
- **Icon: Solar Icons (@solar-icons/react) — weight="BoldDuotone"**
- Font: Plus Jakarta Sans (body), Fraunces (display/heading), Quicksand (logo), Geist Mono (mono)

### Icon Usage (Solar BoldDuotone)
```tsx
import { Magnifer, Pen, TrashBinTrash } from "@solar-icons/react";

<Magnifer weight="BoldDuotone" className="h-4 w-4 text-muted-foreground" />
<Pen weight="BoldDuotone" className="h-5 w-5" />
```
Size via Tailwind className (h-N w-N). Color via Tailwind `text-*` (uses currentColor for both duotone paths).

### Layout & Component Style — Bank Jago Vibe (REFRESH)
Layouting & komponen ngikut gaya **Bank Jago** (modern neobank) — warna TETEP brand ink/gold/cream, cuma layout-nya naik kelas:

- **Card-based** — konten dikelompokin di card `rounded-2xl`, bukan flat list polos
- **Rounded generous** — card `rounded-2xl`; button/input/badge `rounded-xl` atau `rounded-full` (pill)
- **Spacing lega** — padding card `p-5`/`p-6`, gap section `gap-4`/`gap-6` — jangan sumpek
- **Soft shadow** — elevation halus (`shadow-sm` → hover `shadow-md`), bukan border tebel doang
- **Pill buttons & chips** — CTA & filter chip bentuk pill (`rounded-full`)
- **Hierarchy jelas** — angka/metric gede & bold pakai `font-heading` (Fraunces), label kecil `muted-foreground` di atasnya
- **Airy & breathable** — whitespace itu fitur, jangan rapetin semua
- **Hover feedback halus** — `transition-colors`/`transition-shadow`, hover subtle pakai `accent`/`muted`

Prinsip: aturan "no hardcode color" tetep STRICT, tapi layout clean, rounded, spacious, friendly kayak app neobank.
