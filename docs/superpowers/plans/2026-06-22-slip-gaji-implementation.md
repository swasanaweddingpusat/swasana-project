# Slip Gaji (Full Payroll Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full payroll engine with configurable salary components, BPJS auto-calculation, PPh 21 (TER + Progressive), attendance integration, monthly payroll lifecycle (draft → finalized → paid), employee self-service payslip viewing, and PDF generation.

**Architecture:** 6 new Prisma models (SalaryComponent, EmployeeSalary, PayrollSettings, PayrollPeriod, Payslip, PayslipItem) + 6 enums. Payroll calculation logic lives in `lib/payroll/` with dedicated calculators for PPh 21, BPJS, and the main generator orchestrator. Two pages: `/dashboard/hr/penggajian-perpajakan` (admin) and `/dashboard/hr/slip-gaji` (employee self-service). PDF generated server-side and stored on R2.

**Tech Stack:** Next.js 16, Prisma 7 (Neon HTTP, Decimal type), Zod v4, TanStack Query v5, shadcn v4 + Tailwind v4, Solar Icons, `@react-pdf/renderer` for PDF.

**Spec:** `docs/superpowers/specs/2026-06-22-slip-gaji-design.md`

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `prisma/migrations/20260622160000_add_payroll/migration.sql` | Schema migration + seed data |
| `lib/payroll/ptkp-values.ts` | PTKP values by status |
| `lib/payroll/pph21-ter-rates.ts` | TER rate lookup table |
| `lib/payroll/pph21-progressive.ts` | Progressive PPh 21 calculation |
| `lib/payroll/bpjs-calculator.ts` | BPJS contribution calculation |
| `lib/payroll/payroll-generator.ts` | Main payroll generation orchestrator |
| `lib/payroll/pdf-generator.ts` | Payslip PDF rendering |
| `lib/validations/salaryComponent.ts` | Zod schemas |
| `lib/validations/employeeSalary.ts` | Zod schemas |
| `lib/validations/payrollPeriod.ts` | Zod schemas |
| `lib/validations/payrollSettings.ts` | Zod schemas |
| `lib/queries/salaryComponents.ts` | Query functions |
| `lib/queries/employeeSalaries.ts` | Query functions |
| `lib/queries/payrollPeriods.ts` | Query functions |
| `lib/queries/payslips.ts` | Query functions |
| `lib/queries/payrollSettings.ts` | Query functions |
| `actions/salaryComponent.ts` | CRUD salary components |
| `actions/employeeSalary.ts` | Set/bulk/delete employee salaries |
| `actions/payroll.ts` | Generate, finalize, mark paid, delete period |
| `actions/payrollSettings.ts` | Update payroll settings |
| `services/salary-component-service.ts` | Client fetch |
| `services/employee-salary-service.ts` | Client fetch |
| `services/payroll-period-service.ts` | Client fetch |
| `services/payslip-service.ts` | Client fetch |
| `services/payroll-settings-service.ts` | Client fetch |
| `hooks/use-salary-components.ts` | TanStack Query hooks |
| `hooks/use-employee-salaries.ts` | TanStack Query hooks |
| `hooks/use-payroll-periods.ts` | TanStack Query hooks |
| `hooks/use-payslips.ts` | TanStack Query hooks |
| `hooks/use-payroll-settings.ts` | TanStack Query hooks |
| `app/api/hr/salary-components/route.ts` | GET |
| `app/api/hr/employee-salaries/route.ts` | GET |
| `app/api/hr/payroll-periods/route.ts` | GET |
| `app/api/hr/payroll-periods/[id]/route.ts` | GET detail |
| `app/api/hr/payslips/my/route.ts` | GET my slips |
| `app/api/hr/payslips/[id]/route.ts` | GET single slip |
| `app/api/hr/payslips/[id]/pdf/route.ts` | GET PDF download |
| `app/api/hr/payroll-settings/route.ts` | GET |
| `app/(private)/dashboard/hr/penggajian-perpajakan/page.tsx` | Admin page |
| `app/(private)/dashboard/hr/penggajian-perpajakan/_components/PayrollManagement.tsx` | Tab wrapper |
| `app/(private)/dashboard/hr/penggajian-perpajakan/_components/PayrollPeriodTable.tsx` | Period list + generate |
| `app/(private)/dashboard/hr/penggajian-perpajakan/_components/PayrollPeriodDetail.tsx` | Period detail drawer |
| `app/(private)/dashboard/hr/penggajian-perpajakan/_components/SalaryComponentManager.tsx` | Component CRUD |
| `app/(private)/dashboard/hr/penggajian-perpajakan/_components/EmployeeSalaryManager.tsx` | Employee salary table |
| `app/(private)/dashboard/hr/penggajian-perpajakan/_components/PayrollSettingsPanel.tsx` | Settings form |
| `app/(private)/dashboard/hr/penggajian-perpajakan/_components/GeneratePayrollDialog.tsx` | Generate dialog |
| `app/(private)/dashboard/hr/slip-gaji/page.tsx` | Employee page |
| `app/(private)/dashboard/hr/slip-gaji/_components/PayslipViewer.tsx` | Viewer wrapper |
| `app/(private)/dashboard/hr/slip-gaji/_components/PayslipCard.tsx` | Slip display card |

