-- Add category to packages (WEDDINGS | MICE), default WEDDINGS so existing rows are wedding.
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "category" "EventCategory" NOT NULL DEFAULT 'WEDDINGS';
CREATE INDEX IF NOT EXISTS "packages_category_idx" ON "packages"("category");
