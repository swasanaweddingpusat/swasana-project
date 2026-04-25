# Dokumen Persyaratan — Migrasi Autentikasi

## Pendahuluan

Dokumen ini mendefinisikan persyaratan untuk migrasi fitur autentikasi dari proyek sumber (`contoh/Sistem-Wedding-Kediaman/`) ke proyek target (`swasana-project/`). Migrasi mencakup area berikut:

1. **Seluruh halaman autentikasi** — login, forgot password, reset password, verifikasi email
2. **Dashboard UI** — sidebar navigasi, header, dan layout shell (tanpa business logic)
3. **Fitur undangan pengguna (user invitation)** — alur lengkap dari invite hingga verifikasi
4. **Halaman Settings** — dengan beberapa sub-menu/section di dalamnya
5. **URL fallback/redirect dinamis** — tidak di-hardcode ke `localhost:3000`

Proyek sumber menggunakan Supabase Auth, sedangkan proyek target menggunakan **Next.js 16 App Router**, **NextAuth v5** (Credentials provider), **Prisma 7**, **Neon PostgreSQL**, **Resend** untuk email, **TanStack Query 5** untuk client-side caching, dan **shadcn/ui** untuk seluruh komponen UI. Fokus saat ini hanya pada **login email/password** — login Google akan menjadi fitur terpisah di kemudian hari.

Tambahan area migrasi:
6. **Database schema & migration** — perubahan Prisma schema dan strategi migrasi
7. **Skeleton/loading states** — loading UI instan pada setiap navigasi halaman
8. **Caching & data freshness** — strategi cache server-side dan client-side

## Glosarium

- **Sistem_Auth**: Modul autentikasi pada `swasana-project` yang menangani seluruh halaman dan alur auth (login, forgot password, reset password, verifikasi email) melalui NextAuth v5 Credentials provider
- **Sistem_Dashboard**: Modul dashboard pada `swasana-project` yang menampilkan layout shell (sidebar, header, area konten) — hanya UI, tanpa business logic
- **Sistem_Undangan**: Modul manajemen pengguna pada `swasana-project` yang menangani pengiriman undangan, pengelolaan akun pengguna, dan tabel user management
- **Sistem_Email**: Modul pengiriman email pada `swasana-project` menggunakan Resend untuk undangan, verifikasi email, dan reset password
- **Sistem_URL**: Modul konfigurasi URL pada `swasana-project` yang menentukan base URL aplikasi secara dinamis saat runtime
- **Sistem_Settings**: Modul halaman pengaturan pada `swasana-project` yang berisi beberapa sub-menu pengaturan (profil, role & permission, konfigurasi PDF, dll.)
- **Pengguna_Admin**: Pengguna dengan role admin yang memiliki akses penuh ke manajemen pengguna dan settings
- **Pengguna_Baru**: Pengguna yang diundang melalui Sistem_Undangan dan belum menyelesaikan verifikasi email
- **Komponen_ShadcnUI**: Komponen UI dari library shadcn/ui yang sudah terinstal di proyek target, meliputi: Button, Input, Card, Form, Label, Select, Table, Tabs, Sheet, Dialog, Dropdown Menu, Separator, Skeleton, Sonner (toast), Avatar, Badge, Checkbox, Switch, Textarea, Tooltip, Calendar, Command, Popover, Progress, Radio Group, Alert Dialog, Input Group
- **Aset_Gambar**: File gambar statis (thumbnail.png, logo-swasana.svg, dll.) yang digunakan pada halaman auth dan dashboard
- **URL_Dinamis**: Base URL aplikasi yang ditentukan saat runtime berdasarkan environment variable atau header request, bukan nilai hardcode
- **Sistem_Cache**: Modul caching pada `swasana-project` yang mengelola cache server-side (`"use cache"` + `cacheTag`) dan client-side (TanStack Query `staleTime` + `initialData`)
- **Sistem_DB**: Modul database pada `swasana-project` yang mengelola Prisma schema, migrasi, dan query optimization
- **Skeleton_UI**: Komponen loading/skeleton yang ditampilkan segera saat navigasi halaman sebelum data selesai dimuat
- **Sistem_Audit**: Modul audit logging pada `swasana-project` yang mencatat aktivitas autentikasi dan manajemen pengguna secara append-only ke tabel `audit_logs`

## Persyaratan