### Modified Files

| File | Changes |
|---|---|
| `prisma/schema.prisma` | Add 6 models, 6 enums, Profile fields + relations |
| `lib/route-meta.ts` | Add penggajian-perpajakan and slip-gaji routes |

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260622160000_add_payroll/migration.sql`

- [ ] **Step 1: Add 6 new enums to schema**

After the existing `LeaveRequestStatus` enum, add:

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

enum Pph21Method {
  ter
  progressive
}

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

enum PayrollPeriodStatus {
  draft
  processing
  finalized
  paid
}

enum PayslipStatus {
  draft
  finalized
}
```

- [ ] **Step 2: Add 6 new models to schema**

After the LeaveRequest model, add all models from the spec: SalaryComponent, EmployeeSalary, PayrollSettings, PayrollPeriod, Payslip, PayslipItem. Copy the exact Prisma definitions from the spec Sections 2.1–2.11.

- [ ] **Step 3: Add Profile fields + relations**

Add `ptkpStatus PtkpStatus?` field to the Profile model (after existing HR fields). Add reverse relations: `employeeSalaries`, `payslips`, `payrollsGenerated`, `payrollsFinalized`.

- [ ] **Step 4: Create migration SQL**

Create `prisma/migrations/20260622160000_add_payroll/migration.sql` with:
- CREATE TYPE for all 6 enums (with DO $$ BEGIN ... EXCEPTION WHEN duplicate_object)
- CREATE TABLE IF NOT EXISTS for all 6 tables
- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS "ptkpStatus" for the new Profile field
- Foreign key constraints (all with DO $$ BEGIN ... EXCEPTION guard)
- Seed 9 preset salary components (INSERT INTO salary_components ... ON CONFLICT (code) DO NOTHING)
- Seed 1 default PayrollSettings row
- Seed 5 hr-payroll permissions (INSERT INTO permissions ... ON CONFLICT (module, action) DO NOTHING)

- [ ] **Step 5: Validate and generate** — `npx prisma validate` then `npx prisma generate`

---

### Task 2: Payroll Calculation Engine

**Files:**
- Create: `lib/payroll/ptkp-values.ts`
- Create: `lib/payroll/pph21-ter-rates.ts`
- Create: `lib/payroll/pph21-progressive.ts`
- Create: `lib/payroll/bpjs-calculator.ts`

These are pure calculation modules with no DB dependency.

- [ ] **Step 1: Create `lib/payroll/ptkp-values.ts`**

Export PTKP values and a lookup function:

```typescript
import type { PtkpStatus } from "@prisma/client";

const PTKP_VALUES: Record<PtkpStatus, number> = {
  TK0: 54_000_000,
  TK1: 58_500_000,
  K0: 58_500_000,
  TK2: 63_000_000,
  K1: 63_000_000,
  TK3: 67_500_000,
  K2: 67_500_000,
  K3: 72_000_000,
};

export function getPtkpValue(status: PtkpStatus): number {
  return PTKP_VALUES[status];
}

export function getTerCategory(status: PtkpStatus): "A" | "B" | "C" {
  if (status === "TK0" || status === "TK1" || status === "K0") return "A";
  if (status === "K1" || status === "K2") return "B";
  return "C";
}
```

