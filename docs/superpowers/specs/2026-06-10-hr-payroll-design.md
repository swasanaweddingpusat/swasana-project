# HR & Payroll Module — Design Spec

**Date:** 2026-06-10
**Branch:** seeddatacalandar
**Scope:** Full HR & Payroll system — 13 sub-modules under `/dashboard/hr/`

---

## Context

The sidebar already defines the HR & Payroll menu with 13 sub-items (`hidden: true`). No backend, no pages, and no Prisma models exist yet (except `Profile` which stores employee personal/payroll bank data). A reference implementation exists at the frontend level (Supabase-based) and has been reviewed for feature scope.

---

## Architecture

### Routing
All pages live under `app/(private)/dashboard/hr/<sub-module>/page.tsx` with co-located `_components/` directories.

### Permissions
Single `hr` permission module (already in the permission seed). All 13 pages use `requirePagePermission("hr")`. Mutations use `requirePermissionForRoute({ module: "hr", action: "create" | "edit" | "delete" })`.

### Data Layer
- **Reads:** `lib/queries/hr/` → consumed by API routes (GET handlers) → TanStack Query hooks
- **Writes:** API routes (`app/api/hr/`) with `mutationLimiter`, `requirePermissionForRoute`, Zod validation, `db.$transaction` for multi-table writes, `logAudit`
- **Hooks:** `hooks/useHr*.ts` — one file per domain

### File Upload
Photo uploads (absensi selfie) reuse the existing `/api/maintenance/upload?folder=hr-attendance` endpoint.

### Charts
`recharts` (already in `package.json` at ^3.8.0) for Analitik & Laporan.

### Sidebar
`hidden: true` removed from HR entry in `sidebar-config.ts` after all modules are complete.

### Route Meta
All 14 routes (parent + 13 sub-modules) added to `lib/route-meta.ts`.

---

## Prisma Schema Additions

All new models added to `prisma/schema.prisma`. Migration generated with `prisma migrate dev`.

### New Enums

```prisma
enum GeofenceStatus      { IN_RANGE OUT_OF_RANGE UNKNOWN }
enum LeaveType           { CUTI_TAHUNAN SAKIT IZIN CUTI_BERSAMA }
enum LeaveStatus         { PENDING APPROVED REJECTED CANCELLED }
enum PayrollStatus       { DRAFT REVIEWED APPROVED PUBLISHED REJECTED }
enum PositionType        { FULL_TIME PART_TIME CONTRACT INTERNSHIP }
enum JobStatus           { OPEN CLOSED }
enum ApplicantStatus     { NEW REVIEWED INTERVIEWED OFFERED HIRED REJECTED }
enum InterviewType       { PHONE_SCREENING TECHNICAL HR_ROUND FINAL }
enum InterviewStatus     { SCHEDULED COMPLETED CANCELLED NO_SHOW }
enum OfferStatus         { PENDING ACCEPTED REJECTED }
enum OnboardingStatus    { IN_PROGRESS COMPLETED }
enum TrainingStatus      { SCHEDULED ONGOING COMPLETED CANCELLED }
enum DevelopmentLevel    { BEGINNER INTERMEDIATE ADVANCED }
enum CertificationStatus { ACTIVE PENDING EXPIRED }
enum ReviewStatus        { PENDING IN_PROGRESS COMPLETED REJECTED }
enum HealthStatus        { NORMAL SELESAI PERLU_TINDAK_LANJUT URGENT }
enum InsuranceStatus     { AKTIF BERAKHIR EXPIRED PENDING NON_AKTIF }
enum ReimbursementStatus { PENDING APPROVED REJECTED }
enum LoanStatus          { PENDING ACTIVE COMPLETED APPROVED REJECTED }
enum DisputeType         { INDIVIDUAL COLLECTIVE PROCEDURAL }
enum DisputeStatus       { PENDING IN_PROGRESS RESOLVED IN_REVIEW UNDER_INVESTIGATION ESCALATED REJECTED }
```

### Attendance

```prisma
model Attendance {
  id               String         @id @default(cuid())
  profileId        String
  clockIn          DateTime
  clockOut         DateTime?
  photoCheckInUrl  String?
  photoCheckOutUrl String?
  latitude         Float?
  longitude        Float?
  accuracy         Float?
  geofenceStatus   GeofenceStatus @default(UNKNOWN)
  isLate           Boolean        @default(false)
  notes            String?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  profile          Profile        @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("attendances")
}
```