### Persyaratan 1: Halaman Login (Email/Password)

**User Story:** Sebagai pengguna, saya ingin login ke aplikasi menggunakan email dan password, sehingga saya dapat mengakses dashboard sesuai role saya.

#### Kriteria Penerimaan

1. THE Sistem_Auth SHALL menampilkan halaman login di route `/auth` dengan layout dua kolom pada layar desktop: formulir login di sisi kiri dan gambar thumbnail di sisi kanan
2. THE Sistem_Auth SHALL menampilkan layout satu kolom pada layar mobile dengan gambar thumbnail tersembunyi
3. THE Sistem_Auth SHALL hanya menyediakan metode login email dan password — tanpa tombol login Google atau provider OAuth lainnya
4. THE Sistem_Auth SHALL membangun formulir login menggunakan Komponen_ShadcnUI (Card, Input, Button, Form, Label)
5. WHEN pengguna mengisi email dan password lalu menekan tombol Login, THE Sistem_Auth SHALL mengautentikasi pengguna melalui NextAuth v5 Credentials provider
6. WHEN autentikasi berhasil, THE Sistem_Auth SHALL mengarahkan pengguna ke halaman dashboard
7. WHEN autentikasi gagal, THE Sistem_Auth SHALL menampilkan pesan toast error menggunakan Sonner yang menjelaskan penyebab kegagalan
8. THE Sistem_Auth SHALL menyediakan tombol toggle untuk menampilkan atau menyembunyikan password pada field input password
9. THE Sistem_Auth SHALL menyediakan tautan "Forgot your password?" yang mengarah ke halaman `/auth/forgot-password`
10. WHEN parameter `message` terdapat pada URL, THE Sistem_Auth SHALL menampilkan pesan tersebut sebagai toast notification dengan tipe yang sesuai (error atau success)
11. WHILE proses autentikasi sedang berlangsung, THE Sistem_Auth SHALL menampilkan indikator loading pada tombol Login dan menonaktifkan semua input field

### Persyaratan 2: Halaman Forgot Password

**User Story:** Sebagai pengguna yang lupa password, saya ingin dapat meminta tautan reset password melalui email, sehingga saya dapat memulihkan akses ke akun saya.

#### Kriteria Penerimaan

1. THE Sistem_Auth SHALL menampilkan halaman forgot password di route `/auth/forgot-password` dengan layout terpusat (centered card)
2. THE Sistem_Auth SHALL membangun formulir forgot password menggunakan Komponen_ShadcnUI (Card, Input, Button, Form, Label)
3. WHEN pengguna mengisi email dan menekan tombol submit, THE Sistem_Auth SHALL membuat token reset password dan menyimpannya di tabel `password_reset_tokens` melalui Prisma
4. WHEN token reset berhasil dibuat, THE Sistem_Email SHALL mengirim email berisi tautan reset password ke alamat email pengguna menggunakan Resend
5. WHEN email berhasil dikirim, THE Sistem_Auth SHALL menampilkan pesan konfirmasi bahwa email reset password telah dikirim
6. IF email yang dimasukkan tidak terdaftar di database, THEN THE Sistem_Auth SHALL tetap menampilkan pesan konfirmasi yang sama untuk mencegah enumerasi akun
7. THE Sistem_Auth SHALL menyediakan tautan kembali ke halaman login
8. WHILE proses pengiriman email sedang berlangsung, THE Sistem_Auth SHALL menampilkan indikator loading pada tombol submit dan menonaktifkan input field

### Persyaratan 3: Halaman Reset Password

**User Story:** Sebagai pengguna yang menerima email reset password, saya ingin dapat mengatur password baru, sehingga saya dapat login kembali ke akun saya.

#### Kriteria Penerimaan

