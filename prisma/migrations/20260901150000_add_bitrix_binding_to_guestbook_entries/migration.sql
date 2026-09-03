-- Fase 4: Bitrix contact binding by phone for guestbook entries.
-- phoneNumberNorm = normalized MSISDN match key; bitrix* = snapshot of the bound
-- Bitrix contact (name kept locally so the row survives Bitrix downtime).
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "phoneNumberNorm" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "bitrixContactId" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "bitrixName" TEXT;
CREATE INDEX IF NOT EXISTS "guestbook_entries_phoneNumberNorm_idx" ON "guestbook_entries"("phoneNumberNorm");
