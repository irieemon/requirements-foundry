# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.0 — AWS Migration

**Shipped:** 2026-03-09
**Phases:** 5 | **Plans:** 17 | **Sessions:** ~12

### What Was Built
- Complete AWS infrastructure via CDK: VPC, RDS, S3, ECR, ECS Fargate, ALB, VPC endpoints
- Application code migration: S3 storage, Bedrock AI, standard PG, Docker container
- CI/CD pipeline: GitHub Actions with OIDC, automated build/push/deploy
- Operational monitoring: CloudWatch alarms, SNS notifications, Lambda cron scheduler
- End-to-end validation: all generative flows, MSS, and file uploads working on AWS

### What Worked
- Parallel phase execution (21 + 22) saved significant time — code changes and infrastructure had zero dependencies
- CDK assertion tests caught issues before deployment, reducing deploy-debug cycles
- GSD plan structure made complex infrastructure work manageable — each plan was small and atomic
- Fire-and-forget pattern elimination (direct async) simplified the architecture significantly
- Smoke test checklist format was effective for systematic manual validation

### What Was Inefficient
- Phase 23 deployment debugging spanned multiple sessions due to SSL, ALB, and migration issues
- Finch amd64 emulation on ARM Mac made local Docker builds impractical (30+ min for npm ci)
- Manual parameter group creation in Phase 23 had to be replaced by CDK in Phase 25 (should have been CDK from the start)
- 23-03-SUMMARY.md was never written due to multi-session debugging spanning context resets
- AI-01/AI-04 requirements were validated by smoke test but checkboxes never updated in REQUIREMENTS.md

### Patterns Established
- CDK stack pattern: single stack class with public readonly resources for cross-construct reference
- Container startup pattern: entrypoint.js reads secrets, composes DATABASE_URL, runs migrations, starts server
- Security group chaining: ALB -> ECS -> RDS with strict port isolation
- GitHub Actions OIDC: no long-lived credentials, role-based access
- Server-side FormData upload pattern replacing client-side Blob

### Key Lessons
1. **CDK from day one for all resources** — manually creating AWS resources (parameter groups, security groups) and later migrating to CDK creates unnecessary rework
2. **Test Docker builds early** — cross-platform build issues (ARM → amd64) should be discovered in Phase 21, not Phase 23
3. **Multi-session plans need explicit summary handoff** — when a plan spans multiple sessions, the summary should be written incrementally to avoid losing context
4. **Internet-facing ALB is fine for POC** — attempting internal-only ALB without VPN/Direct Connect wastes time. Start internet-facing and restrict later
5. **Prisma SSL configuration matters** — `rejectUnauthorized: false` is required for RDS with self-signed certificates, and individual connection params are more reliable than connection URLs for special characters in passwords

### Cost Observations
- Model mix: ~70% sonnet (execution), ~30% opus (planning, complex debugging)
- Sessions: ~12 across 5 days
- Notable: automated plans averaged 3 minutes each; deployment/validation plans required multi-session human interaction

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 9 | Established GSD workflow, 17 plans |
| v1.1 | ~5 | 5 | Added decimal phases for urgent work |
| v1.2 | ~4 | 5 | Fastest milestone, 8 plans in 7 days |
| v2.0 | ~12 | 5 | Infrastructure + deployment, multi-session debugging |

### Top Lessons (Verified Across Milestones)

1. Small, atomic plans execute faster and with fewer issues than large monolithic ones (v1.0, v1.1, v1.2, v2.0)
2. Human checkpoints for deployment validation are essential — automated tests can't verify browser-based flows (v1.0, v2.0)
3. Parallel execution where dependencies allow saves significant wall-clock time (v2.0 phases 21+22)