1. THE Sistem_Auth SHALL menampilkan halaman reset password di route `/auth/reset-password` dengan layout terpusat (centered card)
2. THE Sistem_Auth SHALL membangun formulir reset password menggunakan Komponen_ShadcnUI (Card, Input, Button, Form, Label) dengan field password baru dan konfirmasi password
3. WHEN pengguna mengakses halaman reset password, THE Sistem_Auth SHALL memvalidasi token dari parameter URL sebelum menampilkan formulir
4. WHEN pengguna mengisi password baru dan menekan tombol submit, THE Sistem_Auth SHALL memperbarui password pengguna di database menggunakan bcrypt hash melalui Prisma
5. IF token reset password sudah kedaluwarsa, THEN THE Sistem_Auth SHALL menampilkan pesan error dan menyediakan tautan ke halaman forgot password
6. IF token reset password sudah digunakan, THEN THE Sistem_Auth SHALL menampilkan pesan error bahwa token sudah tidak berlaku
7. IF token reset password tidak valid, THEN THE Sistem_Auth SHALL menampilkan pesan error bahwa tautan tidak valid
8. WHEN reset password berhasil, THE Sistem_Auth SHALL mengarahkan pengguna ke halaman login dengan pesan sukses melalui parameter URL
9. WHEN halaman diakses dengan parameter `force=true`, THE Sistem_Auth SHALL menampilkan pesan bahwa pengguna wajib mengganti password sementara sebelum melanjutkan
10. WHEN pengguna berhasil mengganti password sementara (force mode), THE Sistem_Auth SHALL mengubah flag `mustChangePassword` menjadi `false` pada tabel `profiles`

### Persyaratan 4: Halaman Verifikasi Email

**User Story:** Sebagai Pengguna_Baru yang diundang, saya ingin dapat memverifikasi email saya melalui tautan yang dikirim, sehingga akun saya aktif dan siap digunakan.

#### Kriteria Penerimaan

1. THE Sistem_Auth SHALL menampilkan halaman verifikasi email di route `/auth/verify` menggunakan Komponen_ShadcnUI (Card, Button, Input, Label)
2. WHEN Pengguna_Baru mengakses halaman verifikasi dengan parameter `token` yang valid, THE Sistem_Auth SHALL memverifikasi token dari tabel `email_verification_tokens` melalui Prisma
3. WHEN verifikasi token berhasil, THE Sistem_Auth SHALL memperbarui field `isEmailVerified` menjadi `true` pada tabel `profiles`
4. WHEN verifikasi email berhasil, THE Sistem_Auth SHALL menampilkan formulir untuk memasukkan password sementara agar Pengguna_Baru dapat login
5. WHEN Pengguna_Baru berhasil login dengan password sementara, THE Sistem_Auth SHALL mengarahkan Pengguna_Baru ke halaman dashboard
6. IF token verifikasi sudah kedaluwarsa, THEN THE Sistem_Auth SHALL menampilkan pesan error bahwa tautan sudah tidak berlaku beserta instruksi untuk menghubungi admin
7. IF token verifikasi tidak valid atau sudah digunakan, THEN THE Sistem_Auth SHALL menampilkan pesan error bahwa tautan tidak valid
8. WHILE proses verifikasi sedang berlangsung, THE Sistem_Auth SHALL menampilkan indikator loading dengan pesan "Memverifikasi email..."
9. WHEN halaman diakses dengan parameter `message` tanpa `token`, THE Sistem_Auth SHALL menampilkan pesan konfirmasi dan mengarahkan pengguna ke halaman login setelah 3 detik

### Persyaratan 5: Forced Password Change untuk Pengguna Baru

**User Story:** Sebagai Pengguna_Baru yang diundang, saya ingin dipaksa mengganti password sementara saat pertama kali login, sehingga akun saya aman.

#### Kriteria Penerimaan

1. WHEN Pengguna_Baru yang memiliki flag `mustChangePassword = true` berhasil login, THE Sistem_Auth SHALL mengarahkan Pengguna_Baru ke halaman `/auth/reset-password` dengan parameter `force=true`
2. WHILE flag `mustChangePassword` bernilai `true` pada profil pengguna, THE Sistem_Dashboard SHALL memblokir akses ke halaman dashboard dan mengarahkan ke halaman reset password
3. WHEN Pengguna_Baru berhasil mengganti password sementara, THE Sistem_Auth SHALL mengubah flag `mustChangePassword` menjadi `false` pada tabel `profiles` melalui Prisma

### Persyaratan 6: Migrasi Aset Gambar

**User Story:** Sebagai pengembang, saya ingin semua aset gambar yang dibutuhkan halaman auth dan dashboard tersedia di folder `public/` proyek target, sehingga tidak ada gambar yang hilang saat runtime.

#### Kriteria Penerimaan

