-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: User.email unique
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Backfill: populate User table from existing Project owners (per D-04: name is NULL for backfilled users)
-- Uses gen_random_uuid() with 'c' prefix to approximate cuid format for migration-generated IDs
-- updatedAt is set explicitly because @updatedAt is Prisma-managed at runtime
INSERT INTO "User" ("id", "email", "updatedAt")
SELECT
    'c' || replace(gen_random_uuid()::text, '-', ''),
    "userId",
    CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "userId" FROM "Project") AS distinct_users;

-- CreateTable: ProjectShare
CREATE TABLE "ProjectShare" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ProjectShare unique constraint on [projectId, userId]
CREATE UNIQUE INDEX "ProjectShare_projectId_userId_key" ON "ProjectShare"("projectId", "userId");

-- CreateIndex: ProjectShare.projectId
CREATE INDEX "ProjectShare_projectId_idx" ON "ProjectShare"("projectId");

-- CreateIndex: ProjectShare.userId
CREATE INDEX "ProjectShare_userId_idx" ON "ProjectShare"("userId");

-- AddForeignKey: ProjectShare -> Project (cascade delete)
ALTER TABLE "ProjectShare" ADD CONSTRAINT "ProjectShare_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ProjectShare -> User (cascade delete)
ALTER TABLE "ProjectShare" ADD CONSTRAINT "ProjectShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
