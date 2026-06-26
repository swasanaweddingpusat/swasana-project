# Rekrutmen & Onboarding — Design Spec

**Date:** 2026-06-22
**Module:** HR & Payroll — Recruitment & Onboarding
**Status:** Approved
**Prerequisite:** Database Karyawan — complete (for Department, Position, createEmployee flow)

---

## 1. Overview

Recruitment pipeline with Kanban board for managing candidates through hiring stages (Applied → Screening → Interview → Assessment → Offering → Hired), plus onboarding checklist system with reusable templates that auto-assign to newly hired employees.

### Key Features

- Job posting management with department/position linkage
- Candidate tracking with resume upload (R2), rating, and notes
- Kanban pipeline with drag-drop between stages
- Auto-create employee account when candidate is hired (reuses invite/createEmployee flow)
- Onboarding template system with task checklists
- Auto-assign onboarding template when candidate is hired
- Progress tracking for onboarding tasks (employee, HR, and manager tasks)

---

## 2. Data Model

### 2.1 JobPostingStatus (New Enum)

```prisma
enum JobPostingStatus {
  draft
  open
  closed
}
```

### 2.2 CandidateStage (New Enum)

```prisma
enum CandidateStage {
  applied
  screening
  interview
  assessment
  offering
  hired
  rejected
}
```

### 2.3 OnboardingAssignTo (New Enum)

```prisma
enum OnboardingAssignTo {
  employee
  hr
  manager
}
```

### 2.4 OnboardingStatus (New Enum)

```prisma
enum OnboardingStatus {
  in_progress
  completed
}
```

### 2.5 JobPosting (New)

```prisma
model JobPosting {
  id              String           @id @default(uuid())
  title           String
  departmentId    String?
  positionId      String?
  description     String?
  requirements    String?
  employmentType  EmploymentType?
  location        String?
  salaryRangeMin  Decimal?         @db.Decimal(15, 2)
  salaryRangeMax  Decimal?         @db.Decimal(15, 2)
  status          JobPostingStatus @default(draft)
  openDate        DateTime?
  closeDate       DateTime?
  createdBy       String?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  department      Department?      @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  position        Position?        @relation(fields: [positionId], references: [id], onDelete: SetNull)
  creator         Profile?         @relation("JobPostingCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  candidates      Candidate[]

  @@index([departmentId])
  @@index([status])
  @@map("job_postings")
}
```

Reuses existing `EmploymentType` enum (permanent, contract, probation, intern) from the Database Karyawan module.

### 2.6 Candidate (New)

```prisma
model Candidate {
  id              String         @id @default(uuid())
  jobPostingId    String
  fullName        String
  email           String
  phoneNumber     String?
  resumeUrl       String?
  coverLetterUrl  String?
  stage           CandidateStage @default(applied)
  rating          Int?
  notes           String?
  rejectionReason String?
  hiredAt         DateTime?
  hiredProfileId  String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  jobPosting      JobPosting     @relation(fields: [jobPostingId], references: [id], onDelete: Cascade)
  hiredProfile    Profile?       @relation("HiredCandidate", fields: [hiredProfileId], references: [id], onDelete: SetNull)
  candidateNotes  CandidateNote[]

  @@index([jobPostingId])
  @@index([stage])
  @@index([hiredProfileId])
  @@map("candidates")
}
```

### 2.7 CandidateNote (New)

```prisma
model CandidateNote {
  id          String   @id @default(uuid())
  candidateId String
  content     String
  createdBy   String?
  createdAt   DateTime @default(now())

  candidate   Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  creator     Profile?  @relation("CandidateNoteCreator", fields: [createdBy], references: [id], onDelete: SetNull)

  @@index([candidateId])
  @@map("candidate_notes")
}
```

### 2.8 OnboardingTemplate (New)

```prisma
model OnboardingTemplate {
  id          String    @id @default(uuid())
  name        String    @unique
  description String?
  isActive    Boolean   @default(true)
  isDefault   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  tasks       OnboardingTemplateTask[]
  assignments OnboardingAssignment[]

  @@map("onboarding_templates")
}
```

### 2.9 OnboardingTemplateTask (New)

```prisma
model OnboardingTemplateTask {
  id          String            @id @default(uuid())
  templateId  String
  title       String
  description String?
  dueInDays   Int               @default(1)
  assignTo    OnboardingAssignTo @default(employee)
  sortOrder   Int               @default(0)
  createdAt   DateTime          @default(now())

  template    OnboardingTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  tasks       OnboardingTask[]

  @@index([templateId])
  @@map("onboarding_template_tasks")
}
```

