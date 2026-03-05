# Technology Stack: AWS Migration

**Project:** Requirements Foundry - AWS Migration
**Researched:** 2026-03-05
**Overall Confidence:** HIGH

## Current Stack (Vercel)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.1 | Full-stack React framework |
| React | 19.2.3 | UI library |
| Prisma | 7.2.0 | ORM with `@prisma/adapter-pg` driver adapter |
| `@vercel/blob` | 0.27.1 | File storage (uploads) |
| `@anthropic-ai/sdk` | 0.71.2 | Claude AI API calls |
| `pg` | 8.16.0 | PostgreSQL driver |
| TypeScript | 5.x | Language |
| Tailwind CSS | 4.x | Styling |

## Recommended Stack (AWS)

### Packages to ADD

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@anthropic-ai/bedrock-sdk` | ^0.26.4 | Claude via AWS Bedrock | Drop-in replacement for `@anthropic-ai/sdk`. Same `messages.create()` API surface -- only the client constructor and model ID change. Uses IAM credentials instead of API keys, keeping all traffic within AWS VPC. 75K weekly npm downloads confirms production adoption. | HIGH |
| `@aws-sdk/client-s3` | ^3.1002.0 | S3 file upload/download/delete | AWS SDK v3 modular client. Replaces `@vercel/blob`'s `put`/`del` operations. Only imports what you need (tree-shakeable). | HIGH |
| `@aws-sdk/s3-request-presigner` | ^3.997.0 | Presigned URLs for client-side uploads | Currently using client-side Blob uploads for files >4.5MB. Presigned URLs are the S3 equivalent -- client uploads directly to S3 without routing through the server. Required for the existing large file upload feature. | HIGH |
| `@aws-sdk/lib-storage` | ^3.1002.0 | Multipart upload helper | Handles automatic multipart uploads for large files server-side. Provides `Upload` class that manages chunking, retries, and progress tracking. | MEDIUM |

### Packages to REMOVE

| Package | Why Remove |
|---------|-----------|
| `@vercel/blob` (0.27.1) | Replaced by `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. No Vercel Blob service on AWS. |
| `@anthropic-ai/sdk` (0.71.2) | Replaced by `@anthropic-ai/bedrock-sdk`. Direct Anthropic API not needed when using Bedrock. Bedrock uses IAM auth (no API key management) and keeps traffic within AWS. |

### Packages to KEEP (unchanged)

| Package | Version | Notes |
|---------|---------|-------|
| `@prisma/adapter-pg` | 7.2.0 | Already uses the `pg` driver adapter pattern. Works with any PostgreSQL, not Vercel-specific. |
| `@prisma/client` | 7.2.0 | No change needed. |
| `prisma` | 7.2.0 | No change needed. Schema, migrations, config all portable. |
| `pg` | 8.16.0 | Standard PostgreSQL driver. Works with RDS directly. |
| `next` | 16.1.1 | No change needed. Add `output: "standalone"` to `next.config.ts` for Docker. |
| All Radix UI packages | Various | UI components -- platform agnostic. |
| All other deps | Various | `mammoth`, `papaparse`, `xlsx`, `jszip`, `unpdf`, `zod`, etc. are all runtime-agnostic. |

### Infrastructure Tooling (NOT npm packages)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Docker (multi-stage) | node:22-alpine | Container image for ECS Fargate | Next.js `output: "standalone"` produces a self-contained `server.js`. Multi-stage build (deps -> build -> runner) yields ~200MB images vs ~1GB naive builds. Node 22 is current LTS. Alpine minimizes attack surface. | HIGH |
| AWS CDK | v2 (latest) | Infrastructure as Code | Project is AWS-only, team is developer-oriented (not ops). CDK's `ApplicationLoadBalancedFargateService` L3 construct creates ALB + ECS service + task definition + security groups in ~20 lines vs ~200 lines of Terraform. CDK uses TypeScript which matches the project stack. | MEDIUM |
| GitHub Actions | N/A | CI/CD pipeline | Already using GitHub. Official AWS actions exist: `aws-actions/configure-aws-credentials@v4`, `aws-actions/amazon-ecr-login@v2`, `aws-actions/amazon-ecs-render-task-definition@v1`, `aws-actions/amazon-ecs-deploy-task-definition@v2`. Well-documented, no new tooling. | HIGH |
| Amazon ECR | N/A | Docker image registry | Private container registry co-located with ECS. Standard choice, no alternatives needed. | HIGH |

## Key Migration Changes by File

### `lib/ai/provider.ts` -- Bedrock Migration

