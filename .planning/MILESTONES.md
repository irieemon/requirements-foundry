# Project Milestones: Requirements Foundry

## v4.0 Project Sharing (Shipped: 2026-03-25)

**Phases completed:** 4 phases, 8 plans, 15 tasks

**Key accomplishments:**

- User and ProjectShare Prisma models with migration backfill and login-time upsert in auth callback
- Role-based authorization with ProjectShare lookup, resolveRole priority function, and enriched AuthResult return shape across getAuthorizedProject, getAuthorizedProjects, and getAuthorizedRun
- canEdit guard added to 29 mutation functions across 10 server action files, blocking viewer role with Read-only access rejection
- Replaced all inline project.userId ownership checks across 7 API routes and 1 page route with centralized getAuthorizedRun/getAuthorizedProject helpers, adding viewer guard on upload mutations
- Share CRUD server actions with owner/admin gating, cmdk+popover UI primitives, and 19 passing unit tests
- Share dialog with user search combobox, role management list, and owner-gated project page integration
- Two-section project list with "My Projects" / "Shared with me" sections, role badges (Editor/Viewer), and owner name display on shared cards
- OR query for owned + shared project runs with per-run projectName display in RunList

---

## v3.0 Authentication & Multi-User (Shipped: 2026-03-10)

**Delivered:** Added Cognito + Okta SAML SSO authentication with per-user project isolation, admin role bypass, and polished user identity display -- transforming a single-user tool into a secure multi-tenant application.

**Phases completed:** 26-29 (10 plans total)

**Key accomplishments:**

- Deployed Cognito User Pool with Okta SAML federation and PreTokenGeneration Lambda for group-to-JWT mapping via CDK
- Built complete auth flow: proxy.ts route protection, OAuth2 callback, JWT verification (aws-jwt-verify), iron-session encrypted cookies
- Created public landing page with SSO sign-in and Next.js route group layout splitting for authenticated/public separation
- Enforced per-user data isolation across all 11 server actions, 7 API routes, and 3 page components with centralized authorization module
- Added UserMenu component with initials avatar, admin badge, and Cognito logout in sidebar and mobile nav
- Implemented admin project view toggle with safe defaults (own projects first, explicit opt-in to view all)

**Stats:**

- 67 commits in milestone
- 375 files changed, +70,225 / -3,753 lines
- 4 phases, 10 plans, 20 tasks
- 2 days from start to ship (Mar 9-10, 2026)
- Total execution time: 32 minutes across 10 plans (avg 3.2 min/plan)

**Git range:** `test(26-01)` → `docs: create v3.0 milestone audit report`

**Tech debt:**

- ADMIN-01: isAdmin uses hardcoded ADMIN_EMAIL instead of Okta group claims (pipeline wired but unused)
- Runs page admins see all runs by default with no My/All toggle (asymmetry with projects page)
- 3 pre-existing CDK test failures (ALB security group, internal flag, DesiredCount)

**What's next:** Resume v1.3 (Contextual Upload, Phase 19) or start new milestone

---

## v2.0 AWS Migration (Shipped: 2026-03-09)

**Delivered:** Migrated Requirements Foundry from Vercel to AWS with full feature parity -- ECS Fargate, RDS PostgreSQL, S3, Bedrock AI, automated CI/CD, and operational monitoring.

**Phases completed:** 21-25 (17 plans total)

**Key accomplishments:**

- Replaced all Vercel dependencies (Blob, Anthropic SDK, Neon SSL, self-continuation) with AWS equivalents (S3, Bedrock, standard PG, direct async)
- Built complete CDK infrastructure stack: VPC with 3 subnet tiers, RDS PostgreSQL, S3, ECR, ECS Fargate, ALB, VPC endpoints
- Deployed containerized Next.js application on ECS Fargate (0.5 vCPU / 1GB RAM) accessible via ALB
- Automated CI/CD via GitHub Actions with OIDC authentication (no long-lived credentials)
- Added operational monitoring: CloudWatch alarms, SNS notifications, Lambda cron scheduler for stale run recovery
- Full smoke test passed: generative pipeline, MSS flow, Bedrock AI, file uploads all working on AWS

