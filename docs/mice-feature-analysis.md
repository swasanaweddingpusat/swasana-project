# MICE Feature Analysis — Swasana System

> Dibuat dari: hasil baca langsung Google Sheets operasional tim MICE Kediaman.
> Sheet 1: `RECAP DEALING MICE EVENT KEDIAMAN` (Booking + Quotation)
> Sheet 2: `DAILY ACTIVITY MICE - 2026` (Leads)

---

## 1. Gambaran Besar — 3 Modul Utama

```
LEADS (Daily Activity)
    │
    │  sales lakukan prospek → kirim penawaran
    ▼
QUOTATION (No. Quotation + QUO per venue)
    │
    │  client setuju → booking terkonfirmasi
    ▼
BOOKING (Rekap 2026)
```

Saat ini 3 modul ini hidup di 3 sheet berbeda, tidak terhubung satu sama lain. Swasana harus jadi **single source of truth** yang menggantikan ketiganya.

---

## 2. Modul LEADS — Daily Activity

### Data di Spreadsheet
Sheet per-sales (Metalia, Nabila, Pwa Niskala). Setiap sheet = satu orang sales mencatat prospek mingguan.

| Kolom Sheet | Makna | Field di System |
|---|---|---|
| No. | Nomor urut | auto |
| April 2026 (periode) | Minggu kegiatan | `activityWeek` |
| Company / Institute | Nama perusahaan prospek | `instansi` |
| Segment | Kategori industri | `segment` (FK ke LeadSegment) |
| Contact Num. | Nama PIC | `contactName` |
| Phone Num. | Nomor HP | `phone` |
| Email | Email | `email` |
| Location | Alamat kantor | `location` |
| Instagram | Akun IG | `instagram` |
| Site Visit Schedule | Jadwal kunjungan | `siteVisitDate` |
| Milestone Client | Aktivitas terakhir | `lastMilestone` |
| Progress | Status prospek | `status` |

### Status / Progress yang Ada
Dari data aktual:
- `Cold` — baru dikontrak, belum ada respon
- `Freeze` — sudah dihubungi, belum ada progress
- (implied) `Warm`, `Hot`, `Deal` — perlu konfirmasi ke tim

### Mapping ke System Saat Ini
```
Leads table (sudah ada) ✅
├── leadName       ← Company/Institute
├── instansi       ← Company/Institute
├── phone          ← Phone Num.
├── email          ← Email
├── segment        ← Segment (FK LeadSegment)
├── status         ← Progress (FK LeadStatus)
└── salesId        ← per-sheet = per-sales
```

**Gap:** Field `activityWeek`, `contactName`, `location`, `instagram`, `siteVisitDate`, `lastMilestone` belum ada di DB. Ini adalah data prospek yang berharga — perlu ditambahkan.

---

## 3. Modul QUOTATION — No. Quotation + QUO per Venue

### Data di Spreadsheet

Ada **2 lapisan**:

#### Layer 1: Tracking Register (`NO QUOTATION` sheet)
Daftar quotation yang sudah dikirim — berfungsi sebagai register nomor.

| Kolom | Makna | Field di System |
|---|---|---|
| Num. Quotation | Nomor QUO (`#201-MICE`) | `quotationNo` |
| Submit Date | Tanggal dikirim | `createdAt` |
| Sales | Nama sales | `salesId` |
| Client / Instansi | Nama perusahaan | `instansi` / `clientName` |
| Event Date | Tanggal event | `eventDate` |
| PIC Client | Nama kontak | `clientName` |
| No. HP | Nomor HP | `clientPhone` |
| Target Venue | Venue yang ditawarkan | `venueId` |
| Status | Status quotation | `status` |

Format nomor: `#201-MICE`, `#202-MICE` — sequential per tahun.

#### Layer 2: Dokumen Quotation (`QUO.SAMISARA`, `QUO.LIPPO`, dll)
Satu sheet per venue, berisi dokumen quotation lengkap. Dari scan `QUO.SAMISARA`:

