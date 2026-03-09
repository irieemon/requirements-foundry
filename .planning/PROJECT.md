# Requirements Foundry

## What This Is

Requirements Foundry is a tool that transforms uploaded documents into structured requirements (cards), groups them into epics, generates user stories with AI, and breaks stories down into implementable subtasks. Work items can be mapped to MSS (Master Service Schedule) taxonomy for service line visibility. Deployed on AWS (ECS Fargate, RDS PostgreSQL, S3, Bedrock AI) with automated CI/CD via GitHub Actions.

## Core Value

**The application runs reliably on AWS infrastructure, accessible to internal corporate users, with all existing features working identically.**

## Requirements

### Validated

- ✓ Document upload and extraction pipeline — existing
- ✓ Card analysis from uploaded documents — existing
- ✓ Epic generation from analyzed cards — existing
- ✓ Story generation wizard with configuration — existing
- ✓ Polling-based progress tracking architecture — existing
- ✓ Stale run detection and recovery — existing
- ✓ JIRA export pipeline — existing
- ✓ Story generation completes without timeout — v1.0
- ✓ Progress panels update in real-time during card analysis — v1.0
- ✓ Epic generation shows progress indicator — v1.0
- ✓ All generative flows provide visual feedback — v1.0
- ✓ Stories page with epic grouping — v1.0
- ✓ Subtask generation from user stories — v1.0
- ✓ Subtasks viewing page — v1.0
- ✓ Performance optimization (batch operations, parallel processing) — v1.0
- ✓ Contextual sidebar navigation with project sections — v1.1
- ✓ Breadcrumb navigation for hierarchical location — v1.1
- ✓ Large file uploads (>4.5MB) via client-side Blob — v1.1
- ✓ Modern card redesign for epics/stories/subtasks — v1.1
- ✓ JIRA export preview showing exact import hierarchy — v1.1
- ✓ Tabbed export wizard with validation indicators — v1.1
- ✓ MSS taxonomy import (L2/L3/L4 service hierarchy) — v1.2
- ✓ MSS management UI (CRUD for service entries) — v1.2
- ✓ MSS mapping to epics/stories with AI auto-assignment — v1.2
- ✓ MSS dashboard with coverage metrics — v1.2
- ✓ MSS export integration with JIRA — v1.2
- ✓ S3 file storage replacing Vercel Blob — v2.0
- ✓ Bedrock AI replacing direct Anthropic SDK — v2.0
- ✓ Standard PostgreSQL connection (no Vercel SSL) — v2.0
- ✓ Docker containerization for ECS Fargate — v2.0
- ✓ Direct async calls replacing self-continuation pattern — v2.0
- ✓ VPC with private subnets and security groups — v2.0
- ✓ RDS PostgreSQL instance — v2.0
- ✓ Complete CDK infrastructure as code — v2.0
- ✓ GitHub Actions CI/CD with OIDC — v2.0
- ✓ Lambda cron for stale run recovery — v2.0
- ✓ CloudWatch alarms and SNS notifications — v2.0
- ✓ End-to-end smoke test on AWS (all features) — v2.0

### Active

- [ ] Resume v1.3 Contextual Upload (paused at Phase 19)
- [ ] Authentication via Cognito + Okta SAML SSO
- [ ] Multi-AZ RDS for high availability
- [ ] Custom domain via Route 53
- [ ] Auto-scaling for ECS

### Out of Scope

- CloudFront CDN — internal-only app, no public users
- WAF — corporate firewall/VPN handles perimeter security
- Multi-region deployment — POC, single region acceptable
- ElastiCache/Redis — app uses polling, no session cache needed
- RDS Proxy — Prisma prepared statements cause connection pinning

## Context

**Current state (v2.0 shipped):**
- ~61,483 lines of TypeScript/TSX/JS/JSON
- Tech stack: Next.js 16, Prisma 7, Bedrock Claude AI, AWS (ECS Fargate, RDS, S3, ALB)
- Infrastructure: CDK (TypeScript), GitHub Actions CI/CD with OIDC
- All generative flows working with real-time progress on AWS
- Complete MSS taxonomy management
- v1.3 (Contextual Upload) paused at Phase 19

