# Slip Gaji (Payslip) — Full Payroll Engine Design Spec

**Date:** 2026-06-22
**Module:** HR & Payroll — Payslip / Payroll
**Status:** Approved
**Prerequisite:** Attendance Enhancement (multi-location & shift) — complete; Sistem Cuti — spec ready (for `on_leave` attendance status)

---

## 1. Overview

Full payroll engine with configurable salary components, auto-calculated BPJS contributions, dual PPh 21 methods (TER + Progressive), attendance/leave integration, monthly payroll generation with draft/finalize/paid workflow, employee self-service slip viewing, and PDF generation.

### Key Features

- Configurable salary components (earnings + deductions) with preset system types
- Per-employee salary assignment with effective dates
- BPJS auto-calculation (Kesehatan, JHT, JKK, JKM, JP) based on configurable rates
- PPh 21 dual method: TER (PP 58/2023) or Progressive (Pasal 17), admin-selectable
- Attendance integration: auto-pull work days, present, absent, late, leave counts
- Absence/late deductions auto-calculated
- Monthly payroll period lifecycle: draft → finalized → paid
- Employee self-service: view finalized slips, download PDF
- PDF generation stored on R2

---

## 2. Data Model

### 2.1 SalaryComponent (New)

```prisma
model SalaryComponent {
  id           String    @id @default(uuid())
  name         String    @unique
  code         String    @unique
  type         SalaryComponentType
  category     SalaryComponentCategory
  isFixed      Boolean   @default(true)
  isTaxable    Boolean   @default(true)
  isActive     Boolean   @default(true)
  isSystemType Boolean   @default(false)
  sortOrder    Int       @default(0)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  employeeSalaries EmployeeSalary[]
  payslipItems     PayslipItem[]

  @@map("salary_components")
}
```

- `type`: `earning` or `deduction`
- `category`: `basic` (gaji pokok), `allowance` (tunjangan), `deduction` (potongan), `benefit` (benefit perusahaan)
- `isFixed`: true = same amount every month; false = can vary
- `isTaxable`: whether this component is included in PPh 21 calculation
- `isSystemType`: preset components cannot be deleted (only deactivated)

### 2.2 SalaryComponentType (New Enum)

```prisma
enum SalaryComponentType {
  earning
  deduction
}

enum SalaryComponentCategory {
  basic
  allowance
  deduction
  benefit
}
```

### 2.3 EmployeeSalary (New)

```prisma
model EmployeeSalary {
  id                  String           @id @default(uuid())
  profileId           String
  salaryComponentId   String
  amount              Decimal          @db.Decimal(15, 2)
  effectiveDate       DateTime
  endDate             DateTime?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  profile             Profile          @relation(fields: [profileId], references: [id], onDelete: Cascade)
  salaryComponent     SalaryComponent  @relation(fields: [salaryComponentId], references: [id], onDelete: Cascade)

  @@unique([profileId, salaryComponentId, effectiveDate])
  @@index([profileId])
  @@index([salaryComponentId])
  @@map("employee_salaries")
}
```

- `amount`: stored as Decimal(15,2) for precision
- `effectiveDate/endDate`: supports salary history (raise effective from X date)

### 2.4 Pph21Method (New Enum)

```prisma
enum Pph21Method {
  ter
  progressive
}
```

### 2.5 PtkpStatus (New Enum)

```prisma
enum PtkpStatus {
  TK0
  TK1
  TK2
  TK3
  K0
  K1
  K2
  K3
}
```

### 2.6 PayrollSettings (New)

```prisma
model PayrollSettings {
  id                       String      @id @default(uuid())
  pph21Method              Pph21Method @default(ter)

  bpjsKesCompanyRate       Decimal     @default(4.0) @db.Decimal(5, 2)
  bpjsKesEmployeeRate      Decimal     @default(1.0) @db.Decimal(5, 2)
  bpjsKesMaxSalary         Decimal     @default(12000000) @db.Decimal(15, 2)

  jhtCompanyRate            Decimal     @default(3.7) @db.Decimal(5, 2)
  jhtEmployeeRate           Decimal     @default(2.0) @db.Decimal(5, 2)
  jkkRate                   Decimal     @default(0.24) @db.Decimal(5, 2)
  jkmRate                   Decimal     @default(0.3) @db.Decimal(5, 2)
  jpCompanyRate             Decimal     @default(2.0) @db.Decimal(5, 2)
  jpEmployeeRate            Decimal     @default(1.0) @db.Decimal(5, 2)
  jpMaxSalary               Decimal     @default(10042300) @db.Decimal(15, 2)

  absenceDeductionPerDay    Decimal     @default(0) @db.Decimal(15, 2)
  lateDeductionPerIncident  Decimal     @default(0) @db.Decimal(15, 2)

  updatedAt                 DateTime    @updatedAt

  @@map("payroll_settings")
}
```

