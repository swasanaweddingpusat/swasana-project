import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

// Toggle DB driver via env (mirrors lib/db.ts):
//   DB_NEON=true  → Neon serverless HTTP adapter
//   DB_NEON=false → native PostgreSQL adapter (self-hosted Docker/VPS)
const USE_NEON = process.env.DB_NEON !== "false";

const adapter = USE_NEON
  ? new PrismaNeonHttp(process.env.DATABASE_URL!, {})
  : new PrismaPg({ connectionString: process.env.DATABASE_URL! });

export const prisma = new PrismaClient({ adapter });