1. THE Sistem_Auth SHALL memuat gambar `thumbnail.png` dari folder `public/` proyek target sebagai gambar latar pada kolom kanan halaman login
2. THE Sistem_Dashboard SHALL memuat gambar `logo-swasana.svg` dari folder `public/` proyek target sebagai logo pada sidebar
3. IF Aset_Gambar yang direferensikan tidak ditemukan di folder `public/`, THEN THE Sistem_Auth SHALL menampilkan placeholder atau fallback visual yang tidak merusak layout halaman

### Persyaratan 7: Dashboard UI — Sidebar, Header, dan Layout Shell

**User Story:** Sebagai pengguna yang sudah login, saya ingin melihat dashboard dengan sidebar navigasi dan header, sehingga saya memiliki kerangka visual untuk mengakses berbagai fitur aplikasi.

#### Kriteria Penerimaan

1. THE Sistem_Dashboard SHALL menampilkan layout shell yang terdiri dari sidebar navigasi di sisi kiri, header di bagian atas, dan area konten utama — hanya UI visual tanpa business logic
2. THE Sistem_Dashboard SHALL membangun sidebar menggunakan Komponen_ShadcnUI (Button, Separator, Sheet untuk mobile, Tooltip, Avatar, Dropdown Menu)
3. THE Sistem_Dashboard SHALL menampilkan logo `logo-swasana.svg` pada bagian atas sidebar
4. THE Sistem_Dashboard SHALL menampilkan daftar menu navigasi pada sidebar sesuai struktur menu dari proyek sumber: Overview, Customers, Event (dengan submenu), Purchase Order, Finance (dengan submenu), Package, Venue, Vendor, Users Management, Settings (dengan submenu)
5. WHEN pengguna mengklik menu pada sidebar, THE Sistem_Dashboard SHALL menavigasi ke halaman yang sesuai tanpa reload halaman penuh menggunakan Next.js App Router
6. THE Sistem_Dashboard SHALL menyediakan tombol untuk memperluas atau menciutkan sidebar pada tampilan desktop
7. THE Sistem_Dashboard SHALL menampilkan sidebar sebagai Sheet (overlay) pada tampilan mobile yang dapat dibuka dan ditutup
8. THE Sistem_Dashboard SHALL menampilkan header di bagian atas yang berisi informasi pengguna yang sedang login (nama, role) menggunakan Komponen_ShadcnUI (Avatar, Dropdown Menu, Button)
9. THE Sistem_Dashboard SHALL menyediakan menu dropdown pada header dengan opsi: Profile, Settings, dan Logout
10. WHEN pengguna menekan tombol Logout, THE Sistem_Dashboard SHALL menghapus session dan mengarahkan pengguna ke halaman login
11. WHILE pengguna belum login, THE Sistem_Dashboard SHALL mengarahkan pengguna ke halaman login melalui mekanisme proteksi route pada layout `(private)`
12. WHEN sidebar dalam keadaan collapsed, THE Sistem_Dashboard SHALL menampilkan submenu sebagai popover saat pengguna hover pada menu yang memiliki submenu

### Persyaratan 8: Fitur Undangan Pengguna (User Invitation)

**User Story:** Sebagai Pengguna_Admin, saya ingin dapat mengundang pengguna baru melalui email, sehingga pengguna baru dapat bergabung ke sistem dengan role dan akses venue yang ditentukan.

#### Kriteria Penerimaan