Singleton — one row. Rates are percentages (e.g., 4.0 = 4%).

### 2.7 PayrollPeriodStatus (New Enum)

```prisma
enum PayrollPeriodStatus {
  draft
  processing
  finalized
  paid
}
```

### 2.8 PayrollPeriod (New)

```prisma
model PayrollPeriod {
  id               String              @id @default(uuid())
  month            Int
  year             Int
  status           PayrollPeriodStatus  @default(draft)
  totalEmployees   Int                  @default(0)
  totalGrossAmount Decimal              @default(0) @db.Decimal(15, 2)
  totalNetAmount   Decimal              @default(0) @db.Decimal(15, 2)
  generatedBy      String?
  generatedAt      DateTime?
  finalizedBy      String?
  finalizedAt      DateTime?
  paidAt           DateTime?
  notes            String?
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  generator        Profile?             @relation("PayrollGenerator", fields: [generatedBy], references: [id], onDelete: SetNull)
  finalizer        Profile?             @relation("PayrollFinalizer", fields: [finalizedBy], references: [id], onDelete: SetNull)
  payslips         Payslip[]

  @@unique([month, year])
  @@map("payroll_periods")
}
```

### 2.9 PayslipStatus (New Enum)

```prisma
enum PayslipStatus {
  draft
  finalized
}
```

### 2.10 Payslip (New)

```prisma
model Payslip {
  id                String        @id @default(uuid())
  payrollPeriodId   String
  profileId         String

  employeeName      String
  employeeNumber    Int
  departmentName    String?
  positionName      String?
  bankName          String?
  bankAccountNumber String?
  bankAccountHolder String?
  npwp              String?
  ptkpStatus        PtkpStatus?

  totalEarnings     Decimal       @default(0) @db.Decimal(15, 2)
  totalDeductions   Decimal       @default(0) @db.Decimal(15, 2)
  netSalary         Decimal       @default(0) @db.Decimal(15, 2)

  pph21Method       Pph21Method?
  pph21Amount       Decimal       @default(0) @db.Decimal(15, 2)

  bpjsKesCompany    Decimal       @default(0) @db.Decimal(15, 2)
  bpjsKesEmployee   Decimal       @default(0) @db.Decimal(15, 2)
  jhtCompany        Decimal       @default(0) @db.Decimal(15, 2)
  jhtEmployee       Decimal       @default(0) @db.Decimal(15, 2)
  jkkAmount         Decimal       @default(0) @db.Decimal(15, 2)
  jkmAmount         Decimal       @default(0) @db.Decimal(15, 2)
  jpCompany         Decimal       @default(0) @db.Decimal(15, 2)
  jpEmployee        Decimal       @default(0) @db.Decimal(15, 2)

  totalWorkDays     Int           @default(0)
  totalPresent      Int           @default(0)
  totalAbsent       Int           @default(0)
  totalLate         Int           @default(0)
  totalLeave        Int           @default(0)
  absenceDeduction  Decimal       @default(0) @db.Decimal(15, 2)
  lateDeduction     Decimal       @default(0) @db.Decimal(15, 2)

  status            PayslipStatus @default(draft)
  pdfUrl            String?

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  payrollPeriod     PayrollPeriod @relation(fields: [payrollPeriodId], references: [id], onDelete: Cascade)
  profile           Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  items             PayslipItem[]

  @@unique([payrollPeriodId, profileId])
  @@index([payrollPeriodId])
  @@index([profileId])
  @@map("payslips")
}
```

Snapshot fields (employeeName, departmentName, etc.) ensure the slip remains valid even if employee data changes later.

### 2.11 PayslipItem (New)

```prisma
model PayslipItem {
  id                  String           @id @default(uuid())
  payslipId           String
  salaryComponentId   String?
  name                String
  type                SalaryComponentType
  amount              Decimal          @db.Decimal(15, 2)
  sortOrder           Int              @default(0)

  payslip             Payslip          @relation(fields: [payslipId], references: [id], onDelete: Cascade)
  salaryComponent     SalaryComponent? @relation(fields: [salaryComponentId], references: [id], onDelete: SetNull)

  @@index([payslipId])
  @@map("payslip_items")
}
```