- [ ] **Step 2: Create `lib/payroll/pph21-ter-rates.ts`**

Export the TER rate table and lookup function. The full table per PP 58/2023 has ~50 ranges. Implement the complete table as an array of `{ maxBruto, rateA, rateB, rateC }` entries, and a `getTerRate(brutoMonthly, category)` function that finds the matching range and returns the rate percentage.

Key ranges (implement ALL of these):
```
≤ 5,400,000: A=0%, B=0%, C=0%
5,400,001-5,650,000: A=0.25%, B=0%, C=0%
5,650,001-5,950,000: A=0.5%, B=0%, C=0%
5,950,001-6,300,000: A=0.75%, B=0.25%, C=0%
6,300,001-6,750,000: A=1%, B=0.5%, C=0.25%
6,750,001-7,500,000: A=1.5%, B=1%, C=0.5%
7,500,001-8,550,000: A=2%, B=1.5%, C=1%
8,550,001-9,650,000: A=2.5%, B=2%, C=1.5%
9,650,001-10,050,000: A=3%, B=2.5%, C=2%
10,050,001-10,350,000: A=3.5%, B=3%, C=2.5%
10,350,001-10,700,000: A=4%, B=3.5%, C=3%
10,700,001-11,050,000: A=5%, B=4%, C=3%
11,050,001-11,600,000: A=6%, B=5%, C=4%
11,600,001-12,500,000: A=7%, B=6%, C=5%
12,500,001-13,750,000: A=8%, B=7%, C=6%
13,750,001-15,100,000: A=9%, B=8%, C=7%
15,100,001-16,950,000: A=10%, B=9%, C=8%
16,950,001-19,750,000: A=11%, B=10%, C=9%
19,750,001-24,150,000: A=12%, B=11%, C=10%
24,150,001-26,450,000: A=13%, B=12%, C=11%
26,450,001-28,000,000: A=14%, B=13%, C=12%
28,000,001-30,050,000: A=15%, B=14%, C=13%
30,050,001-32,400,000: A=16%, B=15%, C=14%
32,400,001-35,400,000: A=17%, B=16%, C=15%
35,400,001-39,100,000: A=18%, B=17%, C=16%
39,100,001-43,850,000: A=19%, B=18%, C=17%
43,850,001-47,800,000: A=20%, B=19%, C=18%
47,800,001-54,800,000: A=21%, B=20%, C=19%
54,800,001-62,800,000: A=22%, B=21%, C=20%
62,800,001-73,100,000: A=23%, B=22%, C=21%
73,100,001-86,000,000: A=24%, B=23%, C=22%
86,000,001-100,000,000: A=25%, B=24%, C=23%
100,000,001-134,000,000: A=26%, B=25%, C=24%
134,000,001-185,000,000: A=27%, B=26%, C=25%
185,000,001-244,000,000: A=28%, B=27%, C=26%
244,000,001-306,000,000: A=29%, B=28%, C=27%
306,000,001-395,000,000: A=30%, B=29%, C=28%
395,000,001-563,000,000: A=31%, B=30%, C=29%
563,000,001-709,000,000: A=32%, B=31%, C=30%
709,000,001-965,000,000: A=33%, B=32%, C=31%
965,000,001-1,419,000,000: A=34%, B=33%, C=32%
>1,419,000,000: A=34%, B=34%, C=34%
```

Export: `calculatePph21Ter(brutoMonthly: number, ptkpStatus: PtkpStatus): number`

- [ ] **Step 3: Create `lib/payroll/pph21-progressive.ts`**

Progressive PPh 21 calculation (Pasal 17):