1. WHEN Pengguna_Admin membuka halaman User Management, THE Sistem_Undangan SHALL menampilkan tabel daftar pengguna yang terdaftar menggunakan Komponen_ShadcnUI (Table, Badge, Button, Avatar)
2. WHEN Pengguna_Admin menekan tombol "Invite New User", THE Sistem_Undangan SHALL menampilkan drawer/dialog menggunakan Komponen_ShadcnUI (Sheet atau Dialog, Form, Input, Select, Button, Label) dengan field: email, nama lengkap, role, dan assigned venues
3. WHEN Pengguna_Admin mengisi form undangan dan menekan tombol "Send Invitation", THE Sistem_Undangan SHALL membuat akun pengguna baru dengan password sementara di database melalui Prisma
4. WHEN akun pengguna baru berhasil dibuat, THE Sistem_Email SHALL mengirim email undangan ke alamat email Pengguna_Baru menggunakan Resend yang berisi tautan verifikasi dan password sementara
5. WHEN Pengguna_Baru mengklik tautan verifikasi dalam email, THE Sistem_Auth SHALL memverifikasi token dari tabel `email_verification_tokens` dan menandai email sebagai terverifikasi pada tabel `profiles`
6. IF token verifikasi sudah kedaluwarsa, THEN THE Sistem_Auth SHALL menampilkan pesan error bahwa tautan sudah tidak berlaku
7. IF token verifikasi tidak valid, THEN THE Sistem_Auth SHALL menampilkan pesan error bahwa tautan tidak valid
8. WHEN Pengguna_Admin mengedit pengguna yang sudah ada, THE Sistem_Undangan SHALL menampilkan drawer/dialog yang terisi dengan data pengguna tersebut untuk diedit
9. THE Sistem_Undangan SHALL memvalidasi bahwa field email, nama lengkap, dan role terisi sebelum mengirim undangan menggunakan validasi form dari react-hook-form dan zod
10. WHEN Pengguna_Admin menekan tombol "Resend Invitation" pada pengguna yang belum verifikasi, THE Sistem_Email SHALL mengirim ulang email undangan dengan token verifikasi baru

### Persyaratan 9: Halaman Settings dengan Sub-Menu

**User Story:** Sebagai Pengguna_Admin, saya ingin mengakses halaman Settings yang berisi beberapa sub-menu pengaturan, sehingga saya dapat mengelola konfigurasi sistem dari satu tempat.

#### Kriteria Penerimaan

1. THE Sistem_Settings SHALL menampilkan halaman settings di route `/dashboard/settings` dengan navigasi sub-menu menggunakan Komponen_ShadcnUI (Tabs atau navigasi sidebar internal)
2. THE Sistem_Settings SHALL menyediakan sub-menu "Role & Permission" di route `/dashboard/settings/roles` yang menampilkan daftar role dan matriks permission per role menggunakan Komponen_ShadcnUI (Table, Checkbox, Button, Card, Dialog, AlertDialog, Input, Label)
3. WHEN Pengguna_Admin membuka halaman Role & Permission, THE Sistem_Settings SHALL menampilkan daftar role yang ada beserta tombol "Tambah Role Baru"
4. WHEN Pengguna_Admin menekan tombol "Tambah Role Baru", THE Sistem_Settings SHALL menampilkan dialog (Dialog) dengan field nama role dan deskripsi untuk membuat role baru
5. WHEN Pengguna_Admin mengisi nama dan deskripsi role lalu menekan tombol "Simpan", THE Sistem_Settings SHALL membuat role baru di database melalui Prisma dan menampilkan toast sukses
6. WHEN Pengguna_Admin menekan tombol edit pada role yang ada, THE Sistem_Settings SHALL menampilkan dialog (Dialog) yang terisi dengan data role tersebut untuk diedit (nama dan deskripsi)
7. WHEN Pengguna_Admin menekan tombol hapus pada role yang ada, THE Sistem_Settings SHALL menampilkan konfirmasi (AlertDialog) sebelum menghapus role dari database
8. THE Sistem_Settings SHALL mencegah penghapusan role "admin" — tombol hapus tidak ditampilkan atau dinonaktifkan untuk role admin
9. WHEN Pengguna_Admin memilih role dari daftar, THE Sistem_Settings SHALL menampilkan matriks permission berupa tabel dengan baris = modul (module) dan kolom = aksi (view, create, edit, delete), di mana setiap sel berisi Checkbox
10. WHEN Pengguna_Admin mengubah centang Checkbox pada matriks permission, THE Sistem_Settings SHALL menyimpan perubahan permission melalui Server Action yang memperbarui tabel `role_permissions` via Prisma
11. THE Sistem_Settings SHALL menyediakan sub-menu "PDF Configuration" di route `/dashboard/settings/pdf-config` yang menampilkan konfigurasi template PDF menggunakan Komponen_ShadcnUI (Tabs, Card, Input, Checkbox, Button, Table)
12. THE Sistem_Settings SHALL menyediakan sub-menu "Profile Settings" di route `/dashboard/settings/profile` yang memungkinkan pengguna mengedit informasi profil (nama, nomor telepon, avatar, timezone, bahasa) menggunakan Komponen_ShadcnUI (Card, Input, Button, Form, Label, Avatar, Select)
13. THE Sistem_Settings SHALL menyediakan sub-menu "Account Settings" di route `/dashboard/settings/account` yang memungkinkan pengguna mengganti password menggunakan Komponen_ShadcnUI (Card, Input, Button, Form, Label)
14. WHEN pengguna mengklik sub-menu pada halaman Settings, THE Sistem_Settings SHALL menavigasi ke sub-halaman yang sesuai tanpa reload halaman penuh
15. THE Sistem_Settings SHALL menampilkan sub-menu yang sesuai berdasarkan role pengguna — sub-menu "Role & Permission" dan "PDF Configuration" hanya ditampilkan untuk Pengguna_Admin

