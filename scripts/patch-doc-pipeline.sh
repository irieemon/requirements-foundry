#!/bin/bash

# ============================================
# Requirements Foundry - Document Pipeline Bootstrap
# ============================================
# This script installs dependencies and runs migrations
# for the multi-format document processing pipeline.
#
# Usage: ./scripts/patch-doc-pipeline.sh
# ============================================

set -e  # Exit on error

echo "============================================"
echo "Requirements Foundry - Document Pipeline Setup"
echo "============================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# ============================================
# 1. Install Dependencies
# ============================================
echo "Installing document processing dependencies..."
echo ""

# Core document processing
npm install pdf-parse mammoth xlsx jszip fast-xml-parser 2>/dev/null

print_status "Installed pdf-parse (PDF extraction)"
print_status "Installed mammoth (DOCX extraction)"
print_status "Installed xlsx (Excel extraction)"
print_status "Installed jszip (ZIP handling for Office formats)"
print_status "Installed fast-xml-parser (XML parsing for PPTX)"

# Types for TypeScript
npm install -D @types/pdf-parse 2>/dev/null
print_status "Installed @types/pdf-parse"

echo ""

# ============================================
# 2. Generate Prisma Client
# ============================================
echo "Generating Prisma client..."
npx prisma generate 2>/dev/null
print_status "Prisma client generated"

echo ""

# ============================================
# 3. Run Database Migrations
# ============================================
echo "Running database migrations..."
npx prisma db push --accept-data-loss 2>/dev/null
print_status "Database schema updated"

echo ""

# ============================================
# 4. Verify Installation
# ============================================
echo "Verifying installation..."

# Check if key files exist
FILES_TO_CHECK=(
    "lib/documents/types.ts"
    "lib/documents/processor.ts"
    "lib/documents/extractors/base.ts"
    "lib/documents/extractors/pdf-extractor.ts"
    "lib/documents/extractors/docx-extractor.ts"
    "lib/documents/extractors/pptx-extractor.ts"
    "lib/documents/extractors/xlsx-extractor.ts"
    "lib/documents/extractors/image-extractor.ts"
    "lib/ai/document-analyzer.ts"
    "app/api/uploads/route.ts"
    "components/uploads/multi-file-upload.tsx"
)

ALL_OK=true
for FILE in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$FILE" ]; then
        print_status "Found $FILE"
    else
        print_error "Missing $FILE"
        ALL_OK=false
    fi
done

echo ""

# ============================================
# 5. Summary
# ============================================
echo "============================================"
echo "Setup Complete!"
echo "============================================"
echo ""

if [ "$ALL_OK" = true ]; then
    print_status "All files verified"
else
    print_warning "Some files are missing - check errors above"
fi

echo ""
echo "Supported file formats:"
echo "  • PDF (.pdf)"
echo "  • Word (.docx, .doc)"
echo "  • PowerPoint (.pptx, .ppt)"
echo "  • Excel (.xlsx, .xls)"
echo "  • CSV (.csv)"
echo "  • Text (.txt, .md)"
echo "  • Images (.png, .jpg, .webp, .gif)"
echo ""

if [ -z "$ANTHROPIC_API_KEY" ]; then
    print_warning "ANTHROPIC_API_KEY not set - using mock AI provider"
    echo "  Set ANTHROPIC_API_KEY in .env to enable Claude analysis"
else
    print_status "ANTHROPIC_API_KEY detected - Claude analysis enabled"
fi

echo ""
echo "Next steps:"
echo "  1. Start the dev server: npm run dev"
echo "  2. Go to a project page"
echo "  3. Upload documents to extract use case cards"
echo ""