```typescript
import type { PtkpStatus } from "@prisma/client";
import { getPtkpValue } from "./ptkp-values";

const PROGRESSIVE_BRACKETS = [
  { limit: 60_000_000, rate: 0.05 },
  { limit: 250_000_000, rate: 0.15 },
  { limit: 500_000_000, rate: 0.25 },
  { limit: 5_000_000_000, rate: 0.30 },
  { limit: Infinity, rate: 0.35 },
];

export function calculatePph21Progressive(
  brutoMonthly: number,
  ptkpStatus: PtkpStatus,
  jhtEmployeeMonthly: number,
  jpEmployeeMonthly: number,
): number {
  const brutoAnnual = brutoMonthly * 12;
  const biayaJabatan = Math.min(brutoAnnual * 0.05, 6_000_000);
  const iuranTahunan = (jhtEmployeeMonthly + jpEmployeeMonthly) * 12;
  const netoAnnual = brutoAnnual - biayaJabatan - iuranTahunan;
  const ptkp = getPtkpValue(ptkpStatus);
  const pkp = Math.max(0, netoAnnual - ptkp);

  let taxAnnual = 0;
  let remaining = pkp;
  let prevLimit = 0;

  for (const bracket of PROGRESSIVE_BRACKETS) {
    const taxable = Math.min(remaining, bracket.limit - prevLimit);
    if (taxable <= 0) break;
    taxAnnual += taxable * bracket.rate;
    remaining -= taxable;
    prevLimit = bracket.limit;
  }

  return Math.round(taxAnnual / 12);
}
```

- [ ] **Step 4: Create `lib/payroll/bpjs-calculator.ts`**

