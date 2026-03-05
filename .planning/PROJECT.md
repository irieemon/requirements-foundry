# Requirements Foundry - AWS Migration

## What This Is

Requirements Foundry is a tool that transforms uploaded documents into structured requirements (cards), groups them into epics, generates user stories with AI, and breaks stories down into implementable subtasks. Work items can be mapped to MSS (Master Service Schedule) taxonomy for service line visibility. Currently deployed on Vercel, it needs to be ported to AWS for internal corporate deployment.

## Core Value

**The application runs reliably on AWS infrastructure, accessible to internal corporate users, with all existing features working identically.**

## Requirements

### Validated

- Document upload and extraction pipeline — existing
- Card analysis from uploaded documents — existing
- Epic generation from analyzed cards — existing
- Story generation wizard with configuration — existing
- Continuation pattern for Vercel 300s timeout — existing
- Polling-based progress tracking architecture — existing
- Stale run detection and recovery — existing
- JIRA export pipeline — existing
- Story generation completes without timeout — v1.0 (self-continuation + fire-and-confirm)
- Progress panels update in real-time during card analysis — v1.0 (elapsed time + animated indicators)
- Epic generation shows progress indicator — v1.0 (elapsed time tracking)
- All generative flows provide visual feedback — v1.0 (consistent UX)
- Stories page with epic grouping — v1.0
- Subtask generation from user stories — v1.0
- Subtasks viewing page — v1.0
- Performance optimization (batch operations, parallel processing) — v1.0
- Contextual sidebar navigation with project sections — v1.1
- Breadcrumb navigation for hierarchical location — v1.1
- Large file uploads (>4.5MB) via client-side Blob — v1.1
- Modern card redesign for epics/stories/subtasks — v1.1
- JIRA export preview showing exact import hierarchy — v1.1
- Tabbed export wizard with validation indicators — v1.1
- MSS taxonomy import (L2/L3/L4 service hierarchy) — v1.2
- MSS management UI (CRUD for service entries) — v1.2
- MSS mapping to epics/stories with AI auto-assignment — v1.2
- MSS dashboard with coverage metrics — v1.2
- MSS export integration with JIRA — v1.2

### Active

- [ ] Replace Vercel Blob storage with AWS S3
- [ ] Replace Anthropic SDK with AWS Bedrock SDK
- [ ] Remove Vercel-specific database connection logic
- [ ] Create Dockerfile for ECS Fargate deployment
- [ ] Set up VPC with private subnets (internal-only access)
- [ ] Provision RDS PostgreSQL instance
- [ ] Create S3 bucket for file uploads
- [ ] Configure Application Load Balancer (internal)
- [ ] Set up ECS Fargate service and task definitions
- [ ] Create GitHub Actions CI/CD pipeline (build, push ECR, deploy ECS)
- [ ] Migrate cron job (stale run recovery) to ECS Scheduled Task or EventBridge
- [ ] Infrastructure as Code (CloudFormation or Terraform)
- [ ] Secrets management via AWS Secrets Manager or Parameter Store

### Out of Scope

- New features beyond restoring working state — focus was on fixing regressions (COMPLETE)
- UI redesign of progress panels — kept existing UI, made it update correctly (COMPLETE)
- Authentication/authorization — deferred, Okta SSO planned for future milestone
- Multi-AZ / production hardening — POC phase, single AZ acceptable
- Custom domain / Route 53 DNS — future milestone
- CloudWatch advanced monitoring — basic logging only for POC
- WAF / CloudFront — internal-only app, not needed yet

## Context

**Current state (v1.2 shipped, v1.3 paused):**
- ~34,435 lines of TypeScript/TSX
- Tech stack: Next.js 16, Prisma 7, Claude AI, Vercel, @vercel/blob
- All generative flows working with real-time progress
- Complete MSS taxonomy management
- v1.3 (Contextual Upload) paused at Phase 19 for AWS migration priority

**Vercel-specific dependencies to replace:**
- `@vercel/blob` in `lib/storage/index.ts` — file upload/download
- Vercel/Neon SSL detection in `lib/db.ts` — database connection
- `@anthropic-ai/sdk` in `lib/ai/provider.ts` — AI calls (replace with Bedrock)
- Vercel Cron in `app/api/cron/recover-stale-runs/route.ts` — stale run recovery
- Vercel-specific timeout config in `next.config.ts`
- `POSTGRES_URL` fallback in `prisma.config.ts`

**AWS target environment:**
- Region: us-east-1
- Account: existing corporate AWS account
- Network: internal-only (VPN/corporate network access)
- No CI/CD established yet — was using personal GitHub to Vercel

## Constraints

- **AWS region**: us-east-1
- **Internal-only**: No public internet access — ALB in private subnet
- **POC first**: Small instance sizes, single AZ acceptable
- **Okta-ready**: Architecture should accommodate future Cognito + Okta SAML
- **Feature parity**: All existing features must work identically on AWS
- **Backward compatibility**: Database schema unchanged — data migration possible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Polling over WebSockets | Simpler for serverless, already implemented | Good |
| Continuation pattern for timeouts | Vercel-compatible, proven approach | Good |
| Heartbeat-based stale detection | Catches stuck runs automatically | Good (resolved E7 issue) |
| Loop-based epic processing | Single invocation processes all epics | Good |
| Fire-and-confirm trigger pattern | 10s abort timeout prevents server action hangs | Good |
| Frontend-only progress enhancement | No new API calls, uses existing polling data | Good |
| Batch DB operations first | Zero-risk foundation before parallelization | Good |
| Limited parallelization (2-3 concurrent) | Respects Claude API rate limits | Good |
| Preview tab default in export wizard | Data-first UX ensures users see what they export | Good |
| Client-side Blob uploads | Bypasses 4.5MB serverless body limit | Good |
| Container/Presentational card pattern | Better separation of concerns, testability | Good |
| Tabbed interface for wizard steps | Reduces cognitive load, clear section separation | Good |
| Upsert pattern for MSS CSV import | Same file can be re-imported safely | Good |
| Polymorphic MSS dialogs | Single component handles L2/L3/L4 levels | Good |
| MSS inheritance (story from epic) | Reduces manual mapping, consistent in export | Good |
| Arrow format for MSS in exports | "Service Line → Service Area" clear hierarchy | Good |

| ECS Fargate for compute | Containerized, no servers to manage, Docker-ready | -- Pending |
| RDS PostgreSQL for database | Standard managed PG, familiar, cost-effective for steady load | -- Pending |
| S3 for file storage | Drop-in replacement for Vercel Blob | -- Pending |
| Amazon Bedrock for AI | Claude via Bedrock, keeps traffic within AWS | -- Pending |
| Internal ALB only | Corporate internal access, no public exposure | -- Pending |
| GitHub Actions for CI/CD | Simple, no new tooling to learn | -- Pending |
| Pause v1.3 for AWS migration | AWS deployment is higher priority than contextual upload | -- Pending |

---
*Last updated: 2026-03-05 after v2.0 AWS Migration milestone initialization*
