import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create the PostgreSQL adapter with connection string from environment
// Vercel Postgres or any PostgreSQL database
function createPrismaClient(): PrismaClient {
  // Support both DATABASE_URL (standard) and POSTGRES_URL (Vercel Postgres)
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL or POSTGRES_URL environment variable is required");
  }

  // Vercel Postgres uses SSL, configure accordingly
  const isVercel = connectionString.includes("vercel-storage.com") ||
    connectionString.includes("neon.tech") ||
    process.env.VERCEL === "1";

  const adapter = new PrismaPg({
    connectionString,
    // Vercel Postgres requires SSL
    ssl: isVercel ? { rejectUnauthorized: false } : undefined,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
