-- Create wedding_indicators table
CREATE TABLE IF NOT EXISTS "wedding_indicators" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coupleName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "venueId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "eventManagerName" TEXT NOT NULL,
    "woName" TEXT,
    "eventManagerRating" DOUBLE PRECISION,
    "woRating" DOUBLE PRECISION,
    "ballroomFacilitiesRating" DOUBLE PRECISION,
    "ballroomCleanlinessRating" DOUBLE PRECISION,
    "vendorsRating" DOUBLE PRECISION,
    "salesRating" DOUBLE PRECISION,
    "recommendationScore" INTEGER NOT NULL DEFAULT 5,
    "satisfactionScore" DOUBLE PRECISION,
    "allowancePercentage" INTEGER,
    "allowanceNominal" INTEGER,
    "questionnaireData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wedding_indicators_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "wedding_indicators_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "wedding_indicators_venueId_idx" ON "wedding_indicators"("venueId");
CREATE INDEX IF NOT EXISTS "wedding_indicators_createdById_idx" ON "wedding_indicators"("createdById");
CREATE INDEX IF NOT EXISTS "wedding_indicators_eventDate_idx" ON "wedding_indicators"("eventDate");
