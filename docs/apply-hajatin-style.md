# APPLY: Hajatin Brand Style → Swasana (Colors + Typography)

Loe sw-agent. Tugas: terapkan brand identity Hajatin (palette + font) ke swasana-project. Swasana sekarang strict monochrome — fitur ini sengaja break monochrome buat brand presence. Update CLAUDE.md di akhir biar aturan baru kebaca agent berikutnya.

## ⚠️ KEPUTUSAN dulu

Tanya gw dulu sebelum nulis:

1. **Scope override**: apply ke seluruh app, atau cuma sub-area tertentu (mis. landing public / fitur baru aja)?
2. **Dark mode**: ikutin palette gelap baru, atau tetep monochrome dark?
3. **CLAUDE.md monochrome rule**: relax (boleh brand color via token) atau hapus total?

## Brand Tokens

### Palette

```
Ink (primary brand)   : #0F4159   — text utama, foreground, ikon
Gold (accent)         : #D4A547   — CTA, highlight, link aktif
Cream (surface alt)   : #FAF7F2   — section divider, soft bg (opsional)
```

Pemakaian:
- **Ink** = `--foreground`, `--sidebar-foreground`, `--card-foreground`, `--popover-foreground`, `--accent-foreground`, `--secondary-foreground` — semua slot "foreground" non-button
- **Gold** = `--ring`, optional `--accent` untuk highlight state. JANGAN dipake jadi `--primary` (primary tetep dark untuk solid button hitam)
- **Primary tetep** `oklch(0.205 0 0)` (near-black) — supaya tombol primary tetep monochrome elegan, gold dipake sebagai accent/hover

### Fonts (Google Fonts)

```
Body sans     : Plus Jakarta Sans     → --font-body / --font-sans
Display serif : Fraunces              → --font-display
Logo          : Quicksand (500/600/700) → --font-logo
Mono          : Geist Mono (sudah ada) → --font-mono
```

## File yang Diubah

### 1. `app/layout.tsx` — load font

Ganti import `Open_Sans` (yang sekarang) dengan:

```tsx
import { Fraunces, Plus_Jakarta_Sans, Quicksand, Geist_Mono } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

Pasang ke `<html className={...}>`:
```tsx
<html className={`${jakarta.variable} ${fraunces.variable} ${quicksand.variable} ${geistMono.variable}`}>
```

### 2. `app/globals.css` — update tokens

Di `@theme inline { ... }`, ganti `--font-sans` & tambah display/logo:
```css
--font-sans: var(--font-jakarta);
--font-mono: var(--font-geist-mono);
--font-heading: var(--font-fraunces);
--font-display: var(--font-fraunces);
--font-body: var(--font-jakarta);
--font-logo: var(--font-quicksand);
```

Di `:root { ... }`, override foreground tokens (light mode):
```css
--background: oklch(1 0 0);
--foreground: #0F4159;                     /* Ink */
--card: oklch(1 0 0);
--card-foreground: #0F4159;
--popover: oklch(1 0 0);
--popover-foreground: #0F4159;
--primary: oklch(0.205 0 0);               /* tetep near-black */
--primary-foreground: oklch(0.985 0 0);
--secondary: oklch(0.97 0 0);
--secondary-foreground: #0F4159;
--muted: oklch(0.97 0 0);
--muted-foreground: oklch(0.556 0 0);
--accent: oklch(0.97 0 0);
--accent-foreground: #0F4159;
--destructive: oklch(0.577 0.245 27.325);  /* tetep */
--border: oklch(0.922 0 0);
--input: oklch(0.922 0 0);
--ring: #D4A547;                            /* Gold — focus ring */
--sidebar: oklch(0.985 0 0);
--sidebar-foreground: #0F4159;
--sidebar-primary: oklch(0.205 0 0);
--sidebar-primary-foreground: oklch(0.985 0 0);
--sidebar-accent: oklch(0.97 0 0);
--sidebar-accent-foreground: #0F4159;
--sidebar-border: oklch(0.922 0 0);
--sidebar-ring: #D4A547;
/* brand extras (kalau butuh akses langsung) */
--brand-ink: #0F4159;
--brand-gold: #D4A547;
--brand-cream: #FAF7F2;
```

`.dark` block: tunggu Decision #2.

### 3. `components.json`

Pastikan `baseColor: neutral` tetep — palette ditangani via CSS variable, bukan rewrite shadcn.

## Cara Pakai di Komponen

```tsx
// foreground biru ink (otomatis dari token)
<h1 className="text-foreground">Judul</h1>

// gold accent (pakai brand var langsung)
<button className="text-[var(--brand-gold)]">Pesan Sekarang</button>
// atau via arbitrary value:
<a className="text-[#D4A547] hover:underline">Detail</a>

// heading editorial (Fraunces)
<h2 className="font-display text-3xl italic">Acara Spesial</h2>

// logo (Quicksand)
<span className="font-logo font-semibold tracking-tight">Swasana</span>

// body default udah Jakarta — gak perlu class khusus
```

## Aturan WAJIB

- JANGAN edit `components/ui/*` — semua perubahan via CSS variable + Tailwind utility di atasnya
- JANGAN hardcode `#0F4159` / `#D4A547` di tsx kecuali pakai `var(--brand-*)` syntax — kalau token udah ada, pakai token
- JANGAN ganti `--primary` ke gold — primary button harus tetep solid dark; gold cuma accent/ring
- Ikon Lucide tetep (jangan ganti library). Warna ikon ngikut `text-foreground` jadi otomatis ink
- Test light + (dark kalau Decision #2 jawabannya "ikutin") di 3 halaman: dashboard, settings, satu form

## Update CLAUDE.md

Tambah section baru `## Brand Palette` di CLAUDE.md (atau update existing monochrome rule):
- Tulis aturan palette baru
- Tulis: "Brand color allowed via tokens `--brand-ink`, `--brand-gold`, `--brand-cream` + standard foreground/ring slots. Hardcoded hex still banned."
- Update bagian "monochrome strict" jadi "monochrome chrome + brand accents via token"

## Verifikasi

- [ ] `npm run build` clean
- [ ] Light mode: foreground bener-bener biru ink, focus ring gold, tombol primary tetep dark
- [ ] Font Jakarta keload (body), Fraunces keload (kalau ada heading `font-display`)
- [ ] `components/ui/*` gak ada yang diedit (cek `git diff components/ui/`)
- [ ] CLAUDE.md udah update

## Mulai dari mana

Jawab dulu 3 Decisions di atas. Setelah gw jawab, propose diff buat layout.tsx + globals.css + CLAUDE.md, tunggu approval, baru eksekusi.
