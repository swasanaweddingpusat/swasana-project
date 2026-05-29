import path from "node:path";
import { defineConfig } from "prisma/config";
import { loadEnvConfig } from "@next/env";

// Load .env files (Next.js style)
loadEnvConfig(path.resolve(__dirname));

export default defineConfig({
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI/migrate commands use the direct (non-pooled) connection to avoid
    // PgBouncer advisory-lock contention. Runtime app still uses the pooled
    // DATABASE_URL via the Neon adapter in lib/db.ts. Falls back to the pooled
    // URL if DIRECT_URL is not set.
    url: (process.env.DIRECT_URL ?? process.env.DATABASE_URL) as string,
  },
});
