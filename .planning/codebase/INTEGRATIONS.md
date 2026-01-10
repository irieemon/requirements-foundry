# External Integrations

**Analysis Date:** 2026-01-09

## APIs & External Services

**AI Processing:**
- Anthropic Claude API - Document analysis and story generation
  - SDK/Client: `@anthropic-ai/sdk` v0.71.2 - `lib/ai/provider.ts`, `lib/ai/document-analyzer.ts`
  - Model: `claude-sonnet-4-20250514` - `lib/ai/provider.ts`
  - Auth: API key in `ANTHROPIC_API_KEY` env var
  - Features: Multi-modal document analysis, epic generation, story generation
  - Fallback: Mock provider for demo/testing without API key - `lib/ai/provider.ts`

## Data Storage

**Databases:**
- PostgreSQL - Primary data store
  - Connection: via `DATABASE_URL` or `POSTGRES_URL` (Vercel) env var - `lib/db.ts`
  - Client: Prisma ORM 7.2.0 with `@prisma/adapter-pg` - `lib/db.ts`
  - Schema: `prisma/schema.prisma` (10+ models: Project, Upload, Card, Epic, Story, Run, etc.)
  - Migrations: `prisma/migrations/` directory
  - SSL: Auto-enabled for Vercel Postgres (sslmode=require) - `lib/db.ts`

**File Storage:**
- Vercel Blob Storage - Optional file upload destination (production)
  - SDK/Client: `@vercel/blob` v0.27.1 - `lib/storage/index.ts`
  - Auth: Token in `BLOB_READ_WRITE_TOKEN` env var
  - Functions: `put()` for upload, `del()` for deletion
  - Modes: "local" (buffer only) or "blob" (Vercel Blob) - `lib/storage/index.ts`
  - Config: `UPLOAD_STORAGE` env var controls mode

**Caching:**
- Not implemented (all queries hit database directly)

## Authentication & Identity

**Auth Provider:**
- Not implemented - No user authentication system detected
- Internal API authorization via `BATCH_STORY_SECRET` for batch operations

**OAuth Integrations:**
- None detected

## Monitoring & Observability

**Structured Logging:**
- Custom logger in `lib/observability/logger.ts`
  - Per-run correlation with runId
  - Event-based logging: `logEvent({ event, runId, ... })`
  - Levels: info, warn, error

**Heartbeat Tracking:**
- `lib/observability/heartbeat.ts`
  - Stale run detection based on last activity
  - Recovery via cron job

**Error Tracking:**
- Not detected (no Sentry, Rollbar, etc.)

**Analytics:**
- Not detected

**Logs:**
- Console/stdout only (Vercel captures)

## CI/CD & Deployment

**Hosting:**
- Vercel - Next.js app hosting
  - Deployment: Automatic on branch push (inferred from config)
  - Environment vars: Configured in Vercel dashboard
  - Serverless: 300s max function duration

**CI Pipeline:**
- Not explicitly configured in repository
- Vercel build handles Next.js compilation

## Environment Configuration

**Development:**
- Required env vars:
  - `DATABASE_URL` - PostgreSQL connection string
  - `ANTHROPIC_API_KEY` - Optional, enables AI features
  - `UPLOAD_STORAGE` - "local" for development
- Secrets location: `.env.local` (gitignored)
- Mock/stub services: Mock AI provider when no API key

**Staging:**
- Not explicitly configured (use Vercel preview deployments)

**Production:**
- Required env vars:
  - `POSTGRES_URL` - Vercel Postgres connection
  - `ANTHROPIC_API_KEY` - Required for AI features
  - `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage
  - `BATCH_STORY_SECRET` - Internal API authorization
  - `CRON_SECRET` - Cron job authorization
- Secrets management: Vercel environment variables

## Webhooks & Callbacks

**Incoming:**
- Cron webhook - `/api/cron/recover-stale-runs`
  - Verification: `Authorization: Bearer ${CRON_SECRET}` header
  - Purpose: Recover stale/stuck runs
  - Schedule: Every 5 minutes (Vercel cron)

**Outgoing:**
- None detected

## Document Processing Libraries

**PDF Processing:**
- `unpdf` v1.4.0 - `lib/documents/extractors/pdf-extractor.ts`
  - Serverless-compatible text extraction
  - Page counting

**Word Documents (DOCX):**
- `mammoth` v1.11.0 - `lib/documents/extractors/docx-extractor.ts`
  - Text and embedded image extraction

**Excel Spreadsheets:**
- `xlsx` v0.18.5 - `lib/documents/extractors/xlsx-extractor.ts`
  - Multi-sheet parsing with cell formatting

**PowerPoint Presentations:**
- `jszip` v3.10.1 + `fast-xml-parser` v5.3.3 - `lib/documents/extractors/pptx-extractor.ts`
  - Slide extraction with embedded images

**CSV Files:**
- `papaparse` v5.5.3 - `lib/parsers/csv-parser.ts`, `lib/documents/extractors/csv-extractor.ts`
  - Robust CSV parsing with error handling

## Data Export

**JIRA Integration:**
- CSV export for JIRA import - `lib/export/jira/`
  - `csv-stringify` v6.6.0 for CSV generation
  - Supports Cloud Company, Cloud Team, Server/DC presets
  - Field mapping for issue types (Epic, Story, Subtask)

**JSON Export:**
- Native JSON export - `lib/export/json-export.ts`
  - Full project data export

## Internal APIs

**Continuation Pattern:**
- `app/api/runs/[id]/process-next/route.ts` - Upload processing continuation
- `app/api/runs/[id]/process-next-upload/route.ts` - Upload processing trigger
- `app/api/runs/[id]/batch-story/route.ts` - Batch story generation trigger
- Auth: `BATCH_STORY_SECRET` header validation - `lib/run-engine/process-next-trigger.ts`

**Polling Endpoints:**
- `app/api/runs/[id]/route.ts` - Run progress polling
- `app/api/projects/[id]/active-run/route.ts` - Active analysis run
- `app/api/projects/[id]/active-batch-story-run/route.ts` - Active batch story run

**Health Check:**
- `app/api/health/route.ts`
  - Basic status, AI enablement, environment, region
  - Optional stale run detection via database query

---

*Integration audit: 2026-01-09*
*Update when adding/removing external services*
