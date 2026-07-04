-- Add video fields to tutorial_steps
ALTER TABLE "tutorial_steps" ADD COLUMN IF NOT EXISTS "videoUrl"  TEXT;
ALTER TABLE "tutorial_steps" ADD COLUMN IF NOT EXISTS "videoType" TEXT;

-- Create tutorial_step_documents table
CREATE TABLE IF NOT EXISTS "tutorial_step_documents" (
  "id"        TEXT         NOT NULL,
  "stepId"    TEXT         NOT NULL,
  "name"      TEXT         NOT NULL,
  "fileUrl"   TEXT         NOT NULL,
  "mimeType"  TEXT,
  "fileSize"  INTEGER,
  "sortOrder" INTEGER      NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tutorial_step_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tutorial_step_documents_stepId_idx"
  ON "tutorial_step_documents"("stepId");

DO $$ BEGIN
  ALTER TABLE "tutorial_step_documents"
    ADD CONSTRAINT "tutorial_step_documents_stepId_fkey"
    FOREIGN KEY ("stepId") REFERENCES "tutorial_steps"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