**Current:** `new Anthropic({ apiKey })` with model `"claude-sonnet-4-20250514"`
**Target:** `new AnthropicBedrock({ region })` with model `"anthropic.claude-sonnet-4-20250514-v1:0"`

The `@anthropic-ai/bedrock-sdk` provides the same `messages.create()` interface. The migration is mechanical:

```typescript
// BEFORE
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const message = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  // ...
});

// AFTER
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
const client = new AnthropicBedrock({ region: "us-east-1" });
const message = await client.messages.create({
  model: "anthropic.claude-sonnet-4-20250514-v1:0",
  // ...
});
```

No API key needed -- ECS task role provides IAM credentials automatically. The response shape (`message.content`, `message.usage`) is identical.

### `lib/storage/index.ts` -- S3 Migration

**Current:** `@vercel/blob`'s `put()`, `del()`, and `fetch()` by URL
**Target:** `@aws-sdk/client-s3` with `PutObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand`

The storage abstraction layer already exists with `uploadToStorage()`, `getFileBuffer()`, and `deleteFromStorage()`. Replace internals, keep the interface.

For client-side large file uploads (currently using Vercel Blob client upload), use presigned URLs via `@aws-sdk/s3-request-presigner`:
1. Server generates a presigned PUT URL
2. Client uploads directly to S3
3. Server records the S3 key

### `lib/db.ts` -- RDS Connection

**Current:** Vercel/Neon SSL detection logic
**Target:** Standard PostgreSQL connection via `DATABASE_URL`

Remove the `isVercel` detection block. RDS in the same VPC does not need SSL (traffic stays within private subnet). The `PrismaPg` adapter works identically -- just remove the conditional SSL config.

### `next.config.ts` -- Standalone Output

**Add:** `output: "standalone"` to enable Docker-optimized builds.
**Remove:** Vercel-specific `maxDuration` comments (Fargate has no 300s limit).
**Keep:** `serverExternalPackages: ["@prisma/client"]` (still needed for Prisma).

### `app/api/cron/recover-stale-runs/route.ts` -- Scheduled Task

**Current:** Vercel Cron job hitting `GET /api/cron/recover-stale-runs` every 5 minutes
**Target:** EventBridge Scheduled Rule triggering the same endpoint via internal ALB

The cron endpoint already accepts HTTP GET. An EventBridge rule with an HTTP target (ALB) or a simple ECS Scheduled Task running `curl` achieves the same result. The `CRON_SECRET` auth header pattern works identically.

### `prisma.config.ts` -- Simplification

Remove `POSTGRES_URL` fallback. Use only `DATABASE_URL` on AWS. This is a one-line change.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| AI SDK | `@anthropic-ai/bedrock-sdk` | `@aws-sdk/client-bedrock-runtime` (raw SDK) | Raw Bedrock SDK requires manual request/response marshalling. Bedrock SDK gives same Anthropic API surface with zero refactoring of prompt logic. |
| AI SDK | `@anthropic-ai/bedrock-sdk` | Keep `@anthropic-ai/sdk` with API key | Requires API key management, traffic leaves AWS VPC, no IAM integration. Bedrock keeps everything within AWS. |
| File Storage | `@aws-sdk/client-s3` | MinIO / self-hosted S3-compatible | Unnecessary complexity. S3 is the standard, no cost advantage for POC. |
| IaC | AWS CDK (TypeScript) | Terraform | Team is TypeScript developers, not ops. CDK's L3 constructs reduce ECS+ALB boilerplate by 10x. Terraform's BSL license change in Dec 2025 adds uncertainty. Single-cloud (AWS only) eliminates Terraform's multi-cloud advantage. |
| IaC | AWS CDK | CloudFormation (raw YAML) | CDK compiles to CloudFormation but is far more maintainable. No reason to write raw CF templates. |
| IaC | AWS CDK | SST (Serverless Stack) | SST is excellent for Lambda-based Next.js but this project targets ECS Fargate specifically. SST's Next.js support optimizes for serverless, not containers. |
| Container Registry | Amazon ECR | Docker Hub / GitHub Container Registry | ECR is co-located, IAM-integrated, no cross-network pulls. Standard for ECS workloads. |
| Cron Replacement | EventBridge Rule -> ALB | ECS Scheduled Task | EventBridge -> ALB is simpler (reuses existing endpoint). ECS Scheduled Task spins up a separate container just to make an HTTP call -- wasteful. |
| Database | RDS PostgreSQL | Aurora Serverless v2 | Overkill for POC. Single-instance RDS is cheaper, simpler, sufficient for internal tool. Aurora makes sense at scale. |
| Node.js Base Image | node:22-alpine | node:22-slim (Debian) | Alpine produces smaller images (~150MB vs ~250MB). The `pg` native module works fine on Alpine with `libc6-compat`. No dependency compatibility issues identified. |

