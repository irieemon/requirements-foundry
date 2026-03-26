# Roadmap: Requirements Foundry

## Milestones

- ✅ **v1.0 Generative Pipeline Fix** — Phases 1-9 (shipped 2026-01-15)
- ✅ **v1.1 UX Polish** — Phases 10-12 (shipped 2026-01-20)
- ✅ **v1.2 MSS Integration** — Phases 13-17 (shipped 2026-01-27)
- ⏸️ **v1.3 Contextual Upload** — Phases 18-20 (paused at Phase 19)
- ✅ **v2.0 AWS Migration** — Phases 21-25 (shipped 2026-03-09)
- ✅ **v3.0 Authentication & Multi-User** — Phases 26-29 (shipped 2026-03-10)
- ✅ **v4.0 Project Sharing** — Phases 30-33 (shipped 2026-03-25)
- 🚧 **v5.0 Bug Reporting** — Phases 34-36 (in progress)

## Completed Milestones

<details>
<summary>✅ v1.0 Generative Pipeline Fix (Phases 1-9) — SHIPPED 2026-01-15</summary>

- [x] **Phase 1: Investigation & Instrumentation** (2/2 plans) — completed 2026-01-13
- [x] **Phase 2: Card Analysis Progress Fix** (1/1 plan) — completed 2026-01-13
- [x] **Phase 3: Epic Generation Progress Fix** (1/1 plan) — completed 2026-01-13
- [x] **Phase 4: Story Generation Timeout Fix** (1/1 plan) — completed 2026-01-14
- [x] **Phase 5: Integration Verification** (2/2 plans) — completed 2026-01-15
- [x] **Phase 6: Stories Page** (1/1 plan) — completed 2026-01-14
- [x] **Phase 7: Subtask Generation** (5/5 plans) — completed 2026-01-14
- [x] **Phase 8: Subtask Viewing** (1/1 plan) — completed 2026-01-15
- [x] **Phase 9: Performance Optimization** (3/3 plans) — completed 2026-01-15

See [v1.0 archive](milestones/v1.0-ROADMAP.md) for full details.

</details>

<details>
<summary>✅ v1.1 UX Polish (Phases 10-12) — SHIPPED 2026-01-20</summary>

- [x] Phase 10: Navigation & Layout (3/3 plans) — completed 2026-01-15
- [x] Phase 10.1: Upload Client Direct (1/1 plan) — completed 2026-01-16
- [x] Phase 10.2: KPI & Subtask UX (1/1 plan) — completed 2026-01-16
- [x] Phase 11: Data Display & Hierarchy (3/3 plans) — completed 2026-01-20
- [x] Phase 12: JIRA Export Preview (2/2 plans) — completed 2026-01-20

See [v1.1 archive](milestones/v1.1-ROADMAP.md) for full details.

</details>

<details>
<summary>✅ v1.2 MSS Integration (Phases 13-17) — SHIPPED 2026-01-27</summary>

- [x] Phase 13: MSS Data Model & Import (1/1 plan) — completed 2026-01-20
- [x] Phase 14: MSS Management UI (3/3 plans) — completed 2026-01-20
- [x] Phase 15: MSS Mapping to Work Items (2/2 plans) — completed 2026-01-20
- [x] Phase 16: MSS Dashboard & Reporting (1/1 plan) — completed 2026-01-20
- [x] Phase 17: MSS Export Integration (1/1 plan) — completed 2026-01-27

See [v1.2 archive](milestones/v1.2-ROADMAP.md) for full details.

</details>

<details>
<summary>⏸️ v1.3 Contextual Upload (Phases 18-20) — PAUSED</summary>

- [x] Phase 18: Context Schema & Upload Form (1/1 plan) — completed 2026-01-27
- [ ] Phase 19: AI Question Generation (1/2 plans) — paused
- [ ] Phase 20: Context Integration (0/? plans) — not started

Paused at Phase 19 for AWS migration priority. Resume when ready.

</details>

<details>
<summary>✅ v2.0 AWS Migration (Phases 21-25) — SHIPPED 2026-03-09</summary>

- [x] **Phase 21: Application Code Migration** (5/5 plans) — completed 2026-03-05
- [x] **Phase 22: Infrastructure Foundation** (3/3 plans) — completed 2026-03-05
- [x] **Phase 23: Compute and Deployment** (3/3 plans) — completed 2026-03-06
- [x] **Phase 24: CI/CD and Operations** (3/3 plans) — completed 2026-03-09
- [x] **Phase 25: Validation and Data Migration** (3/3 plans) — completed 2026-03-09

See [v2.0 archive](milestones/v2.0-ROADMAP.md) for full details.

</details>

<details>
<summary>✅ v3.0 Authentication & Multi-User (Phases 26-29) — SHIPPED 2026-03-10</summary>

