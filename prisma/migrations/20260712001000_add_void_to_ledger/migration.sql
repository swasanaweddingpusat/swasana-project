-- Fase 1 (lanjutan, ADDITIVE): void tombstone di ledgers buat koreksi non-destruktif (§6.5).
-- Acked row IMMUTABLE — koreksi = tandai voidedAt + row reversing baru, bukan overwrite.

ALTER TABLE "ledgers" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "ledgers" ADD COLUMN IF NOT EXISTS "voidedById" TEXT;

DO $$ BEGIN
    ALTER TABLE "ledgers"
        ADD CONSTRAINT "ledgers_voidedById_fkey"
        FOREIGN KEY ("voidedById") REFERENCES "profiles" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "ledgers_voidedById_idx" ON "ledgers"("voidedById");
