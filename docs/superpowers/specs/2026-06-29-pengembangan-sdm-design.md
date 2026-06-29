# Pengembangan SDM — Design Spec

**Date:** 2026-06-29
**Route:** `/dashboard/hr/pengembangan-sdm`
**Approach:** Single page, 3 tab utama (Pelatihan | Kompetensi | Pengembangan Karir), masing-masing dengan sub-tab

---

## 1. Scope & Users

| Role | Kemampuan |
|---|---|
| HR Admin | Full CRUD semua fitur: program pelatihan, framework kompetensi, siklus assessment, career path, succession plan, compile final score, approve/reject TNA & IDP |
| Karyawan | Self-service: ajukan TNA, lihat & download training history, self-assess kompetensi, buat & submit IDP + milestones, lihat career path |
| Manager | Approve/reject TNA bawahan, isi manager-score assessment kompetensi bawahan, approve/reject IDP bawahan |

---

## 2. File Structure

```
app/(private)/dashboard/hr/pengembangan-sdm/
├── page.tsx
└── _components/
    ├── PengembanganSDMClient.tsx     # Tab controller utama
    ├── TrainingTab.tsx               # Tab Pelatihan
    ├── CompetencyTab.tsx             # Tab Kompetensi
    ├── CareerTab.tsx                 # Tab Pengembangan Karir
    ├── TrainingSummaryCards.tsx
    ├── CompetencySummaryCards.tsx
    └── CareerSummaryCards.tsx

actions/pengembangan-sdm.ts
lib/queries/pengembanganSdm.ts
lib/validations/pengembanganSdm.ts
hooks/use-pengembangan-sdm.ts
```

---

## 3. Tab Structure

```
[Pelatihan]  [Kompetensi]  [Pengembangan Karir]

Pelatihan sub-tab:
  [TNA]  [Program]  [Peserta & Nilai]

Kompetensi sub-tab:
  [Framework]  [Siklus Assessment]  [Gap Analysis]

Pengembangan Karir sub-tab:
  [Career Path]  [IDP]  [Succession]
```

---

## 4. Data Model

### 4.1 Pelatihan

```prisma
model TrainingProgram {
  id              String                  @id @default(cuid())
  title           String
  description     String?
  type            String                  // "internal" | "external"
  mode            String                  // "online" | "offline" | "hybrid"
  trainer         String?
  location        String?
  startDate       DateTime?
  endDate         DateTime?
  maxParticipants Int?
  status          String                  @default("draft") // draft|published|completed|cancelled
  createdById     String
  createdBy       Profile                 @relation("TrainingCreatedBy", fields: [createdById], references: [id])
  participants    TrainingParticipant[]
  tnaRequests     TrainingNeedsAnalysis[] @relation("ScheduledProgram")
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt
}

model TrainingParticipant {
  id             String          @id @default(cuid())
  programId      String
  program        TrainingProgram @relation(fields: [programId], references: [id])
  profileId      String
  profile        Profile         @relation("TrainingParticipants", fields: [profileId], references: [id])
  status         String          @default("registered") // registered|attended|absent|passed|failed
  score          Decimal?
  certificateUrl String?
  completedAt    DateTime?
  createdAt      DateTime        @default(now())

  @@unique([programId, profileId])
}

model TrainingNeedsAnalysis {
  id                 String           @id @default(cuid())
  profileId          String
  profile            Profile          @relation("TNARequests", fields: [profileId], references: [id])
  requestedTitle     String
  description        String?
  justification      String?
  status             String           @default("pending") // pending|approved|rejected|scheduled
  approvedById       String?
  approvedBy         Profile?         @relation("TNAApprovedBy", fields: [approvedById], references: [id])
  scheduledProgramId String?
  scheduledProgram   TrainingProgram? @relation("ScheduledProgram", fields: [scheduledProgramId], references: [id])
  rejectionReason    String?
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
}
```

### 4.2 Kompetensi

```prisma
model Competency {
  id           String                          @id @default(cuid())
  name         String
  description  String?
  category     String                          // "core" | "functional" | "leadership"
  isActive     Boolean                         @default(true)
  requirements CompetencyPositionRequirement[]
  assessments  CompetencyAssessment[]
  createdAt    DateTime                        @default(now())
}

model CompetencyPositionRequirement {
  id            String     @id @default(cuid())
  competencyId  String
  competency    Competency @relation(fields: [competencyId], references: [id])
  positionId    String
  position      Position   @relation("CompetencyRequirements", fields: [positionId], references: [id])
  requiredLevel Int        // 1-5

  @@unique([competencyId, positionId])
}

model CompetencyAssessmentCycle {
  id          String                 @id @default(cuid())
  name        String
  year        Int
  startDate   DateTime
  endDate     DateTime
  status      String                 @default("draft") // draft|open|closed
  assessments CompetencyAssessment[]
  createdAt   DateTime               @default(now())
}

model CompetencyAssessment {
  id           String                    @id @default(cuid())
  cycleId      String
  cycle        CompetencyAssessmentCycle @relation(fields: [cycleId], references: [id])
  profileId    String
  profile      Profile                   @relation("CompetencyAssessments", fields: [profileId], references: [id])
  competencyId String
  competency   Competency                @relation(fields: [competencyId], references: [id])
  selfScore    Int?                      // 1-5, diisi karyawan
  managerScore Int?                      // 1-5, diisi manager
  finalScore   Int?                      // 1-5, dikompilasi HR
  assessedById String?
  assessedBy   Profile?                  @relation("CompetencyAssessedBy", fields: [assessedById], references: [id])
  notes        String?
  createdAt    DateTime                  @default(now())
  updatedAt    DateTime                  @updatedAt

  @@unique([cycleId, profileId, competencyId])
}
```