```typescript
interface BpjsRates {
  bpjsKesCompanyRate: number;
  bpjsKesEmployeeRate: number;
  bpjsKesMaxSalary: number;
  jhtCompanyRate: number;
  jhtEmployeeRate: number;
  jkkRate: number;
  jkmRate: number;
  jpCompanyRate: number;
  jpEmployeeRate: number;
  jpMaxSalary: number;
}

interface BpjsResult {
  bpjsKesCompany: number;
  bpjsKesEmployee: number;
  jhtCompany: number;
  jhtEmployee: number;
  jkkAmount: number;
  jkmAmount: number;
  jpCompany: number;
  jpEmployee: number;
}

export function calculateBpjs(gajiPokok: number, rates: BpjsRates): BpjsResult {
  const kesBase = Math.min(gajiPokok, rates.bpjsKesMaxSalary);
  const jpBase = Math.min(gajiPokok, rates.jpMaxSalary);

  return {
    bpjsKesCompany: Math.round(kesBase * rates.bpjsKesCompanyRate / 100),
    bpjsKesEmployee: Math.round(kesBase * rates.bpjsKesEmployeeRate / 100),
    jhtCompany: Math.round(gajiPokok * rates.jhtCompanyRate / 100),
    jhtEmployee: Math.round(gajiPokok * rates.jhtEmployeeRate / 100),
    jkkAmount: Math.round(gajiPokok * rates.jkkRate / 100),
    jkmAmount: Math.round(gajiPokok * rates.jkmRate / 100),
    jpCompany: Math.round(jpBase * rates.jpCompanyRate / 100),
    jpEmployee: Math.round(jpBase * rates.jpEmployeeRate / 100),
  };
}
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 3: Payroll Generator + Validations + Queries

**Files:**
- Create: `lib/payroll/payroll-generator.ts`
- Create: `lib/validations/salaryComponent.ts`, `employeeSalary.ts`, `payrollPeriod.ts`, `payrollSettings.ts`
- Create: `lib/queries/salaryComponents.ts`, `employeeSalaries.ts`, `payrollPeriods.ts`, `payslips.ts`, `payrollSettings.ts`

- [ ] **Step 1: Create `lib/payroll/payroll-generator.ts`**

The main orchestrator. Exports `generatePayrollForPeriod(month, year, generatedBy)` which:
1. Checks/creates PayrollPeriod
2. Gets all active employees with salary, attendance, department, position data
3. For each employee: calculates earnings, BPJS, PPh 21, deductions, net
4. Creates Payslip + PayslipItems atomically
5. Updates period totals

This is the most complex file (~200 lines). It imports from bpjs-calculator, pph21-ter-rates, pph21-progressive, ptkp-values. Uses `db.$transaction([...])` array form.

The implementer should read the spec Section 3.1 for the exact generation flow and implement it faithfully.

- [ ] **Step 2: Create 4 validation schema files**

`lib/validations/salaryComponent.ts`: createSalaryComponentSchema (name, code, type enum, category enum, isFixed, isTaxable), updateSalaryComponentSchema (partial)

`lib/validations/employeeSalary.ts`: setEmployeeSalarySchema (profileId, salaryComponentId, amount as number, effectiveDate, endDate?), bulkSetEmployeeSalarySchema (profileIds array, salaryComponentId, amount, effectiveDate, endDate?)

`lib/validations/payrollPeriod.ts`: generatePayrollSchema (month 1-12, year 2020-2100)

`lib/validations/payrollSettings.ts`: updatePayrollSettingsSchema (pph21Method enum, all BPJS rates, absence/late deduction amounts)

- [ ] **Step 3: Create 5 query files**

Follow existing patterns. Each file has a main query function + exported type.

`lib/queries/salaryComponents.ts`: getSalaryComponents() — all active, getAllSalaryComponents() — all including inactive with _count

`lib/queries/employeeSalaries.ts`: getEmployeeSalaries(params: { profileId?, salaryComponentId? }) — with profile + component select

`lib/queries/payrollPeriods.ts`: getPayrollPeriods() — ordered by year desc, month desc. getPayrollPeriodById(id) — includes payslips with profile info

`lib/queries/payslips.ts`: getMyPayslips(profileId) — finalized/paid only. getPayslipById(id) — includes items

`lib/queries/payrollSettings.ts`: getPayrollSettings() — findFirst (singleton)

- [ ] **Step 4: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 4: Server Actions

**Files:**
- Create: `actions/salaryComponent.ts`
- Create: `actions/employeeSalary.ts`
- Create: `actions/payroll.ts`
- Create: `actions/payrollSettings.ts`

Follow existing action patterns (requirePermission → rateLimiter → Zod → DB → audit → revalidate).

- [ ] **Step 1: Create `actions/salaryComponent.ts`**

CRUD with `hr-payroll:create/edit/delete`. Delete blocked if isSystemType. Revalidate "salary-components".

- [ ] **Step 2: Create `actions/employeeSalary.ts`**

`setEmployeeSalary(data)` — hr-payroll:edit. Creates or updates EmployeeSalary for (profileId, componentId, effectiveDate).
`bulkSetEmployeeSalary(data)` — hr-payroll:edit. Uses db.$transaction for multiple employees.
`deleteEmployeeSalary(id)` — hr-payroll:edit.
Revalidate "employee-salaries".

- [ ] **Step 3: Create `actions/payroll.ts`**

`generatePayroll(data)` — hr-payroll:create. Validates with generatePayrollSchema. Calls payroll-generator.ts `generatePayrollForPeriod()`. Revalidate "payroll-periods".
`finalizePayroll(periodId)` — hr-payroll:finalize. Updates period + all payslips to finalized. Audit log.
`markPayrollPaid(periodId)` — hr-payroll:finalize. Updates status to paid + paidAt.
`deletePayrollPeriod(periodId)` — hr-payroll:delete. Only draft periods. Deletes period + cascade deletes payslips/items.

- [ ] **Step 4: Create `actions/payrollSettings.ts`**

`updatePayrollSettings(data)` — hr-payroll:edit. Upsert singleton. Revalidate "payroll-settings".

- [ ] **Step 5: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 5: API Routes + Services + Hooks + Route Meta

**Files:**
- Create: 8 API route files, 5 service files, 5 hook files
- Modify: `lib/route-meta.ts`

All follow established patterns.

- [ ] **Step 1: Create 8 API routes**

- `app/api/hr/salary-components/route.ts` — GET, hr-payroll:view
- `app/api/hr/employee-salaries/route.ts` — GET, hr-payroll:view, params: profileId, salaryComponentId
- `app/api/hr/payroll-periods/route.ts` — GET, hr-payroll:view
- `app/api/hr/payroll-periods/[id]/route.ts` — GET, hr-payroll:view, returns period detail with payslips
- `app/api/hr/payslips/my/route.ts` — GET, auth only, returns finalized/paid slips for current user
- `app/api/hr/payslips/[id]/route.ts` — GET, hr-payroll:view OR own slip, includes items
- `app/api/hr/payslips/[id]/pdf/route.ts` — GET, hr-payroll:view OR own, redirects to pdfUrl or generates on-demand
- `app/api/hr/payroll-settings/route.ts` — GET, hr-payroll:view

- [ ] **Step 2: Create 5 services** (kebab-case)

- `services/salary-component-service.ts` — fetchSalaryComponents()
- `services/employee-salary-service.ts` — fetchEmployeeSalaries(params?)
- `services/payroll-period-service.ts` — fetchPayrollPeriods(), fetchPayrollPeriodById(id)
- `services/payslip-service.ts` — fetchMyPayslips(), fetchPayslipById(id)
- `services/payroll-settings-service.ts` — fetchPayrollSettings()

- [ ] **Step 3: Create 5 hooks** (kebab-case)

- `hooks/use-salary-components.ts` — useQuery + CRUD mutations
- `hooks/use-employee-salaries.ts` — useQuery + set/bulk/delete mutations
- `hooks/use-payroll-periods.ts` — useQuery (list + detail) + generate/finalize/paid/delete mutations
- `hooks/use-payslips.ts` — useQuery (my + detail)
- `hooks/use-payroll-settings.ts` — useQuery + update mutation

- [ ] **Step 4: Add route meta entries**

```typescript
"/dashboard/hr/penggajian-perpajakan": {
  title: "Penggajian & Perpajakan",
  subtitle: "Kelola payroll dan perpajakan karyawan",
  parent: "/dashboard/hr",
},
"/dashboard/hr/slip-gaji": {
  title: "Slip Gaji",
  subtitle: "Lihat slip gaji bulanan",
  parent: "/dashboard/hr",
},
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 6: UI — Admin Penggajian Page

