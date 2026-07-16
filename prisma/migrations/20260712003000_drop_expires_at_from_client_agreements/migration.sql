-- Client agreement links no longer expire. Drop the now-unused expiresAt column.
--
-- SAFETY: this ONLY removes the expiry timestamp. token, accessCode, and status are
-- left untouched, so every already-generated link keeps working exactly as before —
-- no link is invalidated, nothing needs regenerating. Idempotent for staging/prod
-- re-runs via migrate deploy.
ALTER TABLE "client_agreements" DROP COLUMN IF EXISTS "expiresAt";
