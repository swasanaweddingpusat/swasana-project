-- AI Model settings — koneksi provider AI (Anthropic langsung atau gateway
-- 9router). Credential disimpan terenkripsi (AES-256-GCM) di "credentialEnc";
-- plaintext token TIDAK PERNAH masuk DB dan tidak pernah dikirim ke client.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AiProviderKind') THEN
    CREATE TYPE "AiProviderKind" AS ENUM ('anthropic', 'router9');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AiAuthScheme') THEN
    CREATE TYPE "AiAuthScheme" AS ENUM ('api_key', 'bearer');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ai_provider_configs" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "kind"          "AiProviderKind" NOT NULL DEFAULT 'anthropic',
  "baseUrl"       TEXT,
  "authScheme"    "AiAuthScheme" NOT NULL DEFAULT 'api_key',
  "credentialEnc" TEXT NOT NULL,
  "modelId"       TEXT NOT NULL,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "isDefault"     BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"     INTEGER NOT NULL DEFAULT 0,
  "lastTestedAt"  TIMESTAMP(3),
  "lastTestOk"    BOOLEAN,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_configs_name_key"
  ON "ai_provider_configs"("name");

CREATE INDEX IF NOT EXISTS "ai_provider_configs_isActive_sortOrder_idx"
  ON "ai_provider_configs"("isActive", "sortOrder");

-- Permission rows untuk halaman Settings > AI Model (idempotent).
INSERT INTO "permissions" ("id", "module", "action", "moduleSortOrder", "createdAt") VALUES
  (gen_random_uuid(), 'settings-ai-model', 'view', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'settings-ai-model', 'create', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'settings-ai-model', 'edit', 0, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'settings-ai-model', 'delete', 0, CURRENT_TIMESTAMP)
ON CONFLICT ("module", "action") DO NOTHING;
