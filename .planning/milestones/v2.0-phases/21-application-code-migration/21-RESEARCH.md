# Phase 21: Application Code Migration - Research

**Researched:** 2026-03-05
**Domain:** Next.js application migration from Vercel platform services to AWS (S3, Bedrock, standard PostgreSQL, Docker)
**Confidence:** HIGH

## Summary

This phase migrates a Next.js 16 application from Vercel-specific services to portable AWS equivalents. The codebase has four clear integration points requiring change: (1) storage via `@vercel/blob` to `@aws-sdk/client-s3`, (2) AI provider via `@anthropic-ai/sdk` to `@anthropic-ai/bedrock-sdk`, (3) database connection cleanup removing Vercel/Neon SSL detection, and (4) elimination of the fire-and-confirm HTTP self-trigger pattern in favor of direct async function calls. A Dockerfile must be created for standalone Next.js deployment.

The existing codebase is well-architected for this migration. The `AIProvider` interface pattern means the Bedrock swap is nearly drop-in. The storage abstraction in `lib/storage/index.ts` has a clean mode-switching pattern. The `executor.ts` already demonstrates the direct async loop pattern that must replace the HTTP self-trigger in story/epic/subtask generation flows. The primary complexity lies in the upload flow, which currently uses Vercel Blob's client-side upload SDK -- this needs replacement with S3 presigned URLs (deferred to Phase 23 per STOR-02, but the server-side storage adapter must be ready now).