**Files:**
- Create: `app/(private)/dashboard/hr/penggajian-perpajakan/page.tsx`
- Create: 7 component files under `_components/`

- [ ] **Step 1: Create page.tsx + PayrollManagement.tsx**

Server page with `requirePagePermission("hr-payroll")`. Client tab wrapper with 4 tabs: Periode, Komponen Gaji, Gaji Karyawan, Pengaturan.

- [ ] **Step 2: Create `PayrollPeriodTable.tsx`**

Table of periods: Bulan/Tahun, Status badge (draft=secondary, finalized=default, paid=outline), Karyawan, Total Bruto, Total Netto, Actions (View, Finalize, Mark Paid, Delete).
"Generate Payroll" button opens GeneratePayrollDialog.
Click "View" opens PayrollPeriodDetail drawer.

- [ ] **Step 3: Create `GeneratePayrollDialog.tsx`**

Dialog: month Select (1-12, Indonesian month names), year Input, Generate button. Uses `useGeneratePayroll()` mutation. Shows loading during generation. Toast result.

- [ ] **Step 4: Create `PayrollPeriodDetail.tsx`**

Full-width Drawer showing period detail. Header with period info + status. Table of payslips: Karyawan, Gaji Pokok, Earnings, BPJS, PPh 21, Deductions, Net. Finalize/Mark Paid buttons at bottom. Export CSV button.

- [ ] **Step 5: Create `SalaryComponentManager.tsx`**

CRUD table: Name, Code, Type badge, Category badge, Taxable, Fixed, System, Actions. Add/Edit dialog. System types can't be deleted.

- [ ] **Step 6: Create `EmployeeSalaryManager.tsx`**

Table showing employees and their salary component values. Each row: Karyawan, Departemen, then columns for each active salary component (showing amount or "-"). Click row → dialog to set all component values for that employee. "Bulk Set" button.

- [ ] **Step 7: Create `PayrollSettingsPanel.tsx`**

Form: PPh 21 method Select (TER/Progresif), BPJS rates section (all editable), Absence/Late deduction amounts. Save button.

- [ ] **Step 8: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 7: UI — Employee Slip Gaji Page

**Files:**
- Create: `app/(private)/dashboard/hr/slip-gaji/page.tsx`
- Create: `app/(private)/dashboard/hr/slip-gaji/_components/PayslipViewer.tsx`
- Create: `app/(private)/dashboard/hr/slip-gaji/_components/PayslipCard.tsx`

