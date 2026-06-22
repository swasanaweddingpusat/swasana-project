# Rekrutmen & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a recruitment pipeline with Kanban board (Applied → Screening → Interview → Assessment → Offering → Hired), candidate management with notes/rating, auto-create employee on hire, plus onboarding checklist template system with auto-assignment and progress tracking.

**Architecture:** 7 new Prisma models (JobPosting, Candidate, CandidateNote, OnboardingTemplate, OnboardingTemplateTask, OnboardingAssignment, OnboardingTask) + 4 enums. Hire action reuses existing createEmployee flow. Single admin page `/dashboard/hr/rekrutmen-onboarding` with 4 tabs (Lowongan, Pipeline, Onboarding Template, Onboarding Progress). Employee onboarding view on same page filtered by permission.

**Tech Stack:** Next.js 16, Prisma 7 (Neon HTTP), Zod v4, TanStack Query v5, shadcn v4 + Tailwind v4, Solar Icons BoldDuotone, R2 for resume uploads.

**Spec:** `docs/superpowers/specs/2026-06-22-rekrutmen-onboarding-design.md`

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `prisma/migrations/20260622180000_add_recruitment_onboarding/migration.sql` | Schema + seeds |
| `lib/validations/jobPosting.ts` | Zod schemas |
| `lib/validations/candidate.ts` | Zod schemas |
| `lib/validations/onboarding.ts` | Zod schemas |
| `lib/queries/jobPostings.ts` | Query functions |
| `lib/queries/candidates.ts` | Query functions |
| `lib/queries/onboarding.ts` | Query functions |
| `actions/jobPosting.ts` | CRUD + publish/close |
| `actions/candidate.ts` | Add, move stage, hire, reject, note, rate |
| `actions/onboarding.ts` | Template CRUD, assign, complete task |
| `services/job-posting-service.ts` | Client fetch |
| `services/candidate-service.ts` | Client fetch |
| `services/onboarding-service.ts` | Client fetch |
| `hooks/use-job-postings.ts` | TanStack Query hooks |
| `hooks/use-candidates.ts` | TanStack Query hooks |
| `hooks/use-onboarding.ts` | TanStack Query hooks |
| `app/api/hr/job-postings/route.ts` | GET list |
| `app/api/hr/job-postings/[id]/route.ts` | GET detail |
| `app/api/hr/candidates/route.ts` | GET list |
| `app/api/hr/onboarding-templates/route.ts` | GET list |
| `app/api/hr/onboarding-assignments/route.ts` | GET list |
| `app/api/hr/onboarding-assignments/my/route.ts` | GET my tasks |
| `app/(private)/dashboard/hr/rekrutmen-onboarding/page.tsx` | Server page |
| `app/(private)/dashboard/hr/rekrutmen-onboarding/_components/RecruitmentManagement.tsx` | Tab wrapper |
| `app/(private)/dashboard/hr/rekrutmen-onboarding/_components/JobPostingTable.tsx` | Posting list |
| `app/(private)/dashboard/hr/rekrutmen-onboarding/_components/JobPostingDialog.tsx` | Create/edit posting |
| `app/(private)/dashboard/hr/rekrutmen-onboarding/_components/CandidatePipeline.tsx` | Kanban board |
| `app/(private)/dashboard/hr/rekrutmen-onboarding/_components/CandidateDetailDrawer.tsx` | Candidate detail |
| `app/(private)/dashboard/hr/rekrutmen-onboarding/_components/OnboardingTemplateManager.tsx` | Template CRUD |
| `app/(private)/dashboard/hr/rekrutmen-onboarding/_components/OnboardingProgressTable.tsx` | Progress list |
| `app/(private)/dashboard/hr/rekrutmen-onboarding/_components/OnboardingChecklist.tsx` | Task checklist |

### Modified Files

| File | Changes |
|---|---|
| `prisma/schema.prisma` | Add 7 models, 4 enums, Profile/Department/Position relations |
| `lib/route-meta.ts` | Add rekrutmen-onboarding entry |