### 4.3 Pengembangan Karir

```prisma
model CareerPath {
  id             String   @id @default(cuid())
  fromPositionId String
  fromPosition   Position @relation("CareerPathFrom", fields: [fromPositionId], references: [id])
  toPositionId   String
  toPosition     Position @relation("CareerPathTo", fields: [toPositionId], references: [id])
  requiredYears  Int?
  description    String?
  createdAt      DateTime @default(now())

  @@unique([fromPositionId, toPositionId])
}

model IndividualDevelopmentPlan {
  id               String        @id @default(cuid())
  profileId        String
  profile          Profile       @relation("IDPProfile", fields: [profileId], references: [id])
  title            String
  description      String?
  targetPositionId String?
  targetPosition   Position?     @relation("IDPTargetPosition", fields: [targetPositionId], references: [id])
  targetDate       DateTime?
  status           String        @default("draft") // draft|submitted|approved|rejected|completed
  approvedById     String?
  approvedBy       Profile?      @relation("IDPApprovedBy", fields: [approvedById], references: [id])
  approvedAt       DateTime?
  rejectionNotes   String?
  milestones       IDPMilestone[]
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
}

model IDPMilestone {
  id          String                    @id @default(cuid())
  idpId       String
  idp         IndividualDevelopmentPlan @relation(fields: [idpId], references: [id])
  title       String
  description String?
  targetDate  DateTime?
  isCompleted Boolean                   @default(false)
  completedAt DateTime?
  createdAt   DateTime                  @default(now())
}

model SuccessionPlan {
  id         String                @id @default(cuid())
  positionId String
  position   Position              @relation("SuccessionPosition", fields: [positionId], references: [id])
  year       Int
  notes      String?
  candidates SuccessionCandidate[]
  createdAt  DateTime              @default(now())
  updatedAt  DateTime              @updatedAt

  @@unique([positionId, year])
}

model SuccessionCandidate {
  id               String         @id @default(cuid())
  successionPlanId String
  successionPlan   SuccessionPlan @relation(fields: [successionPlanId], references: [id])
  profileId        String
  profile          Profile        @relation("SuccessionCandidates", fields: [profileId], references: [id])
  readinessLevel   String         // "ready_now" | "1_year" | "2_years"
  isHighPotential  Boolean        @default(false)
  notes            String?
  createdAt        DateTime       @default(now())

  @@unique([successionPlanId, profileId])
}
```

---

## 5. UI Detail per Tab

### 5.1 Tab Pelatihan

**Sub-tab TNA**
- Stat cards: Total TNA | Pending | Disetujui | Dijadwalkan
- **HR view:** Tabel semua TNA → Approve (pilih program existing atau kosongkan) / Reject (+ alasan)
- **Karyawan/Manager view:** Form ajukan TNA (judul, deskripsi, justifikasi) + tabel history TNA sendiri

**Sub-tab Program**
- Left panel (360px): Form buat program (judul, tipe, mode, trainer, lokasi, tanggal, max peserta, deskripsi)
- Right panel: Tabel program dengan badge status, tombol Publish/Complete/Cancel, klik buka drawer detail peserta
- Drawer detail: list peserta terdaftar + tombol tambah peserta

**Sub-tab Peserta & Nilai**
- Filter by program
- Tabel: Nama | Status | Nilai | Sertifikat | Aksi
- HR: update status & nilai inline, upload sertifikat
- Karyawan: read-only, tombol download sertifikat jika ada

### 5.2 Tab Kompetensi

**Sub-tab Framework**
- Left panel: Form buat kompetensi (nama, kategori, deskripsi)
- Right panel atas: Tabel daftar kompetensi (aktif/nonaktif)
- Right panel bawah: Matrix inline — baris = Jabatan, kolom = Kompetensi, cell = input number 1-5 (required level)

