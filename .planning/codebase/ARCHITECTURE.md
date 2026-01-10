# Architecture

**Analysis Date:** 2026-01-09

## Pattern Overview

**Overall:** Full-stack Layered Monolith optimized for Vercel Serverless

**Key Characteristics:**
- Next.js App Router for routing and server rendering
- Server Actions for RPC-style mutations
- Continuation pattern for long-running operations (300s limit)
- Polling over WebSockets for progress tracking
- Document extraction pipeline decoupled from AI analysis

## Layers

**Presentation Layer:**
- Purpose: User interface and client-side interactions
- Contains: React components, pages, layouts
- Location: `app/`, `components/`
- Depends on: Server Actions, API routes
- Used by: End users via browser

**API Layer:**
- Purpose: REST endpoints for uploads, polling, and internal triggers
- Contains: Route handlers, cron jobs, webhooks
- Location: `app/api/`
- Depends on: Business logic layer
- Used by: Frontend polling, internal continuation calls

**Server Actions Layer:**
- Purpose: Type-safe RPC for mutations and queries
- Contains: Project CRUD, analysis triggers, export operations
- Location: `server/actions/`
- Depends on: Business logic layer, database
- Used by: React components via direct function calls

**Business Logic Layer:**
- Purpose: Core domain logic and orchestration
- Contains: Document processing, AI integration, run engine, export pipeline
- Location: `lib/`
- Depends on: Data layer, external services (Anthropic, Vercel Blob)
- Used by: API routes, Server Actions

**Data Layer:**
- Purpose: Database access and persistence
- Contains: Prisma client, schema definitions
- Location: `lib/db.ts`, `prisma/schema.prisma`
- Depends on: PostgreSQL
- Used by: All server-side layers

## Data Flow

**Document Upload & Extraction:**

1. User drops files in `components/uploads/multi-file-upload.tsx`
2. POST to `app/api/uploads/route.ts`
3. `lib/documents/processor.ts` routes to appropriate extractor
4. Extractor (`lib/documents/extractors/*.ts`) extracts text + images
5. Upload record created in database with `extractionStatus: EXTRACTED`
6. Blob storage used in production, buffer in development

**Card Analysis Flow:**

1. User clicks "Analyze" in `components/analysis/analyze-project-button.tsx`
2. Server Action `server/actions/analysis.ts` creates Run record
3. `lib/run-engine/process-next-trigger.ts` triggers continuation endpoint
4. `app/api/runs/[id]/process-next/route.ts` processes one upload at a time
5. `lib/ai/document-analyzer.ts` calls Claude API for card extraction
6. Cards saved to database, Upload marked as analyzed
7. Run status updated, frontend polls for progress

**Batch Story Generation Flow:**

1. User configures settings in `components/batch-stories/batch-story-config-dialog.tsx`
2. Server Action `server/actions/batch-stories.ts` creates batch Run
3. `lib/run-engine/batch-story-executor.ts` processes epics sequentially
4. AI Provider generates stories per epic with configurable pacing
5. Stories + subtasks saved, RunEpic records track per-epic progress
6. Continuation pattern survives Vercel 300s timeout

**State Management:**
- Server-side: Prisma queries, Run/RunEpic status tracking
- Client-side: React hooks with polling for progress updates
- No global client state library (Redux, Zustand) - relies on server state

## Key Abstractions

**DocumentProcessor (Singleton):**
- Purpose: Orchestrate file validation and extraction
- Location: `lib/documents/processor.ts`
- Pattern: Strategy pattern with MIME-type routing to extractors

**AIProvider (Factory):**
- Purpose: Abstract AI service for document analysis and story generation
- Location: `lib/ai/provider.ts`
- Pattern: Adapter pattern, returns Anthropic or Mock implementation

**RunEngine:**
- Purpose: Execute long-running async operations with progress tracking
- Location: `lib/run-engine/`
- Pattern: Continuation-passing style for serverless timeout survival

**Export Pipeline:**
- Purpose: Transform project data to JIRA-compatible formats
- Location: `lib/export/jira/`
- Pattern: Functional pipeline (extract → normalize → map → validate → generate)

## Entry Points

**Web Application:**
- Location: `app/layout.tsx` (root), `app/page.tsx` (redirects to /projects)
- Triggers: Browser navigation
- Responsibilities: Render UI, handle user interactions

**API Routes:**
- Location: `app/api/*/route.ts`
- Triggers: HTTP requests (frontend polling, continuation calls, cron)
- Responsibilities: Handle REST operations, trigger background work

**Server Actions:**
- Location: `server/actions/*.ts`
- Triggers: Direct function calls from React components
- Responsibilities: Mutations, queries, business logic orchestration

**Cron Jobs:**
- Location: `app/api/cron/recover-stale-runs/route.ts`
- Triggers: Vercel cron schedule (every 5 minutes)
- Responsibilities: Recover stuck runs from serverless interruptions

## Error Handling

**Strategy:** Try/catch at boundaries, structured logging, graceful degradation

**Patterns:**
- API routes return structured error responses with status codes
- Server Actions return `{ success: false, error: message }` objects
- Document extraction failures set `extractionStatus: FAILED` with error message
- Run failures set `status: FAILED` with error details stored in run record
- Observability module (`lib/observability/`) provides structured logging

## Cross-Cutting Concerns

**Logging:**
- Structured logger in `lib/observability/logger.ts`
- Per-run correlation with runId
- Console.log still present in many files (technical debt)

**Validation:**
- Zod schemas for type definitions in `lib/types.ts`
- File validation in `lib/documents/types.ts`
- Form validation via react-hook-form + Zod resolvers

**Authentication:**
- Not implemented (no user auth system detected)
- Internal API calls use `BATCH_STORY_SECRET` for authorization

**Heartbeat & Recovery:**
- `lib/observability/heartbeat.ts` tracks run activity
- Stale run detection based on last activity timestamp
- Automatic recovery via cron job

---

*Architecture analysis: 2026-01-09*
*Update when major patterns change*
