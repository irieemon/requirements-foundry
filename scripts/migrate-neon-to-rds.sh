#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# migrate-neon-to-rds.sh
#
# Migrates data from Neon PostgreSQL to RDS PostgreSQL using pg_dump/pg_restore.
#
# Strategy: Full dump from Neon, restore into RDS, then Prisma applies any
# pending migrations (including rename_blob_to_storage) on next container
# restart via entrypoint.js -> prisma migrate deploy.
#
# Usage:
#   ./scripts/migrate-neon-to-rds.sh <NEON_CONNECTION_STRING> [--dry-run]
#
# Where to find your Neon connection string:
#   1. Local .env.local file (look for DATABASE_URL or POSTGRES_URL)
#   2. Neon Dashboard: https://console.neon.tech -> Project -> Connection Details
#   3. Vercel Dashboard: Project Settings -> Environment Variables
#
# Prerequisites:
#   - pg_dump and pg_restore installed (PostgreSQL client tools)
#   - AWS CLI configured with access to CloudFormation and Secrets Manager
#   - Network access to both Neon (internet) and RDS (VPC/network)
#
# Notes:
#   - Uses --clean --if-exists to drop existing objects before restore.
#     Warnings about "does not exist" on DROP statements are NORMAL and safe
#     to ignore -- they just mean the object wasn't there to drop.
#   - The rename migration (blobUrl -> storageUrl, blobPathname -> storageKey)
#     will apply on next ECS container restart when entrypoint.js runs
#     "prisma migrate deploy".
###############################################################################

DUMP_FILE="neon_full.dump"
DRY_RUN=false
NEON_URL=""

# CloudFormation stack and secret names
CF_STACK="RequirementsFoundryStack"
CF_REGION="us-east-1"
RDS_SECRET_ID="requirements-foundry-prod/rds-credentials"
RDS_DB_NAME="requirements_foundry"

# --- Color helpers ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }

# --- Parse arguments ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 <NEON_CONNECTION_STRING> [--dry-run]"
      echo ""
      echo "Migrates data from Neon PostgreSQL to RDS PostgreSQL."
      echo ""
      echo "Arguments:"
      echo "  NEON_CONNECTION_STRING  PostgreSQL connection URL for Neon database"
      echo "  --dry-run              Show what would happen without executing"
      echo "  --help, -h             Show this help message"
      echo ""
      echo "Where to find your Neon connection string:"
      echo "  1. Local .env.local (DATABASE_URL or POSTGRES_URL)"
      echo "  2. Neon Dashboard: https://console.neon.tech -> Connection Details"
      echo "  3. Vercel Dashboard: Project Settings -> Environment Variables"
      exit 0
      ;;
    *)
      if [[ -z "$NEON_URL" ]]; then
        NEON_URL="$1"
      else
        error "Unknown argument: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

# --- Prompt for Neon URL if not provided ---
if [[ -z "$NEON_URL" ]]; then
  echo ""
  info "No Neon connection string provided as argument."
  echo ""
  echo "Where to find it:"
  echo "  1. Local .env.local file (DATABASE_URL or POSTGRES_URL)"
  echo "  2. Neon Dashboard: https://console.neon.tech -> Project -> Connection Details"
  echo "  3. Vercel Dashboard: Project Settings -> Environment Variables"
  echo ""
  read -rp "Enter Neon connection string: " NEON_URL
  if [[ -z "$NEON_URL" ]]; then
    error "Neon connection string is required."
    exit 1
  fi
fi

