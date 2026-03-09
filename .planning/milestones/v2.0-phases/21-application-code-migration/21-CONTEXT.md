# Phase 21: Application Code Migration - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace four Vercel-specific integrations (Blob storage, Anthropic SDK, Neon DB config, self-continuation HTTP pattern), create a Dockerfile for standalone Next.js, add a health check endpoint, and remove all Vercel-specific environment variables. The application must run in a Docker container with AWS service integrations (S3, Bedrock, standard PostgreSQL) and no Vercel dependencies.

</domain>

<decisions>
## Implementation Decisions

### Local Development Workflow
- Two supported modes: `npm run dev` for fast iteration, Docker for final testing
- `npm run dev` continues using Neon as the database (no change to current dev workflow)
- Docker Compose with PostgreSQL is a nice-to-have convenience but NOT required for Phase 21
- Phase 21 success criteria: standalone Dockerfile only (no Compose requirement)
- Developers need AWS credentials for full functionality; auto-detection handles fallback

### Self-Continuation Replacement
- Fire-and-confirm HTTP pattern (`process-next-trigger.ts`) replaced with direct async function calls
- All generative flows (story, epic, subtask) use in-process loops like `executor.ts` already does for card analysis
- Delete `/api/runs/{id}/process-next` and `/api/runs/{id}/process-next-upload` API routes entirely
- Delete `process-next-trigger.ts` and all supporting functions (`getBaseUrl`, `getBatchSecret`, `validateBatchSecret`, etc.)
- Remove `BATCH_STORY_SECRET` and `VERCEL_AUTOMATION_BYPASS_SECRET` environment variables completely
- Remove all `maxDuration` exports from route files and Vercel-specific timeout configuration from `next.config.ts`
- Stale run recovery (cron) handles stuck runs -- no need for manual retry endpoints

### Storage Column Naming
- Rename database columns: `blobUrl` -> `storageUrl`, `blobPathname` -> `storageKey` via Prisma migration
- Rename TypeScript interfaces to match: `StoredFile.storageUrl`, `StoredFile.storageKey`, `UploadResult.storageUrl`, `UploadResult.storageKey`
- Storage mode values: `"local"` / `"s3"` (rename `"blob"` to `"s3"`)
- Environment variable: `UPLOAD_STORAGE=s3` or `UPLOAD_STORAGE=local`

### Mock Mode & Credential Detection
- AI provider: auto-detect AWS credentials via SDK credential chain. If credentials found, use Bedrock. If not, fall back to MockProvider
- `MOCK_MODE=true` environment variable overrides credential detection -- always uses mock regardless of available credentials
- Storage: same auto-detection pattern. If AWS credentials available, use S3. If not, fall back to local storage mode
- `UPLOAD_STORAGE` env var can still explicitly override auto-detection when set
- No `.env.local.example` with `MOCK_MODE=true` -- developers are expected to have AWS credentials

### Claude's Discretion
- Dockerfile implementation details (multi-stage build, base image, layer optimization)
- Health check endpoint path and response format
- How to structure the Bedrock provider class (extending AIProvider interface)
- Prisma migration strategy for column renames (single migration vs multiple)
- Error handling patterns for credential detection failures
- Cleanup of Vercel-specific comments throughout codebase

</decisions>

<specifics>
## Specific Ideas

- Card analysis executor (`lib/run-engine/executor.ts`) already uses the direct async loop pattern -- use it as the reference implementation for refactoring story/epic/subtask generation
- The `AIProvider` interface is already clean -- Bedrock provider is a drop-in swap implementing the same `generateEpics`, `generateStories`, `generateSubtasks` methods
- Storage abstraction in `lib/storage/index.ts` has a clean mode-switching pattern -- just swap the `"blob"` implementation for S3 SDK calls

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AIProvider` interface (`lib/ai/provider.ts`): Clean provider pattern with `isAvailable()`, `generateEpics()`, `generateStories()`, `generateSubtasks()` -- Bedrock provider implements this
- `MockProvider` class (`lib/ai/provider.ts`): Stays as-is, used when credentials unavailable or `MOCK_MODE=true`
- `executeRun()` in `lib/run-engine/executor.ts`: Reference implementation for direct async loops with concurrency control via `p-limit`
- Storage mode pattern (`lib/storage/index.ts`): `getStorageMode()` already supports mode switching via env var

### Established Patterns
- Provider pattern (interface + concrete implementations + factory function) for AI
- Mode-based storage with environment variable switching
- Prisma client singleton with adapter pattern (`lib/db.ts`)
- Server-only imports for database access

### Integration Points
- `lib/storage/index.ts`: Replace `@vercel/blob` imports with `@aws-sdk/client-s3`
- `lib/ai/provider.ts`: Replace `@anthropic-ai/sdk` with `@anthropic-ai/bedrock-sdk`
- `lib/db.ts`: Remove Vercel/Neon SSL detection, use standard connection string
- `lib/run-engine/process-next-trigger.ts`: Delete entirely, refactor callers to direct async
- `app/api/cron/recover-stale-runs/route.ts`: Remove Vercel-specific auth header check, remove `maxDuration`
- `next.config.ts`: Remove Vercel timeout comments, keep `serverExternalPackages`
- `package.json`: Add `@aws-sdk/client-s3`, `@aws-sdk/credential-providers`, `@anthropic-ai/bedrock-sdk`; remove `@vercel/blob`, `@anthropic-ai/sdk`

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 21-application-code-migration*
*Context gathered: 2026-03-05*