- `salaryComponentId` nullable: auto-calculated items (BPJS, PPh 21, absence deduction) don't link to a component

### 2.12 Profile Model Changes

Add:
```prisma
  ptkpStatus             PtkpStatus?
  employeeSalaries       EmployeeSalary[]
  payslips               Payslip[]
  payrollsGenerated      PayrollPeriod[]  @relation("PayrollGenerator")
  payrollsFinalized      PayrollPeriod[]  @relation("PayrollFinalizer")
```

---

## 3. Payroll Generation Flow

### 3.1 Generate Payroll

Admin selects month/year and clicks "Generate Payroll":

1. Check if `PayrollPeriod` exists for month/year
   - If exists with status `draft` → delete all related payslips and items, regenerate
   - If exists with status `finalized` or `paid` → error "Periode ini sudah difinalisasi"
2. Create `PayrollPeriod` (status = `draft`)
3. Get all active employees (`Profile.status = active`)
4. For each employee:
   a. **Get salary components**: query `EmployeeSalary` where `effectiveDate <= endOfMonth` AND (`endDate IS NULL` OR `endDate >= startOfMonth`)
   b. **Get attendance summary** for the month from `Attendance` table:
      - `totalWorkDays` = weekdays in the month (Mon-Fri)
      - `totalPresent` = count where status IN (`on_time`, `late`)
      - `totalLate` = count where status = `late`
      - `totalLeave` = count where status = `on_leave`
      - `totalAbsent` = `totalWorkDays - totalPresent - totalLeave`
   c. **Calculate earnings**: sum all `EmployeeSalary` where component type = `earning`
   d. **Calculate attendance deductions**:
      - `absenceDeduction = totalAbsent × PayrollSettings.absenceDeductionPerDay`
      - `lateDeduction = totalLate × PayrollSettings.lateDeductionPerIncident`
   e. **Calculate BPJS** (based on gaji pokok = EmployeeSalary where SalaryComponent.code = `basic_salary`):
      - `bpjsKesCompany = min(gajiPokok, bpjsKesMaxSalary) × bpjsKesCompanyRate / 100`
      - `bpjsKesEmployee = min(gajiPokok, bpjsKesMaxSalary) × bpjsKesEmployeeRate / 100`
      - `jhtCompany = gajiPokok × jhtCompanyRate / 100`
      - `jhtEmployee = gajiPokok × jhtEmployeeRate / 100`
      - `jkkAmount = gajiPokok × jkkRate / 100`
      - `jkmAmount = gajiPokok × jkmRate / 100`
      - `jpCompany = min(gajiPokok, jpMaxSalary) × jpCompanyRate / 100`
      - `jpEmployee = min(gajiPokok, jpMaxSalary) × jpEmployeeRate / 100`
   f. **Calculate PPh 21** (see Section 4)
   g. **Calculate total deductions**: sum component deductions + bpjsKesEmployee + jhtEmployee + jpEmployee + pph21Amount + absenceDeduction + lateDeduction
   h. **Net salary** = totalEarnings - totalDeductions
   i. Create `Payslip` with snapshot data + calculated amounts
   j. Create `PayslipItem` for each earning component, each deduction component, BPJS items, PPh 21, attendance deductions
5. Update `PayrollPeriod` totals
6. Audit log

### 3.2 Finalize

Admin clicks "Finalize" on a draft period:
1. Set `PayrollPeriod.status = finalized`, record `finalizedBy`, `finalizedAt`
2. Set all related `Payslip.status = finalized`
3. Slips become visible to employees
4. No further edits allowed
5. Audit log

### 3.3 Mark as Paid

Admin clicks "Tandai Sudah Dibayar":
1. Set `PayrollPeriod.status = paid`, record `paidAt`
2. Audit log

### 3.4 PDF Generation

On finalize (or on-demand), generate PDF for each payslip:
1. Render payslip data into PDF format
2. Upload to R2: `payslips/{year}/{month}/{profileId}-{period}.pdf`
3. Save URL in `Payslip.pdfUrl`

Use `@react-pdf/renderer` for server-side PDF generation (React components → PDF buffer). If bundle issues arise, fall back to simple HTML-to-PDF via `puppeteer` or a lightweight alternative.

---

## 4. PPh 21 Calculation

