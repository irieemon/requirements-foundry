# Roadmap: Requirements Foundry

## Milestones

- ✅ **v1.0 Generative Pipeline Fix** — Phases 1-9 (shipped 2026-01-15)
- ✅ **v1.1 UX Polish** — Phases 10-12 (shipped 2026-01-20)
- ✅ **v1.2 MSS Integration** — Phases 13-17 (shipped 2026-01-27)
- ⏸️ **v1.3 Contextual Upload** — Phases 18-20 (paused at Phase 19)
- ✅ **v2.0 AWS Migration** — Phases 21-25 (shipped 2026-03-09)
- ✅ **v3.0 Authentication & Multi-User** — Phases 26-29 (shipped 2026-03-10)
- 🚧 **v4.0 Project Sharing** — Phases 30-33 (in progress)

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

## Phases

### v4.0 Project Sharing (In Progress)

**Milestone Goal:** Enable project owners to share projects with other users as viewers or editors, with clear UI separation between owned and shared projects.

- [x] **Phase 30: Data Foundation** - User table and ProjectShare schema enabling all sharing functionality (completed 2026-03-23)
- [ ] **Phase 31: Authorization Refactor** - Role-aware access control for owner/editor/viewer/admin across all routes
- [ ] **Phase 32: Share Management** - Owner-facing UI for sharing projects and managing collaborators
- [ ] **Phase 33: Projects Page Integration** - User-facing display of shared projects with role and owner context

## Phase Details

### Phase 30: Data Foundation
**Goal**: Users have local identity records and the data layer exists to represent project shares
**Depends on**: Phase 29 (v3.0 auth infrastructure)
**Requirements**: DATA-01, DATA-02
**Success Criteria** (what must be TRUE):
  1. User who logs in via SSO has a local User record created automatically (with email and display name from Cognito claims)
  2. A ProjectShare record can be created linking a user to a project with a viewer or editor role
  3. Existing users who have previously logged in appear in the User table (backfilled from Project.userId on migration)
  4. Deleting a project cascades to remove its share records
**Plans**: 1 plan
Plans:
- [x] 30-01-PLAN.md — User/ProjectShare schema, migration with backfill, auth callback upsert

### Phase 31: Authorization Refactor
**Goal**: Every route and server action resolves an explicit role (owner/editor/viewer/admin) and enforces it consistently
**Depends on**: Phase 30
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User with a share record can navigate to the shared project and see its contents (cards, epics, stories, subtasks)
  2. User with viewer role sees disabled mutation controls and cannot trigger uploads, AI runs, edits, deletions, or exports
  3. Admin can access any project regardless of ownership or share records (existing behavior preserved)
  4. No inline ownership checks remain outside the centralized authorization module (all consolidated)
  5. Unauthorized access to a project returns 404 (not 403), preserving the existing security pattern
**Plans**: 3 plans
Plans:
- [ ] 31-01-PLAN.md — Core auth module: types, resolveRole, getAuthorizedProject with shares, getAuthorizedProjects, getAuthorizedRun
- [ ] 31-02-PLAN.md — Viewer mutation guards on all 11 server action files
- [ ] 31-03-PLAN.md — Consolidate inline auth checks from 7 API routes and 1 page route

### Phase 32: Share Management
**Goal**: Project owners can add, remove, and manage collaborators on their projects
**Depends on**: Phase 31
**Requirements**: SHARE-01, SHARE-02, SHARE-03
**Success Criteria** (what must be TRUE):
  1. Project owner can open a share dialog and add one or more users as viewer or editor
  2. User picker shows matching users by email or name with autocomplete (from local User table, not Cognito API)
  3. Project owner can change a shared user's role between viewer and editor
  4. Project owner can remove a user's access to the project
  5. Non-owners (editors, viewers) cannot access the share management controls
**Plans**: [To be planned]
**UI hint**: yes

### Phase 33: Projects Page Integration
**Goal**: Users can distinguish their own projects from shared ones and see collaboration context at a glance
**Depends on**: Phase 32
**Requirements**: PAGE-01, PAGE-02, PAGE-03
**Success Criteria** (what must be TRUE):
  1. Projects page displays a "Shared with me" section visually separated from "My Projects"
  2. Each shared project card shows the user's role (viewer or editor) as a badge
  3. Each shared project card shows the project owner's display name
  4. Runs page includes runs from shared projects the user has access to
**Plans**: [To be planned]
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 30 -> 31 -> 32 -> 33

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9   | v1.0      | 17/17          | Complete | 2026-01-15 |
| 10-12 | v1.1      | 10/10          | Complete | 2026-01-20 |
| 13-17 | v1.2      | 8/8            | Complete | 2026-01-27 |
| 18-20 | v1.3      | 2/?            | Paused   | -          |
| 21-25 | v2.0      | 17/17          | Complete | 2026-03-09 |
| 26-29 | v3.0      | 10/10          | Complete | 2026-03-10 |
| 30. Data Foundation | v4.0 | 1/1 | Complete    | 2026-03-23 |
| 31. Authorization Refactor | v4.0 | 0/3 | Not started | - |
| 32. Share Management | v4.0 | 0/? | Not started | - |
| 33. Projects Page Integration | v4.0 | 0/? | Not started | - |
