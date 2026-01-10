# Codebase Structure

**Analysis Date:** 2026-01-09

## Directory Layout

```
requirements-foundry/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # REST API endpoints
│   ├── projects/          # Project management pages
│   ├── runs/              # Run monitoring pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home (redirects to /projects)
├── components/            # React components (feature-organized)
│   ├── ui/               # Base UI components (shadcn/ui style)
│   ├── layout/           # Layout components (shell, header, sidebar)
│   ├── projects/         # Project-related components
│   ├── uploads/          # File upload components
│   ├── analysis/         # Card analysis components
│   ├── runs/             # Run progress components
│   ├── epics/            # Epic display components
│   ├── stories/          # Story components
│   ├── batch-stories/    # Batch story generation UI
│   └── export/           # Export wizard components
├── lib/                   # Business logic and services
│   ├── ai/               # AI provider integration
│   ├── documents/        # Document extraction pipeline
│   ├── run-engine/       # Async execution engine
│   ├── batch-stories/    # Batch story types and utilities
│   ├── export/           # Export formatting (JIRA, JSON)
│   ├── parsers/          # Text and CSV parsing
│   ├── storage/          # File storage abstraction
│   ├── observability/    # Logging and monitoring
│   ├── db.ts             # Prisma client singleton
│   ├── types.ts          # Type definitions and enums
│   └── utils.ts          # Utility functions
├── server/               # Server-side logic
│   └── actions/          # Next.js Server Actions
├── prisma/               # Database schema and migrations
│   ├── schema.prisma     # Data model definitions
│   ├── migrations/       # Migration history
│   └── seed.ts           # Sample data seeding
├── hooks/                # Custom React hooks
├── public/               # Static assets
├── docs/                 # Documentation
└── [config files]        # next.config.ts, tsconfig.json, etc.
```

## Directory Purposes

