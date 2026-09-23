-- Ad source URL (Bitrix deal UF_CRM_1770698079121) attributed to a guestbook entry,
-- used to power the "Sumber Iklan" acquisition breakdown on the Guestbook overview.
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "bitrixAdsUrl" TEXT;
