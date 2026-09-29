-- Matriks performance di Guestbook Overview sekarang memfilter rentang tanggal
-- pakai createdAt (tanggal sales input data), bukan checkInAt (tanggal kunjungan).
-- Index ini menjaga groupBy/count funnel tetap cepat pada dataset besar.

CREATE INDEX IF NOT EXISTS "guestbook_entries_createdAt_idx" ON "guestbook_entries"("createdAt");