**Stats:**

- ~84 commits in milestone
- 94 files changed, +14,163 / -2,092 lines
- 61,483 total LOC (TypeScript/TSX/JS/JSON)
- 5 phases, 17 plans
- 5 days from start to ship (Mar 5-9, 2026)

**Git range:** `feat(21-01)` → `docs(phase-25)`

**Known gaps:**

- 23-03-SUMMARY.md missing (multi-session deployment debugging, work completed)
- AI-01/AI-04 checkbox omissions in REQUIREMENTS.md (validated by smoke test)

**What's next:** Resume v1.3 (Contextual Upload, Phase 19) or start new milestone

---

## v1.2 MSS Integration (Shipped: 2026-01-27)

**Delivered:** Complete MSS (Master Service Schedule) taxonomy management pipeline from CSV import through JIRA export, enabling work items to be mapped to service lines for effort visibility.

**Phases completed:** 13-17 (8 plans total)

**Key accomplishments:**

- Created L2/L3/L4 MSS taxonomy schema with flexible CSV import and auto-column detection
- Built full CRUD management UI with collapsible hierarchy viewer and polymorphic dialogs
- Added MSS selector to epics/stories with AI auto-assignment during generation
- Created dashboard with coverage metrics and color-coded service line breakdown
- Integrated MSS into JIRA export with inheritance support (stories inherit from epics)

**Stats:**

- ~17 commits in milestone
- ~3,947 net lines added (30,500 → 34,435 TypeScript/TSX)
- 5 phases, 8 plans
- 7 days from start to ship (Jan 20-27, 2026)

**Git range:** `feat(13-01)` → `feat(17-01)`

**What's next:** TBD - milestone complete, ready for next feature development

---

## v1.1 UX Polish (Shipped: 2026-01-20)

**Delivered:** Transformed working but clunky interface into polished, modern dashboard with contextual navigation, modern card designs, and preview-first JIRA export experience.

**Phases completed:** 10-12 (10 plans total, including decimal phases 10.1 and 10.2)

**Key accomplishments:**

- Contextual sidebar navigation with project sections and visual hierarchy
- Fixed 413 file upload errors with client-side direct Blob uploads (files >4.5MB now work)
- Modern card redesign for epics/stories/subtasks following Notion/Linear aesthetic
- Tabbed JIRA export wizard with preview-first UX showing exact import hierarchy
- Mobile navigation parity and responsive KPI layout

**Stats:**

- 44 files created/modified
- ~3,666 net lines added
- 5 phases (3 planned + 2 decimal), 10 plans
- 5 days from start to ship (Jan 15-20, 2026)

**Git range:** `feat(10-01)` → `feat(12-02)`

**What's next:** v1.2 MSS Integration - Import and manage Master Service Schedule taxonomy

---

## v1.0 Generative Pipeline Fix (Shipped: 2026-01-15)

**Delivered:** Fixed all three regressed generative flows (card analysis, epic generation, story generation) with real-time progress feedback, plus added subtask generation and performance optimizations.

**Phases completed:** 1-9 (17 plans total)

**Key accomplishments:**

- Fixed frozen progress panel during card analysis with live elapsed time tracking and animated indicators
- Added progress indicator for epic generation (was just spinning button)
- Fixed story generation timeouts with self-continuation and fire-and-confirm trigger patterns
- Added Stories page with grouping by epic and KPI tracking
- Implemented full subtask generation pipeline (schema, executor, UI, progress polling)
- Added Subtasks viewing page with hierarchical display (story within epic)
- Optimized performance with batch DB operations (`createMany`) and parallel card analysis (2-3 concurrent)

**Stats:**

- 78 files created/modified
- ~12,000 lines added
- 26,788 total lines of TypeScript/TSX
- 9 phases, 17 plans
- 3 days from start to ship (Jan 12-15, 2026)

**Git range:** `feat(01-02)` → `feat(09-03)`

**What's next:** TBD - milestone complete, ready for next feature development

---