**app/api/**
- Purpose: REST API endpoints for file operations and polling
- Contains: Route handlers (`route.ts` files)
- Key files:
  - `uploads/route.ts` - File upload and extraction
  - `runs/[id]/route.ts` - Run progress polling
  - `runs/[id]/process-next/route.ts` - Continuation trigger
  - `runs/[id]/batch-story/route.ts` - Batch story trigger
  - `cron/recover-stale-runs/route.ts` - Stale run recovery
  - `health/route.ts` - Health check endpoint

**app/projects/**
- Purpose: Project management UI
- Contains: Page components for project listing and details
- Key files:
  - `page.tsx` - Projects list
  - `[id]/page.tsx` - Project detail with tabs (uploads, cards, epics, runs)
  - `[id]/export/page.tsx` - Export wizard

**app/runs/**
- Purpose: Run monitoring UI
- Contains: Page components for run listing and details
- Key files:
  - `page.tsx` - All runs list
  - `[id]/page.tsx` - Run detail with progress tracking

**components/ui/**
- Purpose: Base UI components following shadcn/ui patterns
- Contains: Reusable UI primitives
- Key files: `button.tsx`, `card.tsx`, `dialog.tsx`, `tabs.tsx`, `progress.tsx`, `status-pill.tsx`, `kpi-card.tsx`

**components/runs/**
- Purpose: Run progress and status display
- Contains: Progress tracking, timeline, duration display
- Key files:
  - `run-progress.tsx` - Main progress view
  - `step-progress.tsx` - Phase timeline
  - `progress-counts.tsx` - Counter display
  - `duration-display.tsx` - Elapsed/remaining time
  - `run-status-badge.tsx` - Status chip

**lib/documents/**
- Purpose: Document extraction pipeline
- Contains: Extractors for various file formats
- Key files:
  - `processor.ts` - Orchestrator singleton
  - `types.ts` - Extraction types and validation
  - `extractors/base.ts` - Base extractor class
  - `extractors/pdf-extractor.ts`, `docx-extractor.ts`, `xlsx-extractor.ts`, `pptx-extractor.ts`

**lib/ai/**
- Purpose: AI integration for analysis and generation
- Contains: Provider abstraction and document analyzer
- Key files:
  - `provider.ts` - AI factory (Anthropic/Mock)
  - `document-analyzer.ts` - Multi-modal document analysis

**lib/run-engine/**
- Purpose: Long-running operation execution
- Contains: Executors and continuation triggers
- Key files:
  - `executor.ts` - Main run executor
  - `batch-story-executor.ts` - Batch story processing
  - `process-next-trigger.ts` - Continuation pattern

**lib/export/jira/**
- Purpose: JIRA-compatible export formatting
- Contains: Extraction, normalization, mapping, validation
- Key files:
  - `index.ts` - Public API
  - `extractor.ts` - Query and format
  - `normalizer.ts` - Hierarchy validation
  - `mapper.ts` - JIRA row conversion
  - `validator.ts` - Data quality checks
  - `csv-generator.ts` - CSV output
  - `presets/` - JIRA configuration presets

**server/actions/**
- Purpose: Next.js Server Actions for mutations
- Contains: Type-safe RPC functions
- Key files:
  - `analysis.ts` - Run lifecycle management
  - `generation.ts` - Epic generation
  - `batch-stories.ts` - Batch story generation
  - `projects.ts` - Project CRUD
  - `uploads.ts` - Upload management
  - `jira-export.ts` - JIRA export operations

**lib/observability/**
- Purpose: Monitoring and logging infrastructure
- Contains: Structured logger, heartbeat tracking
- Key files:
  - `logger.ts` - Structured logging
  - `heartbeat.ts` - Stale run detection
  - `index.ts` - Public API exports

## Key File Locations

**Entry Points:**
- `app/layout.tsx` - Root layout with AppShell, fonts, toaster
- `app/page.tsx` - Home page (redirects to /projects)
- `lib/db.ts` - Prisma client initialization

**Configuration:**
- `next.config.ts` - Next.js config (server actions, external packages)
- `tsconfig.json` - TypeScript strict mode config
- `prisma.config.ts` - Prisma datasource config
- `vitest.config.ts` - Test runner config
- `.env.example` - Environment variable documentation

**Core Logic:**
- `lib/ai/provider.ts` - AI service abstraction
- `lib/documents/processor.ts` - Document extraction
- `lib/run-engine/executor.ts` - Run execution
- `lib/export/jira/index.ts` - Export pipeline

**Testing:**
- `lib/export/jira/__tests__/*.test.ts` - Export tests
- `lib/batch-stories/__tests__/*.test.ts` - Batch story tests

**Documentation:**
- `README.md` - Project overview
- `docs/` - Additional documentation

## Naming Conventions

**Files:**
- Components: kebab-case (`run-progress.tsx`, `status-pill.tsx`)
- Utilities: kebab-case (`document-analyzer.ts`, `csv-parser.ts`)
- Page files: `page.tsx`, `layout.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Test files: `*.test.ts` in `__tests__/` directories

**Directories:**
- kebab-case for all directories
- Plural for collections (`components/`, `actions/`, `extractors/`)
- Feature-based organization within components

**Special Patterns:**
- `[id]` - Dynamic route segments
- `index.ts` - Barrel exports for public APIs
- `types.ts` - Type definitions per module

## Where to Add New Code

**New Feature:**
- Primary code: `lib/{feature-name}/`
- Types: `lib/{feature-name}/types.ts`
- Tests: `lib/{feature-name}/__tests__/`
- UI: `components/{feature-name}/`
- Server Action: `server/actions/{feature-name}.ts`

**New Component:**
- Implementation: `components/{category}/{component-name}.tsx`
- If reusable UI primitive: `components/ui/{name}.tsx`

**New API Route:**
- Implementation: `app/api/{path}/route.ts`
- Add `maxDuration` export for long operations

**New Extractor:**
- Implementation: `lib/documents/extractors/{format}-extractor.ts`
- Register in `lib/documents/extractors/index.ts`

**New Export Format:**
- Implementation: `lib/export/{format}/`
- Follow existing JIRA pipeline pattern

## Special Directories

**prisma/**
- Purpose: Database schema and migrations
- Source: Developer-authored schema, Prisma-generated migrations
- Committed: Yes (schema.prisma and migrations/)

**node_modules/**
- Purpose: npm dependencies
- Source: Generated by npm install
- Committed: No (.gitignore)

**.next/**
- Purpose: Next.js build output
- Source: Generated by next build
- Committed: No (.gitignore)

**.planning/**
- Purpose: Project planning documents (this codebase map)
- Source: GSD workflow generated
- Committed: Yes

---

*Structure analysis: 2026-01-09*
*Update when directory structure changes*
