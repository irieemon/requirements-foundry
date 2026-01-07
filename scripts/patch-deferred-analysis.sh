#!/usr/bin/env bash
# ============================================
# Deferred Card Generation - Migration Script
# ============================================
# This script applies the database migration for the deferred card generation feature.
#
# What this migration adds:
# - New RunUpload junction table for per-upload progress tracking
# - New fields on Upload: extractionStatus, analysisStatus, errorPhase, lastAnalyzedRunId, lastAnalyzedAt
# - New fields on Run: phase, phaseDetail, totalItems, completedItems, failedItems, totalCards
# - New field on Card: runId
# - Appropriate indexes for query performance
#
# Run this script from the project root:
#   ./scripts/patch-deferred-analysis.sh

set -e

echo "============================================"
echo "Deferred Card Generation - Database Migration"
echo "============================================"
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
  echo "Error: Please run this script from the project root directory"
  exit 1
fi

if [ ! -f "prisma/schema.prisma" ]; then
  echo "Error: prisma/schema.prisma not found"
  exit 1
fi

# Check if prisma is installed
if ! npx prisma --version > /dev/null 2>&1; then
  echo "Error: Prisma CLI not found. Run 'npm install' first."
  exit 1
fi

echo "Step 1: Generating Prisma client..."
npx prisma generate

echo ""
echo "Step 2: Creating migration..."
npx prisma migrate dev --name deferred_analysis

echo ""
echo "============================================"
echo "Migration completed successfully!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Start the dev server: npm run dev"
echo "  2. Navigate to a project"
echo "  3. Upload some documents (they'll be extracted but not analyzed)"
echo "  4. Click 'Analyze' to run AI card generation"
echo "  5. Watch the progress panel for real-time updates"
echo ""
echo "New UI flow:"
echo "  Upload → Extract → Analyze (on demand) → Cards"
echo ""