**Primary recommendation:** Work in five sequential waves: (1) package swap and Dockerfile, (2) storage adapter S3 replacement, (3) AI provider Bedrock replacement, (4) self-continuation elimination, (5) cleanup of all Vercel references including health check, db.ts, and env vars.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two supported modes: `npm run dev` for fast iteration, Docker for final testing
- `npm run dev` continues using Neon as the database (no change to current dev workflow)
- Docker Compose with PostgreSQL is a nice-to-have convenience but NOT required for Phase 21
- Phase 21 success criteria: standalone Dockerfile only (no Compose requirement)
- Developers need AWS credentials for full functionality; auto-detection handles fallback
- Fire-and-confirm HTTP pattern (`process-next-trigger.ts`) replaced with direct async function calls
- All generative flows (story, epic, subtask) use in-process loops like `executor.ts` already does for card analysis
- Delete `/api/runs/{id}/process-next` and `/api/runs/{id}/process-next-upload` API routes entirely
- Delete `process-next-trigger.ts` and all supporting functions (`getBaseUrl`, `getBatchSecret`, `validateBatchSecret`, etc.)
- Remove `BATCH_STORY_SECRET` and `VERCEL_AUTOMATION_BYPASS_SECRET` environment variables completely
- Remove all `maxDuration` exports from route files and Vercel-specific timeout configuration from `next.config.ts`
- Stale run recovery (cron) handles stuck runs -- no need for manual retry endpoints
- Rename database columns: `blobUrl` -> `storageUrl`, `blobPathname` -> `storageKey` via Prisma migration
- Rename TypeScript interfaces to match: `StoredFile.storageUrl`, `StoredFile.storageKey`, `UploadResult.storageUrl`, `UploadResult.storageKey`
- Storage mode values: `"local"` / `"s3"` (rename `"blob"` to `"s3"`)
- Environment variable: `UPLOAD_STORAGE=s3` or `UPLOAD_STORAGE=local`
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CODE-01 | Storage adapter uses S3 SDK instead of `@vercel/blob` | S3 SDK patterns documented; storage abstraction already exists in `lib/storage/index.ts` |
| CODE-02 | AI provider uses Bedrock SDK with correct model IDs | Bedrock SDK is API-compatible drop-in; `AIProvider` interface pattern already clean |
| CODE-03 | Database connection uses standard PostgreSQL connection string | `lib/db.ts` Vercel/Neon SSL detection identified; simple cleanup |
| CODE-04 | Dockerfile produces working standalone Next.js container | Next.js standalone output pattern documented with multi-stage build |
| CODE-05 | Self-continuation HTTP pattern replaced with direct async calls | `executor.ts` reference implementation identified; 3 server actions + 2 API routes + heartbeat need refactoring |
| CODE-06 | Health check endpoint returns 200 for ALB/ECS | Existing `/api/health` route needs Vercel references removed |
| CODE-07 | All Vercel-specific env vars and config removed | Full inventory of VERCEL_URL, BATCH_STORY_SECRET, VERCEL_AUTOMATION_BYPASS_SECRET references catalogued |
| CODE-08 | Package dependencies updated (add AWS SDKs, remove Vercel/Anthropic) | Package additions/removals identified with versions |
| AI-03 | Mock mode continues to work without Bedrock access | MockProvider stays as-is; credential auto-detection with MOCK_MODE override |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@aws-sdk/client-s3` | ^3.x (latest) | S3 put, get, delete operations | Official AWS SDK v3 for S3 |
| `@aws-sdk/credential-providers` | ^3.x (latest) | `fromNodeProviderChain()` for credential auto-detection | Official AWS credential chain provider |
| `@anthropic-ai/bedrock-sdk` | ^0.9.x (latest) | Claude API via Bedrock | Official Anthropic SDK for Bedrock, API-compatible with `@anthropic-ai/sdk` |

### Removed
| Library | Purpose | Replacement |
|---------|---------|-------------|
| `@vercel/blob` (^0.27.1) | File upload storage | `@aws-sdk/client-s3` |
| `@anthropic-ai/sdk` (^0.71.2) | Direct Anthropic API | `@anthropic-ai/bedrock-sdk` |

### No Change
| Library | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.1 | Application framework |
| `@prisma/client` | ^7.2.0 | ORM |
| `@prisma/adapter-pg` | ^7.2.0 | PostgreSQL adapter |
| `pg` | ^8.16.0 | PostgreSQL driver |
| `p-limit` | ^7.2.0 | Concurrency control (used by executor) |

**Installation:**
```bash
npm install @aws-sdk/client-s3 @aws-sdk/credential-providers @anthropic-ai/bedrock-sdk
npm uninstall @vercel/blob @anthropic-ai/sdk
```

## Architecture Patterns

### Recommended Change Map
```
lib/
  storage/
    index.ts              # Rewrite: S3 SDK replaces @vercel/blob
  ai/
    provider.ts           # Rewrite: BedrockProvider replaces AnthropicProvider
    document-analyzer.ts  # Update: import AnthropicBedrock instead of Anthropic
    question-generator.ts # Update: import AnthropicBedrock instead of Anthropic
  db.ts                   # Simplify: remove Vercel/Neon SSL detection
  run-engine/
    process-next-trigger.ts  # DELETE entirely
    executor.ts              # No change (reference implementation)
    batch-story-executor.ts  # Already uses direct async pattern
    subtask-executor.ts      # Remove timeout/continuation logic

server/actions/
  analysis.ts             # Replace trigger with direct executeRun() call
  batch-stories.ts        # Replace trigger with direct executeBatchStoryRun() call
  subtasks.ts             # Replace trigger with direct executeSubtaskGeneration() call

app/api/
  runs/[id]/process-next/route.ts         # DELETE entirely
  runs/[id]/process-next-upload/route.ts  # DELETE entirely
  cron/recover-stale-runs/route.ts        # Remove maxDuration, update auth
  uploads/route.ts                        # Rename blobUrl/blobPathname fields
  uploads/get-upload-url/route.ts         # DELETE (Vercel Blob client upload)
  health/route.ts                         # Remove Vercel env references

components/uploads/
  multi-file-upload.tsx   # Remove @vercel/blob/client import (upload flow)

lib/observability/
  heartbeat.ts            # Remove triggerProcessNext recovery logic
