-- Create RecommendationLevel enum (idempotent)
DO $$ BEGIN
    CREATE TYPE "RecommendationLevel" AS ENUM ('HIGHLY_RECOMMENDED', 'RECOMMENDED', 'CONDITIONAL', 'NOT_RECOMMENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create event_evaluations table
CREATE TABLE IF NOT EXISTS "event_evaluations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT,
    "eventName" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "venueId" TEXT NOT NULL,
    "paxCount" INTEGER NOT NULL,
    "venueSpecialistId" TEXT NOT NULL,
    "ballroomReview" TEXT,
    "woEvaluationNotes" TEXT,
    "generalNotes" TEXT,
    "eventFlow" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_evaluations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "event_evaluations_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "event_evaluations_venueSpecialistId_fkey" FOREIGN KEY ("venueSpecialistId") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "event_evaluations_bookingId_idx" ON "event_evaluations"("bookingId");
CREATE INDEX IF NOT EXISTS "event_evaluations_venueId_idx" ON "event_evaluations"("venueId");
CREATE INDEX IF NOT EXISTS "event_evaluations_venueSpecialistId_idx" ON "event_evaluations"("venueSpecialistId");
CREATE INDEX IF NOT EXISTS "event_evaluations_eventDate_idx" ON "event_evaluations"("eventDate");

-- Create vendor_evaluations table
CREATE TABLE IF NOT EXISTS "vendor_evaluations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventEvaluationId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorCategoryId" TEXT NOT NULL,
    "notes" TEXT,
    "actionsTaken" TEXT,
    "followUp" TEXT,
    "followUpDone" BOOLEAN NOT NULL DEFAULT false,
    "recommendation" "RecommendationLevel" NOT NULL,
    "recommendationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendor_evaluations_eventEvaluationId_fkey" FOREIGN KEY ("eventEvaluationId") REFERENCES "event_evaluations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vendor_evaluations_vendorCategoryId_fkey" FOREIGN KEY ("vendorCategoryId") REFERENCES "vendor_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "vendor_evaluations_eventEvaluationId_idx" ON "vendor_evaluations"("eventEvaluationId");
CREATE INDEX IF NOT EXISTS "vendor_evaluations_vendorCategoryId_idx" ON "vendor_evaluations"("vendorCategoryId");
CREATE INDEX IF NOT EXISTS "vendor_evaluations_recommendation_idx" ON "vendor_evaluations"("recommendation");

-- Create vendor_evaluation_images table
CREATE TABLE IF NOT EXISTS "vendor_evaluation_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorEvaluationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendor_evaluation_images_vendorEvaluationId_fkey" FOREIGN KEY ("vendorEvaluationId") REFERENCES "vendor_evaluations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "vendor_evaluation_images_vendorEvaluationId_idx" ON "vendor_evaluation_images"("vendorEvaluationId");

-- Create event_evaluation_images table
CREATE TABLE IF NOT EXISTS "event_evaluation_images" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventEvaluationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_evaluation_images_eventEvaluationId_fkey" FOREIGN KEY ("eventEvaluationId") REFERENCES "event_evaluations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "event_evaluation_images_eventEvaluationId_idx" ON "event_evaluation_images"("eventEvaluationId");