---

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260622180000_add_recruitment_onboarding/migration.sql`

- [ ] **Step 1: Add 4 enums** — `JobPostingStatus`, `CandidateStage`, `OnboardingAssignTo`, `OnboardingStatus` after existing payroll enums

- [ ] **Step 2: Add 7 models** — `JobPosting`, `Candidate`, `CandidateNote`, `OnboardingTemplate`, `OnboardingTemplateTask`, `OnboardingAssignment`, `OnboardingTask` (exact definitions from spec sections 2.5–2.11)

- [ ] **Step 3: Add Profile reverse relations** — `jobPostingsCreated`, `hiredFromCandidate`, `candidateNotesCreated`, `onboardingAssignments`, `onboardingTasksCompleted`

- [ ] **Step 4: Add Department and Position reverse relations** — `jobPostings JobPosting[]` to both models

- [ ] **Step 5: Create migration SQL** — CREATE TYPE for 4 enums, CREATE TABLE IF NOT EXISTS for 7 tables, FK constraints, indexes, seed 5 `hr-recruitment` permissions

- [ ] **Step 6: Validate + Generate** — `npx prisma validate` then `npx prisma generate`

---

### Task 2: Validations + Queries

**Files:**
- Create: `lib/validations/jobPosting.ts`, `lib/validations/candidate.ts`, `lib/validations/onboarding.ts`
- Create: `lib/queries/jobPostings.ts`, `lib/queries/candidates.ts`, `lib/queries/onboarding.ts`

- [ ] **Step 1: Create validation schemas**

`jobPosting.ts`: createJobPostingSchema (title required, departmentId?, positionId?, description?, requirements?, employmentType? enum, location?, salaryRangeMin/Max? number, status? enum), updateJobPostingSchema (partial)

`candidate.ts`: addCandidateSchema (jobPostingId, fullName, email, phoneNumber?), moveCandidateStageSchema (candidateId, stage enum), rejectCandidateSchema (candidateId, reason), rateCandidateSchema (candidateId, rating 1-5), addCandidateNoteSchema (candidateId, content)

`onboarding.ts`: createOnboardingTemplateSchema (name, description?), updateOnboardingTemplateSchema (partial), addOnboardingTemplateTaskSchema (templateId, title, description?, dueInDays int, assignTo enum), updateOnboardingTemplateTaskSchema (partial), assignOnboardingSchema (profileId, templateId)

- [ ] **Step 2: Create query functions**

`jobPostings.ts`: getJobPostings() (with candidate _count), getJobPostingById(id) (with candidates + department + position)

`candidates.ts`: getCandidates(params: { jobPostingId?, stage? }) (with jobPosting, notes, candidateNotes), getCandidateById(id) (full detail with notes)

`onboarding.ts`: getOnboardingTemplates() (with tasks + assignments _count), getOnboardingTemplateById(id) (with tasks), getOnboardingAssignments(params?) (with profile, template, tasks progress), getMyOnboardingAssignment(profileId) (with tasks)

- [ ] **Step 3: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 3: Server Actions

**Files:**
- Create: `actions/jobPosting.ts`, `actions/candidate.ts`, `actions/onboarding.ts`

- [ ] **Step 1: Create `actions/jobPosting.ts`**

- `createJobPosting(data)` — hr-recruitment:create. Clean empty FK strings to null (same pattern as department fix).
- `updateJobPosting(id, data)` — hr-recruitment:edit
- `deleteJobPosting(id)` — hr-recruitment:delete, blocked if has candidates
- `publishJobPosting(id)` — hr-recruitment:edit, sets status=open, openDate=now
- `closeJobPosting(id)` — hr-recruitment:edit, sets status=closed, closeDate=now
- Revalidate "job-postings"

- [ ] **Step 2: Create `actions/candidate.ts`**

- `addCandidate(data)` — hr-recruitment:create. Handles resume upload if FormData.
- `updateCandidate(id, data)` — hr-recruitment:edit
- `moveCandidateStage(data)` — hr-recruitment:edit. Updates stage. If stage = "hired", calls hireCandidate logic.
- `hireCandidate(candidateId)` — hr-recruitment:hire. Core hire flow:
  1. Get candidate data
  2. Check email not already registered
  3. Create User + Profile (reuse createEmployee pattern from `actions/employee.ts`): temp password, email verification token, send invite email
  4. Link Profile to job posting's departmentId/positionId
  5. Set Candidate.hiredProfileId and hiredAt
  6. Auto-assign default OnboardingTemplate if exists
  7. Audit log
- `rejectCandidate(data)` — hr-recruitment:edit. Sets stage=rejected, rejectionReason
- `addCandidateNote(data)` — hr-recruitment:edit. Creates CandidateNote
- `rateCandidate(data)` — hr-recruitment:edit. Updates Candidate.rating
- Revalidate "candidates"

- [ ] **Step 3: Create `actions/onboarding.ts`**

- `createOnboardingTemplate(data)` — hr-recruitment:create
- `updateOnboardingTemplate(id, data)` — hr-recruitment:edit. If setting isDefault=true, unset other defaults first.
- `deleteOnboardingTemplate(id)` — hr-recruitment:delete, blocked if has active assignments
- `addOnboardingTemplateTask(data)` — hr-recruitment:create
- `updateOnboardingTemplateTask(id, data)` — hr-recruitment:edit
- `deleteOnboardingTemplateTask(id)` — hr-recruitment:delete
- `assignOnboarding(data)` — hr-recruitment:edit. Creates OnboardingAssignment + OnboardingTask instances from template tasks with calculated dueDates.
- `completeOnboardingTask(taskId)` — authenticated. Marks task completed, checks if all tasks done → mark assignment completed.
- Revalidate "onboarding"

- [ ] **Step 4: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 4: API Routes + Services + Hooks + Route Meta

**Files:**
- Create: 6 API routes, 3 services, 3 hooks
- Modify: `lib/route-meta.ts`

- [ ] **Step 1: Create 6 API routes** — all GET handlers following existing patterns (auth + apiLimiter)

- `app/api/hr/job-postings/route.ts` — hr-recruitment:view, returns getJobPostings()
- `app/api/hr/job-postings/[id]/route.ts` — hr-recruitment:view, Next.js 16 async params
- `app/api/hr/candidates/route.ts` — hr-recruitment:view, query params: jobPostingId, stage
- `app/api/hr/onboarding-templates/route.ts` — hr-recruitment:view
- `app/api/hr/onboarding-assignments/route.ts` — hr-recruitment:view, query param: status
- `app/api/hr/onboarding-assignments/my/route.ts` — auth only, returns getMyOnboardingAssignment(profileId)

- [ ] **Step 2: Create 3 services** (kebab-case) — fetch wrappers

- [ ] **Step 3: Create 3 hooks** (kebab-case) — useQuery + useMutation wrappers for all actions

- [ ] **Step 4: Add route meta**

```typescript
"/dashboard/hr/rekrutmen-onboarding": {
  title: "Rekrutmen & Onboarding",
  subtitle: "Kelola lowongan, kandidat, dan onboarding",
  parent: "/dashboard/hr",
},
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 5: UI — Job Posting + Pipeline