### 4.1 Metode TER (Tarif Efektif Rata-rata)

Per PP 58/2023, effective January 2024.

```
PPh 21 = Penghasilan Bruto Bulanan × Tarif TER
```

TER categories based on PTKP status:
- **Kategori A**: TK/0, TK/1, K/0
- **Kategori B**: K/1, K/2
- **Kategori C**: K/3

Tarif TER (simplified — stored in `lib/payroll/pph21-ter-rates.ts`):

| Range Bruto Bulanan | Kategori A | Kategori B | Kategori C |
|---|---|---|---|
| ≤ 5.400.000 | 0% | 0% | 0% |
| 5.400.001 – 5.650.000 | 0.25% | 0% | 0% |
| 5.650.001 – 5.950.000 | 0.5% | 0% | 0% |
| 5.950.001 – 6.300.000 | 0.75% | 0.25% | 0% |
| 6.300.001 – 6.750.000 | 1% | 0.5% | 0.25% |
| ... (full table in implementation) | ... | ... | ... |
| > 1.400.000.000 | 34% | 34% | 34% |

The full TER table has ~50 rows per category. Store as a lookup function.

### 4.2 Metode Progresif (Pasal 17)

```
1. Penghasilan bruto tahunan = bruto bulanan × 12
2. Biaya jabatan = min(bruto tahunan × 5%, 6.000.000)
3. Iuran JHT + JP karyawan (tahunan)
4. Penghasilan neto = bruto tahunan - biaya jabatan - iuran
5. PTKP berdasarkan status
6. PKP = max(0, penghasilan neto - PTKP)
7. PPh 21 tahunan = progressive rate on PKP
8. PPh 21 bulanan = PPh 21 tahunan / 12
```

Progressive rates (Pasal 17):
| PKP Range | Rate |
|---|---|
| 0 – 60.000.000 | 5% |
| 60.000.001 – 250.000.000 | 15% |
| 250.000.001 – 500.000.000 | 25% |
| 500.000.001 – 5.000.000.000 | 30% |
| > 5.000.000.000 | 35% |

### 4.3 PTKP Values (2024)

| Status | Amount |
|---|---|
| TK/0 | 54.000.000 |
| TK/1, K/0 | 58.500.000 |
| TK/2, K/1 | 63.000.000 |
| TK/3, K/2 | 67.500.000 |
| K/3 | 72.000.000 |

Store in `lib/payroll/ptkp-values.ts`.

---

## 5. Preset Salary Components (Seed via Migration)

| Code | Name | Type | Category | Taxable | Fixed |
|---|---|---|---|---|---|
| `basic_salary` | Gaji Pokok | earning | basic | Yes | Yes |
| `transport_allowance` | Tunjangan Transport | earning | allowance | Yes | Yes |
| `meal_allowance` | Tunjangan Makan | earning | allowance | Yes | Yes |
| `position_allowance` | Tunjangan Jabatan | earning | allowance | Yes | Yes |
| `communication_allowance` | Tunjangan Komunikasi | earning | allowance | Yes | Yes |
| `overtime_pay` | Uang Lembur | earning | allowance | Yes | No |
| `bonus` | Bonus | earning | allowance | Yes | No |
| `loan_deduction` | Potongan Pinjaman | deduction | deduction | No | No |
| `other_deduction` | Potongan Lain-lain | deduction | deduction | No | No |

System types (`isSystemType = true`): `basic_salary` only. Others are presets that can be deactivated or deleted.

---

## 6. API Layer

