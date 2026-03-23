# Requirements Foundry

## What This Is

Requirements Foundry is a multi-user tool that transforms uploaded documents into structured requirements (cards), groups them into epics, generates user stories with AI, and breaks stories down into implementable subtasks. Work items can be mapped to MSS (Master Service Schedule) taxonomy for service line visibility. Users authenticate via Okta SSO with per-user project isolation and admin oversight. Deployed on AWS (ECS Fargate, RDS PostgreSQL, S3, Bedrock AI, Cognito) with automated CI/CD via GitHub Actions.

## Core Value

**Transform uploaded documents into structured, exportable requirements with AI — securely isolated per user with corporate SSO.**

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
- ✓ Cognito User Pool with Okta SAML SSO (seamless corporate login) — v3.0
- ✓ Per-user project isolation (enforce Project.userId) — v3.0
- ✓ Admin role via Okta group membership — v3.0
- ✓ Public landing page with SSO login — v3.0
- ✓ Protected routes with auth middleware — v3.0
- ✓ User identity display with logout menu — v3.0

### Active

- Project owner can share their project with one or more existing users
- Role-based sharing: viewer (read-only) or editor (full access)
- "Shared with me" section on projects page separating owned vs shared
- Share management UI (add/remove users, change roles)
- User picker showing accounts who have previously signed in
- Admins retain full visibility across all projects

## Current Milestone: v4.0 Project Sharing

**Goal:** Enable project owners to share projects with other users as viewers or editors, with clear UI separation between owned and shared projects.

**Target features:**
- Direct user-to-user project sharing with viewer/editor roles
- Share management UI with user picker
- "Shared with me" section on projects page
- Admin full-access override preserved

### Deferred

- Resume v1.3 Contextual Upload (paused at Phase 19)
- Multi-AZ RDS for high availability
- Custom domain via Route 53
- Auto-scaling for ECS
- Refresh token rotation for enhanced security
- Custom Cognito domain (auth.requirementsfoundry.internal)
- Admin project ownership reassignment
- Admin dashboard with user activity metrics
- Audit log of user actions
- Okta group-based admin detection (pipeline wired, using hardcoded email)
- Runs page admin My/All toggle (parity with projects page)

### Out of Scope

- CloudFront CDN — internal-only app, no public users
- WAF — corporate firewall/VPN handles perimeter security
- Multi-region deployment — POC, single region acceptable
- ElastiCache/Redis — app uses polling, no session cache needed
- RDS Proxy — Prisma prepared statements cause connection pinning
- Local username/password auth — pure SSO via corporate Okta
- NextAuth / Amplify libraries — direct Cognito integration is simpler for SAML
- PostgreSQL Row-Level Security — Prisma doesn't support RLS session variables; app-level filtering sufficient
- IdP-initiated SAML — Cognito doesn't support it
- ALB-level Cognito authentication — breaks logout control
- User self-registration — corporate SSO only

## Context

**Current state (v4.0 Phase 30 complete):**
- ~70,000+ lines of TypeScript/TSX/JS/JSON
- Tech stack: Next.js 16, Prisma 7, Bedrock Claude AI, AWS (ECS Fargate, RDS, S3, ALB, Cognito, Secrets Manager)
- Infrastructure: CDK (TypeScript), GitHub Actions CI/CD with OIDC
- Authentication: Cognito + Okta SAML SSO, iron-session cookies, JWT verification via aws-jwt-verify
- Data isolation: per-user project ownership with centralized authorization module
- Identity: User table with login-time upsert from Cognito claims, ProjectShare junction table for multi-user access
- Admin: hardcoded admin email with UI toggle for all-projects view
- All generative flows working with real-time progress on AWS
- Complete MSS taxonomy management
- v1.3 (Contextual Upload) paused at Phase 19

**AWS deployment:**
- Region: us-east-1
- Compute: ECS Fargate (0.5 vCPU / 1GB RAM)
- Database: RDS PostgreSQL db.t4g.micro (single-AZ)
- Storage: S3 bucket (private access)
- AI: Amazon Bedrock (Claude Sonnet 4)
- Auth: Cognito User Pool + Okta SAML IdP + PreTokenGeneration Lambda
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
| Cognito + Okta SAML (not NextAuth/Amplify) | Direct integration simpler for corporate SAML | ✓ Good |
| AwsCustomResource for Cognito client secret | Extract secret at CDK deploy time, store in Secrets Manager | ✓ Good |
| iron-session encrypted cookies | HTTP-only, no external session store needed | ✓ Good |
| Extracted claims in cookie (not full JWT) | Avoids 4KB cookie size limit | ✓ Good |
| proxy.ts route protection (not middleware) | Defense-in-depth per CVE-2025-29927 | ✓ Good |
| Hardcoded admin email (not Okta groups) | Simpler for now; group pipeline wired for future | ✓ Good |
| 404-not-403 for unauthorized access | Prevents leaking project existence | ✓ Good |
| Entity chain ownership (not userId on every table) | Fewer schema changes, single source of truth | ✓ Good |
| Admin defaults to own projects | Safe default; explicit opt-in for all-projects view | ✓ Good |

## Constraints

- **AWS region**: us-east-1
- **Internal-only**: Internet-facing ALB as POC workaround (switch to internal after VPN)
- **POC sizing**: Small instance sizes, single AZ acceptable
- **Corporate SSO**: All users authenticate via Okta SAML through Cognito
- **Feature parity**: All existing features work identically on AWS with auth
- **No breaking schema changes**: Prisma migrations handle column additions

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-23 — Phase 30 Data Foundation complete*