## Installation

```bash
# Add AWS dependencies
npm install @anthropic-ai/bedrock-sdk @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @aws-sdk/lib-storage

# Remove Vercel dependencies
npm uninstall @vercel/blob @anthropic-ai/sdk
```

## Environment Variables Migration

| Vercel | AWS | Notes |
|--------|-----|-------|
| `ANTHROPIC_API_KEY` | (not needed) | Bedrock uses IAM task role credentials |
| `BLOB_READ_WRITE_TOKEN` | (not needed) | S3 uses IAM task role credentials |
| `POSTGRES_URL` | `DATABASE_URL` | Standard connection string to RDS |
| `UPLOAD_STORAGE=blob` | `UPLOAD_STORAGE=s3` | New mode value for S3 backend |
| `VERCEL=1` | (remove) | No longer needed |
| `CRON_SECRET` | `CRON_SECRET` | Keep for EventBridge auth header |
| (new) | `AWS_REGION=us-east-1` | For Bedrock SDK region config |
| (new) | `S3_BUCKET_NAME` | Target bucket for file uploads |
| (new) | `S3_REGION=us-east-1` | S3 bucket region (if different) |

## Bedrock Model Availability

| Model Used in Code | Anthropic API ID | Bedrock Model ID | Available in us-east-1 |
|--------------------|------------------|-------------------|----------------------|
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | `anthropic.claude-sonnet-4-20250514-v1:0` | Yes |

Cross-region inference profile (optional): `us.anthropic.claude-sonnet-4-20250514-v1:0` -- use this for automatic region failover. For a single-region POC, the base model ID is sufficient.

**Important:** Bedrock model access must be explicitly enabled in the AWS console (Bedrock > Model access). Claude models require requesting access and agreeing to Anthropic's terms. This is a one-time setup step that can take minutes to hours for approval.

## Docker Image Strategy

Use Next.js `output: "standalone"` with a three-stage Dockerfile:

1. **deps** stage: Install node_modules on `node:22-alpine`
2. **builder** stage: Run `next build`, produce `.next/standalone`
3. **runner** stage: Copy only `standalone/`, `.next/static/`, and `public/` into clean `node:22-alpine`

Final image size target: ~200MB (vs ~1.5GB without standalone).

Entry point: `node server.js` (auto-generated by standalone mode).

Port: 3000 (Next.js default, mapped via ALB target group).

Prisma note: Run `prisma generate` in the builder stage. The generated client is included in standalone output automatically because `@prisma/client` is listed in `serverExternalPackages`.

## Sources

- [@aws-sdk/client-s3 on npm](https://www.npmjs.com/package/@aws-sdk/client-s3) - v3.1002.0 confirmed
- [@aws-sdk/client-bedrock-runtime on npm](https://www.npmjs.com/package/@aws-sdk/client-bedrock-runtime) - v3.1002.0 confirmed
- [@anthropic-ai/bedrock-sdk on npm](https://www.npmjs.com/package/@anthropic-ai/bedrock-sdk) - v0.26.4 confirmed
- [@aws-sdk/s3-request-presigner on npm](https://www.npmjs.com/package/@aws-sdk/s3-request-presigner) - v3.997.0 confirmed
- [Amazon Bedrock supported models](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html) - Claude Sonnet 4 model ID confirmed
- [Claude on Amazon Bedrock - Anthropic docs](https://platform.claude.com/docs/en/build-with-claude/claude-on-amazon-bedrock)
- [Next.js deployment docs](https://nextjs.org/docs/app/getting-started/deploying) - standalone output documentation
- [aws-actions/amazon-ecs-deploy-task-definition](https://github.com/aws-actions/amazon-ecs-deploy-task-definition) - GitHub Actions ECS deployment
- [AWS CDK vs Terraform 2026 comparison](https://towardsthecloud.com/blog/aws-cdk-vs-terraform) - IaC decision rationale
- [Claude Sonnet 4.6 on Amazon Bedrock](https://aws.amazon.com/about-aws/whats-new/2026/02/claude-sonnet-4.6-available-in-amazon-bedrock/) - Bedrock availability
- [Anthropic Bedrock SDK demo](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/packages/bedrock-sdk/examples/demo.ts) - API usage pattern