```
Header dokumen:
  Quotation No  : #220-MICE
  To            : Ms Salsa
  No. HP        : 0821 3648 9710
  Instansi      : PT Fintopia
  Sales MICE    : Metalia Yuniarti
  No. HP Sales  : 0851 2108 5180

  Event         : Iftar
  Details       : Iftar Venue Only
  Time          : Half Day
  Place         : Ballroom
  Date          : 2 April 2026
  Venue         : Samisara Grand Ballroom

Line items:
  A. Ballroom Facilities :
    - Samisara Grand Ballroom for 6 hours    Rp 80,000,000
    - Full Carpet Ballroom
    - Full Air Conditioned
    - Voyager Area
    - 2 Holding Room
    ...
  Qty | Price | Total per item
```

### Mapping ke System Saat Ini
```
Quotation table (sudah ada) ✅
├── quotationNo     ← Num. Quotation (#xxx-MICE)
├── clientName      ← PIC Client / To
├── clientPhone     ← No. HP
├── instansi        ← Client / Instansi
├── salesId         ← Sales MICE
├── venueId         ← Target Venue / Venue
├── eventDate       ← Event Date / Date
├── eventTypeName   ← Event (Iftar, Seminar, dll)
├── details         ← Details (Venue Only, dll)
├── time            ← Time (Half Day, Full Day, dll)
├── status          ← Status
└── items[]         ← Line items (title, qty, price, total)
    └── QuotationItem
        ├── title
        ├── description (bullet list fasilitas)
        ├── qty
        ├── price
        └── total
```

**System sudah sangat match** dengan struktur dokumen quotation. ✅

**Gap:** Status di sheet tidak terstandar (kolom status di NO QUOTATION sering kosong). Perlu define enum status: `draft` → `sent` → `revised` → `accepted` → `rejected`.

---

## 4. Modul BOOKING — Rekap 2026

### Data di Spreadsheet

| Kolom | Makna | Field di System |
|---|---|---|
| No. | Nomor urut | auto |
| Month | Bulan booking | derived dari `bookingDate` |
| Client | Nama client/perusahaan | `clientName` / `instansi` |
| Booking Date | Tanggal booking dikonfirmasi | `bookingDate` |
| No. Purchase Order | Nomor PO/booking (`214/MICE/...`) | `bookingNo` |
| Drop File | Status dokumen ke finance | `dropFileStatus` |
| Kediaman Venue | Venue | `venueId` |
| Status | Status booking | `status` |
| Event Date | Tanggal event | `eventDate` |
| Full Payment | Nominal pembayaran penuh | `totalPayment` |
| Booking Fee | DP / booking fee | `bookingFee` |
| Sales MICE | Sales yang handle | `salesId` |
| Source | Sumber lead (referral, dll) | `sourceOfInformation` |
| Platform | Platform asal | `platform` |

Format No. PO: `214/MICE/PAKUBUWONO/N/06-01-2026`
→ `{seq}/MICE/{venue_code}/{sales_initial}/{date}`

### Mapping ke System
```
Booking table (sudah ada, tapi belum MICE-specific) ⚠️
├── bookingNo       ← No. Purchase Order
├── clientName      ← Client
├── bookingDate     ← Booking Date
├── eventDate       ← Event Date
├── venueId         ← Kediaman Venue
├── salesId         ← Sales MICE
├── status          ← Status
├── totalPayment    ← Full Payment
├── bookingFee      ← Booking Fee
└── sourceId        ← Source
```

**Gap:** `dropFileStatus` (apakah sudah dikirim ke finance), `platform` belum ada. Format `bookingNo` MICE berbeda dari format Wedding.

---

## 5. Alur Lengkap di System

```
┌─────────────────────────────────────────────────────────────┐
│                    SALES MICE DASHBOARD                      │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │  LEADS   │        │QUOTATION │        │ BOOKING  │
   │          │        │          │        │          │
   │ prospek  │──────▶│ penawaran│──────▶│ deal ✅  │
   │ harian   │        │ terkirim │        │ confirmed│
   └──────────┘        └──────────┘        └──────────┘
        │                    │                    │
   Daily Activity        No.Quotation         Rekap 2026
   (per sales)           + QUO per venue      (semua venue)
```