```

### Pattern 1: Bedrock Provider (Drop-in Replacement)
**What:** Replace `AnthropicProvider` with `BedrockProvider` using identical API surface
**When to use:** All AI calls (epics, stories, subtasks, document analysis, question generation)
**Example:**
```typescript
// Source: @anthropic-ai/bedrock-sdk official examples
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

class BedrockProvider implements AIProvider {
  private client: AnthropicBedrock;

  constructor() {
    // Auto-detects AWS credentials via standard chain
    // (env vars, ~/.aws/credentials, IAM role, container credentials)
    this.client = new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION || "us-east-1",
    });
  }

  isAvailable(): boolean {
    return true; // Credential errors surface at call time
  }

  async generateEpics(cards, projectContext?, mssContext?) {
    // messages.create() API is identical to @anthropic-ai/sdk
    const message = await this.client.messages.create({
      model: "anthropic.claude-sonnet-4-20250514-v1:0",  // Bedrock model ID format
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    // Response structure is identical
  }
}
```

### Pattern 2: S3 Storage Adapter
**What:** Replace Vercel Blob put/del/fetch with S3 SDK commands
**When to use:** `lib/storage/index.ts` rewrite
**Example:**
```typescript
// Source: AWS SDK v3 documentation
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const BUCKET = process.env.S3_BUCKET_NAME!;

export async function uploadToStorage(buffer: Buffer, filename: string, contentType: string): Promise<UploadResult> {
  const mode = getStorageMode();
  if (mode === "s3") {
    const key = `uploads/${Date.now()}-${filename}`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    return { storageUrl: `s3://${BUCKET}/${key}`, storageKey: key };
  }
  return {};
}

export async function getFileBuffer(localBuffer: Buffer | null, storageKey?: string | null): Promise<Buffer> {
  const mode = getStorageMode();
  if (mode === "s3" && storageKey) {
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }));
    const stream = response.Body;
    // Convert stream to Buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  if (!localBuffer) throw new Error("No buffer available in local mode");
  return localBuffer;
}

export async function deleteFromStorage(storageKey?: string | null): Promise<void> {
  if (!storageKey) return;
  const mode = getStorageMode();
  if (mode === "s3") {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey }));
    } catch (error) {
      console.warn("Failed to delete from S3:", error);
    }
  }
}
```

### Pattern 3: Direct Async Execution (Self-Continuation Replacement)
**What:** Server actions call executor functions directly instead of HTTP triggers
**When to use:** All three server actions (analysis, batch-stories, subtasks)
**Example:**
```typescript
// server/actions/batch-stories.ts
// BEFORE: triggerProcessNextAsync(run.id)
// AFTER: direct async call (fire-and-forget via unhandled promise)
import { executeBatchStoryRun } from "@/lib/run-engine/batch-story-executor";

// Inside server action, after creating the run:
// Fire and forget -- the run executes in the background
// No await -- server action returns immediately with run ID
executeBatchStoryRun(run.id).catch((error) => {
  console.error(`[BatchStoryRun] Background execution failed:`, error);
});

// Return run ID to client immediately
return { success: true, runId: run.id };
```

### Pattern 4: AWS Credential Auto-Detection
**What:** Detect available credentials and fall back to mock mode
**When to use:** `getAIProvider()` factory and `getStorageMode()` functions
**Example:**
```typescript
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";

async function hasAwsCredentials(): Promise<boolean> {
  try {
    const provider = fromNodeProviderChain();
    await provider();
    return true;
  } catch {
    return false;
  }
}

// For the AI provider factory:
export async function getAIProvider(): Promise<AIProvider> {
  // MOCK_MODE override: always return mock
  if (process.env.MOCK_MODE === "true") return new MockProvider();
  // Try AWS credentials
  if (await hasAwsCredentials()) return new BedrockProvider();
  // Fallback to mock
  return new MockProvider();
}
```

**Note:** Making `getAIProvider()` async is a breaking change. All callers (executor.ts, batch-story-executor.ts, subtask-executor.ts, document-analyzer.ts, question-generator.ts) need `await getAIProvider()`. Alternatively, detect credentials once at startup and cache the result.

### Pattern 5: Next.js Standalone Dockerfile
**What:** Multi-stage Dockerfile for standalone Next.js
**When to use:** `Dockerfile` at project root
**Example:**
```dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Generate Prisma client and build Next.js in standalone mode
RUN npx prisma generate && npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Copy Prisma schema and migrations for runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

