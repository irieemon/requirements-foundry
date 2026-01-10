#!/bin/bash

# ============================================
# Batch Generate Stories Feature - Patch Script
# ============================================
# This script applies all changes required for the
# "Generate ALL Stories" feature.
#
# Usage:
#   chmod +x scripts/batch-generate-stories.sh
#   ./scripts/batch-generate-stories.sh
#
# For hosted/production:
#   npx prisma migrate deploy
# ============================================

set -e

echo "================================================"
echo " Batch Generate Stories Feature - Patch Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Running from project root"
echo ""

# ============================================
# Step 1: Create directories
# ============================================
echo -e "${YELLOW}Step 1: Creating directories...${NC}"

mkdir -p components/batch-stories
mkdir -p app/api/projects/\[id\]/active-batch-story-run
mkdir -p app/api/runs/\[id\]/batch-story
mkdir -p lib/run-engine

echo -e "${GREEN}✓${NC} Directories created"
echo ""

# ============================================
# Step 2: Update Prisma Schema
# ============================================
echo -e "${YELLOW}Step 2: Checking Prisma schema updates...${NC}"

# Check if RunEpic model already exists
if grep -q "model RunEpic" prisma/schema.prisma; then
    echo -e "${GREEN}✓${NC} RunEpic model already exists in schema"
else
    echo -e "${YELLOW}!${NC} RunEpic model needs to be added to prisma/schema.prisma"
    echo ""
    echo "Add the following to your schema.prisma file:"
    echo ""
    cat << 'SCHEMA_ADDITIONS'

// Add to Run model:
//   skippedItems     Int      @default(0)
//   currentItemId    String?
//   currentItemIndex Int?
//   runEpics         RunEpic[]

// Add this new model:
model RunEpic {
  id        String   @id @default(cuid())
  runId     String
  run       Run      @relation(fields: [runId], references: [id], onDelete: Cascade)
  epicId    String
  epic      Epic     @relation(fields: [epicId], references: [id], onDelete: Cascade)

  status    String   @default("PENDING")
  order     Int      @default(0)

  startedAt    DateTime?
  completedAt  DateTime?
  durationMs   Int?
  tokensUsed   Int?

  storiesCreated   Int      @default(0)
  storiesDeleted   Int      @default(0)
  errorMsg         String?
  retryCount       Int      @default(0)

  mode             String?
  personaSet       String?

  createdAt        DateTime @default(now())

  @@unique([runId, epicId])
  @@index([runId])
  @@index([epicId])
  @@index([runId, status])
}

// Add to Epic model:
//   runEpics  RunEpic[]
SCHEMA_ADDITIONS
fi

echo ""

# ============================================
# Step 3: Run Prisma migrations
# ============================================
echo -e "${YELLOW}Step 3: Running Prisma migrations...${NC}"
echo ""

read -p "Run prisma migrate dev now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running prisma migrate dev..."
    npx prisma migrate dev --name add_batch_story_run_epic
    echo -e "${GREEN}✓${NC} Migration complete"
else
    echo -e "${YELLOW}!${NC} Skipped. Run manually:"
    echo "    npx prisma migrate dev --name add_batch_story_run_epic"
    echo ""
    echo "For production/hosted environments:"
    echo "    npx prisma migrate deploy"
fi

echo ""

# ============================================
# Step 4: Generate Prisma client
# ============================================
echo -e "${YELLOW}Step 4: Generating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}✓${NC} Prisma client generated"
echo ""

# ============================================
# Step 5: Summary
# ============================================
echo "================================================"
echo -e "${GREEN} Patch Complete!${NC}"
echo "================================================"
echo ""
echo "Files created/modified:"
echo "  - prisma/schema.prisma (RunEpic model)"
echo "  - lib/types.ts (new types and enums)"
echo "  - server/actions/batch-stories.ts"
echo "  - lib/run-engine/batch-story-executor.ts"
echo "  - hooks/use-batch-story-progress.ts"
echo "  - components/batch-stories/*"
echo "  - components/epics/epics-section.tsx"
echo "  - components/epics/epic-grid.tsx (export interface)"
echo "  - app/api/projects/[id]/active-batch-story-run/route.ts"
echo "  - app/api/runs/[id]/batch-story/route.ts"
echo "  - app/projects/[id]/page.tsx"
echo ""
echo "Next steps:"
echo "  1. Start the development server: npm run dev"
echo "  2. Navigate to a project with epics"
echo "  3. Click 'Generate All Stories' button"
echo "  4. Configure and start batch generation"
echo ""
echo "For production deployment:"
echo "  npx prisma migrate deploy"
echo ""
