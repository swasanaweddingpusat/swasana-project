-- Create tutorial tables required by the tutorial module

CREATE TABLE IF NOT EXISTS "tutorial_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tutorial_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tutorial_lessons" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "duration" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tutorial_lessons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tutorial_steps" (
  "id" TEXT NOT NULL,
  "lessonId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "caption" TEXT NOT NULL,
  "image" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tutorial_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tutorial_lessons_categoryId_idx" ON "tutorial_lessons"("categoryId");
CREATE INDEX IF NOT EXISTS "tutorial_steps_lessonId_idx" ON "tutorial_steps"("lessonId");

DO $$ BEGIN
  ALTER TABLE "tutorial_lessons"
    ADD CONSTRAINT "tutorial_lessons_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "tutorial_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tutorial_steps"
    ADD CONSTRAINT "tutorial_steps_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "tutorial_lessons"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
