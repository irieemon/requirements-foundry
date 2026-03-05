# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** The application runs reliably on AWS infrastructure, accessible to internal corporate users, with all existing features working identically.
**Current focus:** v2.0 AWS Migration - porting from Vercel to AWS (ECS Fargate, RDS, S3, Bedrock)

## Current Position

Phase: Pending roadmap creation
Plan: N/A
Status: Milestone initialization
Last activity: 2026-03-05 -- Paused v1.3, initialized v2.0 AWS Migration

## Milestones

- **v1.0 Generative Pipeline Fix** -- SHIPPED 2026-01-15
- **v1.1 UX Polish** -- SHIPPED 2026-01-20
- **v1.2 MSS Integration** -- SHIPPED 2026-01-27 (Phases 13-17)
- **v1.3 Contextual Upload** -- PAUSED at Phase 19/20 (AI Question Generation)
- **v2.0 AWS Migration** -- IN PROGRESS (initializing)

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Key decisions for v2.0:
- ECS Fargate for compute (containerized, Docker-ready)
- RDS PostgreSQL for database (standard managed, cost-effective)
- S3 for file storage (replaces @vercel/blob)
- Amazon Bedrock for AI (replaces direct Anthropic SDK)
- Internal ALB only (no public access)
- GitHub Actions for CI/CD

### Deferred Issues

- v1.3 Contextual Upload paused at Phase 19 (resume after AWS migration)

### Blockers/Concerns Carried Forward

None.

## Roadmap Evolution

- Milestone v1.0 shipped: 2026-01-15
- Milestone v1.1 shipped: 2026-01-20
- Milestone v1.2 shipped: 2026-01-27
- Milestone v1.3 paused: 2026-03-05 (at Phase 19/20)
- Milestone v2.0 created: AWS Migration

## Session Continuity

Last session: 2026-03-05
Stopped at: Milestone initialization, pending workflow config and roadmap
Resume file: None

## Notes

**v2.0 AWS Migration Focus:**
- Replace Vercel-specific dependencies (Blob, DB config, AI SDK)
- Containerize with Docker for ECS Fargate
- Provision AWS infrastructure (VPC, RDS, S3, ALB, ECS)
- Set up CI/CD with GitHub Actions
- Internal-only access (corporate network)
- POC heading toward production
- Future: Okta SSO integration