Profile relation to add: `attendances Attendance[]`

### Leave

```prisma
model LeaveRequest {
  id         String      @id @default(cuid())
  profileId  String
  startDate  DateTime
  endDate    DateTime
  leaveType  LeaveType
  status     LeaveStatus @default(PENDING)
  daysCount  Int
  reason     String
  notes      String?
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  profile    Profile     @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("leave_requests")
}

model LeaveBalance {
  id        String    @id @default(cuid())
  profileId String
  year      Int
  leaveType LeaveType
  total     Int       @default(0)
  used      Int       @default(0)
  remaining Int       @default(0)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  profile   Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, year, leaveType])
  @@map("leave_balances")
}
```

Profile relations to add: `leaveRequests LeaveRequest[]`, `leaveBalances LeaveBalance[]`

### Payroll

```prisma
model PayrollRecord {
  id               String        @id @default(cuid())
  profileId        String
  periodMonth      Int
  periodYear       Int
  baseSalary       Decimal       @db.Decimal(15, 2)
  allowances       Decimal       @db.Decimal(15, 2) @default(0)
  grossSalary      Decimal       @db.Decimal(15, 2)
  totalDeductions  Decimal       @db.Decimal(15, 2) @default(0)
  netSalary        Decimal       @db.Decimal(15, 2)
  workingDays      Int
  actualDaysWorked Int
  status           PayrollStatus @default(DRAFT)
  notes            String?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  profile          Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, periodMonth, periodYear])
  @@map("payroll_records")
}

model TaxConfig {
  id                String   @id @default(cuid())
  ptkpCategory      String
  ptkpAmount        Decimal  @db.Decimal(15, 2)
  bpjsHealthRate    Float
  bpjsEmployeeRate  Float
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("tax_configs")
}
```

Profile relation to add: `payrollRecords PayrollRecord[]`

### Recruitment & Onboarding

```prisma
model JobPosting {
  id                  String       @id @default(cuid())
  title               String
  department          String
  positionType        PositionType
  description         String
  location            String
  salaryRangeMin      Decimal?     @db.Decimal(15, 2)
  salaryRangeMax      Decimal?     @db.Decimal(15, 2)
  status              JobStatus    @default(OPEN)
  applicationDeadline DateTime?
  maxApplicants       Int?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt
  applicants          Applicant[]

  @@map("job_postings")
}

model Applicant {
  id              String          @id @default(cuid())
  jobPostingId    String
  fullName        String
  email           String
  phoneNumber     String?
  position        String
  applicationDate DateTime        @default(now())
  status          ApplicantStatus @default(NEW)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  jobPosting      JobPosting      @relation(fields: [jobPostingId], references: [id], onDelete: Cascade)
  interviews      Interview[]
  jobOffers       JobOffer[]

  @@map("applicants")
}

model Interview {
  id                       String          @id @default(cuid())
  applicantId              String
  interviewerId            String?
  scheduledDate            DateTime
  interviewType            InterviewType
  interviewLocation        String?
  interviewDurationMinutes Int             @default(60)
  status                   InterviewStatus @default(SCHEDULED)
  interviewNotes           String?
  createdAt                DateTime        @default(now())
  updatedAt                DateTime        @updatedAt
  applicant                Applicant       @relation(fields: [applicantId], references: [id], onDelete: Cascade)

  @@map("interviews")
}

model JobOffer {
  id            String      @id @default(cuid())
  applicantId   String
  positionTitle String
  salary        Decimal     @db.Decimal(15, 2)
  startDate     DateTime
  status        OfferStatus @default(PENDING)
  notes         String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  applicant     Applicant   @relation(fields: [applicantId], references: [id], onDelete: Cascade)

  @@map("job_offers")
}

model OnboardingTemplate {
  id          String                   @id @default(cuid())
  name        String
  description String?
  department  String?
  isActive    Boolean                  @default(true)
  createdAt   DateTime                 @default(now())
  updatedAt   DateTime                 @updatedAt
  items       OnboardingTemplateItem[]
  onboardings EmployeeOnboarding[]

  @@map("onboarding_templates")
}

model OnboardingTemplateItem {
  id         String             @id @default(cuid())
  templateId String
  title      String
  order      Int
  template   OnboardingTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@map("onboarding_template_items")
}

model EmployeeOnboarding {
  id                 String              @id @default(cuid())
  profileId          String
  templateId         String?
  startDate          DateTime
  status             OnboardingStatus    @default(IN_PROGRESS)
  progressPercentage Int                 @default(0)
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  profile            Profile             @relation(fields: [profileId], references: [id], onDelete: Cascade)
  template           OnboardingTemplate? @relation(fields: [templateId], references: [id])

  @@map("employee_onboardings")
}
```