**Critical:** Requires `output: "standalone"` in `next.config.ts`.

### Anti-Patterns to Avoid
- **Do NOT await the background executor in server actions:** The server action must return immediately with the run ID. The executor runs in-process in the background. Use `.catch()` for error logging.
- **Do NOT create a separate S3 presigned URL upload flow in Phase 21:** That is Phase 23 (STOR-02). Phase 21 only swaps the server-side storage adapter. The client-side upload component (`multi-file-upload.tsx`) will need a different approach but NOT in this phase.
- **Do NOT use Alpine for Prisma if it causes issues:** Prisma generates platform-specific binaries. If Alpine causes issues with `@prisma/client`, switch to `node:22-slim`. The standalone build should include Prisma engine binaries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AWS credential detection | Custom env var checking | `fromNodeProviderChain()` from `@aws-sdk/credential-providers` | Handles 7+ credential sources (env, file, IAM, container, SSO, etc.) |
| S3 operations | Custom HTTP calls to S3 API | `@aws-sdk/client-s3` commands | Handles signing, retries, streaming, error codes |
| Bedrock API calls | Custom HTTP calls to Bedrock | `@anthropic-ai/bedrock-sdk` | Same API as `@anthropic-ai/sdk`, handles SigV4 signing |
| Docker layer caching | Single-stage Dockerfile | Multi-stage build with separate deps/build/run stages | Rebuild speed: dependency layer cached separately from code |

## Common Pitfalls

### Pitfall 1: Prisma in Alpine Docker
**What goes wrong:** Prisma generates platform-specific engine binaries. Alpine uses musl libc, not glibc. If the wrong binary target is generated, Prisma crashes at runtime.
**Why it happens:** Prisma auto-detects the platform during `prisma generate`, but the build stage platform must match the runner stage platform.
**How to avoid:** Both builder and runner stages must use the same base (both Alpine or both Debian). Alternatively, set `binaryTargets` in `schema.prisma`: `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`.
**Warning signs:** `Error: Unknown binaryTarget linux-musl` or `ENOENT: no such file or directory` for query engine.

### Pitfall 2: Async getAIProvider() Breaking Change
**What goes wrong:** Making `getAIProvider()` async to support credential detection breaks all synchronous callers.
**Why it happens:** AWS credential detection (`fromNodeProviderChain()`) is async.
**How to avoid:** Two options: (A) detect credentials once at module load time with a cached promise, or (B) make all callers async (executor.ts already is, so this is mainly about the factory call sites). Option B is cleaner. All callers already use `getAIProvider()` in async contexts.
**Warning signs:** Unresolved promises, `TypeError: provider.generateEpics is not a function`.

### Pitfall 3: Server Action Background Execution
**What goes wrong:** Server actions in Next.js may terminate their execution context after returning. A fire-and-forget `executeBatchStoryRun()` could be killed.
**Why it happens:** Next.js may garbage-collect the execution context of completed server actions.
**How to avoid:** This is exactly why the Vercel pattern used HTTP self-calls. In a Docker container, the Node.js process persists, so in-process fire-and-forget works. The executor's `activeRuns` Map keeps a reference preventing GC.
**Warning signs:** Runs stuck in RUNNING status with no progress. The stale run recovery cron should catch these.