- [ ] **Step 1: Create page.tsx**

```tsx
import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { PayslipViewer } from "./_components/PayslipViewer";

export const metadata: Metadata = {
  title: "Slip Gaji - SWASANA",
  description: "Lihat slip gaji bulanan",
};

export default async function SlipGajiPage() {
  await requirePagePermission("hr");
  return (
    <div className="flex flex-col gap-6 w-full mb-6">
      <PayslipViewer />
    </div>
  );
}
```

- [ ] **Step 2: Create `PayslipViewer.tsx`**

Client component. Period selector (month/year dropdown, defaults to latest available). Uses `useMyPayslips()` to get list, then `usePayslipDetail(selectedId)` for the selected slip. Renders PayslipCard when a slip is selected. Empty state when no slips available.

- [ ] **Step 3: Create `PayslipCard.tsx`**

The actual payslip display. Props: `{ payslip: PayslipDetail }`.

Layout (Bank Jago style card):
- **Header**: employee name, number, department, position, period (month/year)
- **Pendapatan Section**: list of earning items (name + amount), subtotal
- **Potongan Section**: BPJS employee items, PPh 21, absence/late deductions, other deduction items, subtotal
- **Ringkasan Kehadiran**: work days, present, absent, late, leave (small info grid)
- **Summary**: Total Pendapatan, Total Potongan, **Gaji Bersih** (large, bold, font-heading)
- "Download PDF" button → opens payslip PDF URL in new tab

Format all amounts with `toLocaleString("id-ID")` for Indonesian number formatting (1.000.000).

- [ ] **Step 4: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 8: PDF Generation

**Files:**
- Create: `lib/payroll/pdf-generator.ts`

- [ ] **Step 1: Create PDF generator**

Use a simple server-side approach. Since `@react-pdf/renderer` can have bundle issues in Next.js serverless, use a simpler approach:

Generate HTML string → convert to PDF using the browser's print-to-PDF capabilities. Or, for the MVP, just generate a well-formatted HTML response from the `/api/hr/payslips/[id]/pdf` endpoint that the browser can print.

Simpler approach: The PDF endpoint returns a formatted HTML page with `Content-Type: text/html` and a `<style>` tag for print layout. The user clicks "Download PDF" → browser opens the HTML → user prints to PDF. This avoids any PDF library dependency.

If a proper PDF is needed later, install `@react-pdf/renderer` and render React components to PDF buffer.

For the MVP, the `pdf-generator.ts` exports a `generatePayslipHtml(payslip)` function that returns an HTML string formatted for printing.

- [ ] **Step 2: Update `/api/hr/payslips/[id]/pdf/route.ts`**

The endpoint renders the payslip as a print-ready HTML page. If `payslip.pdfUrl` exists, redirect to it. Otherwise, generate HTML on-the-fly.

- [ ] **Step 3: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 9: Final Verification

- [ ] **Step 1: TypeScript** — `npx tsc --noEmit --skipLibCheck`
- [ ] **Step 2: ESLint** — `npx eslint "app/(private)/dashboard/hr/penggajian-perpajakan/**/*.tsx" "app/(private)/dashboard/hr/slip-gaji/**/*.tsx" "lib/payroll/**/*.ts" "actions/payroll*.ts" "actions/salary*.ts" "actions/employee*.ts" --max-warnings 100`
- [ ] **Step 3: Build** — `npm run build`
- [ ] **Step 4: Manual testing checklist**

1. `/dashboard/hr/penggajian-perpajakan` — tabs render
2. Komponen Gaji tab — create custom component, edit, delete
3. Gaji Karyawan tab — set salary for employee, bulk set
4. Pengaturan tab — change PPh 21 method, BPJS rates
5. Generate Payroll — select month/year, generate
6. View period detail — payslips listed with calculations
7. Finalize period
8. Mark as paid
9. `/dashboard/hr/slip-gaji` — employee sees finalized slip
10. Payslip card shows correct earnings, deductions, BPJS, PPh 21, net
11. Download PDF link works
