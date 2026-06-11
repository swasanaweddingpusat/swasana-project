import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

// Toggle DB driver via env:
//   DB_NEON=true  → Neon serverless adapter (pooled HTTP over the Neon driver)
//   DB_NEON=false → native PostgreSQL adapter (self-hosted, e.g. Docker/VPS)
// Defaults to Neon when unset to preserve existing production behavior.
const USE_NEON = process.env.DB_NEON !== "false";

function createPrismaClient(): PrismaClient {
  // Booking creation runs a large array-form transaction (snapshots, category
  // prices, vendor/internal items, term-of-payments, approval records + steps,
  // client agreement) — each op is a round trip, so the default 15s ceiling is
  // too tight under elevated latency. 30s gives headroom without masking
  // genuinely stuck transactions.
  const transactionOptions = { timeout: 30000 };
  const log: ("error" | "warn")[] =
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  const adapter = USE_NEON
    ? new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
    : new PrismaPg({ connectionString: process.env.DATABASE_URL! });

  return new PrismaClient({ adapter, transactionOptions, log });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