### Pitfall 4: Missing `output: "standalone"` in next.config.ts
**What goes wrong:** Docker build succeeds but image is huge (>1GB) or `server.js` doesn't exist.
**Why it happens:** Without `output: "standalone"`, Next.js doesn't produce the minimal standalone server.
**How to avoid:** Add `output: "standalone"` to `next.config.ts` before building the Dockerfile.
**Warning signs:** No `.next/standalone` directory after build; `node server.js` fails.

### Pitfall 5: S3 GetObject Stream Handling
**What goes wrong:** `GetObjectCommand` response Body is a ReadableStream, not a Buffer.
**Why it happens:** AWS SDK v3 streams responses for memory efficiency.
**How to avoid:** Convert stream to Buffer using async iteration (see code example above). For Node.js, you can also use `response.Body.transformToByteArray()`.
**Warning signs:** `TypeError: Cannot read properties of undefined` when treating Body as Buffer.

### Pitfall 6: Client Upload Component Left Broken
**What goes wrong:** `multi-file-upload.tsx` imports `@vercel/blob/client` which no longer exists after package removal.
**Why it happens:** The client-side upload flow uses Vercel Blob's client SDK directly.
**How to avoid:** The component must be updated to NOT use `@vercel/blob/client`. Since presigned URL upload is Phase 23 (STOR-02), for Phase 21 the upload must work via server-side form submission or the component import must be replaced with a temporary server-side upload path.
**Warning signs:** Build fails with `Cannot find module '@vercel/blob/client'`.

### Pitfall 7: Heartbeat Recovery Still References process-next-trigger
**What goes wrong:** `lib/observability/heartbeat.ts` dynamically imports `triggerProcessNext` from the deleted file.
**Why it happens:** The heartbeat recovery mechanism re-triggers stale runs via HTTP self-calls.
**How to avoid:** Update heartbeat recovery to call the executor directly instead of HTTP trigger, or remove the heartbeat recovery entirely since stale run recovery cron handles this.
**Warning signs:** Runtime error when a stale run is detected by heartbeat.

## Code Examples

### Bedrock Model ID Format
```typescript
// Source: Bedrock SDK documentation and AWS Bedrock model catalog
// Current direct Anthropic model ID: "claude-sonnet-4-20250514"
// Bedrock model ID format:           "anthropic.claude-sonnet-4-20250514-v1:0"
//
// For the existing codebase, all three AI files use:
//   model: "claude-sonnet-4-20250514"
// Replace with:
//   model: "anthropic.claude-sonnet-4-20250514-v1:0"
```

### Database Connection Simplification
```typescript
// Source: Existing lib/db.ts analysis
// BEFORE:
const isVercel = connectionString.includes("vercel-storage.com") ||
  connectionString.includes("neon.tech") ||
  process.env.VERCEL === "1";
const adapter = new PrismaPg({
  connectionString,
  ssl: isVercel ? { rejectUnauthorized: false } : undefined,
});

// AFTER:
const adapter = new PrismaPg({ connectionString });
// SSL configuration should come from the connection string itself
// e.g., DATABASE_URL=postgresql://...?sslmode=require
// For local dev with Neon, the connection string already handles SSL
```

### Health Check Simplification
```typescript
// Source: Existing app/api/health/route.ts analysis
// BEFORE:
environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
region: process.env.VERCEL_REGION || "local",

// AFTER:
environment: process.env.NODE_ENV || "development",
region: process.env.AWS_REGION || "local",
// Also update aiEnabled check from ANTHROPIC_API_KEY to credential-based
```

### Prisma Migration for Column Renames
```sql
-- Single migration file
ALTER TABLE "Upload" RENAME COLUMN "blobUrl" TO "storageUrl";
ALTER TABLE "Upload" RENAME COLUMN "blobPathname" TO "storageKey";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@anthropic-ai/sdk` direct | `@anthropic-ai/bedrock-sdk` via AWS | Migration | Same API, different auth (IAM vs API key) |
| `@vercel/blob` hosted storage | `@aws-sdk/client-s3` | Migration | Different API, same concepts (put/get/delete) |
| HTTP self-trigger continuation | In-process async execution | Migration | Simpler, no network overhead, works in containers |
| Vercel serverless (cold start, 300s limit) | Docker container (persistent process) | Migration | No timeout limits, persistent in-memory state |