Profile relations to add: `onboardings EmployeeOnboarding[]`

### HR Development

```prisma
model TrainingProgram {
  id                   String         @id @default(cuid())
  name                 String
  description          String?
  startDate            DateTime
  endDate              DateTime
  status               TrainingStatus @default(SCHEDULED)
  participantsCount    Int            @default(0)
  completionPercentage Int            @default(0)
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt

  @@map("training_programs")
}

model EmployeeDevelopment {
  id                   String           @id @default(cuid())
  profileId            String
  skill                String
  level                DevelopmentLevel
  startDate            DateTime
  targetCompletionDate DateTime?
  progressPercentage   Int              @default(0)
  notes                String?
  createdAt            DateTime         @default(now())
  updatedAt            DateTime         @updatedAt
  profile              Profile          @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("employee_developments")
}

model EmployeeCertification {
  id                String              @id @default(cuid())
  profileId         String
  certificationName String
  issueDate         DateTime
  expiryDate        DateTime?
  status            CertificationStatus @default(ACTIVE)
  notes             String?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  profile           Profile             @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("employee_certifications")
}
```

Profile relations to add: `developments EmployeeDevelopment[]`, `certifications EmployeeCertification[]`

### Performance Management

```prisma
model PerformanceReview {
  id              String       @id @default(cuid())
  profileId       String
  periodStartDate DateTime
  periodEndDate   DateTime
  rating          Float
  strengths       String?
  comments        String?
  status          ReviewStatus @default(PENDING)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  profile         Profile      @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("performance_reviews")
}

model KPI {
  id                 String   @id @default(cuid())
  name               String
  description        String?
  department         String?
  targetValue        Float
  achievedValue      Float    @default(0)
  unit               String
  periodStartDate    DateTime
  periodEndDate      DateTime
  progressPercentage Float    @default(0)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@map("kpis")
}
```

Profile relation to add: `performanceReviews PerformanceReview[]`

### Health Management

```prisma
model HealthRecord {
  id          String       @id @default(cuid())
  profileId   String
  checkupType String
  checkupDate DateTime
  doctorName  String?
  findings    String?
  status      HealthStatus @default(NORMAL)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  profile     Profile      @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("health_records")
}

model EmployeeInsurance {
  id             String          @id @default(cuid())
  profileId      String
  insuranceType  String
  provider       String
  policyNumber   String
  coverageAmount Decimal         @db.Decimal(15, 2) @default(0)
  expiryDate     DateTime?
  status         InsuranceStatus @default(AKTIF)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  profile        Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("employee_insurances")
}
```

Profile relations to add: `healthRecords HealthRecord[]`, `insurances EmployeeInsurance[]`

### Reimbursement & Loan

```prisma
model Reimbursement {
  id          String              @id @default(cuid())
  profileId   String
  description String
  amount      Decimal             @db.Decimal(15, 2)
  date        DateTime
  status      ReimbursementStatus @default(PENDING)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  profile     Profile             @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("reimbursements")
}

model EmployeeLoan {
  id                 String     @id @default(cuid())
  profileId          String
  amount             Decimal    @db.Decimal(15, 2)
  tenor              Int
  monthlyInstallment Decimal    @db.Decimal(15, 2)
  status             LoanStatus @default(PENDING)
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt
  profile            Profile    @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("employee_loans")
}
```

Profile relations to add: `reimbursements Reimbursement[]`, `loans EmployeeLoan[]`

### Industrial Relations

```prisma
model LaborDispute {
  id          String        @id @default(cuid())
  profileId   String
  disputeType DisputeType
  dateFiled   DateTime
  description String
  status      DisputeStatus @default(PENDING)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  profile     Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("labor_disputes")
}

model EmployeeGrievance {
  id          String        @id @default(cuid())
  profileId   String
  subject     String
  description String
  dateFiled   DateTime
  status      DisputeStatus @default(PENDING)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  profile     Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@map("employee_grievances")
}
```

Profile relations to add: `laborDisputes LaborDispute[]`, `grievances EmployeeGrievance[]`

---

## Module Designs