### 6.1 API Routes

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/hr/salary-components` | `hr-payroll:view` | List salary components |
| GET | `/api/hr/employee-salaries` | `hr-payroll:view` | List employee salaries (filtered) |
| GET | `/api/hr/payroll-periods` | `hr-payroll:view` | List payroll periods |
| GET | `/api/hr/payroll-periods/[id]` | `hr-payroll:view` | Period detail with payslips |
| GET | `/api/hr/payslips/my` | authenticated | My payslips (finalized/paid) |
| GET | `/api/hr/payslips/[id]` | `hr-payroll:view` or own | Single payslip with items |
| GET | `/api/hr/payslips/[id]/pdf` | `hr-payroll:view` or own | Download PDF |
| GET | `/api/hr/payroll-settings` | `hr-payroll:view` | Get payroll settings |

### 6.2 Server Actions

| Action | Permission | Description |
|---|---|---|
| `createSalaryComponent` | `hr-payroll:create` | Create component |
| `updateSalaryComponent` | `hr-payroll:edit` | Update component |
| `deleteSalaryComponent` | `hr-payroll:delete` | Delete (blocked if system type) |
| `setEmployeeSalary` | `hr-payroll:edit` | Set salary component value for employee |
| `bulkSetEmployeeSalary` | `hr-payroll:edit` | Set for multiple employees |
| `deleteEmployeeSalary` | `hr-payroll:edit` | Remove salary assignment |
| `generatePayroll` | `hr-payroll:create` | Generate payroll for month/year |
| `finalizePayroll` | `hr-payroll:finalize` | Finalize period |
| `markPayrollPaid` | `hr-payroll:finalize` | Mark as paid |
| `deletePayrollPeriod` | `hr-payroll:delete` | Delete draft period |
| `updatePayrollSettings` | `hr-payroll:edit` | Update global settings |
| `generatePayslipPdf` | `hr-payroll:view` | Generate PDF for a payslip |

---

## 7. UI Pages

### 7.1 Admin — Penggajian & Perpajakan (`/dashboard/hr/penggajian-perpajakan`)

**Tab Periode:**
- Table of payroll periods with status badges (draft/finalized/paid)
- "Generate Payroll" button → dialog (month/year select)
- Row actions: View Detail, Finalize, Mark Paid, Delete (draft only)

**Tab Komponen Gaji:**
- CRUD table: Name, Code, Type badge, Category badge, Taxable, Fixed, System, Actions
- System types cannot be deleted
- Add/Edit dialog

**Tab Gaji Karyawan:**
- Table: Employee, Department, then one column per active salary component showing the amount
- Click employee row → dialog to set/edit all component values
- "Bulk Set" button for mass assignment

**Tab Pengaturan:**
- PPh 21 method Select (TER / Progresif)
- BPJS rates section (all rate fields editable)
- Attendance deduction section

### 7.2 Admin — Detail Periode (`/dashboard/hr/penggajian-perpajakan/[periodId]`)

Actually: use the same page with a dialog/drawer to show period detail, to avoid creating another route.

Period detail in a full-width drawer:
- Header: "Payroll [Month] [Year]", status badge, total employees, total gross, total net
- Table of payslips: Karyawan, Gaji Pokok, Total Earning, BPJS, PPh 21, Potongan Lain, Net
- Click row → slip detail drawer
- "Finalize" / "Mark Paid" buttons
- "Export CSV" button

### 7.3 Karyawan — Slip Gaji (`/dashboard/hr/slip-gaji`)

- Period selector (month/year dropdown, defaults to latest)
- Slip card showing:
  - Header: employee info (name, number, department, position)
  - Earnings section: list of earning items with amounts
  - BPJS section: employee portion details
  - PPh 21 line
  - Deductions section: list of deduction items
  - Attendance summary: work days, present, absent, late, leave
  - Summary: Total Earnings, Total Deductions, **Net Salary** (large, bold)
- "Download PDF" button
- Only shows `finalized` or `paid` slips

---

## 8. Permissions (Seed via Migration)

```sql
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-payroll', 'view', 'View payroll periods, settings, components', 24),
  (gen_random_uuid()::text, 'hr-payroll', 'create', 'Generate payroll, create components', 24),
  (gen_random_uuid()::text, 'hr-payroll', 'edit', 'Edit components, settings, salaries', 24),
  (gen_random_uuid()::text, 'hr-payroll', 'delete', 'Delete draft periods, components', 24),
  (gen_random_uuid()::text, 'hr-payroll', 'finalize', 'Finalize and mark payroll as paid', 24)
ON CONFLICT (module, action) DO NOTHING;
```

---

## 9. File Structure

```
lib/payroll/pph21-ter-rates.ts          # TER rate lookup table
lib/payroll/pph21-progressive.ts        # Progressive calculation
lib/payroll/ptkp-values.ts              # PTKP values
lib/payroll/bpjs-calculator.ts          # BPJS calculation
lib/payroll/payroll-generator.ts        # Main generation orchestrator
lib/payroll/pdf-generator.ts            # PDF rendering

lib/validations/salaryComponent.ts
lib/validations/employeeSalary.ts
lib/validations/payrollPeriod.ts
lib/validations/payrollSettings.ts

lib/queries/salaryComponents.ts
lib/queries/employeeSalaries.ts
lib/queries/payrollPeriods.ts
lib/queries/payslips.ts
lib/queries/payrollSettings.ts

