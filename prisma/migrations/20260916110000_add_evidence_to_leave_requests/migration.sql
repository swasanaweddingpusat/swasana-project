-- Leave requests: add JSONB evidence file descriptor { id, name_file_origin,
-- mimetype, path } — path is a storage KEY (e.g. "leave-requests/abc123def456.webp"),
-- never a full URL. Same SOP as attendances.clockInEvidence
-- (see 20260916100000_attendance_evidence_jsonb) and guestbook_entries.proofFiles.

ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "evidence" JSONB;