### 1. Database Karyawan (`/dashboard/hr/database-karyawan`)

**No new schema.** Uses existing `Profile` joined with `Role` and `Venue` (via `UserVenueAccess`).

**Page layout:** Stats row (Total Karyawan, Terverifikasi, Aktif, Admin/HR count) → Card with filters + table.

**Filters:** Search (nama/email), role, status (active/inactive), venue.

**Table columns:** Avatar + Nama, Email, Role, Venue, Status badge, Tanggal Bergabung, Actions (Detail).

**Detail:** Read-only drawer showing all Profile fields: personal info (NIK, TTL, alamat), bank account, emergency contact, role, venue access.

**API:** `GET /api/hr/employees` — queries `Profile` with `select` (no `findMany` without pagination), returns paginated list.

---

### 2. Manajemen Kehadiran (`/dashboard/hr/manajemen-kehadiran`)

HR read-only monitoring view. Does not allow editing attendance.

**Stats row:** Total Hadir Hari Ini, Di Lokasi, Sudah Pulang, Terlambat.

**Filters:** Tanggal (default: today), Search karyawan, Geofence status.

**Table:** Karyawan, Jam Masuk, Jam Keluar, Lokasi (IN_RANGE/OUT_OF_RANGE badge), Terlambat badge, Catatan.

**API:** `GET /api/hr/attendance` with `?date=YYYY-MM-DD&profileId=&geofenceStatus=&page=&limit=`.

---

### 3. Absensi (`/dashboard/hr/absensi`)

Dual-mode page.

**Self-service tab (karyawan):**
- "Check In" button → request GPS → open camera → capture selfie → submit POST `/api/hr/attendance`
- "Check Out" button (shown only if user has open attendance today) → same flow
- Camera uses `navigator.mediaDevices.getUserMedia({ video: true })` + canvas capture
- Photo uploaded to R2 via `/api/maintenance/upload?folder=hr-attendance`
- GPS via `navigator.geolocation.getCurrentPosition`

**Manual input tab (HR):**
- Select karyawan dropdown
- Pick tanggal, jam masuk, jam keluar, geofence status, isLate, catatan
- POST `/api/hr/attendance`

**Table:** Today's records for current user (self-service tab) or all records with date filter (manual tab).

---

### 4. Sistem Cuti (`/dashboard/hr/sistem-cuti`)

**Stats:** Total Pengajuan, Menunggu, Disetujui, Ditolak, Total Hari Diambil.

**Tabs:** Pengajuan Cuti | Saldo Cuti

**Pengajuan tab:**
- Filters: status, tipe cuti, tahun, search
- Table: Karyawan, Tipe, Tanggal Mulai-Selesai, Jumlah Hari, Status badge, Actions (Approve/Reject/Detail)
- Add button → drawer form: pilih karyawan, tipe, tanggal, alasan

**Saldo tab:**
- Grouped by karyawan, year filter
- Shows per-type balance: total/terpakai/sisa

**API:** `GET/POST /api/hr/leave-requests`, `PATCH /api/hr/leave-requests/[id]`, `GET /api/hr/leave-balances`.

---

### 5. Penggajian & Perpajakan (`/dashboard/hr/penggajian-perpajakan`)

**Stats:** Draft, Reviewed, Approved, Published count.

**Tabs:** Input Manual | Konfigurasi Pajak | Approval | Riwayat

**Input Manual:** Select karyawan + bulan/tahun → form (gaji pokok, tunjangan, potongan, hari kerja) → POST DRAFT.

**Konfigurasi Pajak:** Table of `TaxConfig` (PTKP category, amount, BPJS rates). Add/Edit modal.

**Approval:** Table of payroll records with status DRAFT/REVIEWED. Action buttons: Review → Approve → Publish. Uses `PATCH /api/hr/payroll/[id]` with `{ status: "REVIEWED" }` etc.

**Riwayat:** All published records with month/year filter and employee search.

**API:** `GET/POST /api/hr/payroll`, `PATCH /api/hr/payroll/[id]`, `GET/POST/PATCH /api/hr/tax-config`.

---

### 6. Slip Gaji (`/dashboard/hr/slip-gaji`)

Dual-access view: HR sees all employees' published slips (with employee search filter); non-HR users see only their own slips. Server enforces this: if requester lacks `hr:view` permission, API filters to `profileId = session.user.profileId`.

**Filters:** Bulan + Tahun (3-year lookback). HR additionally gets karyawan search.

