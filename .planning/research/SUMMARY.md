# Project Research Summary

**Project:** Requirements Foundry - AWS Migration
**Domain:** Next.js application migration from Vercel to AWS ECS Fargate
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

Requirements Foundry is a ~34,000-line Next.js 16 application that transforms documents into structured requirements using Claude AI. It currently runs on Vercel with Vercel Blob storage, Neon PostgreSQL, and the direct Anthropic SDK. The migration to AWS replaces exactly four Vercel-specific integration points: file storage (S3 for Vercel Blob), AI inference (Bedrock for Anthropic API), database connection (RDS for Neon), and compute (ECS Fargate for Vercel serverless). The rest of the codebase -- Prisma ORM, React UI, Radix components, document parsing libraries -- is entirely portable and requires zero changes.

The recommended approach is a lift-and-shift with targeted refactoring. The application code changes are narrow and mechanical: swap the storage adapter, swap the AI provider, simplify the database connection, and add a Dockerfile with `output: "standalone"`. The infrastructure work is the bulk of the effort -- VPC, subnets, ALB, ECS, RDS, S3, IAM roles, security groups, and CI/CD pipeline. AWS CDK (TypeScript) is recommended over Terraform because the team is TypeScript-native, the project is single-cloud, and CDK's L3 constructs reduce ECS boilerplate by 10x. Code changes can proceed in parallel with infrastructure provisioning.

The single biggest architectural opportunity is eliminating the self-continuation HTTP pattern. The entire "fire-and-confirm" mechanism in the run engine exists solely to work around Vercel's 300-second serverless timeout. ECS Fargate has no timeout. Replacing HTTP self-triggers with direct async calls simplifies the codebase, eliminates a class of networking bugs, and removes the need for `VERCEL_URL`, `BATCH_STORY_SECRET`, and `VERCEL_AUTOMATION_BYPASS_SECRET`. This refactoring should happen early because it touches every generative flow and eliminates the riskiest migration pitfall (broken self-referencing URLs).

## Key Findings

### Recommended Stack

