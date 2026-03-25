# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v4.0 — Project Sharing

**Shipped:** 2026-03-25
**Phases:** 4 | **Plans:** 8 | **Sessions:** ~4

### What Was Built
- User table with login-time upsert and ProjectShare junction table for multi-user access
- Centralized role-based authorization (owner/editor/viewer/admin) with highest-wins priority across all routes and server actions
- Viewer mutation guards on 29 functions across 10 server action files
- Share dialog with user search combobox (cmdk+popover), role management, and owner-gated access
- Two-section projects page (My Projects / Shared with me) with role badges and owner attribution
- Runs page expanded to include shared project runs with project name display

### What Worked
- Building directly on v3.0's centralized authorization module — Phase 31 extended existing patterns rather than reinventing
- TDD carried forward from v3.0 with 30 auth tests and 19 share action tests catching issues before deployment
- Discuss-phase context documents captured key decisions (User table vs Cognito, highest-wins role priority) that prevented mid-execution pivots
- Phase ordering was optimal: data foundation → authorization → share UI → display integration — zero circular dependencies
- Human UAT on deployed environment caught no issues (8/8 automated + 8/8 human tests passed)

### What Was Inefficient
- Phase 32 ROADMAP checkbox for 32-02 never got checked to `[x]` despite summary existing — recurring issue from v3.0
- Phase 32 completion required manual `/gsd:execute-phase` to trigger state update even though all plans were already done
- Nyquist validation strategies created but not exercised (same pattern as v3.0)
- Pre-existing CDK test failures (3) still unresolved from v2.0

### Patterns Established
- `resolveRole` priority function: admin > owner > editor > viewer with explicit precedence
- Server-side `shouldFilter=false` pattern for cmdk combobox with debounced search
- Return shape split pattern (`{ownedProjects, sharedProjects}`) for clean UI section separation without client-side filtering
- Batch `User.findMany` for efficient N-record display name lookups
- P2002 Prisma error code detection for duplicate share prevention

### Key Lessons
1. **Extend centralized modules, don't duplicate** — adding share resolution to existing `getAuthorizedProject` was cleaner than parallel auth paths
2. **User table beats external IdP queries** — local User table made autocomplete instant vs Cognito rate-limited ListUsers
3. **OR queries with conditional spread** — `{OR: [ownedClause, ...(dbUser ? [shareClause] : [])]}` pattern handles optional join conditions cleanly
4. **Two-section return shapes > client filtering** — splitting at the server avoids client-side role detection logic
5. **Phase completion tracking needs automation** — manual state sync after plans are done is error-prone across milestones

### Cost Observations
- Model mix: ~70% opus (planning, milestone), ~30% sonnet (verification, checking)
- Sessions: ~4 across 3 days
- Notable: 8 plans in 3 days with zero rework — fastest feature milestone by defect rate

---

## Milestone: v3.0 — Authentication & Multi-User

**Shipped:** 2026-03-10
**Phases:** 4 | **Plans:** 10 | **Sessions:** ~3

### What Was Built
- Cognito User Pool with Okta SAML federation and PreTokenGeneration Lambda for group-to-JWT mapping
- Complete auth flow: proxy.ts route protection, OAuth2 callback, JWT verification, iron-session cookies
- Public landing page with SSO sign-in and Next.js route group layout splitting
- Per-user data isolation across all server actions, API routes, and page components
- UserMenu with initials avatar, admin badge, and Cognito logout
- Admin project view toggle with safe defaults

### What Worked
- TDD methodology across all phases caught issues early — zero bugs in shipped code
- Centralized authorization module (getAuthorizedProject/getAuthorizedProjects) made enforcement consistent and fast across 11+ files
- Small atomic plans averaged 3.2 minutes each — the fastest milestone by execution time
- Research phase documents provided clear contracts between phases (e.g., Phase 26 Cognito outputs → Phase 27 auth inputs)
- Milestone audit before completion caught tech debt items for documentation

### What Was Inefficient
- Phase 26/27 plan checkboxes in ROADMAP.md never got checked to `[x]` (inconsistency with Phase 28/29)
- Nyquist validation strategies created but never executed — all 4 phases remained in draft status
- Pre-existing Prisma CLI incompatibility (Node 21.5.0 ESM/CJS) forced manual migration creation
- Pre-existing CDK test failures (3) accumulated from v2.0 and were never addressed

### Patterns Established
- `server-only` import guard on all lib/auth/ modules prevents client-side usage
- proxy.ts defense-in-depth route protection (per CVE-2025-29927) — verify auth in data access, not just middleware
- Entity chain ownership lookup (run→project→userId) instead of userId on every table
- URL search param for server/client view state synchronization (admin toggle)
- Server layout → AppShell → component props pattern for user data flow (avoids client-side auth calls)

### Key Lessons
1. **Centralized authorization pays off** — writing helpers once and importing everywhere made 11-file enforcement take 7 minutes instead of hours
2. **iron-session cookie size matters** — storing extracted claims instead of full JWT avoided 4KB limit silently truncating data
3. **Lazy singleton for env-dependent services** — CognitoJwtVerifier crashed in dev until lazy-initialized, a pattern to apply broadly
4. **Safe admin defaults** — defaulting admins to their own view prevents accidental data exposure and matches daily workflow
5. **Hardcode first, abstract later** — hardcoded admin email shipped in minutes; the full group pipeline is wired but dormant until needed

### Cost Observations
- Model mix: ~80% sonnet (execution), ~20% opus (planning, milestone completion)
- Sessions: ~3 across 2 days
- Notable: 32 minutes total execution time for 10 plans — fastest milestone by wall-clock execution

---

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
| v3.0 | ~3 | 4 | Fastest execution (32min), TDD across all phases |
| v4.0 | ~4 | 4 | Zero-defect feature delivery, role-based sharing |

### Top Lessons (Verified Across Milestones)

1. Small, atomic plans execute faster and with fewer issues than large monolithic ones (v1.0, v1.1, v1.2, v2.0, v3.0, v4.0)
2. Human checkpoints for deployment validation are essential — automated tests can't verify browser-based flows (v1.0, v2.0)
3. Parallel execution where dependencies allow saves significant wall-clock time (v2.0 phases 21+22)
4. Centralized helpers for cross-cutting concerns (authorization, auth) pay off immediately when many files need the same pattern (v3.0, v4.0)
5. Discuss-phase context documents prevent mid-execution pivots by locking key design decisions early (v4.0)
