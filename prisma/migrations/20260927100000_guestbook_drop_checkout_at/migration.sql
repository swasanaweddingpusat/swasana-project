-- Tanggal checkout dihapus: statusnya redundan dengan visitStatus `done_visit`,
-- dan alur checkout manual (yang selalu menimpa status ke deal/to_be_discuss/lost)
-- sudah ditiadakan. Entry yang punya checkOutAt tapi belum bertstatus kita
-- promosikan ke `done_visit`; yang sudah punya status dibiarkan apa adanya supaya
-- hasil kualifikasi sales tidak hilang.
UPDATE "guestbook_entries"
SET "visitStatus" = 'done_visit'
WHERE "checkOutAt" IS NOT NULL
  AND "visitStatus" IS NULL;

ALTER TABLE "guestbook_entries" DROP COLUMN "checkOutAt";
