# Domain Pitfalls: Next.js Vercel-to-AWS Migration

**Domain:** Next.js 16 application migration from Vercel to ECS Fargate
**Researched:** 2026-03-05
**Confidence:** HIGH (verified against official docs, codebase analysis, community reports)

---

## Critical Pitfalls

Mistakes that cause deployment failures, data loss, or major rework.

### Pitfall 1: Next.js Standalone Output Missing Static Assets and Public Folder

**What goes wrong:** The `output: "standalone"` mode in `next.config.ts` produces a minimal `server.js` but deliberately excludes the `public/` folder and `.next/static/` directory. The Docker image builds and starts but serves no CSS, JS bundles, or static assets. The app appears completely broken with unstyled, non-functional pages.

**Why it happens:** Next.js assumes a CDN (like Vercel's edge network) will serve static assets. In a self-hosted Docker container, there is no CDN -- the container must serve everything. Developers copy `.next/standalone` and assume it is complete.

**Consequences:** App loads but is non-functional. White screen or unstyled HTML. Every static asset returns 404.

**Prevention:**
1. Add `output: "standalone"` to `next.config.ts`
2. In the Dockerfile runner stage, explicitly copy the missing directories:
   ```dockerfile
   COPY --from=builder /app/.next/standalone ./
   COPY --from=builder /app/.next/static ./.next/static
   COPY --from=builder /app/public ./public
   ```
3. Test the Docker image locally before deploying to ECS

**Detection:** Run the Docker container locally and open the app in a browser. If styles are missing or the page is blank, this is the cause.

**Phase:** Dockerfile creation (early infrastructure phase)

**Confidence:** HIGH -- documented in [Next.js output docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) and extensively reported in [GitHub Discussion #13304](https://github.com/vercel/next.js/discussions/13304)

---

### Pitfall 2: Bedrock Model IDs Are Different from Anthropic API Model IDs

**What goes wrong:** The codebase uses `"claude-sonnet-4-20250514"` in all three AI generation methods (`generateEpics`, `generateStories`, `generateSubtasks`). Bedrock requires a completely different model ID format: `"anthropic.claude-sonnet-4-20250514-v1:0"` (with `anthropic.` prefix and version suffix). Using the Anthropic-format model ID against Bedrock returns a `ValidationException` or model-not-found error.

**Why it happens:** The `@anthropic-ai/bedrock-sdk` package uses the same `messages.create()` API surface as `@anthropic-ai/sdk`, so developers assume the model IDs are also the same. They are not.

**Consequences:** Every AI call fails immediately. No cards, epics, stories, or subtasks can be generated. The entire core functionality is broken.

**Prevention:**
1. Replace `@anthropic-ai/sdk` with `@anthropic-ai/bedrock-sdk` (install: `npm install @anthropic-ai/bedrock-sdk`)
2. Change the client constructor from `new Anthropic({ apiKey })` to `new AnthropicBedrock({ awsRegion: 'us-east-1' })`
3. Map all model IDs to Bedrock format. Create a constant:
   ```typescript
   const BEDROCK_MODEL = "anthropic.claude-sonnet-4-20250514-v1:0";
   ```
4. Remove `ANTHROPIC_API_KEY` references -- Bedrock uses IAM credentials from the ECS task role
5. Verify Claude Sonnet 4 availability in us-east-1 via the Bedrock console before coding

**Detection:** Any call to `messages.create()` throws immediately with a model validation error.

**Phase:** AI provider migration (core functionality phase)

**Confidence:** HIGH -- verified via [@anthropic-ai/bedrock-sdk docs](https://github.com/anthropics/anthropic-sdk-typescript/tree/main/packages/bedrock-sdk) and [Anthropic Bedrock documentation](https://docs.anthropic.com/en/api/claude-on-amazon-bedrock)

---

### Pitfall 3: Self-Referencing Fetch Calls Will Break on ECS Without Correct Base URL

**What goes wrong:** The codebase has a "fire-and-confirm" pattern in `lib/run-engine/process-next-trigger.ts` that makes HTTP fetch calls back to itself (e.g., `fetch("https://${VERCEL_URL}/api/runs/${runId}/process-next")`). On Vercel, `VERCEL_URL` resolves to the deployment's public URL. On ECS Fargate behind an internal ALB, there is no `VERCEL_URL` and the container cannot reach itself through the ALB domain without proper DNS/networking.

**Why it happens:** The `getBaseUrl()` function checks `VERCEL_URL`, then `NEXT_PUBLIC_VERCEL_URL`, then `NEXT_PUBLIC_APP_URL`, then falls back to `localhost:3000`. On ECS, none of the Vercel env vars exist. The fallback to `localhost:3000` will work in a single-container setup (container can reach itself on localhost) BUT will fail if the ALB does health checks on a different path, or if the container port mapping differs.

**Consequences:** Story generation, card analysis, and subtask generation all use the self-triggering continuation pattern. If the base URL is wrong, processing starts but never continues past the first item. Runs appear stuck in RUNNING state forever.

**Prevention:**
1. Set `NEXT_PUBLIC_APP_URL` environment variable in the ECS task definition to `http://localhost:3000` (for self-referencing within the same container)
2. Verify that the container port is 3000 and matches the `PORT` env var
3. Alternatively, since ECS Fargate runs a long-lived process (not serverless), consider eliminating the self-triggering HTTP pattern entirely and using direct in-process async execution -- the 300s timeout constraint from Vercel no longer applies
4. Test the stale run recovery cron separately

**Detection:** Runs start but never progress past the first epic/upload. Logs show "Failed to trigger process-next" errors.

**Phase:** Run engine refactoring (should be addressed early, before testing generative flows)

**Confidence:** HIGH -- direct codebase analysis of `process-next-trigger.ts`

---

### Pitfall 4: Prisma Binary Target Mismatch in Docker Multi-Stage Build

**What goes wrong:** Prisma generates platform-specific query engine binaries during `prisma generate`. If the build stage uses a different base image (e.g., Alpine/musl) than the runtime stage (e.g., Debian/glibc), or if the build runs on macOS (darwin) and the binary is copied to a Linux container, Prisma throws `PrismaClientInitializationError: Query engine library for current platform "linux-musl" could not be found`.

**Why it happens:** The project uses Prisma 7 with `@prisma/adapter-pg` (driver adapter). In Prisma 7, the driver adapter pattern means no binary query engine is needed -- queries go through the pg driver directly. However, `prisma generate` still needs to run to generate the client code, and if any schema introspection or migration commands run in the container, they still need the correct engine binary.

**Consequences:** Container starts but crashes on first database query. Or worse: builds succeed, container starts, app appears to work, but fails only when hitting a specific code path.

**Prevention:**
1. Use the same base image family for both build and runtime stages (recommend `node:22-slim` for both, which uses Debian/glibc)
2. If using Alpine, do NOT install glibc -- Prisma explicitly warns against this
3. Run `prisma generate` inside the Docker build, not on the host machine
4. If using driver adapters (`@prisma/adapter-pg`), verify that the Prisma Client works without the binary engine in your chosen Docker image
5. Add `openssl` to the runtime image: `RUN apt-get update && apt-get install -y openssl`

**Detection:** Container crashes immediately on startup with Prisma engine errors in logs.

**Phase:** Dockerfile creation

**Confidence:** HIGH -- verified via [Prisma Docker guide](https://www.prisma.io/docs/guides/docker) and [Prisma AWS deployment caveats](https://www.prisma.io/docs/orm/prisma-client/deployment/caveats-when-deploying-to-aws-platforms)

---

### Pitfall 5: Vercel Blob Client Upload API Has No S3 Equivalent Drop-In

**What goes wrong:** The codebase uses `@vercel/blob`'s `handleUpload` function in `app/api/uploads/get-upload-url/route.ts` which provides a complete client-to-storage upload flow with token generation, validation, and completion callbacks. S3 presigned URLs are a lower-level primitive with no built-in equivalent to `handleUpload`'s `onBeforeGenerateToken` and `onUploadCompleted` callbacks.

**Why it happens:** Developers assume "replace Vercel Blob with S3 presigned URLs" is a simple swap. It is not. The Vercel Blob SDK handles: (a) CORS automatically, (b) token-based authorization, (c) upload completion notification, (d) content type validation, (e) size limits. With S3, every one of these must be implemented manually.

**Consequences:** Upload feature breaks entirely. Or uploads appear to work but files are inaccessible, CORS blocks the browser, or large file uploads fail silently.

**Prevention:**
1. Create an API route that generates S3 presigned PUT URLs using `@aws-sdk/s3-request-presigner`
2. Configure S3 bucket CORS policy to allow PUT from the app's origin (or `*` for internal apps)
3. Implement server-side validation before generating presigned URLs (replaces `onBeforeGenerateToken`)
4. After successful client upload, have the client call a confirmation API route (replaces `onUploadCompleted`)
5. For files over 100MB, implement multipart upload with presigned URLs per part
6. Replace `getFileBuffer()` which uses `fetch(blobUrl)` -- S3 objects may not be publicly accessible; use `GetObjectCommand` from the SDK instead
7. Replace `del(blobUrl)` with `DeleteObjectCommand`

**Detection:** Upload button does nothing, browser console shows CORS errors, or files upload but cannot be retrieved.

**Phase:** Storage migration (should be done before testing document upload/analysis pipeline)

**Confidence:** HIGH -- direct codebase analysis of `lib/storage/index.ts` and `app/api/uploads/get-upload-url/route.ts`

---

## Moderate Pitfalls

### Pitfall 6: Database Connection String SSL Handling

**What goes wrong:** The `lib/db.ts` file has Vercel-specific SSL detection that checks for `vercel-storage.com` or `neon.tech` in the connection string, plus `process.env.VERCEL === "1"`. On AWS, RDS PostgreSQL uses different SSL requirements. If SSL is misconfigured, the app either cannot connect to RDS at all, or connects without encryption (security risk in corporate environments).

**Prevention:**
1. Remove the Vercel-specific SSL detection logic entirely
2. For RDS, append `?sslmode=require` to the `DATABASE_URL` connection string
3. If corporate policy requires certificate validation, download the RDS CA bundle and configure `ssl: { ca: fs.readFileSync('/path/to/rds-ca.pem') }` in the PrismaPg adapter
4. For POC, `sslmode=no-verify` works but document this as a security shortcut

**Detection:** App crashes on startup with "SSL connection required" or ECONNREFUSED errors to the database.

**Phase:** Database connection setup

**Confidence:** HIGH -- verified via [Prisma AWS caveats](https://www.prisma.io/docs/orm/prisma-client/deployment/caveats-when-deploying-to-aws-platforms)

---

### Pitfall 7: Connection Pool Exhaustion in Long-Running ECS Container

**What goes wrong:** On Vercel, each serverless function invocation creates a fresh Prisma client that is garbage collected after the function completes. On ECS Fargate, the same container runs for hours/days. The Prisma connection pool can leak connections over time, eventually exhausting the RDS connection limit. Symptoms: "Timed out fetching a new connection from the pool" errors that worsen until the container is restarted.

**Prevention:**
1. Set explicit connection pool size in the connection string: `?connection_limit=10` (for a 0.5 vCPU Fargate task, use `vCPU_cores * 2 + 1`)
2. Do NOT use RDS Proxy with Prisma -- Prisma uses prepared statements which cause RDS Proxy to pin connections, eliminating all pooling benefits
3. Monitor connection counts via CloudWatch RDS metrics (`DatabaseConnections`)
4. If running multiple ECS tasks, divide the RDS `max_connections` across tasks

**Detection:** App works initially but degrades after hours. Database queries slow down, then timeout entirely.

**Phase:** Infrastructure configuration (task definition + RDS setup)

**Confidence:** HIGH -- documented in [Prisma connection pooling discussion](https://github.com/prisma/prisma/discussions/9273) and [RDS Proxy discussion](https://github.com/prisma/prisma/discussions/23547)

---

### Pitfall 8: ECS Security Group Not Allowing Container-to-RDS Traffic

**What goes wrong:** The ECS Fargate task runs in a VPC subnet, and the RDS instance runs in another (or the same) subnet. If the RDS security group does not have an inbound rule allowing TCP 5432 from the ECS task's security group, database connections silently timeout. The error is often a generic connection timeout with no clear indication that it is a security group issue.

**Prevention:**
1. Create a security group for ECS tasks and a separate one for RDS
2. Add an inbound rule on the RDS security group: allow TCP 5432 from the ECS security group
3. Ensure both are in the same VPC
4. Check NACLs on the subnets (often overlooked)
5. For POC, place ECS and RDS in the same private subnet to simplify networking

**Detection:** Container starts, logs show "Connecting to database...", then hangs or times out. No error in RDS logs because the connection never reaches RDS.

**Phase:** Infrastructure setup (VPC, security groups, RDS provisioning)

**Confidence:** HIGH -- standard AWS networking, verified via [AWS re:Post](https://repost.aws/questions/QUh3ZQ7GPPTYqmNA119CJ0Qg/cannot-connect-docker-container-on-ecs-fargate-to-rds-db-instance)

---

### Pitfall 9: Vercel Cron Job Has No Direct ECS Equivalent

**What goes wrong:** The stale run recovery cron (`app/api/cron/recover-stale-runs/route.ts`) is triggered by Vercel's cron system which sends authenticated GET requests to the API route every 5 minutes. On ECS, there is no built-in cron trigger for API routes. Developers either forget to migrate this or set up a complex EventBridge + Lambda solution when simpler options exist.

**Prevention:**
1. **Simplest option:** Since ECS Fargate is a long-running process, implement an in-process `setInterval` timer that calls `recoverAllStaleRuns()` directly every 5 minutes. No HTTP call needed.
2. **Alternative:** Use EventBridge Scheduler to trigger an ECS Scheduled Task running a lightweight script
3. **Alternative:** Use EventBridge to invoke the existing API route via the internal ALB
4. Remove the `CRON_SECRET` and Vercel authentication check from the route handler
5. Remove `vercel.json` cron configuration

**Detection:** Stale runs accumulate in the database, never getting recovered. Only noticeable under failure conditions.

**Phase:** Cron/scheduled tasks migration

**Confidence:** HIGH -- direct codebase analysis

---

### Pitfall 10: Bedrock SDK Default Timeout Is 60 Seconds (Too Short for Large Prompts)

**What goes wrong:** The AWS SDK client defaults to a 60-second read timeout. Claude Sonnet calls with large document analysis prompts (the codebase processes multi-page documents with images) can easily exceed 60 seconds. The SDK throws a timeout error, but the model may still be processing, leading to wasted compute and failed analysis runs.

**Prevention:**
1. Configure the Bedrock client with extended timeouts:
   ```typescript
   const client = new AnthropicBedrock({
     awsRegion: 'us-east-1',
     // The @anthropic-ai/bedrock-sdk handles timeout configuration
     // differently from raw AWS SDK -- verify timeout options in the SDK docs
   });
   ```
2. If using the raw AWS Bedrock Runtime SDK instead, set `requestHandler` with a custom timeout
3. The Vercel 300s maxDuration constraint no longer applies on ECS, so longer timeouts are safe
4. Consider adding retry logic with exponential backoff for transient failures

**Detection:** AI generation calls fail intermittently with timeout errors, especially on larger documents.

**Phase:** AI provider migration

**Confidence:** MEDIUM -- timeout behavior confirmed in [AWS Bedrock migration blog](https://aws.amazon.com/blogs/machine-learning/migrate-from-anthropics-claude-sonnet-3-x-to-claude-sonnet-4-x-on-amazon-bedrock/), but exact `@anthropic-ai/bedrock-sdk` timeout configuration needs verification

---

## Minor Pitfalls

### Pitfall 11: `server-only` Import in `lib/db.ts` May Cause Build Issues in Standalone Mode

**What goes wrong:** The `import "server-only"` at the top of `lib/db.ts` is a Next.js convention that prevents accidentally importing server code into client components. In standalone mode, this usually works fine, but can cause unexpected build errors if the build toolchain resolves it differently.

**Prevention:** Keep the import but verify the standalone build completes without errors related to this module. If issues arise, the `server-only` package is a dev-time guard and can be safely removed for production builds.

**Detection:** Build fails with module resolution errors referencing `server-only`.

**Phase:** Dockerfile/build setup

**Confidence:** LOW -- uncommon but reported in edge cases

---

### Pitfall 12: ECS Task Role Missing Bedrock or S3 Permissions

**What goes wrong:** The ECS task runs with an IAM task role. If the role lacks `bedrock:InvokeModel` permission or `s3:PutObject`/`s3:GetObject`/`s3:DeleteObject` permissions, the respective features fail with `AccessDeniedException`. Unlike API keys which either work or do not, IAM policies can be partially correct (e.g., S3 works but Bedrock does not).

**Prevention:**
1. Create a task execution role (for ECR pull, CloudWatch logs) AND a task role (for app-level AWS API calls)
2. Task role needs:
   - `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` on the specific Claude model ARN
   - `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the specific S3 bucket ARN
   - `s3:ListBucket` on the bucket for listing operations
3. Use least-privilege: scope to specific resources, not `*`
4. Test each permission independently before combining

**Detection:** Partial functionality -- some features work, others throw access denied errors.

**Phase:** Infrastructure setup (IAM roles)

**Confidence:** HIGH -- standard AWS IAM pattern

---

### Pitfall 13: `p-limit` and In-Process State Lost on Container Restart

**What goes wrong:** The executor in `lib/run-engine/executor.ts` tracks active runs in an in-memory `Map<string, { cancelled: boolean }>`. On Vercel, this is acceptable because each function invocation is independent. On ECS, the container is long-lived but can be replaced by ECS service updates, health check failures, or scaling events. When the container restarts, all in-memory state (active runs, cancellation flags) is lost. Runs that were in progress become orphaned.

**Prevention:**
1. The existing stale run recovery cron already handles this -- ensure it is migrated (see Pitfall 9)
2. Consider writing run state to the database more aggressively (heartbeat pattern already exists in `lib/observability/heartbeat.ts`)
3. For POC, accept that container restarts may orphan runs and rely on stale run recovery
4. For production, implement graceful shutdown handling (SIGTERM) that marks active runs as failed

**Detection:** After a deployment or container restart, some runs show as permanently "RUNNING" in the UI.

**Phase:** Run engine hardening (can be deferred to post-POC)

**Confidence:** HIGH -- direct codebase analysis

---

### Pitfall 14: NAT Gateway Cost Surprise for Internal-Only App

**What goes wrong:** The project scope says "internal-only, ALB in private subnet." If the ECS tasks are in private subnets and need to call AWS services (Bedrock, S3, ECR), they need either NAT Gateways or VPC Endpoints. NAT Gateways cost ~$32/month each, and the default CDK/CloudFormation patterns create one per AZ (2-3 AZs = $64-96/month just for NAT). For a POC, this is often the largest unexpected cost.

**Prevention:**
1. For POC (single AZ acceptable per constraints), use one NAT Gateway in one AZ only
2. Better: Use VPC Endpoints for S3 (Gateway endpoint, free) and Bedrock (Interface endpoint, ~$7/month)
3. ECR pull can use VPC Endpoints too (avoid NAT for image pulls)
4. If the corporate VPC already has NAT Gateways, use the existing ones

**Detection:** AWS bill shows unexpected charges from NAT Gateway data processing.

**Phase:** Infrastructure setup (VPC design)

**Confidence:** HIGH -- well-known AWS cost pattern

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Dockerfile creation | Missing static assets (P1), Prisma binary mismatch (P4) | Use `node:22-slim` for both stages, copy `.next/static` and `public/` explicitly |
| AI provider migration | Wrong model IDs (P2), SDK timeout (P10), missing Bedrock permissions (P12) | Use `@anthropic-ai/bedrock-sdk`, map all model IDs, test with a simple prompt first |
| Storage migration | No drop-in replacement for Vercel Blob (P5), S3 CORS (P5) | Build presigned URL flow from scratch, configure bucket CORS early |
| Database connection | SSL handling (P6), security groups (P8), connection pooling (P7) | Test RDS connectivity from a simple script before wiring into the app |
| Run engine / continuation | Self-referencing fetch (P3), in-memory state (P13) | Consider eliminating HTTP self-triggering entirely since ECS has no timeout constraint |
| Cron migration | No Vercel cron equivalent (P9) | Use in-process `setInterval` for simplicity |
| Infrastructure (VPC/IAM) | Security groups (P8), IAM roles (P12), NAT costs (P14) | POC: single AZ, VPC endpoints over NAT, test permissions incrementally |

## Key Insight: The Biggest Opportunity

The most impactful architectural change is recognizing that ECS Fargate has NO timeout constraint. The entire "fire-and-confirm" / self-continuation HTTP pattern in `process-next-trigger.ts` exists solely because Vercel serverless functions timeout at 300 seconds. On ECS, the container runs indefinitely. This means:

- `triggerProcessNext()` / `triggerProcessNextAsync()` can be replaced with direct async function calls
- `triggerProcessNextUpload()` / `triggerProcessNextUploadAsync()` same
- The `BATCH_STORY_SECRET` authentication for internal routes becomes unnecessary
- The `VERCEL_AUTOMATION_BYPASS_SECRET` is irrelevant
- `getBaseUrl()` with Vercel URL detection is unnecessary

This simplification eliminates Pitfall 3 entirely and reduces the surface area for networking bugs. It should be addressed early in the migration because it affects every generative flow.

## Sources

- [Next.js Standalone Output Documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js Docker Deployment Guide](https://nextjs.org/docs/app/getting-started/deploying)
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/docker)
- [Prisma AWS Deployment Caveats](https://www.prisma.io/docs/orm/prisma-client/deployment/caveats-when-deploying-to-aws-platforms)
- [Prisma Connection Pool Sizing Discussion](https://github.com/prisma/prisma/discussions/9273)
- [Prisma RDS Proxy Discussion](https://github.com/prisma/prisma/discussions/23547)
- [@anthropic-ai/bedrock-sdk](https://github.com/anthropics/anthropic-sdk-typescript/tree/main/packages/bedrock-sdk)
- [Claude on Amazon Bedrock](https://docs.anthropic.com/en/api/claude-on-amazon-bedrock)
- [AWS Bedrock Claude Migration Guide](https://aws.amazon.com/blogs/machine-learning/migrate-from-anthropics-claude-sonnet-3-x-to-claude-sonnet-4-x-on-amazon-bedrock/)
- [Next.js Static Assets in Docker - GitHub Discussion](https://github.com/vercel/next.js/discussions/13304)
- [ECS Fargate to RDS Connectivity - AWS re:Post](https://repost.aws/questions/QUh3ZQ7GPPTYqmNA119CJ0Qg/cannot-connect-docker-container-on-ecs-fargate-to-rds-db-instance)