## Open Questions

1. **Client-side upload component transition**
   - What we know: `multi-file-upload.tsx` uses `@vercel/blob/client` for direct client-to-blob uploads. Phase 23 (STOR-02) will implement presigned URL upload flow.
   - What's unclear: What should the upload component do in Phase 21? Options: (A) temporary server-side upload via form data, (B) disable blob mode and force local-only uploads, (C) implement a minimal S3 presigned URL flow now.
   - Recommendation: Option A -- route upload through server action using standard FormData. This keeps uploads functional while `@vercel/blob` is removed. The component sends files to a server action which uses the new S3 storage adapter.

2. **Credential detection timing**
   - What we know: `fromNodeProviderChain()` is async. The current `getAIProvider()` is synchronous.
   - What's unclear: Whether to detect once at startup (cached) or on every call.
   - Recommendation: Detect once at startup, cache the boolean result. Use a module-level promise that resolves on first import.

3. **Subtask executor timeout logic**
   - What we know: `subtask-executor.ts` has a timeout + continuation pattern (lines 109-114) designed for Vercel serverless.
   - What's unclear: Whether to keep timeout logic for safety or remove it entirely.
   - Recommendation: Remove the timeout logic. In Docker, there is no serverless execution limit. The executor should process all items in a single invocation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.16 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CODE-01 | S3 storage adapter put/get/delete | unit | `npx vitest run lib/storage/__tests__/s3-adapter.test.ts -x` | No -- Wave 0 |
