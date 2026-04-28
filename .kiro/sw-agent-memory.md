# SW-Agent Memory

## Primary Project
Path: /mnt/d/Apps/myApps/swasana-project

## Reference Project
Path: /mnt/d/Apps/myApps/Sistem-Wedding-Kediaman
Purpose: Feature reference ONLY — bukan primary target

## Default Rule
Setiap kali user minta "cek", "liat", "buka", atau explore code tanpa specify project
→ SELALU default ke swasana-project (/mnt/d/Apps/myApps/swasana-project)
→ Sistem-Wedding-Kediaman hanya dibuka kalau user explicitly minta atau butuh feature reference

## Tailwind Canonical Classes (STRICT)
- WAJIB pake canonical Tailwind classes — JANGAN pake arbitrary `[Npx]` kalau ada padanannya
- Konversi: `[Npx]` → hitung `N ÷ 4`, pake hasilnya sebagai Tailwind unit
  - `w-[160px]` → `w-40` | `w-[100px]` → `w-25` | `h-[80px]` → `h-20`
  - `w-[180px]` → `w-45` | `min-w-[220px]` → `min-w-55` | `min-w-[200px]` → `min-w-50`
  - `max-w-[180px]` → `max-w-45` | `max-w-[140px]` → `max-w-35`
  - `flex-[2]` → `flex-2`
  - `text-[14px]` → `text-sm`
- Arbitrary values HANYA boleh kalau genuinely gak ada canonical equivalent (e.g. `max-w-[630px]` = 157.5 unit, gak ada canonical)
- Berlaku di semua file kecuali `components/ui/` (shadcn generated)

## ESLint no-unused-vars (STRICT)
- Setiap kali nulis import, cek apakah semua yang di-import beneran dipake
- Kalo ada yang gak dipake, hapus dari import list
- Unused variable assignment juga harus dihapus
- Sebelum commit, mental-check semua imports di file yang diubah