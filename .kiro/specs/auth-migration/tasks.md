# Implementation Plan: Migrasi Autentikasi

## Overview

Implementasi migrasi fitur autentikasi dari proyek sumber ke `swasana-project`. Mencakup perubahan database schema, halaman auth (login, forgot password, reset password, verifikasi email), dashboard UI shell (sidebar + header), fitur undangan pengguna, halaman settings dengan CRUD role & permission, halaman error, dan optimasi caching/loading states. Menggunakan Next.js 16.2.3 dengan `proxy.ts`, NextAuth v5, Prisma 7, TanStack Query 5, dan shadcn/ui.

## Tasks

- [x] 1. Foundation — Database Schema, Migrasi, Seed, dan Utilitas
  - [x] 1.1 Update Prisma schema dengan perubahan baru
    - Tambahkan enum `ProfileStatus` (`active`, `inactive`, `suspended`)
    - Tambahkan field `status ProfileStatus @default(active)`, `invitedBy String?`, `invitedAt DateTime?` pada model `Profile`
    - Ubah field `used Boolean @default(false)` menjadi `usedAt DateTime?` pada model `EmailVerificationToken`
    - Ubah field `used Boolean @default(false)` menjadi `usedAt DateTime?` pada model `PasswordResetToken`
    - Tambahkan `@@index([roleId])` pada model `Profile`
    - Tambahkan `@@index([userId])` pada model `UserVenueAccess`
    - Jalankan `npx prisma migrate dev --name add_profile_status_and_indexes`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [x] 1.2 Update `prisma/seed.ts` sesuai schema baru
    - Sesuaikan seed data: gunakan `usedAt` (bukan `used`), tambahkan `status` pada profil
    - Pastikan seed data konsisten dengan enum `ProfileStatus`
    - _Requirements: 12.9_

  - [x] 1.3 Buat fungsi utilitas `getBaseUrl()` di `lib/url.ts`
    - Implementasi async function yang menggunakan `await headers()` di server-side (Next.js 16)
    - Gunakan `x-forwarded-host` / `host` header untuk deteksi URL runtime
    - Fallback ke `NEXT_PUBLIC_APP_URL` atau `http://localhost:3000`
    - Client-side: gunakan `NEXT_PUBLIC_APP_URL` atau fallback
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 1.4 Buat type definitions di `types/auth.ts` dan `types/user.ts`
    - Definisikan TypeScript types/interfaces untuk auth (LoginInput, ResetPasswordInput, ForgotPasswordInput, VerifyTokenInput)
    - Definisikan types untuk user management (User, InviteUserInput, UpdateUserInput, RoleWithPermissions, PermissionMatrix)
    - _Requirements: 1, 2, 3, 4, 8, 9_

  - [x] 1.5 Buat/update Zod validation schemas di `lib/validations/auth.ts` dan `lib/validations/user.ts`
    - Pastikan `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `changePasswordSchema` ada di `auth.ts`
    - Buat `inviteUserSchema`, `updateUserSchema`, `createRoleSchema`, `updateRoleSchema` di `user.ts`
    - _Requirements: 1.5, 2.3, 3.4, 4.4, 8.9, 9.4, 9.5_


- [x] 2. Checkpoint — Pastikan schema valid dan seed berjalan
  - Jalankan `npx prisma generate` dan `npx prisma db seed` untuk memastikan schema dan seed data benar. Tanyakan ke user jika ada pertanyaan.

- [x] 3. Auth Infrastructure — Proxy, NextAuth Config, Server Actions, Email
  - [x] 3.1 Buat `proxy.ts` (pengganti middleware.ts) di root project
    - Implementasi fungsi `proxy(request: NextRequest)` dengan cek JWT cookie (`authjs.session-token` / `__Secure-authjs.session-token`)
    - Definisikan `PUBLIC_PATHS` untuk route auth dan API
    - Redirect user yang sudah login dari `/auth/*` ke `/dashboard`
    - Redirect user yang belum login dari route private ke `/auth/login` dengan `callbackUrl`
    - Export `config` dengan `matcher` dan `skipProxyUrlNormalize: true`
    - _Requirements: 7.11, 5.2_

  - [x] 3.2 Update NextAuth config di `lib/auth.ts`
    - Update `pages.signIn` ke `/auth/login` (pastikan konsisten)
    - Pastikan JWT callback menyertakan `mustChangePassword`, `roleId`, `isEmailVerified`
    - Pastikan session callback meneruskan data dari token ke session
    - Update authorize function: cek `isEmailVerified`, update `lastLoginAt`
    - _Requirements: 1.5, 1.6, 5.1_

  - [x] 3.3 Update `app/(private)/layout.tsx` — auth guard dengan forced password change
    - Cek session via `auth()`, redirect ke `/auth/login` jika belum login
    - Cek `mustChangePassword` dari session, redirect ke `/auth/reset-password?force=true` jika `true`
    - _Requirements: 5.1, 5.2, 7.11_

  - [x] 3.4 Buat Server Actions di `actions/auth.ts`
    - `forgotPassword(formData)`: buat token di `password_reset_tokens`, kirim email via Resend, selalu return sukses (anti-enumerasi)
    - `resetPassword(formData)`: validasi token (expired/used/invalid), update password (bcrypt hash), set `mustChangePassword = false` jika force mode, invalidasi cache
    - `verifyEmail(token)`: validasi token dari `email_verification_tokens`, set `isEmailVerified = true`, set `usedAt`
    - Gunakan `getBaseUrl()` untuk generate link dalam email
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 4.2, 4.3, 10.5_

  - [x] 3.5 Buat Server Actions di `actions/user.ts`
    - `inviteUser(formData)`: buat User + Profile (isEmailVerified: false, mustChangePassword: true), buat EmailVerificationToken, buat UserVenueAccess, kirim email undangan via Resend, invalidasi cache `users` via `updateTag`
    - `updateUser(formData)`: update data user/profile, invalidasi cache
    - `deleteUser(userId)`: hapus user, invalidasi cache
    - `resendInvitation(userId)`: buat token baru, kirim ulang email undangan
    - _Requirements: 8.3, 8.4, 8.5, 8.8, 8.10, 10.5_

  - [x] 3.6 Buat Server Actions di `actions/role.ts`
    - `createRole(formData)`: buat role baru di database via Prisma, invalidasi cache `roles`
    - `updateRole(formData)`: update nama/deskripsi role, invalidasi cache `roles`
    - `deleteRole(roleId)`: hapus role (cegah hapus role "admin"), cascade ke RolePermission, invalidasi cache `roles`
    - `updateRolePermissions(roleId, permissionIds)`: update matriks permission per role di tabel `role_permissions`, invalidasi cache `roles`
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.10_

  - [x] 3.7 Buat email templates untuk Resend
    - Template email undangan: berisi tautan verifikasi `{getBaseUrl()}/auth/verify?token={token}` dan password sementara
    - Template email reset password: berisi tautan `{getBaseUrl()}/auth/reset-password?token={token}`
    - Gunakan `getBaseUrl()` untuk URL dinamis, bukan hardcode
    - _Requirements: 2.4, 8.4, 10.5, 10.6_


  - [x] 3.8 Buat cached queries di `lib/queries/`
    - `lib/queries/users.ts`: `getUsers()` dengan `"use cache"`, `cacheTag("users")`, `cacheLife("minutes")` — gunakan `select` (bukan `include`) untuk N+1 prevention
    - `lib/queries/roles.ts`: `getRoles()` dengan `cacheTag("roles")`, `cacheLife("hours")`
    - `lib/queries/permissions.ts`: `getPermissions()` dengan `cacheTag("permissions")`, `cacheLife("hours")`
    - `lib/queries/venues.ts`: `getVenues()` dengan `cacheTag("venues")`, `cacheLife("hours")`
    - _Requirements: 14.1, 14.5_

  - [x] 3.9 Buat TanStack Query hooks di `hooks/`
    - `hooks/use-users.ts`: `useUsers(initialData)` dengan `staleTime: 5 * 60 * 1000`, `useInviteUser()`, `useUpdateUser()`, `useDeleteUser()` mutations dengan `invalidateQueries`
    - `hooks/use-roles.ts`: `useRoles(initialData)` dengan `staleTime: 10 * 60 * 1000`, mutations untuk CRUD role dan update permissions
    - `hooks/use-current-user.ts`: `useCurrentUser()` dengan `staleTime: 60 * 1000`
    - `hooks/use-sidebar.ts`: hook state untuk sidebar collapse/expand
    - _Requirements: 14.2, 14.3, 14.4, 14.6, 14.7_

  - [x] 3.10 Buat service layer di `services/`
    - `services/user-service.ts`: pure fetch functions (`fetchUsers`, `fetchUserById`) untuk TanStack Query `queryFn`
    - `services/auth-service.ts`: pure fetch functions untuk auth operations
    - _Requirements: 14.2_

- [x] 4. Checkpoint — Pastikan semua server actions, queries, dan hooks terkompilasi tanpa error
  - Jalankan `npx tsc --noEmit` atau build check. Tanyakan ke user jika ada pertanyaan.

- [x] 5. Halaman Auth — Login, Forgot Password, Reset Password, Verify
  - [x] 5.1 Buat halaman Login di `app/(public)/auth/login/`
    - `page.tsx` (Server Component): render LoginForm, handle URL `message` parameter
    - `_components/login-form.tsx` (Client Component): layout dua kolom desktop (form kiri, gambar `thumbnail.png` kanan), satu kolom mobile (gambar hidden)
    - Form: email (Input), password (Input dengan toggle Eye/EyeOff), tombol Login (Button dengan Loader2 loading state)
    - Gunakan `signIn("credentials")` dari next-auth/react
    - Link "Forgot your password?" ke `/auth/forgot-password`
    - Toast dari URL parameter `message` menggunakan Sonner
    - Disable semua input saat loading
    - Bangun dengan Komponen_ShadcnUI: Card, CardContent, Input, Button, Label, Form
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 11.1, 11.5_

  - [x] 5.2 Buat halaman Forgot Password di `app/(public)/auth/forgot-password/`
    - `page.tsx` (Server Component): render ForgotPasswordForm
    - `_components/forgot-password-form.tsx` (Client Component): layout centered card
    - Form: email (Input), tombol submit (Button dengan loading state)
    - Panggil server action `forgotPassword`, selalu tampilkan pesan sukses (anti-enumerasi)
    - Link kembali ke login
    - Disable input saat loading
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 11.1_

  - [x] 5.3 Buat halaman Reset Password di `app/(public)/auth/reset-password/`
    - `page.tsx` (Server Component): render ResetPasswordForm, pass searchParams (await di Next.js 16)
    - `_components/reset-password-form.tsx` (Client Component): validasi token dari URL sebelum tampilkan form
    - Form: password baru + konfirmasi password (keduanya dengan toggle visibility)
    - Handle mode `force=true`: tampilkan pesan wajib ganti password sementara
    - Handle token states: expired → pesan + link forgot password, used → pesan error, invalid → pesan error
    - Setelah berhasil: redirect ke login dengan pesan sukses, set `mustChangePassword = false`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 5.3, 11.1_

  - [x] 5.4 Buat halaman Verifikasi Email di `app/(public)/auth/verify/`
    - `page.tsx` (Server Component): render VerifyForm, pass searchParams (await di Next.js 16)
    - `_components/verify-form.tsx` (Client Component): state machine (loading → verified → password input → login)
    - Validasi token dari `email_verification_tokens`, set `isEmailVerified = true`
    - Form password sementara untuk login pertama kali
    - Handle token states: expired → pesan error + instruksi hubungi admin, invalid/used → pesan error
    - Loading state: "Memverifikasi email..."
    - Handle `message` tanpa `token`: tampilkan pesan konfirmasi, redirect ke login setelah 3 detik
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 11.1_


  - [x] 5.5 Migrasi aset gambar ke folder `public/`
    - Salin `thumbnail.png` ke `public/thumbnail.png` (gambar latar halaman login)
    - Salin `logo-swasana.svg` ke `public/logo-swasana.svg` (logo sidebar)
    - Pastikan fallback visual jika gambar tidak ditemukan (tidak merusak layout)
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 6. Checkpoint — Pastikan semua halaman auth berfungsi dan dapat diakses
  - Pastikan semua halaman auth ter-render tanpa error. Tanyakan ke user jika ada pertanyaan.

- [x] 7. Dashboard Shell — Layout, Sidebar, Header, Loading States
  - [x] 7.1 Refactor sidebar ke `app/(private)/dashboard/_components/sidebar/`
    - Pindahkan dan refactor sidebar menjadi beberapa file: `sidebar.tsx`, `nav-item.tsx`, `sub-menu-item.tsx`, `sidebar-config.ts`
    - Implementasi collapsible sidebar pada desktop (toggle PanelLeftClose/PanelLeftOpen)
    - Implementasi Sheet overlay pada mobile (hidden lg:flex untuk desktop, Sheet untuk mobile)
    - Implementasi popover submenu saat sidebar collapsed + hover
    - Logo `logo-swasana.svg` di bagian atas sidebar
    - Menu navigasi sesuai desain: Overview, Customers, Event (submenu), Purchase Order, Finance (submenu), Package, Venue, Vendor, Users Management, Settings (submenu: Role & Permission, PDF Config, Profile, Account)
    - Gunakan Komponen_ShadcnUI: Button, Separator, Sheet, Tooltip, Avatar, Dropdown Menu
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.12, 11.2_

  - [x] 7.2 Refactor header ke `app/(private)/dashboard/_components/header/`
    - Pindahkan dan refactor header menjadi: `header.tsx`, `user-menu.tsx`
    - Tampilkan info pengguna: nama, role (Avatar + DropdownMenu)
    - Menu dropdown: Profile, Settings, Logout
    - Hamburger menu untuk mobile (trigger Sheet sidebar)
    - Logout: `signOut({ callbackUrl: "/auth/login" })`
    - Gunakan Komponen_ShadcnUI: Avatar, Dropdown Menu, Button
    - _Requirements: 7.8, 7.9, 7.10, 11.2_

  - [x] 7.3 Update `app/(private)/dashboard/layout.tsx`
    - Integrasikan sidebar dan header yang sudah di-refactor
    - Pastikan layout shell: sidebar kiri, header atas, area konten utama
    - _Requirements: 7.1_

  - [x] 7.4 Buat `app/(private)/dashboard/loading.tsx` — skeleton layout dashboard
    - Skeleton untuk heading, grid cards, dan area konten menggunakan komponen `Skeleton` dari shadcn/ui
    - _Requirements: 13.1, 13.2, 13.4, 13.6_

- [x] 8. Checkpoint — Pastikan dashboard shell (sidebar + header + loading) berfungsi
  - Pastikan navigasi sidebar, header dropdown, dan loading skeleton berjalan. Tanyakan ke user jika ada pertanyaan.

- [x] 9. User Management — Tabel, Invite Drawer, CRUD
  - [x] 9.1 Buat halaman User Management di `app/(private)/dashboard/settings/user-management/`
    - `page.tsx` (Server Component): fetch users via `getUsers()`, pass sebagai `initialData` ke UsersTable
    - Gunakan `Promise.all` untuk parallel queries jika perlu (users + roles + venues)
    - _Requirements: 8.1, 14.6_

  - [x] 9.2 Buat `_components/users-table.tsx` (Client Component)
    - Tabel daftar pengguna menggunakan Komponen_ShadcnUI: Table, Badge, Avatar, Button
    - Kolom: avatar, nama, email, role (Badge), status verifikasi (Badge), venues, aksi
    - Tombol "Invite New User" di atas tabel
    - Tombol "Resend Invitation" untuk pengguna yang belum verifikasi
    - Tombol edit untuk setiap pengguna
    - Gunakan `useUsers(initialData)` dari TanStack Query hook
    - _Requirements: 8.1, 8.8, 8.10, 11.3, 14.2_

  - [x] 9.3 Buat `_components/invite-drawer.tsx` (Client Component)
    - Sheet/Dialog untuk form undangan pengguna baru dan edit pengguna
    - Field: email (Input), nama lengkap (Input), role (Select), assigned venues (multi-select)
    - Validasi: react-hook-form + zod (`inviteUserSchema`)
    - Panggil server action `inviteUser` / `updateUser`
    - Toast sukses/error menggunakan Sonner
    - _Requirements: 8.2, 8.3, 8.4, 8.8, 8.9, 11.3_

  - [x] 9.4 Buat `app/(private)/dashboard/settings/user-management/loading.tsx`
    - Skeleton tabel pengguna: header + 5 baris skeleton dengan avatar, nama, email, badge
    - Gunakan komponen `Skeleton` dari shadcn/ui
    - _Requirements: 13.5, 13.6_


- [x] 10. Settings Pages — Layout, Role & Permission CRUD, Profile, Account
  - [x] 10.1 Buat settings layout di `app/(private)/dashboard/settings/layout.tsx`
    - Layout dengan navigasi sub-menu (Tabs atau sidebar internal)
    - Sub-menu items: User Management, Role & Permission, PDF Configuration, Profile, Account
    - Tampilkan sub-menu berdasarkan role: "Role & Permission" dan "PDF Configuration" hanya untuk admin
    - Navigasi tanpa reload halaman penuh
    - _Requirements: 9.1, 9.14, 9.15_

  - [x] 10.2 Buat `app/(private)/dashboard/settings/page.tsx`
    - Redirect ke sub-menu default (misalnya `/dashboard/settings/user-management`)
    - _Requirements: 9.1_

  - [x] 10.3 Buat halaman Role & Permission di `app/(private)/dashboard/settings/roles/`
    - `page.tsx` (Server Component): fetch roles + permissions via `Promise.all([getRoles(), getPermissions()])`, pass sebagai `initialData`
    - _Requirements: 9.2, 9.3_

  - [x] 10.4 Buat `_components/roles-manager.tsx` (Client Component) — CRUD Role lengkap
    - Daftar role: tabel/Card menampilkan nama, deskripsi, jumlah user per role
    - Tombol "Tambah Role Baru" → membuka Dialog
    - Tombol Edit (ikon pensil) dan Hapus (ikon trash) per role
    - Role "admin" tidak dapat dihapus — tombol hapus disembunyikan/dinonaktifkan
    - Dialog tambah/edit role: field nama role (wajib), deskripsi (opsional), validasi react-hook-form + zod
    - AlertDialog konfirmasi hapus role
    - Matriks permission: Table dengan baris = modul, kolom = aksi (view, create, edit, delete), setiap sel = Checkbox
    - WHEN Checkbox diubah, panggil server action `updateRolePermissions`
    - Gunakan TanStack Query hooks (`useRoles`, mutations) untuk cache + invalidation
    - Gunakan Komponen_ShadcnUI: Card, Table, Checkbox, Dialog, AlertDialog, Button, Input, Label
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 11.4_

  - [x] 10.5 Buat halaman Profile Settings di `app/(private)/dashboard/settings/profile/page.tsx`
    - Form edit profil: nama, nomor telepon, avatar, timezone (Select), bahasa (Select)
    - Gunakan Komponen_ShadcnUI: Card, Input, Button, Form, Label, Avatar, Select
    - _Requirements: 9.12_

  - [x] 10.6 Buat halaman Account Settings di `app/(private)/dashboard/settings/account/page.tsx`
    - Form ganti password: password lama, password baru, konfirmasi password baru
    - Gunakan Komponen_ShadcnUI: Card, Input, Button, Form, Label
    - _Requirements: 9.13_

  - [x] 10.7 Buat placeholder halaman PDF Configuration di `app/(private)/dashboard/settings/pdf-config/page.tsx`
    - Halaman placeholder dengan Tabs, Card — konten PDF config dari proyek sumber
    - Hanya ditampilkan untuk admin
    - _Requirements: 9.11, 9.15_

- [x] 11. Checkpoint — Pastikan settings pages dan CRUD role berfungsi
  - Pastikan navigasi settings, CRUD role, matriks permission, profile, dan account berjalan. Tanyakan ke user jika ada pertanyaan.

- [x] 12. Halaman Error — 404, 500, Error Boundary
  - [x] 12.1 Buat halaman 404 global di `app/not-found.tsx`
    - Layout terpusat penuh layar (centered full-screen)
    - Ikon `FileQuestion` dari lucide-react, heading "Halaman Tidak Ditemukan", deskripsi, tombol "Kembali ke Dashboard"
    - Responsif mobile dan desktop
    - Gunakan Komponen_ShadcnUI: Button
    - _Requirements: 15.1, 15.5, 15.6, 15.8, 15.10_

  - [x] 12.2 Buat halaman error global di `app/error.tsx`
    - WAJIB `"use client"` — Client Component
    - Ikon `AlertTriangle`, heading "Terjadi Kesalahan", deskripsi, tombol "Coba Lagi" (`reset()`), tombol "Kembali ke Dashboard"
    - Responsif mobile dan desktop
    - Gunakan Komponen_ShadcnUI: Button
    - _Requirements: 15.2, 15.5, 15.7, 15.8, 15.10_

  - [x] 12.3 Buat halaman 404 dashboard di `app/(private)/dashboard/not-found.tsx`
    - Desain sama dengan global 404, tapi di-render di dalam layout dashboard (sidebar + header tetap terlihat)
    - Gunakan `min-h-[50vh]` (bukan `min-h-svh`) karena sudah di dalam layout
    - _Requirements: 15.3, 15.6, 15.9_

  - [x] 12.4 Buat halaman error dashboard di `app/(private)/dashboard/error.tsx`
    - WAJIB `"use client"` — Client Component
    - Desain sama dengan global error, tapi di-render di dalam layout dashboard
    - Sidebar dan header tetap terlihat — error hanya di area konten
    - _Requirements: 15.4, 15.7, 15.9_

- [x] 13. Polish — Shared Components, Caching Optimization, Loading States
  - [x] 13.1 Buat shared/reusable components di `components/shared/`
    - `page-header.tsx`: reusable page header component (judul + deskripsi + aksi)
    - `data-table.tsx`: reusable data table wrapper
    - `confirm-dialog.tsx`: reusable confirm dialog (AlertDialog wrapper)
    - _Requirements: 11.2, 11.3, 11.4_

  - [x] 13.2 Pastikan konsistensi penggunaan shadcn/ui di seluruh halaman
    - Verifikasi semua halaman auth menggunakan Komponen_ShadcnUI
    - Verifikasi dashboard shell menggunakan Komponen_ShadcnUI
    - Verifikasi user management menggunakan Komponen_ShadcnUI
    - Verifikasi settings menggunakan Komponen_ShadcnUI
    - Verifikasi Sonner digunakan untuk semua toast notification
    - Install komponen shadcn/ui yang belum ada jika diperlukan (`npx shadcn@latest add [component-name]`)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 13.3 Verifikasi dan optimasi caching end-to-end
    - Pastikan semua cached queries menggunakan `"use cache"` + `cacheTag` + `cacheLife`
    - Pastikan semua server actions menginvalidasi cache via `updateTag`
    - Pastikan semua TanStack Query hooks menggunakan `initialData` pattern dari Server Component
    - Pastikan `staleTime` dikonfigurasi per tipe data (users: 5 min, roles/venues: 10 min, current user: 1 min)
    - Pastikan mutations menginvalidasi queries yang relevan
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 13.4 Verifikasi loading states dan skeleton di seluruh route
    - Pastikan `loading.tsx` ada di `/dashboard` dan `/dashboard/settings/user-management`
    - Pastikan skeleton menggunakan komponen `Skeleton` dari shadcn/ui
    - Pastikan Suspense boundaries digunakan di level komponen jika diperlukan
    - Pastikan tidak ada layout shift saat data dimuat (skeleton → konten mulus)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [x] 14. Audit Logging — Schema Update, Utilitas, dan Integrasi
  - [x] 14.1 Update model `ActivityLog` di Prisma schema
    - Tambahkan field `result String @default("success")`
    - Tambahkan field `ipAddress String?`
    - Tambahkan field `userAgent String?`
    - Tambahkan index `@@index([userId, createdAt])`
    - Tambahkan index `@@index([action, createdAt])`
    - Tambahkan index `@@index([entityType, entityId, createdAt])`
    - Jalankan `npx prisma migrate dev --name add_audit_log_fields`
    - _Requirements: 16.1, 16.2, 16.8_

  - [x] 14.2 Buat fungsi utilitas `logAudit()` di `lib/audit.ts`
    - Implementasi async function dengan try/catch (non-blocking)
    - Parameter: userId, action, result, entityType, entityId, changes, description, ipAddress, userAgent
    - Naming convention: `resource.action`
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 14.3 Integrasikan `logAudit()` ke Server Actions auth (`actions/auth.ts`)
    - Log: auth.login (berhasil), auth.login_failed (gagal), auth.logout, auth.password_reset_requested, auth.password_changed, auth.email_verified
    - Capture ipAddress dan userAgent dari headers
    - _Requirements: 16.5_

  - [x] 14.4 Integrasikan `logAudit()` ke Server Actions user (`actions/user.ts`)
    - Log: user.invited (dengan before/after state), user.updated, user.deleted
    - Capture ipAddress dan userAgent dari headers
    - _Requirements: 16.5, 16.7_

  - [x] 14.5 Integrasikan `logAudit()` ke Server Actions role (`actions/role.ts`)
    - Log: role.created, role.updated, role.deleted, permission.changed (dengan before/after state)
    - _Requirements: 16.5, 16.7_

  - [x] 14.6 Implementasi retention policy — auto-cleanup logs > 90 hari
    - Buat API endpoint atau server action untuk cleanup
    - Query: delete activity_logs where createdAt < 90 days ago
    - _Requirements: 16.9_

- [x] 15. Final Checkpoint — Pastikan semua fitur terintegrasi dan berfungsi
  - Pastikan semua tests pass dan semua 16 requirements tercakup. Tanyakan ke user jika ada pertanyaan.

## Notes

- Setiap task mereferensikan requirements spesifik untuk traceability
- Checkpoints memastikan validasi inkremental di setiap fase
- Pola Server/Client Component split digunakan konsisten: `page.tsx` = Server Component, `_components/*.tsx` = Client Component
- Semua async APIs (headers, cookies, params, searchParams) harus di-`await` sesuai Next.js 16
- Gunakan `proxy.ts` (bukan `middleware.ts`) sesuai Next.js 16
- Gunakan `updateTag` (bukan `revalidateTag`) untuk invalidasi cache di Server Actions
- Palet warna KETAT: hitam/putih/abu-abu untuk UI, warna semantik HANYA untuk toast/status
- PBT (Property-Based Testing) tidak diterapkan karena fitur ini sebagian besar UI, CRUD, dan integrasi layanan eksternal
- Task 14 (Audit Logging) mencakup Persyaratan 16 — schema update, fungsi utilitas, integrasi ke server actions, dan retention policy