- [x] **Phase 26: Cognito Infrastructure** (2/2 plans) — completed 2026-03-10
- [x] **Phase 27: Auth Flow** (3/3 plans) — completed 2026-03-10
- [x] **Phase 28: Data Isolation** (3/3 plans) — completed 2026-03-10
- [x] **Phase 29: Admin UI and Polish** (2/2 plans) — completed 2026-03-10

See [v3.0 archive](milestones/v3.0-ROADMAP.md) for full details.

</details>

<details>
<summary>✅ v4.0 Project Sharing (Phases 30-33) — SHIPPED 2026-03-25</summary>

- [x] **Phase 30: Data Foundation** (1/1 plan) — completed 2026-03-23
- [x] **Phase 31: Authorization Refactor** (3/3 plans) — completed 2026-03-24
- [x] **Phase 32: Share Management** (2/2 plans) — completed 2026-03-25
- [x] **Phase 33: Projects Page Integration** (2/2 plans) — completed 2026-03-25

See [v4.0 archive](milestones/v4.0-ROADMAP.md) for full details.

</details>

## Phases

### v5.0 Bug Reporting

**Milestone Goal:** Enable users to report bugs from anywhere in the app, notify the admin via email, and provide an admin dashboard for tracking and managing reports.

- [x] **Phase 34: Schema & SES Infrastructure** - BugReport data model and AWS SES email delivery foundation (completed 2026-03-26)
- [ ] **Phase 35: Bug Report Submission Flow** - User-facing floating button, modal, email notification, and confirmation
- [ ] **Phase 36: Admin Bug Dashboard** - Admin-only page for viewing, managing, filtering, and tracking bug reports

## Phase Details

### Phase 34: Schema & SES Infrastructure
**Goal**: The data foundation and email delivery infrastructure exist so application code can persist bug reports and send notifications
**Depends on**: Phase 33 (v4.0 complete)
**Requirements**: INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. BugReport table exists in the database with all required fields (description, pageUrl, submitterEmail, submitterName, browserMetadata, status, adminNotes, timestamps)
  2. Prisma migration applies cleanly to the production RDS instance
  3. SES email identity is verified in us-east-1 and the ECS task role has ses:SendEmail permission
  4. BUG_REPORT_ADMIN_EMAIL and SES_SENDER_EMAIL environment variables are available to the ECS task
**Plans**: 2 plans
Plans:
- [ ] 34-01-PLAN.md — BugReport Prisma model and database migration
- [ ] 34-02-PLAN.md — SES email identity, IAM permissions, and CDK tests

### Phase 35: Bug Report Submission Flow
**Goal**: Any authenticated user can report a bug from any page without losing context, and the admin receives an email notification
**Depends on**: Phase 34
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, EMAIL-01, EMAIL-02
**Success Criteria** (what must be TRUE):
  1. A persistent "Report Bug" button is visible on every authenticated page
  2. Clicking the button opens a modal where the user types a description; page URL, user identity, and browser metadata are captured automatically
  3. After submitting, the user sees a success toast and the bug report is saved to the database
  4. The admin receives a rich HTML email with report details and a direct link to the admin dashboard
  5. If SES fails, the bug report is still saved (email is fire-and-forget, not blocking)
**Plans**: 2 plans
Plans:
- [ ] 35-01-PLAN.md — Email template, SES send function, and submitBugReport server action with tests
- [ ] 35-02-PLAN.md — BugReportButton FAB + Dialog component and AppShell integration
**UI hint**: yes

### Phase 36: Admin Bug Dashboard
**Goal**: Admin can view, triage, and manage all bug reports from a dedicated page with status workflow and filtering
**Depends on**: Phase 35
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05
**Success Criteria** (what must be TRUE):
  1. Admin can access a dedicated /bug-reports page showing all reports with submitter, date, page URL, description, and status
  2. Admin can update a report's status through the workflow (open -> in-progress -> resolved -> closed)
  3. Admin can add internal notes to any bug report
  4. Admin can filter reports by status and sort by date
  5. An open report count badge appears in the sidebar navigation for admin users
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 34 -> 35 -> 36

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9   | v1.0      | 17/17          | Complete | 2026-01-15 |
| 10-12 | v1.1      | 10/10          | Complete | 2026-01-20 |
| 13-17 | v1.2      | 8/8            | Complete | 2026-01-27 |
| 18-20 | v1.3      | 2/?            | Paused   | -          |
| 21-25 | v2.0      | 17/17          | Complete | 2026-03-09 |
| 26-29 | v3.0      | 10/10          | Complete | 2026-03-10 |
| 30-33 | v4.0      | 8/8            | Complete | 2026-03-25 |
| 34. Schema & SES Infrastructure | v5.0 | 0/2 | Complete    | 2026-03-26 |
| 35. Bug Report Submission Flow | v5.0 | 0/2 | Not started | - |
| 36. Admin Bug Dashboard | v5.0 | 0/? | Not started | - |