| CODE-02 | Bedrock provider generates epics/stories/subtasks | unit | `npx vitest run lib/ai/__tests__/bedrock-provider.test.ts -x` | No -- Wave 0 |
| CODE-03 | DB connection without Vercel SSL logic | unit | `npx vitest run lib/__tests__/db.test.ts -x` | No -- Wave 0 |
| CODE-04 | Dockerfile builds and starts on port 3000 | smoke | `docker build -t rf-test . && docker run --rm -p 3000:3000 -e DATABASE_URL=mock -e MOCK_MODE=true rf-test &` | Manual |
| CODE-05 | Direct async calls replace HTTP triggers | unit | `npx vitest run server/actions/__tests__/direct-execution.test.ts -x` | No -- Wave 0 |
| CODE-06 | Health check returns 200 | smoke | `curl -s http://localhost:3000/api/health` | Manual |
| CODE-07 | No Vercel env var references remain | lint | `grep -r "VERCEL_URL\|BATCH_STORY_SECRET\|VERCEL_AUTOMATION_BYPASS_SECRET" --include="*.ts" --include="*.tsx" lib/ app/ server/ components/` | Manual |
| CODE-08 | Package deps correct | unit | `node -e "require('@aws-sdk/client-s3'); require('@anthropic-ai/bedrock-sdk')"` | Manual |
| AI-03 | Mock mode works without credentials | unit | `npx vitest run lib/ai/__tests__/mock-fallback.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green + `docker build` succeeds + grep for Vercel references returns empty

### Wave 0 Gaps
- [ ] `lib/storage/__tests__/s3-adapter.test.ts` -- covers CODE-01 (mock S3Client)
- [ ] `lib/ai/__tests__/bedrock-provider.test.ts` -- covers CODE-02 (mock AnthropicBedrock)
- [ ] `lib/ai/__tests__/mock-fallback.test.ts` -- covers AI-03 (credential detection fallback)
- [ ] `server/actions/__tests__/direct-execution.test.ts` -- covers CODE-05 (verify no HTTP triggers)
- [ ] Update `vitest.config.ts` coverage include to add `lib/storage/**`, `lib/ai/**`, `server/actions/**`

## Detailed File Impact Inventory

### Files to DELETE
| File | Reason |
|------|--------|
| `lib/run-engine/process-next-trigger.ts` | Entire HTTP self-trigger pattern eliminated |
| `app/api/runs/[id]/process-next/route.ts` | API route no longer needed |
| `app/api/runs/[id]/process-next-upload/route.ts` | API route no longer needed |
| `app/api/uploads/get-upload-url/route.ts` | Vercel Blob client upload endpoint |

### Files to REWRITE
| File | Change |
|------|--------|
| `lib/storage/index.ts` | S3 SDK replaces @vercel/blob; rename types; add auto-detect |
| `lib/ai/provider.ts` | BedrockProvider replaces AnthropicProvider; async getAIProvider; credential auto-detect |
| `lib/ai/document-analyzer.ts` | Import AnthropicBedrock, update model ID, async provider detection |
| `lib/ai/question-generator.ts` | Import AnthropicBedrock, update model ID, async provider detection |
| `components/uploads/multi-file-upload.tsx` | Remove @vercel/blob/client; use server-side upload |
| `app/api/uploads/route.ts` | Rename blobUrl/blobPathname to storageUrl/storageKey |

### Files to MODIFY (smaller changes)
| File | Change |
|------|--------|
| `lib/db.ts` | Remove Vercel/Neon SSL detection, POSTGRES_URL fallback |
| `app/api/health/route.ts` | Remove VERCEL_ENV, VERCEL_REGION, update aiEnabled |
| `app/api/cron/recover-stale-runs/route.ts` | Remove maxDuration export, update Vercel comments |
| `app/api/uploads/route.ts` | Remove maxDuration |
| `next.config.ts` | Add `output: "standalone"`, remove Vercel comments |
| `server/actions/analysis.ts` | Replace triggerProcessNextUploadAsync with direct executeRun |
| `server/actions/batch-stories.ts` | Replace triggerProcessNextAsync with direct executeBatchStoryRun |
| `server/actions/subtasks.ts` | Replace triggerProcessNextAsync with direct executeSubtaskGeneration + finalizeSubtaskRun |
| `lib/run-engine/subtask-executor.ts` | Remove timeout/continuation pattern, simplify to full processing |
| `lib/observability/heartbeat.ts` | Remove triggerProcessNext dynamic import and recovery |
| `package.json` | Add AWS SDKs, remove Vercel/Anthropic packages |
| `prisma/schema.prisma` | Rename blobUrl->storageUrl, blobPathname->storageKey |

### Files to CREATE
| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage standalone Next.js container |
| `.dockerignore` | Exclude node_modules, .next, .git, etc. |
| Prisma migration file | Column renames via `prisma migrate dev` |

## Sources

### Primary (HIGH confidence)
- `@anthropic-ai/bedrock-sdk` [NPM](https://www.npmjs.com/package/@anthropic-ai/bedrock-sdk) and [GitHub](https://github.com/anthropics/anthropic-sdk-typescript/tree/main/packages/bedrock-sdk) - API compatibility confirmed as drop-in replacement
- `@aws-sdk/client-s3` [Official docs](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html) - PutObject, GetObject, DeleteObject patterns
- `@aws-sdk/credential-providers` [NPM](https://www.npmjs.com/package/@aws-sdk/credential-providers) - fromNodeProviderChain API
- Next.js [official Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker) - standalone Dockerfile pattern
- Direct codebase analysis of all affected files (HIGH confidence on current state)

### Secondary (MEDIUM confidence)
- Bedrock model ID format `anthropic.claude-sonnet-4-20250514-v1:0` - based on SDK examples and AWS naming convention. Exact model availability depends on Bedrock model access in us-east-1.

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries are official, well-documented, current
- Architecture: HIGH - codebase directly examined, patterns are clear and well-structured
- Pitfalls: HIGH - based on direct codebase analysis and known Docker/Prisma/AWS SDK issues
- File inventory: HIGH - based on comprehensive grep and file reading of entire codebase

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable libraries, well-understood migration)