### Persyaratan 10: URL Fallback Dinamis

**User Story:** Sebagai pengembang, saya ingin URL fallback/redirect tidak di-hardcode ke `localhost:3000`, sehingga aplikasi dapat berjalan di port atau domain mana pun tanpa perlu mengubah kode.

#### Kriteria Penerimaan

1. THE Sistem_URL SHALL menentukan base URL aplikasi menggunakan environment variable `NEXT_PUBLIC_APP_URL` sebagai nilai default
2. WHEN environment variable `NEXT_PUBLIC_APP_URL` tidak diatur, THE Sistem_URL SHALL menggunakan `http://localhost:3000` sebagai fallback
3. THE Sistem_URL SHALL menyediakan fungsi utilitas `getBaseUrl()` yang mengembalikan base URL yang benar untuk digunakan di seluruh aplikasi
4. WHEN kode server-side membutuhkan base URL, THE Sistem_URL SHALL menggunakan header request (`x-forwarded-host`, `host`) untuk mendeteksi URL aktual saat runtime
5. THE Sistem_Email SHALL menggunakan fungsi `getBaseUrl()` untuk menghasilkan tautan verifikasi dan reset password dalam email, bukan nilai hardcode
6. THE Sistem_Auth SHALL menggunakan fungsi `getBaseUrl()` untuk callback URL setelah autentikasi berhasil

### Persyaratan 11: Penggunaan Komponen shadcn/ui Secara Konsisten

**User Story:** Sebagai pengembang, saya ingin seluruh komponen UI menggunakan shadcn/ui secara konsisten, sehingga tampilan aplikasi seragam dan mudah di-maintain.

#### Kriteria Penerimaan

1. THE Sistem_Auth SHALL menggunakan Komponen_ShadcnUI untuk seluruh elemen UI pada halaman login, forgot password, reset password, dan verifikasi email
2. THE Sistem_Dashboard SHALL menggunakan Komponen_ShadcnUI untuk seluruh elemen UI pada sidebar, header, dan layout shell
3. THE Sistem_Undangan SHALL menggunakan Komponen_ShadcnUI untuk seluruh elemen UI pada halaman user management (tabel, form, drawer/dialog)
4. THE Sistem_Settings SHALL menggunakan Komponen_ShadcnUI untuk seluruh elemen UI pada halaman settings dan sub-menu-nya
5. THE Sistem_Auth SHALL menggunakan Sonner (dari shadcn/ui) untuk seluruh toast notification pada halaman auth
6. IF komponen shadcn/ui yang dibutuhkan belum terinstal di proyek target, THEN pengembang SHALL menginstal komponen tersebut menggunakan CLI `npx shadcn@latest add [component-name]` sebelum implementasi

### Persyaratan 12: Database Schema & Migrasi

**User Story:** Sebagai pengembang, saya ingin schema database diperbarui dengan field dan index baru yang dibutuhkan, sehingga fitur autentikasi dan manajemen pengguna berjalan optimal.

#### Kriteria Penerimaan

