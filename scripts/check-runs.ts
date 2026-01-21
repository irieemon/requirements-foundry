import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const adapter = new PrismaPg({ connectionString: connectionString! });
const db = new PrismaClient({ adapter });

async function check() {
  const runs = await db.run.findMany({
    where: { type: "GENERATE_EPICS" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, status: true, logs: true, createdAt: true }
  });
  
  for (const run of runs) {
    console.log("\n=== Run", run.id.slice(0,8), "===");
    console.log("Status:", run.status);
    console.log("Created:", run.createdAt);
    console.log("Logs:");
    console.log(run.logs?.slice(-1500) || "No logs");
  }
  
  await db.$disconnect();
}
check();