# --- Validate Neon URL format ---
if [[ ! "$NEON_URL" =~ ^postgres(ql)?:// ]]; then
  error "Invalid connection string format. Expected: postgresql://user:pass@host/dbname"
  exit 1
fi

# --- Check prerequisites ---
check_command() {
  if ! command -v "$1" &>/dev/null; then
    error "'$1' is not installed. Please install PostgreSQL client tools."
    exit 1
  fi
}

check_command pg_dump
check_command pg_restore
check_command aws
check_command python3

echo ""
info "=== Neon to RDS Data Migration ==="
echo ""

# --- Fetch RDS endpoint from CloudFormation ---
info "Fetching RDS endpoint from CloudFormation stack '${CF_STACK}'..."
if $DRY_RUN; then
  info "[DRY RUN] Would run: aws cloudformation describe-stacks --stack-name ${CF_STACK} ..."
  RDS_HOST="<rds-endpoint>"
else
  RDS_HOST=$(aws cloudformation describe-stacks \
    --stack-name "$CF_STACK" \
    --query 'Stacks[0].Outputs[?ExportName==`rf-prod-rds-endpoint`].OutputValue' \
    --output text \
    --region "$CF_REGION" 2>/dev/null) || {
    error "Failed to fetch RDS endpoint from CloudFormation."
    error "Is the stack '${CF_STACK}' deployed? Is your AWS CLI configured?"
    exit 1
  }

  if [[ -z "$RDS_HOST" || "$RDS_HOST" == "None" ]]; then
    error "RDS endpoint not found in CloudFormation outputs."
    exit 1
  fi
  success "RDS endpoint: ${RDS_HOST}"
fi

# --- Fetch RDS credentials from Secrets Manager ---
info "Fetching RDS credentials from Secrets Manager..."
if $DRY_RUN; then
  info "[DRY RUN] Would run: aws secretsmanager get-secret-value --secret-id ${RDS_SECRET_ID} ..."
  RDS_PASSWORD="<rds-password>"
  RDS_USER="postgres"
else
  RDS_SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "$RDS_SECRET_ID" \
    --region "$CF_REGION" \
    --query SecretString \
    --output text 2>/dev/null) || {
    error "Failed to fetch RDS credentials from Secrets Manager."
    error "Secret ID: ${RDS_SECRET_ID}"
    exit 1
  }

  RDS_USER=$(echo "$RDS_SECRET_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['username'])")
  RDS_PASSWORD=$(echo "$RDS_SECRET_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['password'])")
  success "RDS credentials retrieved (user: ${RDS_USER})"
fi

echo ""

# --- Step 1: pg_dump from Neon ---
info "Step 1: Dumping data from Neon..."
if $DRY_RUN; then
  info "[DRY RUN] Would run:"
  echo "  pg_dump \"\$NEON_URL\" \\"
  echo "    --no-owner \\"
  echo "    --no-privileges \\"
  echo "    --clean \\"
  echo "    --if-exists \\"
  echo "    --format=custom \\"
  echo "    -f ${DUMP_FILE}"
else
  info "Running pg_dump (this may take a moment)..."
  pg_dump "$NEON_URL" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --format=custom \
    -f "$DUMP_FILE" || {
    error "pg_dump failed. Check your Neon connection string and network access."
    error "Connection string format: postgresql://user:password@host/database?sslmode=require"
    rm -f "$DUMP_FILE"
    exit 1
  }

  DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
  success "Dump complete: ${DUMP_FILE} (${DUMP_SIZE})"
fi

echo ""

# --- Step 2: pg_restore into RDS ---
info "Step 2: Restoring data into RDS..."
if $DRY_RUN; then
  info "[DRY RUN] Would run:"
  echo "  PGPASSWORD=\"\$RDS_PASSWORD\" pg_restore \\"
  echo "    --no-owner \\"
  echo "    --no-privileges \\"
  echo "    --clean \\"
  echo "    --if-exists \\"
  echo "    -h ${RDS_HOST} -p 5432 -U ${RDS_USER} -d ${RDS_DB_NAME} \\"
  echo "    ${DUMP_FILE}"
else
  info "Running pg_restore into RDS (warnings about 'does not exist' on DROP are normal)..."
  # pg_restore returns non-zero on warnings (e.g., "does not exist" for DROP),
  # so we capture the exit code and check for actual errors vs harmless warnings.
  set +e
  RESTORE_OUTPUT=$(PGPASSWORD="$RDS_PASSWORD" pg_restore \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    -h "$RDS_HOST" -p 5432 -U "$RDS_USER" -d "$RDS_DB_NAME" \
    "$DUMP_FILE" 2>&1)
  RESTORE_EXIT=$?
  set -e

  if [[ $RESTORE_EXIT -ne 0 ]]; then
    # Check if the errors are just harmless "does not exist" warnings
    REAL_ERRORS=$(echo "$RESTORE_OUTPUT" | grep -i "error" | grep -vi "does not exist" | grep -vi "already exists" || true)
    if [[ -n "$REAL_ERRORS" ]]; then
      warn "pg_restore completed with warnings/errors:"
      echo "$RESTORE_OUTPUT" | tail -20
      echo ""
      warn "Some errors may be expected. Review the output above."
    else
      success "pg_restore completed (harmless 'does not exist' warnings only)"
    fi
  else
    success "pg_restore completed successfully"
  fi
fi

echo ""

# --- Step 3: Clean up dump file ---
if ! $DRY_RUN; then
  info "Cleaning up dump file..."
  rm -f "$DUMP_FILE"
  success "Removed ${DUMP_FILE}"
  echo ""
fi

# --- Step 4: Print verification queries ---
info "=== Verification ==="
echo ""
info "Run these queries to verify the migration:"
echo ""

if $DRY_RUN; then
  echo "  # After running the actual migration, connect to RDS and verify:"
  echo ""
fi

cat <<'VERIFY'
# Check data counts:
PGPASSWORD="$RDS_PASS" psql -h "$RDS_HOST" -U postgres -d requirements_foundry -c \
  "SELECT 'Project' as tbl, COUNT(*) FROM \"Project\"
   UNION ALL SELECT 'Card', COUNT(*) FROM \"Card\"
   UNION ALL SELECT 'Epic', COUNT(*) FROM \"Epic\"
   UNION ALL SELECT 'Story', COUNT(*) FROM \"Story\"
   UNION ALL SELECT 'Subtask', COUNT(*) FROM \"Subtask\";"

# Check Upload table columns (should show blobUrl/blobPathname before migration runs):
PGPASSWORD="$RDS_PASS" psql -h "$RDS_HOST" -U postgres -d requirements_foundry -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name = 'Upload'
   AND column_name IN ('storageUrl', 'storageKey', 'blobUrl', 'blobPathname');"

# Check Prisma migration history:
PGPASSWORD="$RDS_PASS" psql -h "$RDS_HOST" -U postgres -d requirements_foundry -c \
  "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;"
VERIFY

echo ""
info "=== Next Steps ==="
echo ""
echo "1. Verify the data counts above match your expectations"
echo "2. Restart the ECS container to apply the rename migration:"
echo "   aws ecs update-service --cluster requirements-foundry-prod-cluster \\"
echo "     --service requirements-foundry-prod-service \\"
echo "     --force-new-deployment --region us-east-1 --no-cli-pager"
echo ""
echo "3. After restart (~2-3 min), verify the rename migration applied:"
echo "   - Upload table should have 'storageUrl' and 'storageKey' columns"
echo "   - _prisma_migrations should show rename_blob_to_storage as applied"
echo ""

if $DRY_RUN; then
  info "[DRY RUN] No changes were made. Run without --dry-run to execute."
else
  success "Data migration complete!"
fi
