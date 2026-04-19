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
    url: process.env.DATABASE_URL as string,
  },
});