actions/salaryComponent.ts
actions/employeeSalary.ts
actions/payroll.ts                      # generatePayroll, finalizePayroll, markPaid, delete
actions/payrollSettings.ts

services/salary-component-service.ts
services/employee-salary-service.ts
services/payroll-period-service.ts
services/payslip-service.ts
services/payroll-settings-service.ts

hooks/use-salary-components.ts
hooks/use-employee-salaries.ts
hooks/use-payroll-periods.ts
hooks/use-payslips.ts
hooks/use-payroll-settings.ts

app/api/hr/salary-components/route.ts
app/api/hr/employee-salaries/route.ts
app/api/hr/payroll-periods/route.ts
app/api/hr/payroll-periods/[id]/route.ts
app/api/hr/payslips/my/route.ts
app/api/hr/payslips/[id]/route.ts
app/api/hr/payslips/[id]/pdf/route.ts
app/api/hr/payroll-settings/route.ts

app/(private)/dashboard/hr/penggajian-perpajakan/page.tsx
app/(private)/dashboard/hr/penggajian-perpajakan/_components/PayrollManagement.tsx
app/(private)/dashboard/hr/penggajian-perpajakan/_components/PayrollPeriodTable.tsx
app/(private)/dashboard/hr/penggajian-perpajakan/_components/PayrollPeriodDetail.tsx
app/(private)/dashboard/hr/penggajian-perpajakan/_components/SalaryComponentManager.tsx
app/(private)/dashboard/hr/penggajian-perpajakan/_components/EmployeeSalaryManager.tsx
app/(private)/dashboard/hr/penggajian-perpajakan/_components/PayrollSettingsPanel.tsx
app/(private)/dashboard/hr/penggajian-perpajakan/_components/GeneratePayrollDialog.tsx

app/(private)/dashboard/hr/slip-gaji/page.tsx
app/(private)/dashboard/hr/slip-gaji/_components/PayslipViewer.tsx
app/(private)/dashboard/hr/slip-gaji/_components/PayslipCard.tsx
```

Modified files:
```
prisma/schema.prisma — add all new models, enums, Profile relations
lib/route-meta.ts — add penggajian-perpajakan and slip-gaji routes
```

---

## 10. Migration Strategy

Single migration file:

1. Create enums: `SalaryComponentType`, `SalaryComponentCategory`, `Pph21Method`, `PtkpStatus`, `PayrollPeriodStatus`, `PayslipStatus`
2. Create tables: `salary_components`, `employee_salaries`, `payroll_settings`, `payroll_periods`, `payslips`, `payslip_items`
3. Add `ptkpStatus` column to `profiles`
4. Add FK constraints and indexes
5. Seed preset salary components (9 types)
6. Seed default PayrollSettings (1 row)
7. Seed permissions (5 entries)

---

## 11. Key Design Decisions

1. **Snapshot-based payslips** — Employee data (name, department, bank info) is snapshotted into the Payslip at generation time. This ensures historical accuracy — a payslip from January 2026 still shows the employee's department at that time, even if they transferred in February.

2. **Decimal type for money** — All monetary values use `Decimal(15,2)` for precision. JavaScript `number` (float64) loses precision beyond ~15 digits; Prisma Decimal maps to `string` in JS but handles arithmetic correctly.

3. **Draft → Finalize → Paid lifecycle** — Drafts can be regenerated (delete + recreate). Once finalized, no edits. This prevents accidental changes to official payslips while allowing corrections before finalization.

4. **PPh 21 dual method** — Both TER and Progressive are implemented because Indonesian tax regulations support both. TER is simpler and newer (2024+), Progressive is the traditional method. Admin chooses the default; the method is recorded per payslip for audit.

5. **BPJS auto-calculation with configurable rates** — Rates are stored in PayrollSettings, not hardcoded. When government changes rates, admin updates settings without code changes. Max salary caps (for BPJS Kes and JP) are also configurable.

6. **Attendance integration** — Payroll generation pulls attendance data for the month, calculating work days, present, absent, late, and leave counts. Absence and late deductions are auto-calculated based on configurable per-day/per-incident amounts.

7. **PDF on R2** — PDFs are generated server-side and stored on R2. This avoids regenerating on every download and provides a permanent record. If PDF generation fails, the payslip is still viewable in-app.

8. **Employee self-service** — Employees can only see `finalized` or `paid` slips. Draft slips are admin-only. This prevents confusion from in-progress calculations.
