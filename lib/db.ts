import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7 requires a driver adapter for SQLite
// PrismaLibSql takes the URL directly, not a libsql client
const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
const adapter = new PrismaLibSql({ url: dbUrl });

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