**Stats:** Total Pendapatan, Total Potongan, Gaji Bersih, Jumlah Slip Published (scoped to the visible set).

**Table/Cards:** Month-Year, Karyawan (HR only), Gaji Pokok, Tunjangan, Potongan, Gaji Bersih, Status, Action (Lihat/Cetak).

**Lihat/Cetak:** Modal with formatted payslip template → `window.print()`.

**API:** `GET /api/hr/payroll?status=PUBLISHED` — server applies `profileId` filter for non-HR requesters automatically.

---

### 7. Rekrutmen & Onboarding (`/dashboard/hr/rekrutmen-onboarding`)

**Stats:** Lowongan Aktif, Total Pelamar, Interview Dijadwalkan, Penawaran Pending, Onboarding Aktif.

**Tabs:** Lowongan | Pelamar | Interview | Penawaran | Onboarding | Template

**Lowongan:** CRUD job postings. Table: Judul, Departemen, Tipe, Deadline, Status, Jumlah Pelamar.

**Pelamar:** List all applicants with job posting filter. Status pipeline badge (NEW→REVIEWED→INTERVIEWED→OFFERED→HIRED/REJECTED). Action: update status.

**Interview:** Schedule management. Table: Pelamar, Tipe Interview, Tanggal, Interviewer, Status. Add/Edit drawer.

**Penawaran:** Job offers table. Salary, start date, status (PENDING/ACCEPTED/REJECTED). HR can create offer for an applicant.

**Onboarding:** Active onboardings with progress bars. Link to template. Update progress percentage.

**Template:** CRUD onboarding templates with checklist items.

**API routes:** All under `/api/hr/recruitment/` prefix for each entity.

---

### 8. Pengembangan SDM (`/dashboard/hr/pengembangan-sdm`)

**Alerts section:** Programs starting in ≤14 days, overdue development targets, certifications expiring in ≤90 days.

**Tabs:** Program Pelatihan | Pengembangan Individu | Sertifikasi

**Program Pelatihan:** CRUD training programs. Table: Nama, Tanggal, Status, Peserta, Progress.

**Pengembangan Individu:** Per-employee skill development goals. Table: Karyawan, Skill, Level badge, Progress bar, Target tanggal.

**Sertifikasi:** Employee certifications. Table: Karyawan, Sertifikasi, Tanggal Terbit, Expired, Status badge.

**API:** `GET/POST/PATCH /api/hr/training-programs`, `/api/hr/employee-development`, `/api/hr/certifications`.

---

### 9. Manajemen Kinerja (`/dashboard/hr/manajemen-kinerja`)

**Tabs:** Review Kinerja | KPI

**Review Kinerja:** Table: Karyawan, Periode, Rating (bintang atau progress /5.0), Kelebihan, Status. Add drawer: pilih karyawan, periode, rating (0-5), strengths, comments.

**KPI:** Table: Nama KPI, Departemen, Target, Tercapai, Progress bar, Periode. Add/Edit drawer.

**API:** `GET/POST/PATCH /api/hr/performance-reviews`, `GET/POST/PATCH /api/hr/kpis`.

---

### 10. Manajemen Kesehatan (`/dashboard/hr/manajemen-kesehatan`)

**Tabs:** Rekam Medis | Asuransi

**Rekam Medis:** Table: Karyawan, Tipe Pemeriksaan, Tanggal, Dokter, Temuan (truncated), Status badge. Add modal.

**Asuransi:** Table: Karyawan, Tipe, Provider, No. Polis, Coverage (IDR), Expired, Status badge. Add modal.

**API:** `GET/POST/PATCH /api/hr/health-records`, `GET/POST/PATCH /api/hr/insurance`.

---

### 11. Reimbursement & Loan (`/dashboard/hr/reimbursement-loan`)

**Tabs:** Reimbursement | Pinjaman

**Reimbursement:** Table: Karyawan, Deskripsi, Jumlah (IDR), Tanggal, Status badge. Approve/Reject action.

**Pinjaman:** Table: Karyawan, Jumlah, Tenor (bulan), Cicilan/Bulan, Status badge. Approve/Reject action.

**API:** `GET/POST/PATCH /api/hr/reimbursements`, `GET/POST/PATCH /api/hr/loans`.

---

### 12. Hubungan Industrial (`/dashboard/hr/hubungan-industrial`)

**Tabs:** Tracking SP | Pengaduan Karyawan

