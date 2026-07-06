# HR & Payroll — Phase 1: Foundation Design Spec

**Date:** 2026-06-12
**Branch:** hr-payroll (to be created)
**Phase:** 1 of N — Foundation only
**Parent spec:** `2026-06-10-hr-payroll-design.md`

---

## Scope

Phase 1 establishes the technical foundation for the HR & Payroll module. No functional UI is built yet — only the data layer, routing, and navigation scaffolding.

**In scope:**
1. Prisma schema additions (all 13 sub-modules' models, migrations grouped by module)
2. Route meta additions (14 routes)
3. Sidebar: unhide HR menu entry
4. Stub pages (13 `page.tsx` files with "Segera Hadir" placeholder)

**Out of scope:** All API routes, hooks, services, and real UI components. Those are addressed in Phase 2+.

---

## 1. Prisma Migrations

Eight migration files, applied in order. Each migration also adds the corresponding relations to `Profile`.

### Migration 1: `add_hr_attendance`

**New enums:** `GeofenceStatus { IN_RANGE OUT_OF_RANGE UNKNOWN }`

**New model:** `Attendance`
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

**Profile addition:** `attendances Attendance[]`

---

### Migration 2: `add_hr_leave`

**New enums:**
- `LeaveType { CUTI_TAHUNAN SAKIT IZIN CUTI_BERSAMA }`
- `LeaveStatus { PENDING APPROVED REJECTED CANCELLED }`

**New models:** `LeaveRequest`, `LeaveBalance`

**Profile additions:** `leaveRequests LeaveRequest[]`, `leaveBalances LeaveBalance[]`

---

### Migration 3: `add_hr_payroll`

**New enums:** `PayrollStatus { DRAFT REVIEWED APPROVED PUBLISHED REJECTED }`

**New models:** `PayrollRecord`, `TaxConfig`

**Profile addition:** `payrollRecords PayrollRecord[]`

---

### Migration 4: `add_hr_recruitment`

**New enums:**
- `PositionType { FULL_TIME PART_TIME CONTRACT INTERNSHIP }`
- `JobStatus { OPEN CLOSED }`
- `ApplicantStatus { NEW REVIEWED INTERVIEWED OFFERED HIRED REJECTED }`
- `InterviewType { PHONE_SCREENING TECHNICAL HR_ROUND FINAL }`
- `InterviewStatus { SCHEDULED COMPLETED CANCELLED NO_SHOW }`
- `OfferStatus { PENDING ACCEPTED REJECTED }`
- `OnboardingStatus { IN_PROGRESS COMPLETED }`

**New models:** `JobPosting`, `Applicant`, `Interview`, `JobOffer`, `OnboardingTemplate`, `OnboardingTemplateItem`, `EmployeeOnboarding`

**Profile addition:** `onboardings EmployeeOnboarding[]`

---

### Migration 5: `add_hr_development`

**New enums:**
- `TrainingStatus { SCHEDULED ONGOING COMPLETED CANCELLED }`
- `DevelopmentLevel { BEGINNER INTERMEDIATE ADVANCED }`
- `CertificationStatus { ACTIVE PENDING EXPIRED }`

**New models:** `TrainingProgram`, `EmployeeDevelopment`, `EmployeeCertification`

**Profile additions:** `developments EmployeeDevelopment[]`, `certifications EmployeeCertification[]`

---

### Migration 6: `add_hr_performance`

**New enums:**
- `ReviewStatus { PENDING IN_PROGRESS COMPLETED REJECTED }`

**New models:** `PerformanceReview`, `KPI`

**Profile addition:** `performanceReviews PerformanceReview[]`

---

### Migration 7: `add_hr_health`

**New enums:**
- `HealthStatus { NORMAL SELESAI PERLU_TINDAK_LANJUT URGENT }`
- `InsuranceStatus { AKTIF BERAKHIR EXPIRED PENDING NON_AKTIF }`

**New models:** `HealthRecord`, `EmployeeInsurance`

**Profile additions:** `healthRecords HealthRecord[]`, `insurances EmployeeInsurance[]`

---

### Migration 8: `add_hr_industrial`

**New enums:**
- `ReimbursementStatus { PENDING APPROVED REJECTED }`
- `LoanStatus { PENDING ACTIVE COMPLETED APPROVED REJECTED }`
- `DisputeType { INDIVIDUAL COLLECTIVE PROCEDURAL }`
- `DisputeStatus { PENDING IN_PROGRESS RESOLVED IN_REVIEW UNDER_INVESTIGATION ESCALATED REJECTED }`

**New models:** `Reimbursement`, `EmployeeLoan`, `LaborDispute`, `EmployeeGrievance`

**Profile additions:** `reimbursements Reimbursement[]`, `loans EmployeeLoan[]`, `laborDisputes LaborDispute[]`, `grievances EmployeeGrievance[]`

---

## 2. Route Meta

Add 14 entries to `lib/route-meta.ts`:

```ts
"/dashboard/hr": { title: "HR & Payroll", subtitle: "Kelola SDM, penggajian, dan administrasi karyawan" },
"/dashboard/hr/database-karyawan": { title: "Database Karyawan", subtitle: "Data lengkap seluruh karyawan", parent: "/dashboard/hr" },
"/dashboard/hr/manajemen-kehadiran": { title: "Manajemen Kehadiran", subtitle: "Monitoring kehadiran real-time", parent: "/dashboard/hr" },
"/dashboard/hr/absensi": { title: "Absensi", subtitle: "Catat kehadiran dengan foto dan lokasi", parent: "/dashboard/hr" },
"/dashboard/hr/sistem-cuti": { title: "Sistem Cuti", subtitle: "Pengajuan dan saldo cuti karyawan", parent: "/dashboard/hr" },
"/dashboard/hr/penggajian-perpajakan": { title: "Penggajian & Perpajakan", subtitle: "Proses penggajian dan konfigurasi pajak", parent: "/dashboard/hr" },
"/dashboard/hr/slip-gaji": { title: "Slip Gaji", subtitle: "Lihat dan unduh slip gaji", parent: "/dashboard/hr" },
"/dashboard/hr/rekrutmen-onboarding": { title: "Rekrutmen & Onboarding", subtitle: "Pipeline rekrutmen hingga onboarding", parent: "/dashboard/hr" },
"/dashboard/hr/pengembangan-sdm": { title: "Pengembangan SDM", subtitle: "Pelatihan, pengembangan, dan sertifikasi", parent: "/dashboard/hr" },
"/dashboard/hr/manajemen-kinerja": { title: "Manajemen Kinerja", subtitle: "Review kinerja dan KPI karyawan", parent: "/dashboard/hr" },
"/dashboard/hr/manajemen-kesehatan": { title: "Manajemen Kesehatan", subtitle: "Rekam medis dan asuransi karyawan", parent: "/dashboard/hr" },
"/dashboard/hr/reimbursement-loan": { title: "Reimbursement & Loan", subtitle: "Klaim biaya dan pinjaman karyawan", parent: "/dashboard/hr" },
"/dashboard/hr/hubungan-industrial": { title: "Hubungan Industrial", subtitle: "SP tracking dan pengaduan karyawan", parent: "/dashboard/hr" },
"/dashboard/hr/analitik-laporan": { title: "Analitik & Laporan", subtitle: "Dashboard metrik HR dan laporan", parent: "/dashboard/hr" },
```

---

## 3. Sidebar

In `lib/sidebar-config.ts` (or wherever HR menu is defined): remove `hidden: true` from the HR & Payroll parent entry so the menu renders.

---

## 4. Stub Pages

Create 13 files: `app/(private)/dashboard/hr/<sub-module>/page.tsx`

Each stub page:
- `export default function Page()` with a centered "Segera Hadir" card
- Uses `requirePagePermission("hr")` for auth guard (server component)
- Imports no client-side code

Sub-modules:
- `database-karyawan`
- `manajemen-kehadiran`
- `absensi`
- `sistem-cuti`
- `penggajian-perpajakan`
- `slip-gaji`
- `rekrutmen-onboarding`
- `pengembangan-sdm`
- `manajemen-kinerja`
- `manajemen-kesehatan`
- `reimbursement-loan`
- `hubungan-industrial`
- `analitik-laporan`

---

## Success Criteria

- `npx prisma validate` passes after all 8 migrations are applied
- `npm run build` passes (no TypeScript errors)
- HR menu visible in sidebar
- All 13 sub-module URLs return a page (no 404)
- No `console.log` in runtime code
- No `any` types