1. THE Sistem_DB SHALL menambahkan enum `ProfileStatus` dengan nilai `active`, `inactive`, dan `suspended` pada Prisma schema
2. THE Sistem_DB SHALL menambahkan field `status ProfileStatus @default(active)` pada model `Profile`
3. THE Sistem_DB SHALL menambahkan field `invitedBy String?` dan `invitedAt DateTime?` pada model `Profile` untuk melacak siapa yang mengundang pengguna
4. THE Sistem_DB SHALL mengubah field `used Boolean @default(false)` menjadi `usedAt DateTime?` pada model `EmailVerificationToken` — token dianggap belum digunakan jika `usedAt` bernilai `null`
5. THE Sistem_DB SHALL mengubah field `used Boolean @default(false)` menjadi `usedAt DateTime?` pada model `PasswordResetToken` — token dianggap belum digunakan jika `usedAt` bernilai `null`
6. THE Sistem_DB SHALL menambahkan index `@@index([userId])` pada model `UserVenueAccess` untuk optimasi query akses venue per user
7. THE Sistem_DB SHALL menambahkan index `@@index([roleId])` pada model `Profile` untuk optimasi query profil berdasarkan role
8. WHEN perubahan schema diterapkan, THE Sistem_DB SHALL menggunakan perintah `prisma migrate dev` untuk membuat dan menjalankan migrasi database
9. THE Sistem_DB SHALL memperbarui file `prisma/seed.ts` agar seed data sesuai dengan perubahan schema baru (menggunakan `usedAt` bukan `used`, menambahkan `status` pada profil)

### Persyaratan 13: Skeleton/Loading States

**User Story:** Sebagai pengguna, saya ingin melihat skeleton/shimmer loading segera saat navigasi ke halaman baru, sehingga saya tidak menunggu layar kosong dan pengalaman terasa responsif.

#### Kriteria Penerimaan

1. THE Sistem_Dashboard SHALL menampilkan skeleton/shimmer loading segera saat pengguna menavigasi ke halaman baru — pengguna masuk ke halaman terlebih dahulu, baru data dimuat
2. THE Sistem_Dashboard SHALL menggunakan konvensi `loading.tsx` dari Next.js untuk loading state pada level route
3. THE Sistem_Dashboard SHALL menggunakan React Suspense boundaries untuk loading state pada level komponen
4. THE Sistem_Dashboard SHALL menyediakan file `loading.tsx` pada route `/dashboard` yang menampilkan skeleton layout dashboard
5. THE Sistem_Dashboard SHALL menyediakan file `loading.tsx` pada route `/dashboard/settings/user-management` yang menampilkan skeleton tabel pengguna
6. THE Sistem_Dashboard SHALL membangun skeleton loading menggunakan komponen `Skeleton` dari Komponen_ShadcnUI
7. WHEN data berhasil dimuat, THE Sistem_Dashboard SHALL mengganti skeleton dengan konten aktual secara mulus tanpa layout shift

### Persyaratan 14: Caching & Data Freshness

**User Story:** Sebagai pengguna, saya ingin data yang sudah dimuat tetap tersedia tanpa refetch berlebihan, namun selalu diperbarui saat ada perubahan (mutasi), sehingga pengalaman cepat dan data selalu akurat.

#### Kriteria Penerimaan

1. THE Sistem_Cache SHALL mengimplementasikan cache server-side menggunakan direktif `"use cache"` dari Next.js 16 dengan `cacheTag` dan `cacheLife` pada fungsi query di `lib/queries/`
2. THE Sistem_Cache SHALL mengimplementasikan cache client-side menggunakan TanStack Query dengan konfigurasi `staleTime` per tipe data dan pola `initialData` dari Server Component
3. THE Sistem_Cache SHALL menginvalidasi cache server-side menggunakan `updateTag` di dalam Server Actions saat terjadi mutasi data
4. THE Sistem_Cache SHALL menginvalidasi cache client-side menggunakan `invalidateQueries` dari TanStack Query saat terjadi mutasi data
5. THE Sistem_Cache SHALL memastikan data tetap di-cache sampai terjadi mutasi — tidak ada refetch yang tidak perlu
6. WHEN Server Component memuat data, THE Sistem_Cache SHALL meneruskan data tersebut sebagai `initialData` ke Client Component yang menggunakan TanStack Query, sehingga tidak ada loading state pada render pertama
7. THE Sistem_Cache SHALL mengkonfigurasi `staleTime` yang sesuai per tipe data: data user/role menggunakan `staleTime: 5 * 60 * 1000` (5 menit), data venue menggunakan `staleTime: 10 * 60 * 1000` (10 menit)

### Persyaratan 15: Halaman Error (404, 500, Error Boundary)

**User Story:** Sebagai pengguna, saya ingin melihat halaman error yang informatif dan konsisten saat terjadi kesalahan (halaman tidak ditemukan, server error, atau error runtime), sehingga saya tahu apa yang terjadi dan dapat kembali ke halaman yang benar.

#### Kriteria Penerimaan

