import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });

  return new PrismaClient({
    adapter,
    // Booking creation runs a large array-form transaction (snapshots, category
    // prices, vendor/internal items, term-of-payments, approval records + steps,
    // client agreement) — each op is a round trip over Neon, so the default 15s
    // ceiling is too tight under elevated latency. 30s gives headroom without
    // masking genuinely stuck transactions.
    transactionOptions: { timeout: 30000 },
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
