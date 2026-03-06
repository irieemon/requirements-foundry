# Phase 23: Compute and Deployment - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire ECS Fargate service to Phase 22's infrastructure (VPC, ALB, RDS, S3, ECR, IAM roles), deploy the Docker image from Phase 21, and validate that the application runs end-to-end on AWS — including file uploads via S3, AI generation via Bedrock, and database connectivity via RDS. Bedrock FTU form must be submitted before deployment validation.

</domain>

<decisions>
## Implementation Decisions

### Upload flow approach
- Keep server-side FormData upload (client -> server -> S3 PutObject) — do NOT switch to presigned URLs
- Current flow in `app/api/uploads/route.ts` and `lib/storage/index.ts` is already working and sufficient for internal users
- No file size cap needed — internal app, small team, documents are typically a few MB
- Update STOR-02 requirement text to reflect "Server-side S3 upload via FormData" instead of "presigned URL upload flow"

### Container startup strategy
- Node.js entrypoint script (`entrypoint.js`) that:
  1. Uses `@aws-sdk/client-secrets-manager` to read RDS credentials secret
  2. Composes DATABASE_URL from the secret (postgresql://user:pass@host:5432/requirements_foundry)
  3. Exports DATABASE_URL as environment variable
  4. Runs `npx prisma migrate deploy` to apply any pending migrations
  5. Exec's `node server.js` to start the application
- No AWS CLI installation needed — AWS SDK is already in the Docker image
- Dockerfile CMD changes from `["node", "server.js"]` to `["node", "entrypoint.js"]`

### First deployment sequence
- Claude's discretion on exact bootstrap order (CDK deploy first, then push image — or partial deploy)
- ECS service starts with `desiredCount=1` — service retries until image appears in ECR
- Include a deploy script (`scripts/deploy.sh`) with manual steps: build, tag, push to ECR, trigger ECS deployment
- Reusable until CI/CD is set up in Phase 24
- Deploy script should be self-documenting (comments explaining each step)

### Bedrock access handling
- Fail loudly if Bedrock access is denied — AI endpoints return clear error, non-AI features still work
- Do NOT fall back to mock mode automatically in production
- Bedrock FTU form must be submitted BEFORE deployment validation — include as prerequisite step in plan
- Phase 23 is NOT complete until AI features (card analysis, epic generation) actually work on Bedrock
- AI-01, AI-02, AI-04 remain in Phase 23 scope — not deferred to Phase 25

### Claude's Discretion
- CDK task definition and Fargate service configuration details
- ALB listener rule changes (switching from 503 to forwarding)
- CloudWatch log group configuration for container logs
- Environment variables passed to container (S3_BUCKET_NAME, AWS_REGION, etc.)
- Deploy script implementation details
- How to handle the initial "no image in ECR" period gracefully

</decisions>

<specifics>
## Specific Ideas

- The entrypoint.js pattern keeps the container self-sufficient — no manual secret composition or migration steps needed after image push
- Deploy script should work as a repeatable command for subsequent deploys (not just first-time bootstrap)
- The "fail loudly" approach for Bedrock means FTU approval is a hard gate — plan accordingly

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Dockerfile` (project root): Multi-stage build, standalone Next.js output, node:22-alpine — needs CMD change to entrypoint.js
- `lib/storage/index.ts`: S3 client with auto-detection, `uploadToStorage()`, `getFileBuffer()`, `deleteFromStorage()` — all ready for ECS with IAM role
- `lib/ai/provider.ts`: `AnthropicBedrock` from `@anthropic-ai/bedrock-sdk`, `fromNodeProviderChain` credential detection — works with ECS task role
- `app/api/health/route.ts`: Health check endpoint at `/api/health` — already configured as ALB health check path in CDK

### Established Patterns
- AWS credential auto-detection via `fromNodeProviderChain` with module-level caching (both storage and AI)
- `MOCK_MODE=true` override for testing without AWS
- Server-side FormData upload flow (no presigned URLs)

### Integration Points
- CDK stack exports 14 CfnOutputs: VPC ID, ALB DNS, target group ARN, RDS endpoint, secrets ARNs, ECR URI, cluster name/ARN, IAM role ARNs, ECS SG ID
- ALB target group already configured with `/api/health` health check, port 3000, IP target type
- ALB listener has default 503 — Phase 23 switches to forwarding to target group
- RDS credentials in Secrets Manager at `requirements-foundry-prod/rds-credentials`
- DATABASE_URL placeholder secret at `requirements-foundry-prod/database-url` (entrypoint composes this)
- S3 bucket: `requirements-foundry-prod-uploads`
- ECR repo: `requirements-foundry-prod`
- ECS cluster: `requirements-foundry-prod-cluster`
- Task execution role: `requirements-foundry-prod-task-execution` (ECR pull + secrets read)
- Task role: `requirements-foundry-prod-task` (S3 read/write, Bedrock invoke, CloudWatch logs)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-compute-and-deployment*
*Context gathered: 2026-03-05*
