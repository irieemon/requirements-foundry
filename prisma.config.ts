// Prisma 7 configuration
// npm install --save-dev prisma dotenv
import "dotenv/config";
import { defineConfig } from "prisma/config";

// Vercel Postgres provides POSTGRES_URL, POSTGRES_PRISMA_URL, etc.
// We support both DATABASE_URL (standard) and POSTGRES_URL (Vercel)
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