### 2.10 OnboardingAssignment (New)

```prisma
model OnboardingAssignment {
  id          String           @id @default(uuid())
  profileId   String
  templateId  String
  startDate   DateTime
  status      OnboardingStatus @default(in_progress)
  completedAt DateTime?
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  profile     Profile          @relation(fields: [profileId], references: [id], onDelete: Cascade)
  template    OnboardingTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  tasks       OnboardingTask[]

  @@unique([profileId, templateId])
  @@index([profileId])
  @@index([status])
  @@map("onboarding_assignments")
}
```

### 2.11 OnboardingTask (New)

```prisma
model OnboardingTask {
  id              String                  @id @default(uuid())
  assignmentId    String
  templateTaskId  String?
  title           String
  description     String?
  dueDate         DateTime?
  assignTo        OnboardingAssignTo      @default(employee)
  isCompleted     Boolean                 @default(false)
  completedAt     DateTime?
  completedBy     String?
  sortOrder       Int                     @default(0)
  createdAt       DateTime                @default(now())

  assignment      OnboardingAssignment    @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  templateTask    OnboardingTemplateTask? @relation(fields: [templateTaskId], references: [id], onDelete: SetNull)
  completer       Profile?                @relation("OnboardingTaskCompleter", fields: [completedBy], references: [id], onDelete: SetNull)

  @@index([assignmentId])
  @@map("onboarding_tasks")
}
```

### 2.12 Profile Model Changes

Add reverse relations:
```prisma
  jobPostingsCreated     JobPosting[]          @relation("JobPostingCreator")
  hiredFromCandidate     Candidate[]           @relation("HiredCandidate")
  candidateNotesCreated  CandidateNote[]       @relation("CandidateNoteCreator")
  onboardingAssignments  OnboardingAssignment[]
  onboardingTasksCompleted OnboardingTask[]    @relation("OnboardingTaskCompleter")
```

### 2.13 Department & Position Model Changes

Add reverse relations:
```prisma
// Department
  jobPostings   JobPosting[]

// Position
  jobPostings   JobPosting[]
```

---

## 3. Recruitment Flow

### 3.1 Job Posting Lifecycle

1. HR creates job posting with title, department, position, description, requirements, employment type, salary range
2. Status starts as `draft`
3. HR publishes → status = `open`, openDate = now
4. HR closes posting → status = `closed`, closeDate = now
5. Closed postings can be reopened

### 3.2 Candidate Pipeline

1. HR adds candidate to a job posting: name, email, phone, resume upload (R2)
2. Candidate starts at `applied` stage
3. HR moves candidate through stages via Kanban drag-drop or action button:
   - applied → screening → interview → assessment → offering → hired
4. At any point, candidate can be moved to `rejected` with a reason
5. HR can add notes at any stage (interview feedback, assessment results, etc.)
6. HR can rate candidates (1-5 stars)

### 3.3 Hire Flow

When candidate is moved to `hired` stage:

1. System validates candidate email is not already registered
2. Creates User + Profile using the same mechanism as `createEmployee` action:
   - User with temp password + email verification token
   - Profile with data from candidate (fullName, email, phoneNumber)
   - Profile linked to the job posting's department and position
   - Employment type from job posting
   - joinDate = today
3. Links `Candidate.hiredProfileId` to the new Profile
4. Sets `Candidate.hiredAt = now`
5. Sends invitation email
6. Auto-assigns default onboarding template (if one exists)
7. Audit log

---

## 4. Onboarding Flow

### 4.1 Template Management

1. Admin creates onboarding templates with tasks
2. Each task has: title, description, dueInDays (offset from hire date), assignTo (employee/hr/manager)
3. One template can be marked as `isDefault` — auto-assigned on hire

### 4.2 Assignment

When a candidate is hired (or manually by HR):
1. Create `OnboardingAssignment` linked to new employee's Profile
2. For each template task, create an `OnboardingTask` instance:
   - Copy title, description, assignTo from template task
   - Calculate `dueDate = startDate + dueInDays`
3. Status = `in_progress`

### 4.3 Task Completion

- Employee sees their onboarding tasks in the UI
- HR and managers see tasks assigned to them
- Mark task as completed → `isCompleted = true`, `completedAt = now`, `completedBy = profileId`
- When all tasks completed → `OnboardingAssignment.status = completed`, `completedAt = now`

