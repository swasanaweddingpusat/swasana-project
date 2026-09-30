ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "approverId" TEXT;

CREATE INDEX IF NOT EXISTS "leave_requests_approverId_idx" ON "leave_requests"("approverId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_approverId_fkey'
  ) THEN
    ALTER TABLE "leave_requests"
      ADD CONSTRAINT "leave_requests_approverId_fkey"
      FOREIGN KEY ("approverId") REFERENCES "profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
