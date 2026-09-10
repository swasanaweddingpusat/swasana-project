-- Guestbook Tahap A: drop dead fields (zero behaviour change)
-- hostId/salesId consolidation is Tahap B — NOT touched here.

-- DropColumn: dead fields on guestbook_entries
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "company";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "idNumber";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "idPhotoUrl";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "purpose";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "purposeNote";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "numberOfGuests";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "notJoinReason";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "source";

-- DropEnum: only after every column referencing them is dropped above
DROP TYPE IF EXISTS "GuestVisitPurpose";
DROP TYPE IF EXISTS "GuestbookSource";