**AWS deployment:**
- Region: us-east-1
- Compute: ECS Fargate (0.5 vCPU / 1GB RAM)
- Database: RDS PostgreSQL db.t4g.micro (single-AZ)
- Storage: S3 bucket (private access)
- AI: Amazon Bedrock (Claude Sonnet 4)
- Network: Internet-facing ALB (POC; switch to internal after VPN setup)
- Monitoring: CloudWatch alarms, SNS email, Container Insights
- Cron: EventBridge + Lambda calling stale run recovery every 5 minutes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Polling over WebSockets | Simpler for serverless, already implemented | ✓ Good |
| Continuation pattern for timeouts | Vercel-compatible, proven approach | ✓ Good |
| Heartbeat-based stale detection | Catches stuck runs automatically | ✓ Good |
| Loop-based epic processing | Single invocation processes all epics | ✓ Good |
| Fire-and-confirm trigger pattern | 10s abort timeout prevents server action hangs | ✓ Good (replaced by direct async in v2.0) |
| Frontend-only progress enhancement | No new API calls, uses existing polling data | ✓ Good |
| Batch DB operations first | Zero-risk foundation before parallelization | ✓ Good |
| Limited parallelization (2-3 concurrent) | Respects Claude API rate limits | ✓ Good |
| Preview tab default in export wizard | Data-first UX ensures users see what they export | ✓ Good |
| Client-side Blob uploads | Bypasses 4.5MB serverless body limit | ✓ Good (replaced by server-side S3 in v2.0) |
| Container/Presentational card pattern | Better separation of concerns, testability | ✓ Good |
| Tabbed interface for wizard steps | Reduces cognitive load, clear section separation | ✓ Good |
| Upsert pattern for MSS CSV import | Same file can be re-imported safely | ✓ Good |
| Polymorphic MSS dialogs | Single component handles L2/L3/L4 levels | ✓ Good |
| MSS inheritance (story from epic) | Reduces manual mapping, consistent in export | ✓ Good |
| Arrow format for MSS in exports | "Service Line → Service Area" clear hierarchy | ✓ Good |
| ECS Fargate for compute | Containerized, no servers to manage, Docker-ready | ✓ Good |
| RDS PostgreSQL for database | Standard managed PG, cost-effective for steady load | ✓ Good |
| S3 for file storage | Drop-in replacement for Vercel Blob | ✓ Good |
| Amazon Bedrock for AI | Claude via Bedrock, keeps traffic within AWS | ✓ Good |
| Internet-facing ALB (POC) | No VPN/Direct Connect available yet | ⚠️ Revisit (switch to internal after VPN) |
| GitHub Actions for CI/CD | Simple, no new tooling to learn | ✓ Good |
| CDK (TypeScript) for IaC | Type-safe, same language as app | ✓ Good |
| Pause v1.3 for AWS migration | AWS deployment higher priority | ✓ Good (v2.0 shipped) |
| OIDC auth for GitHub Actions | No long-lived credentials in secrets | ✓ Good |
| Single NAT Gateway | POC cost savings, acceptable risk | ✓ Good |
| RemovalPolicy.DESTROY on all resources | POC teardown convenience | ⚠️ Revisit (change for production) |
| Server-side FormData upload | Replaced client-side Blob, works with S3 | ✓ Good |
| Direct async executor calls | Eliminated Vercel HTTP self-trigger pattern | ✓ Good |

## Constraints

- **AWS region**: us-east-1
- **Internal-only**: Internet-facing ALB as POC workaround (switch to internal after VPN)
- **POC sizing**: Small instance sizes, single AZ acceptable
- **Okta-ready**: Architecture accommodates future Cognito + Okta SAML
- **Feature parity**: All existing features work identically on AWS
- **No breaking schema changes**: Prisma migrations handle column renames

---
*Last updated: 2026-03-09 after v2.0 AWS Migration milestone*