1. THE Sistem_Auth SHALL menyediakan halaman 404 global di `app/not-found.tsx` yang ditampilkan WHEN route yang diakses tidak ditemukan di mana pun dalam aplikasi
2. THE Sistem_Auth SHALL menyediakan halaman error global di `app/error.tsx` yang ditampilkan WHEN terjadi error runtime yang tidak tertangani (berfungsi sebagai halaman 500)
3. THE Sistem_Dashboard SHALL menyediakan halaman 404 khusus dashboard di `app/(private)/dashboard/not-found.tsx` yang ditampilkan WHEN sub-route dashboard tidak ditemukan, dengan tetap mempertahankan layout dashboard (sidebar + header)
4. THE Sistem_Dashboard SHALL menyediakan halaman error khusus dashboard di `app/(private)/dashboard/error.tsx` yang ditampilkan WHEN terjadi error di dalam dashboard, dengan tetap mempertahankan layout dashboard (sidebar + header)
5. THE Sistem_Auth SHALL membangun seluruh halaman error menggunakan Komponen_ShadcnUI (Card, Button) untuk konsistensi visual
6. WHEN halaman 404 ditampilkan, THE Sistem_Auth SHALL menampilkan: ikon ilustrasi, pesan "Halaman Tidak Ditemukan", teks deskripsi, dan tombol untuk kembali atau menuju dashboard
7. WHEN halaman error ditampilkan, THE Sistem_Auth SHALL menampilkan: ikon ilustrasi, pesan "Terjadi Kesalahan", teks deskripsi, tombol "Coba Lagi" yang memanggil fungsi `reset()`, dan tombol untuk menuju dashboard
8. THE Sistem_Auth SHALL memastikan seluruh halaman error responsif pada tampilan mobile dan desktop
9. WHEN error terjadi di dalam dashboard, THE Sistem_Dashboard SHALL menampilkan halaman error hanya di area konten — sidebar dan header tetap terlihat dan berfungsi
10. THE Sistem_Auth SHALL memastikan seluruh halaman error mengikuti Design System & Styling proyek (font, warna, spacing) yang sudah didefinisikan


### Persyaratan 16: Audit Logging

**User Story:** Sebagai Pengguna_Admin, saya ingin melihat log aktivitas autentikasi dan manajemen pengguna, sehingga saya dapat memantau keamanan sistem dan melacak siapa melakukan apa dan kapan.

#### Kriteria Penerimaan

1. THE Sistem_Audit SHALL menyediakan fungsi utilitas `logAudit()` di `lib/audit.ts` yang mencatat aktivitas ke tabel `audit_logs` secara append-only
2. THE Sistem_Audit SHALL menangkap 5 dimensi pada fungsi `logAudit()`: Who (actorId, actorType), What (action, result), When (createdAt UTC), Where (ipAddress, userAgent), On What (resourceType, resourceId)
3. THE Sistem_Audit SHALL menggunakan naming convention `resource.action` pada fungsi `logAudit()` (contoh: `auth.login`, `auth.login_failed`, `user.invited`, `role.permission_changed`)
4. THE Sistem_Audit SHALL memastikan fungsi `logAudit()` bersifat async dan non-blocking — kegagalan menulis log TIDAK BOLEH menggagalkan operasi bisnis utama (try/catch, console.error)
5. THE Sistem_Audit SHALL mencatat log untuk: login berhasil, login gagal, logout, password reset request, password changed, email verified, user invited, user updated, user deleted, role created/updated/deleted, permission changed
6. THE Sistem_Audit SHALL memastikan tabel `audit_logs` bersifat append-only — tidak ada operasi UPDATE atau DELETE pada level aplikasi
7. THE Sistem_Audit SHALL menyimpan before/after state dalam field `metadata` (JSONB) untuk operasi update
8. THE Sistem_Audit SHALL menambahkan index pada `(actorId, createdAt)`, `(resourceType, resourceId, createdAt)`, dan `(action, createdAt)` untuk optimasi query
9. THE Sistem_Audit SHALL mengimplementasikan retention policy: auto-cleanup log yang lebih dari 90 hari
10. WHEN Pengguna_Admin membuka halaman audit log (opsional, bisa di settings), THE Sistem_Audit SHALL menampilkan daftar log terbaru dengan filter berdasarkan actor, action, resource, dan date range