**Tracking SP:** Labor disputes table. Karyawan, Tipe SP, Tanggal, Deskripsi (truncated), Status badge. Add/Edit modal.

**Pengaduan:** Employee grievances table. Karyawan, Subjek, Tanggal, Status badge. Add/Edit modal.

**API:** `GET/POST/PATCH /api/hr/labor-disputes`, `GET/POST/PATCH /api/hr/grievances`.

---

### 13. Analitik & Laporan (`/dashboard/hr/analitik-laporan`)

Server-aggregated dashboard. No new schema — queries existing HR data.

**KPI cards:** Total Karyawan, Tingkat Turnover (%), Rata-rata Absensi (%), Kepuasan Kinerja (avg rating).

**Charts (recharts):**
1. **Attendance chart** — BarChart: monthly present vs absent from `Attendance` grouped by month
2. **Leave chart** — BarChart: leave requests by type per month
3. **Performance chart** — BarChart: distribution of performance ratings
4. **Department distribution** — PieChart: employee count by role/department from `Profile`

**Export:** Button downloads a CSV file of the aggregated metrics (one row per month with all KPI values).

**API:** `GET /api/hr/analytics` — returns all aggregated data in one call.

---

## Route Meta Additions

```ts
"/dashboard/hr": { title: "HR & Payroll", subtitle: "Kelola SDM, penggajian, dan administrasi karyawan" }
"/dashboard/hr/database-karyawan": { title: "Database Karyawan", subtitle: "Data lengkap seluruh karyawan", parent: "/dashboard/hr" }
"/dashboard/hr/manajemen-kehadiran": { title: "Manajemen Kehadiran", subtitle: "Monitoring kehadiran real-time", parent: "/dashboard/hr" }
"/dashboard/hr/absensi": { title: "Absensi", subtitle: "Catat kehadiran dengan foto dan lokasi", parent: "/dashboard/hr" }
"/dashboard/hr/sistem-cuti": { title: "Sistem Cuti", subtitle: "Pengajuan dan saldo cuti karyawan", parent: "/dashboard/hr" }
"/dashboard/hr/penggajian-perpajakan": { title: "Penggajian & Perpajakan", subtitle: "Proses penggajian dan konfigurasi pajak", parent: "/dashboard/hr" }
"/dashboard/hr/slip-gaji": { title: "Slip Gaji", subtitle: "Lihat dan unduh slip gaji", parent: "/dashboard/hr" }
"/dashboard/hr/rekrutmen-onboarding": { title: "Rekrutmen & Onboarding", subtitle: "Pipeline rekrutmen hingga onboarding", parent: "/dashboard/hr" }
"/dashboard/hr/pengembangan-sdm": { title: "Pengembangan SDM", subtitle: "Pelatihan, pengembangan, dan sertifikasi", parent: "/dashboard/hr" }
"/dashboard/hr/manajemen-kinerja": { title: "Manajemen Kinerja", subtitle: "Review kinerja dan KPI karyawan", parent: "/dashboard/hr" }
"/dashboard/hr/manajemen-kesehatan": { title: "Manajemen Kesehatan", subtitle: "Rekam medis dan asuransi karyawan", parent: "/dashboard/hr" }
"/dashboard/hr/reimbursement-loan": { title: "Reimbursement & Loan", subtitle: "Klaim biaya dan pinjaman karyawan", parent: "/dashboard/hr" }
"/dashboard/hr/hubungan-industrial": { title: "Hubungan Industrial", subtitle: "SP tracking dan pengaduan karyawan", parent: "/dashboard/hr" }
"/dashboard/hr/analitik-laporan": { title: "Analitik & Laporan", subtitle: "Dashboard metrik HR dan laporan", parent: "/dashboard/hr" }
```

---

## Constraints

- All Solar BoldDuotone icons — no lucide-react
- Tailwind v4 syntax (`data-attr:class`, not `data-[attr]:class`)
- No hardcoded colors — Tailwind tokens only
- `rounded-2xl` containers, `rounded-xl` inputs, `rounded-full` buttons
- No `console.log` in runtime code
- No `any` types
- `findMany` always paginated
- `requirePermission`/`requirePermissionForRoute` on all mutations
- `mutationLimiter`/`apiLimiter` on all routes
- `logAudit` on all mutations
- `db.$transaction([...])` array form for multi-table writes
- Camera selfie: `navigator.mediaDevices.getUserMedia` + canvas — gracefully degrade if not available