**Sub-tab Siklus Assessment**
- HR: Form buat siklus (nama, tahun, tanggal) + tabel siklus dengan tombol Open/Close
- Saat siklus Open:
  - **Karyawan:** Tabel kompetensi untuk diisi self-score (1-5)
  - **Manager:** Tabel bawahan → pilih karyawan → isi manager-score per kompetensi
  - **HR:** Form compile final score + progress tabel (sudah/belum self-assess per karyawan)

**Sub-tab Gap Analysis**
- Filter: pilih karyawan ATAU pilih jabatan
- Tabel: Kompetensi | Level Aktual (final score dari siklus terakhir) | Level Required (by jabatan) | Gap
- Gap negatif = cell merah, gap nol = hijau, gap positif = biru
- Summary card: % kompetensi terpenuhi

### 5.3 Tab Pengembangan Karir

**Sub-tab Career Path**
- Left panel: Form define jalur (dari jabatan → ke jabatan, required years, deskripsi)
- Right panel: Tampilan per starting position — kartu dengan chain arrow jabatan ke atas
- HR bisa delete jalur

**Sub-tab IDP**
- **Karyawan:** Form buat IDP (judul, deskripsi, target jabatan, target tanggal) + tambah milestones + tombol Submit
  - Tabel IDP sendiri + progress milestone per IDP
- **Manager:** Tabel IDP bawahan berstatus "submitted" → Approve / Reject + catatan
- **HR:** Tabel semua IDP aktif, tombol mark Completed

**Sub-tab Succession**
- Tabel posisi kunci yang sudah punya succession plan (year) + tombol buat plan baru
- Klik plan → drawer: daftar kandidat dengan readiness level + badge High Potential
- HR: tambah kandidat, edit readiness level, toggle high potential

---

## 6. Server Actions

```ts
// Training
createTrainingProgram(data)
updateTrainingProgramStatus(id, status)          // publish|complete|cancel
addTrainingParticipant(programId, profileId)
updateParticipantResult(id, { status, score, certificateUrl })
submitTNA(data)                                   // karyawan
approveTNA(id, scheduledProgramId?)               // HR
rejectTNA(id, rejectionReason)                    // HR

// Competency
createCompetency(data)
setPositionRequirement(competencyId, positionId, requiredLevel)
createAssessmentCycle(data)
updateCycleStatus(id, status)                     // open|close
submitSelfAssessment(cycleId, scores[])           // karyawan
submitManagerAssessment(cycleId, profileId, scores[])  // manager
compileFinalScores(cycleId, profileId, scores[])  // HR

// Career
createCareerPath(fromPositionId, toPositionId, requiredYears?)
deleteCareerPath(id)
createIDP(data)                                   // karyawan
addIDPMilestone(idpId, data)                      // karyawan
submitIDP(id)                                     // karyawan
approveIDP(id)                                    // manager
rejectIDP(id, rejectionNotes)                     // manager
completeIDP(id)                                   // HR
toggleMilestoneComplete(milestoneId)              // karyawan
createSuccessionPlan(positionId, year)            // HR
addSuccessionCandidate(planId, profileId, readinessLevel, isHighPotential)
updateSuccessionCandidate(id, data)
```

---

## 7. Permission

Semua route menggunakan permission `hr:view` (existing). Mutations di server actions pakai `requirePermission({ module: "hr", action: "create" | "edit" | "delete" })`.

Karyawan mengakses self-service fitur via session `session.user.profileId` — tidak perlu permission khusus, hanya verifikasi bahwa data yang diakses milik karyawan yang sedang login.

Manager approval divalidasi via relasi manager–bawahan (Employee.managerId atau Department head).

---

## 8. Migration

Satu migration file: `add_pengembangan_sdm_tables`

Tables baru (12):
- `training_programs`
- `training_participants`
- `training_needs_analyses`
- `competencies`
- `competency_position_requirements`
- `competency_assessment_cycles`
- `competency_assessments`
- `career_paths`
- `individual_development_plans`
- `idp_milestones`
- `succession_plans`
- `succession_candidates`

**Implementation note:** Saat step 1, cek apakah `Employee` model sudah punya `managerId` untuk validasi manager approval IDP & assessment. Jika belum, tambahkan ke schema sekalian dalam migration yang sama.

---

## 9. Implementation Order

1. Schema + migration
2. Zod validations (`lib/validations/pengembanganSdm.ts`)
3. Query helpers (`lib/queries/pengembanganSdm.ts`)
4. Server actions (`actions/pengembangan-sdm.ts`)
5. TanStack Query hooks (`hooks/use-pengembangan-sdm.ts`)
6. UI: `page.tsx` + `PengembanganSDMClient.tsx`
7. UI: `TrainingTab.tsx` (TNA → Program → Peserta & Nilai)
8. UI: `CompetencyTab.tsx` (Framework → Siklus → Gap)
9. UI: `CareerTab.tsx` (Career Path → IDP → Succession)
10. Stat summary cards (3 files)