The migration requires adding four npm packages (`@anthropic-ai/bedrock-sdk`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/lib-storage`) and removing two (`@vercel/blob`, `@anthropic-ai/sdk`). All other dependencies are platform-agnostic and unchanged.

**Core technologies:**
- **@anthropic-ai/bedrock-sdk** (v0.26.4): Drop-in replacement for the Anthropic SDK. Same `messages.create()` API surface -- only the client constructor and model ID change. Uses IAM credentials instead of API keys.
- **@aws-sdk/client-s3** (v3.1002.0): Replaces `@vercel/blob` for file storage. Tree-shakeable modular client.
- **AWS CDK v2** (TypeScript): Infrastructure as Code. `ApplicationLoadBalancedFargateService` L3 construct creates ALB + ECS + task definition + security groups in ~20 lines. Matches the project's TypeScript stack.
- **Docker** (node:22-alpine, multi-stage): Next.js `output: "standalone"` produces ~200MB images. Three-stage build: deps, build, runner.
- **GitHub Actions**: CI/CD with official AWS actions for ECR push and ECS deployment. OIDC authentication eliminates long-lived credentials.

**Critical version requirement:** Bedrock model ID format differs from Anthropic API -- must use `anthropic.claude-sonnet-4-20250514-v1:0` (not `claude-sonnet-4-20250514`).

### Expected Features

**Must have (table stakes):**
- Dockerfile with standalone output + ECR repository
- ECS Fargate service with task definitions (0.5 vCPU / 1GB RAM)
- VPC with private subnets, internal ALB, NAT Gateway
- RDS PostgreSQL (db.t4g.micro, single-AZ)
- S3 bucket with presigned URL upload flow
- Bedrock integration with IAM-based auth
- Secrets Manager for DATABASE_URL and config
- IAM task execution role + task role (least privilege)
- CloudWatch Logs via awslogs driver
- GitHub Actions CI/CD with OIDC auth
- Health check endpoint (`/api/health`)
- EventBridge or in-process cron for stale run recovery

**Should have (differentiators for operational quality):**
- CloudWatch Container Insights (~$0.50/month)
- CloudWatch alarms (ECS task count = 0, ALB unhealthy, RDS CPU > 80%)
- Rolling deployment (ECS default, just configure correctly)
- RDS automated backups (free, default)
- ECS Exec via SSM Session Manager (debugging)
- ECR image lifecycle policy (keep last 10)

**Defer (v2+):**
- CloudFront CDN, WAF, Route 53 custom domain
- Auto-scaling policies
- Cognito + Okta SSO (architecture should accommodate but do not build)
- Multi-region, multi-AZ RDS, staging environment
- ElastiCache/Redis, RDS Proxy, Service Mesh

### Architecture Approach

The architecture is a standard internal VPC deployment: corporate traffic arrives via VPN/DirectConnect to an internal ALB, which routes to ECS Fargate tasks running the Next.js container in private subnets. RDS PostgreSQL sits in dedicated database subnets. S3 is accessed via a free Gateway Endpoint. Bedrock is accessed via an Interface Endpoint to keep AI traffic on the AWS backbone. A single NAT Gateway handles outbound internet (ECR pulls, external dependencies). Security groups enforce strict boundaries: ALB accepts only corporate CIDR, ECS accepts only from ALB, RDS accepts only from ECS.

**Major components:**
1. **Internal ALB** -- Routes corporate HTTP/HTTPS traffic to ECS tasks on port 3000
2. **ECS Fargate Service** -- Runs Next.js container (SSR + API routes in single process)
3. **RDS PostgreSQL** -- Persistent data store, accessed via Prisma with `@prisma/adapter-pg`
4. **S3 Bucket** -- File storage for uploaded documents, replaces Vercel Blob
5. **Amazon Bedrock** -- Claude AI inference via VPC Interface Endpoint
6. **Secrets Manager** -- Injects DATABASE_URL and config into container at startup

### Critical Pitfalls

1. **Missing static assets in standalone Docker build** -- `output: "standalone"` excludes `.next/static/` and `public/`. Must explicitly COPY both in the Dockerfile runner stage. Without this, the app renders as a blank/unstyled page.
2. **Bedrock model ID mismatch** -- Using `claude-sonnet-4-20250514` (Anthropic format) against Bedrock causes every AI call to fail immediately. Must use `anthropic.claude-sonnet-4-20250514-v1:0`.
3. **Self-referencing fetch URLs break on ECS** -- The fire-and-confirm pattern uses `VERCEL_URL` for HTTP callbacks. On ECS, this URL does not exist. Best fix: eliminate the HTTP self-trigger entirely and use direct async calls (ECS has no timeout).
4. **Vercel Blob has no S3 drop-in replacement** -- `handleUpload` with its token generation, CORS handling, and completion callbacks must be rebuilt from scratch using presigned URLs. This is more work than it appears.
5. **Security group misconfiguration blocks ECS-to-RDS traffic** -- Missing TCP/5432 inbound rule on RDS security group causes silent connection timeouts. Test connectivity early with a simple script.

## Implications for Roadmap

Based on combined research, the migration naturally splits into five phases. Code changes and infrastructure can partially overlap.

### Phase 1: Application Code Migration

**Rationale:** Code changes have zero AWS dependency -- they can be developed and tested locally with Docker. Starting here unblocks parallel infrastructure work and produces a deployable artifact early.
**Delivers:** A Docker image that runs the full application with S3, Bedrock, and simplified DB connection support.
**Addresses:** Dockerfile (standalone), S3 storage adapter, Bedrock AI provider, DB connection simplification, health check endpoint, run engine refactoring (eliminate self-continuation HTTP pattern).
**Avoids:** Pitfall 1 (static assets), Pitfall 2 (model IDs), Pitfall 3 (self-referencing URLs), Pitfall 4 (Prisma binary), Pitfall 5 (Blob replacement).

### Phase 2: AWS Infrastructure Foundation

**Rationale:** All compute and data components depend on networking. VPC, subnets, NAT, and security groups must exist before anything else can be provisioned. This is the CDK/IaC heavy phase.
**Delivers:** VPC with private subnets, NAT Gateway, security groups, S3 bucket (+ Gateway Endpoint), RDS PostgreSQL instance, ECR repository, Secrets Manager entries, IAM roles.
**Implements:** Network topology from ARCHITECTURE.md, security group rules, VPC endpoints (S3 Gateway free, Bedrock Interface).
**Avoids:** Pitfall 8 (security groups), Pitfall 14 (NAT cost -- single AZ, one NAT), Pitfall 6 (SSL handling).

### Phase 3: Compute and Deployment

**Rationale:** Depends on Phase 2 (infrastructure) and Phase 1 (Docker image). This phase wires everything together -- ALB, ECS cluster, task definition, service.
**Delivers:** Running application accessible from corporate network via internal ALB.
**Uses:** Docker image from Phase 1, infrastructure from Phase 2.
**Avoids:** Pitfall 7 (connection pooling -- configure `?connection_limit=10` in DATABASE_URL), Pitfall 12 (IAM permissions -- test incrementally).

### Phase 4: CI/CD and Operations

**Rationale:** Manual deployment is acceptable for initial testing but must be automated before handoff. This phase also restores the cron functionality and adds basic observability.
**Delivers:** GitHub Actions pipeline (build, ECR push, ECS deploy), OIDC auth, EventBridge or in-process cron for stale run recovery, CloudWatch Logs, Container Insights.
**Avoids:** Pitfall 9 (cron migration -- use in-process `setInterval` for simplicity), Pitfall 13 (in-memory state -- ensure stale recovery works).

### Phase 5: Validation and Data Migration

**Rationale:** All infrastructure and code must be in place before end-to-end validation. Database migration from Neon is a one-time operation that should happen last.
**Delivers:** Smoke-tested application with all flows verified (upload, analyze, generate epics/stories/subtasks, JIRA export, MSS mapping). Database migrated from Neon via `pg_dump`/`pg_restore`.

### Phase Ordering Rationale

- Phase 1 and Phase 2 can run in parallel (code changes vs infrastructure). This is the critical optimization -- do not serialize them.
- Phase 3 is the integration point where code meets infrastructure. It is the highest-risk phase and should have focused testing time.
- Phase 4 (CI/CD) comes after manual deployment is proven. Automating a broken deployment wastes time.
- Phase 5 (validation) is explicitly separated because data migration is irreversible and should only happen once the target environment is confirmed working.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (run engine refactoring):** The elimination of the self-continuation HTTP pattern touches every generative flow. Needs careful analysis of `process-next-trigger.ts`, `executor.ts`, and all server actions that use fire-and-confirm. Well-understood conceptually but high surface area.
- **Phase 2 (CDK infrastructure):** CDK construct configuration for VPC + ECS + ALB + RDS is well-documented but verbose. Consider using the `ApplicationLoadBalancedFargateService` L3 construct as the foundation. Research the exact CDK constructs and their defaults.

Phases with standard patterns (skip research-phase):
- **Phase 3 (compute/deployment):** Standard ECS Fargate deployment. Task definition, service, ALB target group -- all well-documented with official AWS examples.
- **Phase 4 (CI/CD):** GitHub Actions with official `aws-actions/*` is extremely well-documented with copy-paste examples.
- **Phase 5 (validation):** Manual testing and `pg_dump`/`pg_restore` -- standard operations.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified on npm with current versions. `@anthropic-ai/bedrock-sdk` confirmed as drop-in. AWS SDK v3 is mature. |
| Features | HIGH | Table stakes are standard AWS patterns. Feature list derived from official AWS docs and codebase analysis. |
| Architecture | HIGH | VPC + private subnets + internal ALB + ECS Fargate is a canonical AWS pattern. Sources include AWS official docs and prescriptive guidance. |
| Pitfalls | HIGH | 14 pitfalls identified from official docs, GitHub issues, and direct codebase analysis. Critical pitfalls are well-documented failure modes. |

**Overall confidence:** HIGH

### Gaps to Address

- **Bedrock SDK timeout configuration:** The `@anthropic-ai/bedrock-sdk` timeout options need verification. The default 60s may be too short for large document analysis. Test with real prompts early.
- **Presigned URL upload flow complexity:** The Vercel Blob `handleUpload` replacement is the most underestimated code change. Budget extra time for CORS configuration, completion callbacks, and multipart upload support.
- **CDK construct defaults:** The `ApplicationLoadBalancedFargateService` L3 construct has opinionated defaults (e.g., it creates public subnets by default). Verify that the `publicLoadBalancer: false` option works correctly for internal-only deployment.
- **Bedrock model access approval:** Enabling Claude model access in the Bedrock console requires a one-time approval that can take minutes to hours. Do this early to avoid blocking Phase 3.
- **Corporate VPN routing to internal ALB:** The research assumes corporate network can reach the VPC private subnets via VPN or DirectConnect. This networking must be confirmed with the corporate infrastructure team.

## Sources

### Primary (HIGH confidence)
- [Next.js Standalone Output Documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js Deployment Docs](https://nextjs.org/docs/app/getting-started/deploying)
- [@anthropic-ai/bedrock-sdk on npm](https://www.npmjs.com/package/@anthropic-ai/bedrock-sdk) -- v0.26.4
- [@aws-sdk/client-s3 on npm](https://www.npmjs.com/package/@aws-sdk/client-s3) -- v3.1002.0
- [Amazon Bedrock Supported Models](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html)
- [Claude on Amazon Bedrock - Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/claude-on-amazon-bedrock)
- [ECS Fargate Private Subnet Setup](https://repost.aws/knowledge-center/ecs-fargate-tasks-private-subnet)
- [ECS Task Networking](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html)
- [VPC Endpoints for ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/vpc-endpoints.html)
- [Passing Secrets to ECS Tasks](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html)
- [GitHub Actions ECS Deployment](https://docs.github.com/en/actions/deployment/deploying-to-your-cloud-provider/deploying-to-amazon-elastic-container-service)
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/docker)
- [Prisma AWS Deployment Caveats](https://www.prisma.io/docs/orm/prisma-client/deployment/caveats-when-deploying-to-aws-platforms)

### Secondary (MEDIUM confidence)
- [AWS CDK vs Terraform 2026 Comparison](https://towardsthecloud.com/blog/aws-cdk-vs-terraform) -- IaC decision rationale
- [Next.js ECS Fargate Deployment Guide](https://medium.com/@redrobotdev/next-js-deployment-using-ecs-with-fargate-1a730a8d0cb1)
- [Deploy Next.js on AWS Fargate with Terraform](https://blog.oscars.dev/posts/deploy_nextjs_app_on_fargate_with_terraform/)
- [Prisma Connection Pool Sizing](https://github.com/prisma/prisma/discussions/9273)
- [Optimizing ECS Fargate Network Costs with S3 VPC Endpoints](https://mhdez.com/notes/optimizing-ecs-fargate-network-costs-with-s3-vpc-endpoints/)

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
