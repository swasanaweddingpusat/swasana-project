# Review Instructions — Swasana Project

Instruksi ini prioritas tertinggi buat code review. Turunan dari `AGENTS.md`.

## Scope (WAJIB)

- Review **HANYA** baris yang berubah di diff PR (`git diff origin/<base>...HEAD`). Jangan audit kode lama yang tidak disentuh PR ini.
- Masalah di kode lama (di luar diff) → **abaikan**, KECUALI perubahan PR ini bikin kode lama jadi regresi.
- Baca file sekitar diff secukupnya buat konteks — bukan buat nyari-nyari isu di luar scope.
- Kalau gak ada isu → bilang **"LGTM, gak ada isu"**. Jangan maksa nyari masalah.

## Severity

| Tag | Arti |
|---|---|
| `[BLOCKER]` | Bug / lubang security / pelanggaran aturan keras. Wajib fix sebelum merge. |
| `[WARNING]` | Bukan blocking tapi sebaiknya dibenerin. |
| `[NIT]` | Minor. Maksimal 5 nit per review; sisanya ringkas di summary. |

Jangan komentarin style/format yang udah dihandle ESLint/Prettier.

---

## Auth & Security — cek keras (BLOCKER kalau langgar)

- Mutation (server action / POST/PATCH/DELETE) tanpa `requirePermission()` / `requirePermissionForRoute()` → **BLOCKER**.
- Endpoint tanpa rate limiter dipanggil **paling awal** (`authLimiter` / `mutationLimiter` / `apiLimiter`) → **BLOCKER**. Termasuk GET kecil.
- Multi-table write TANPA `db.$transaction([...])` **array-form** → **BLOCKER**. Callback form (`async tx =>`) di Neon HTTP → **BLOCKER**.
- Password change tanpa `db.session.deleteMany({ where: { userId } })` di transaksi yang sama → **BLOCKER**.
- `isSuperAdmin` via string match nama role (`role.name === "super admin"`) → **BLOCKER**. Harus `role.isSystemRole`.
- Token pakai `.used` (boolean) → salah, field-nya `usedAt` (DateTime). Cek `expiresAt` DAN `usedAt` dua-duanya.
- Auth error path bocorin email / bedain "user not found" vs "wrong password" → **BLOCKER**.
- Mutation sukses tanpa `revalidateTag("<tag>", "max")` → **WARNING**.
- Sensitive action tanpa `logAudit()` → **WARNING**.
- Pakai `{ session, error }` destructuring — BUKAN `permResult.error`.

## Next.js 16 & Prisma

- `middleware.ts` → **BLOCKER**, harus `proxy.ts`.
- `cookies()` / `headers()` tanpa `await` → **BLOCKER**.
- `findMany()` tanpa pagination → **WARNING**.
- Ganti `prisma/schema.prisma` tanpa migration file ke-commit bareng → **BLOCKER**.
- `db:push` di branch yang bakal di-merge → **BLOCKER**.
- Migration gak idempotent (tanpa `IF NOT EXISTS` / `IF EXISTS`) → **WARNING**.

## Code Quality

- `any` type → **WARNING** (pakai `unknown` lalu narrow).
- `console.log()` di runtime → **WARNING** (cuma `console.error()` di catch).
- Import / variable gak kepakai → **NIT**.
- Edit file di `components/ui/*` (shadcn generated) → **BLOCKER**.
- Exported function tanpa explicit return type → **NIT**.
- Ternary sebagai statement (`cond ? a() : b()`) → **WARNING**, harus `if/else`.

## Design System (no hardcode color)

- Hardcode warna (`bg-blue-500`, `text-green-600`, hex `#0F4159` di .tsx) → **WARNING**. Pakai token (`primary`, `foreground`, `var(--brand-*)`).
- Pakai `lucide-react` di file baru → **NIT**. Harus Solar Icons (`@solar-icons/react`, `weight="BoldDuotone"`).
- Tailwind v4 syntax: `data-[disabled]:` → `data-disabled:`, important `!text-x` → `text-x!`, arbitrary `w-[20px]` yang ada padanannya → `w-5`. → **NIT**.

---

## Struktur Folder — cek penempatan file (WAJIB)

Kalau ada file BARU di PR yang salah taruh, kasih catatan **[WARNING]** dengan lokasi yang benar:

- Server action (`"use server"`) → harus di `actions/`, BUKAN di `app/api/`.
- API route → `app/api/<resource>/route.ts`.
- Read/SELECT helper → `lib/queries/`. Write (INSERT/UPDATE/DELETE) → `actions/` atau `app/api/`. Jangan campur.
- Zod schema → `lib/validations/<domain>.ts`.
- Hook TanStack Query → `hooks/useXxx.ts`.
- Client fetcher → `services/xxxService.ts`.
- Email template → `emails/` (BUKAN di dalam `app/api/send-email/`).
- Feature component → co-located di `app/(private)/dashboard/<feature>/_components/`. Pindah ke `components/shared/` cuma kalau dipakai ≥2 feature.
- Ada `middleware.ts` → salah, harus `proxy.ts`.

### Naming convention (kasih [NIT] kalau langgar)

- React component `.tsx` → **PascalCase** (`UsersTable.tsx`).
- Hook → **camelCase** mulai `use` (`useUsers.ts`). `UseUsers.ts` → salah.
- Route folder → **kebab-case** (`user-management/`). `User-Management/` → salah.
- Validations → single-word lowercase (`auth.ts`, `user.ts`).
- Jangan campur konvensi dalam satu folder (`UsersTable.tsx` sebelah `invite-drawer.tsx` → flag).

---

## File Test

- Kalau PR **nambah/ubah** logic penting (server action, API route, util auth/permission) TAPI gak ada test yang nyertain → kasih **[WARNING]**: sebut fungsi/endpoint mana yang idealnya di-test.
- Kalau ada file test di PR:
  - Cek lokasi & penamaan test konsisten sama file test lain di repo (ikut pola yang udah ada — jangan bikin pola baru sendiri).
  - Test yang di-skip (`.skip` / `xit` / `it.todo`) tanpa alasan → **[NIT]**.
  - Assertion kosong / test yang gak ngetes apa-apa (cuma render tanpa expect) → **[WARNING]**.
- Kalau repo belum punya infra test sama sekali, JANGAN maksa — cukup catat sekali di summary kalau perubahan berisiko sebaiknya ditemani test.