### Status Flow

```
LEADS:
  New → Cold → Freeze → Warm → Hot → Quotation Sent → Deal / Lost

QUOTATION:
  draft → sent → revised → accepted → rejected

BOOKING:
  confirmed → dp_paid → full_paid → event_done → completed
```

---

## 6. Gap Analysis — Apa yang Perlu Ditambah

### A. Tabel / Field Baru di DB

| Entity | Field Baru | Keterangan |
|---|---|---|
| `Lead` | `activityWeek` | Minggu prospek dilakukan |
| `Lead` | `contactName` | Nama PIC (beda dari instansi) |
| `Lead` | `location` | Alamat kantor prospek |
| `Lead` | `instagram` | Akun IG prospek |
| `Lead` | `siteVisitDate` | Jadwal site visit |
| `Lead` | `lastMilestone` | Aktivitas terakhir ke client |
| `Booking` | `dropFileStatus` | Sudah drop ke finance atau belum |
| `Booking` | `platform` | Platform asal lead |
| `Quotation` | `category` | Sudah ada (`MICE`) ✅ |

### B. Fitur UI Baru

| Fitur | Modul | Prioritas |
|---|---|---|
| Daily Activity form (per sales) | Leads | 🔴 High |
| Konversi Lead → Quotation (1-click) | Leads + Quotation | 🔴 High |
| Konversi Quotation → Booking | Quotation + Booking | 🔴 High |
| Filter view per sales | Leads, Quotation | 🟡 Medium |
| Export ke Sheet (sync balik) | Semua | 🟡 Medium |
| Dashboard recap (total booking, revenue per bulan) | Booking | 🟡 Medium |
| Notif reminder site visit | Leads | 🟢 Low |

### C. Fitur yang Sudah Ada & Tinggal Dipakai

| Fitur | Status |
|---|---|
| Quotation drawer (create/edit) | ✅ Sudah ada |
| Quotation list + table | ✅ Sudah ada |
| Quotation template per venue | ✅ Sudah ada |
| Leads list | ✅ Sudah ada |
| Booking (Wedding) | ✅ Sudah ada (perlu extend ke MICE) |

---

## 7. Rekomendasi Urutan Pengerjaan

```
Phase 1 — Daily Activity (Leads MICE)
  → Tambah field activityWeek, contactName, location, instagram, siteVisitDate, lastMilestone
  → UI: form daily activity per sales (mirip sheet per-orang)
  → Filter: sales hanya lihat data sendiri

Phase 2 — Quotation MICE (sudah hampir done)
  → Fix bugs dari review (H-1, H-2, H-3)
  → Tambah konversi Lead → Quotation (pre-fill form dari data lead)
  → Register nomor quotation otomatis (#xxx-MICE sequential)

Phase 3 — Booking MICE
  → Extend booking table untuk MICE
  → Konversi Quotation → Booking (1-click, pre-fill dari quotation)
  → Format bookingNo MICE: {seq}/MICE/{venue_code}/{sales_initial}/{date}
  → Drop file tracking ke finance

Phase 4 — Rekap & Dashboard
  → Dashboard MICE: total quotation, conversion rate, revenue per bulan
  → Filter per sales, per venue, per bulan
  → Export ke Google Sheets (sync balik ke sheet operasional)
```

---

## 8. Kesimpulan

Swasana sudah punya **fondasi yang kuat** untuk MICE:
- Quotation sudah ~90% match dengan sheet operasional
- Leads sudah ada, tinggal extend dengan field daily activity
- Booking sudah ada untuk Wedding, perlu extend ke MICE

Pekerjaan terbesar ada di **3 koneksi antar modul**:
1. Lead → Quotation (satu klik, data pre-filled)
2. Quotation → Booking (konfirmasi deal)
3. Booking → Finance (drop file tracking)

Kalau 3 koneksi ini jalan, tim sales tidak perlu lagi buka spreadsheet manual — semua tercatat di Swasana.