**Files:**
- Create: `page.tsx`, `RecruitmentManagement.tsx`, `JobPostingTable.tsx`, `JobPostingDialog.tsx`, `CandidatePipeline.tsx`, `CandidateDetailDrawer.tsx`

- [ ] **Step 1: Create page.tsx** — server component with `requirePagePermission("hr-recruitment")`

- [ ] **Step 2: Create RecruitmentManagement.tsx** — "use client" tab wrapper with 4 tabs: Lowongan, Pipeline, Onboarding Template, Onboarding Progress. Show onboarding progress for employee users (via useMyOnboarding).

- [ ] **Step 3: Create JobPostingTable.tsx** — Card with table: Title, Department, Position, Status badge, Kandidat count, Actions (Edit, Publish/Close, Delete, View Pipeline). "Tambah Lowongan" button opens JobPostingDialog.

- [ ] **Step 4: Create JobPostingDialog.tsx** — Dialog with fields: title, departmentId (Select from useDepartments), positionId (Select from usePositions), description (Textarea), requirements (Textarea), employmentType (Select), location, salaryRangeMin/Max.

- [ ] **Step 5: Create CandidatePipeline.tsx** — Job posting selector at top. 6 columns for stages (Applied through Hired). Each column shows candidate cards. Click card opens CandidateDetailDrawer. "Tambah Kandidat" dialog (name, email, phone, resume upload). Stage buttons on each card to move forward/reject. Rejected section at bottom.

- [ ] **Step 6: Create CandidateDetailDrawer.tsx** — Drawer showing candidate detail: info, stage selector, rating stars (clickable), notes list + add note form, resume download link, "Hire" button (when on offering stage), "Reject" button with reason dialog.

- [ ] **Step 7: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 6: UI — Onboarding Template + Progress

**Files:**
- Create: `OnboardingTemplateManager.tsx`, `OnboardingProgressTable.tsx`, `OnboardingChecklist.tsx`

- [ ] **Step 1: Create OnboardingTemplateManager.tsx** — Card with template table: Name, Default badge, Task count, Actions. Add/Edit template dialog (name, description, isDefault toggle). Click row → task list: sortable table with CRUD (title, description, dueInDays, assignTo Select). "Tambah Task" dialog.

- [ ] **Step 2: Create OnboardingProgressTable.tsx** — Card with table: Karyawan, Template, Progress bar (completed/total tasks), Start Date, Status badge, Actions. Click row opens OnboardingChecklist. Filter by status.

- [ ] **Step 3: Create OnboardingChecklist.tsx** — Dialog/Drawer showing checklist for a specific employee. Shows: employee name, template name, progress. List of tasks: title, assignTo badge, due date, completed status (checkbox to mark done). Overdue tasks highlighted. Uses completeOnboardingTask mutation.

- [ ] **Step 4: Verify** — `npx tsc --noEmit --skipLibCheck`

---

### Task 7: Final Verification

- [ ] **Step 1: TypeScript** — `npx tsc --noEmit --skipLibCheck`
- [ ] **Step 2: ESLint** — `npx eslint "app/(private)/dashboard/hr/rekrutmen-onboarding/**/*.tsx" --max-warnings 100`
- [ ] **Step 3: Build** — `npm run build`
- [ ] **Step 4: Deploy migration** — `npx prisma migrate deploy`
- [ ] **Step 5: Manual testing checklist**

1. `/dashboard/hr/rekrutmen-onboarding` — tabs render
2. Create job posting with department/position
3. Publish posting
4. Add candidate to posting
5. Move candidate through pipeline stages
6. Add note to candidate, rate candidate
7. Hire candidate from offering stage → employee account created
8. Create onboarding template with tasks
9. Set template as default → auto-assigned on hire
10. View onboarding progress, mark tasks complete
