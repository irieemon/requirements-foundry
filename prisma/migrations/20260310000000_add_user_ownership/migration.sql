-- Backfill existing projects with admin email
UPDATE "Project" SET "userId" = 'sean.mcinerney@merkle.com' WHERE "userId" IS NULL;

-- Make userId non-nullable
ALTER TABLE "Project" ALTER COLUMN "userId" SET NOT NULL;