---

## 5. API Layer

### 5.1 API Routes

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/hr/job-postings` | `hr-recruitment:view` | List job postings |
| GET | `/api/hr/job-postings/[id]` | `hr-recruitment:view` | Posting detail with candidates |
| GET | `/api/hr/candidates` | `hr-recruitment:view` | List candidates (filtered) |
| GET | `/api/hr/onboarding-templates` | `hr-recruitment:view` | List templates |
| GET | `/api/hr/onboarding-assignments` | `hr-recruitment:view` | List onboarding progress |
| GET | `/api/hr/onboarding-assignments/my` | authenticated | My onboarding tasks |

### 5.2 Server Actions

| Action | Permission | Description |
|---|---|---|
| `createJobPosting` | `hr-recruitment:create` | Create posting |
| `updateJobPosting` | `hr-recruitment:edit` | Update posting |
| `deleteJobPosting` | `hr-recruitment:delete` | Delete (blocked if has candidates) |
| `publishJobPosting` | `hr-recruitment:edit` | Set status to open |
| `closeJobPosting` | `hr-recruitment:edit` | Set status to closed |
| `addCandidate` | `hr-recruitment:create` | Add candidate to posting |
| `updateCandidate` | `hr-recruitment:edit` | Update candidate info |
| `moveCandidateStage` | `hr-recruitment:edit` | Move candidate to new stage |
| `hireCandidate` | `hr-recruitment:hire` | Hire + create employee account |
| `rejectCandidate` | `hr-recruitment:edit` | Reject with reason |
| `addCandidateNote` | `hr-recruitment:edit` | Add note to candidate |
| `rateCandidate` | `hr-recruitment:edit` | Set rating |
| `createOnboardingTemplate` | `hr-recruitment:create` | Create template |
| `updateOnboardingTemplate` | `hr-recruitment:edit` | Update template |
| `deleteOnboardingTemplate` | `hr-recruitment:delete` | Delete template |
| `addOnboardingTemplateTask` | `hr-recruitment:create` | Add task to template |
| `updateOnboardingTemplateTask` | `hr-recruitment:edit` | Update task |
| `deleteOnboardingTemplateTask` | `hr-recruitment:delete` | Delete task |
| `assignOnboarding` | `hr-recruitment:edit` | Manually assign template to employee |
| `completeOnboardingTask` | authenticated | Mark task as done |

---

## 6. UI Pages

### 6.1 Admin — `/dashboard/hr/rekrutmen-onboarding`

**Tab Lowongan:**
- Table: Title, Department, Position, Status badge (draft=secondary, open=default, closed=outline), Kandidat count, Created, Actions
- "Tambah Lowongan" button → dialog with all posting fields
- Row actions: Edit, Publish/Close, Delete, "Lihat Pipeline"
- Click "Lihat Pipeline" → switches to Pipeline tab filtered to that posting

**Tab Pipeline:**
- Job posting selector at top (Select dropdown)
- Kanban board with 6 columns: Applied, Screening, Interview, Assessment, Offering, Hired
- Each card: candidate name, rating stars, date applied
- Drag-drop between columns (use state-based reorder, no library needed)
- Click card → candidate detail drawer:
  - Info section: name, email, phone, resume link
  - Stage selector (Select to move)
  - Rating (clickable stars)
  - Notes section: list of notes + add note form
  - "Hire" button (only on Offering stage)
  - "Reject" button with reason dialog
- Rejected candidates shown in collapsed section below the board

**Tab Onboarding Template:**
- Table: Name, Description, Default badge, Task Count, Actions
- "Tambah Template" button
- Click row → template detail with sortable task list
- Task CRUD: title, description, dueInDays, assignTo (Select)
- Toggle default template

**Tab Onboarding Progress:**
- Table: Karyawan, Template, Progress bar (completed/total), Start Date, Status badge, Actions
- Click row → checklist view showing all tasks with completion status
- Filter: status (in_progress/completed)

### 6.2 Employee View

New employees see their onboarding tasks at `/dashboard/hr/rekrutmen-onboarding` (filtered to own assignment). Shows:
- Progress bar (completed/total)
- Task checklist with mark-complete buttons for tasks assigned to `employee`
- Due dates with overdue highlighting

---

## 7. Validation Schemas

### `lib/validations/jobPosting.ts`
- `createJobPostingSchema`: title (required), departmentId?, positionId?, description?, requirements?, employmentType?, location?, salaryRangeMin?, salaryRangeMax?, status?
- `updateJobPostingSchema`: partial of create

### `lib/validations/candidate.ts`
- `addCandidateSchema`: jobPostingId, fullName, email, phoneNumber?, stage?
- `moveCandidateStageSchema`: candidateId, stage (enum)
- `rejectCandidateSchema`: candidateId, reason
- `rateCandidateSchema`: candidateId, rating (1-5)
- `addCandidateNoteSchema`: candidateId, content

### `lib/validations/onboarding.ts`
- `createOnboardingTemplateSchema`: name, description?
- `addOnboardingTemplateTaskSchema`: templateId, title, description?, dueInDays, assignTo
- `assignOnboardingSchema`: profileId, templateId

---

## 8. Permissions (Seed via Migration)

```sql
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'hr-recruitment', 'view', 'View job postings, candidates, onboarding', 25),
  (gen_random_uuid()::text, 'hr-recruitment', 'create', 'Create postings, add candidates, templates', 25),
  (gen_random_uuid()::text, 'hr-recruitment', 'edit', 'Edit postings, move candidates, manage pipeline', 25),
  (gen_random_uuid()::text, 'hr-recruitment', 'delete', 'Delete postings, candidates, templates', 25),
  (gen_random_uuid()::text, 'hr-recruitment', 'hire', 'Hire candidates (creates employee account)', 25)
ON CONFLICT (module, action) DO NOTHING;
```

---

## 9. File Structure

```
prisma/migrations/20260622180000_add_recruitment_onboarding/migration.sql

lib/validations/jobPosting.ts
lib/validations/candidate.ts
lib/validations/onboarding.ts

lib/queries/jobPostings.ts
lib/queries/candidates.ts
lib/queries/onboarding.ts

actions/jobPosting.ts
actions/candidate.ts
actions/onboarding.ts

services/job-posting-service.ts
services/candidate-service.ts
services/onboarding-service.ts

hooks/use-job-postings.ts
hooks/use-candidates.ts
hooks/use-onboarding.ts

app/api/hr/job-postings/route.ts
app/api/hr/job-postings/[id]/route.ts
app/api/hr/candidates/route.ts
app/api/hr/onboarding-templates/route.ts
app/api/hr/onboarding-assignments/route.ts
app/api/hr/onboarding-assignments/my/route.ts

app/(private)/dashboard/hr/rekrutmen-onboarding/page.tsx
app/(private)/dashboard/hr/rekrutmen-onboarding/_components/RecruitmentManagement.tsx
app/(private)/dashboard/hr/rekrutmen-onboarding/_components/JobPostingTable.tsx
app/(private)/dashboard/hr/rekrutmen-onboarding/_components/JobPostingDialog.tsx
app/(private)/dashboard/hr/rekrutmen-onboarding/_components/CandidatePipeline.tsx
app/(private)/dashboard/hr/rekrutmen-onboarding/_components/CandidateCard.tsx
app/(private)/dashboard/hr/rekrutmen-onboarding/_components/CandidateDetailDrawer.tsx
app/(private)/dashboard/hr/rekrutmen-onboarding/_components/OnboardingTemplateManager.tsx
app/(private)/dashboard/hr/rekrutmen-onboarding/_components/OnboardingProgressTable.tsx
app/(private)/dashboard/hr/rekrutmen-onboarding/_components/OnboardingChecklist.tsx
```

---

## 10. Key Design Decisions

1. **Fixed pipeline stages** — Using an enum rather than configurable stages per posting. Simpler, consistent, and covers the standard hiring flow. Custom stages can be added later by converting to a model.

2. **Candidate scoped to JobPosting** — Each candidate belongs to one posting. If the same person applies to multiple jobs, they're separate candidate records. This keeps the pipeline clean per posting.

3. **Hire → createEmployee reuse** — The hire action reuses the existing employee creation flow (User + Profile + email verification), avoiding code duplication. The candidate's data prefills the employee profile.

4. **Onboarding template system** — Templates are reusable across hires. Tasks are instantiated per employee, allowing individual tracking. The `dueInDays` offset system auto-calculates due dates from the hire date.

5. **Drag-drop without library** — The Kanban board uses React state-based stage changes (click to move or select new stage) rather than requiring a drag-drop library. Simpler implementation, works on mobile.

6. **Notes as separate model** — Rather than a single notes field on Candidate, CandidateNote supports multiple entries from different users, creating an audit trail of interview feedback and observations.
