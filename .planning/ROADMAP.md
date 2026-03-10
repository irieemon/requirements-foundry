# Roadmap: Requirements Foundry

## Milestones

- v1.0 Generative Pipeline Fix - Phases 1-9 (shipped 2026-01-15)
- v1.1 UX Polish - Phases 10-12 (shipped 2026-01-20)
- v1.2 MSS Integration - Phases 13-17 (shipped 2026-01-27)
- v1.3 Contextual Upload - Phases 18-20 (paused at Phase 19)
- v2.0 AWS Migration - Phases 21-25 (shipped 2026-03-09)
- v3.0 Authentication & Multi-User - Phases 26-29 (in progress)

## Completed Milestones

<details>
<summary>v1.0 Generative Pipeline Fix (Phases 1-9) -- SHIPPED 2026-01-15</summary>

- [x] **Phase 1: Investigation & Instrumentation** (2/2 plans) -- completed 2026-01-13
- [x] **Phase 2: Card Analysis Progress Fix** (1/1 plan) -- completed 2026-01-13
- [x] **Phase 3: Epic Generation Progress Fix** (1/1 plan) -- completed 2026-01-13
- [x] **Phase 4: Story Generation Timeout Fix** (1/1 plan) -- completed 2026-01-14
- [x] **Phase 5: Integration Verification** (2/2 plans) -- completed 2026-01-15
- [x] **Phase 6: Stories Page** (1/1 plan) -- completed 2026-01-14
- [x] **Phase 7: Subtask Generation** (5/5 plans) -- completed 2026-01-14
- [x] **Phase 8: Subtask Viewing** (1/1 plan) -- completed 2026-01-15
- [x] **Phase 9: Performance Optimization** (3/3 plans) -- completed 2026-01-15

See [v1.0 archive](milestones/v1.0-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.1 UX Polish (Phases 10-12) -- SHIPPED 2026-01-20</summary>

- [x] Phase 10: Navigation & Layout (3/3 plans) -- completed 2026-01-15
- [x] Phase 10.1: Upload Client Direct (1/1 plan) -- completed 2026-01-16
- [x] Phase 10.2: KPI & Subtask UX (1/1 plan) -- completed 2026-01-16
- [x] Phase 11: Data Display & Hierarchy (3/3 plans) -- completed 2026-01-20
- [x] Phase 12: JIRA Export Preview (2/2 plans) -- completed 2026-01-20

See [v1.1 archive](milestones/v1.1-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.2 MSS Integration (Phases 13-17) -- SHIPPED 2026-01-27</summary>

- [x] Phase 13: MSS Data Model & Import (1/1 plan) -- completed 2026-01-20
- [x] Phase 14: MSS Management UI (3/3 plans) -- completed 2026-01-20
- [x] Phase 15: MSS Mapping to Work Items (2/2 plans) -- completed 2026-01-20
- [x] Phase 16: MSS Dashboard & Reporting (1/1 plan) -- completed 2026-01-20
- [x] Phase 17: MSS Export Integration (1/1 plan) -- completed 2026-01-27

See [v1.2 archive](milestones/v1.2-ROADMAP.md) for full details.

</details>

<details>
<summary>v1.3 Contextual Upload (Phases 18-20) -- PAUSED</summary>

- [x] Phase 18: Context Schema & Upload Form (1/1 plan) -- completed 2026-01-27
- [ ] Phase 19: AI Question Generation (1/2 plans) -- paused
- [ ] Phase 20: Context Integration (0/? plans) -- not started

Paused at Phase 19 for AWS migration priority. Resume after v3.0.

</details>

<details>
<summary>v2.0 AWS Migration (Phases 21-25) -- SHIPPED 2026-03-09</summary>

- [x] **Phase 21: Application Code Migration** (5/5 plans) -- completed 2026-03-05
- [x] **Phase 22: Infrastructure Foundation** (3/3 plans) -- completed 2026-03-05
- [x] **Phase 23: Compute and Deployment** (3/3 plans) -- completed 2026-03-06
- [x] **Phase 24: CI/CD and Operations** (3/3 plans) -- completed 2026-03-09
- [x] **Phase 25: Validation and Data Migration** (3/3 plans) -- completed 2026-03-09

See [v2.0 archive](milestones/v2.0-ROADMAP.md) for full details.

</details>

## v3.0 Authentication & Multi-User (In Progress)

**Milestone Goal:** Add Cognito + Okta SAML SSO authentication with per-user project isolation and admin role

### Phases

- [ ] **Phase 26: Cognito Infrastructure** - Deploy Cognito User Pool with Okta SAML federation and group-mapping Lambda via CDK
- [ ] **Phase 27: Auth Flow** - End-to-end login, session management, route protection, and logout
- [ ] **Phase 28: Data Isolation** - Per-user project ownership with admin bypass and existing data migration
- [ ] **Phase 29: Admin UI and Polish** - Admin project toggle, user identity display, and user menu

## Phase Details

### Phase 26: Cognito Infrastructure
**Goal**: AWS Cognito User Pool exists with working Okta SAML federation so the app can authenticate corporate users
**Depends on**: Nothing (first phase of v3.0; builds on v2.0 CDK stack)
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. Cognito User Pool is deployed with an Okta SAML identity provider configured
  2. A test user can complete SAML authentication through Cognito Hosted UI and receive JWT tokens containing their email and group claims
  3. PreTokenGeneration Lambda correctly maps Okta group attributes to cognito:groups in the ID token
  4. Cognito client credentials are stored securely and accessible to ECS task environment
**Plans**: TBD

Plans:
- [ ] 26-01: TBD
- [ ] 26-02: TBD

### Phase 27: Auth Flow
**Goal**: Users authenticate via Okta SSO through the application with persistent sessions and protected routes
**Depends on**: Phase 26 (Cognito must be deployed and Okta SAML working)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. Unauthenticated user visiting any app route is redirected to a public landing page with "Sign in with Okta" button
  2. Clicking "Sign in with Okta" redirects through Cognito to Okta, and if already logged into Okta, returns to the app without additional login prompts
  3. Authenticated user's session persists across browser tabs and survives page refreshes (HTTP-only cookies)
  4. User can log out and is redirected to the landing page, with Cognito session cleared
  5. proxy.ts verifies JWT on every request and rejects expired/invalid tokens
**Plans**: TBD

Plans:
- [ ] 27-01: TBD
- [ ] 27-02: TBD
- [ ] 27-03: TBD

### Phase 28: Data Isolation
**Goal**: Each user sees only their own projects, with admin role enforcement at the data access layer
**Depends on**: Phase 27 (auth flow must work so user identity is available in server actions)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, ADMIN-01, ADMIN-03
**Success Criteria** (what must be TRUE):
  1. All existing projects are migrated to the default admin user (sean.mcinerney@merkle.com) and no projects have NULL userId
  2. New projects created by an authenticated user are automatically assigned to that user
  3. Non-admin users see only their own projects in the project list and cannot access other users' projects via direct URL
  4. All server actions and API routes enforce userId ownership -- requests for another user's resources are rejected
  5. Admin user (determined by Okta group membership in JWT) can access all projects through server-side bypass
**Plans**: TBD

Plans:
- [ ] 28-01: TBD
- [ ] 28-02: TBD
- [ ] 28-03: TBD

### Phase 29: Admin UI and Polish
**Goal**: Admin users have a toggle to view all projects, and all users see their identity in the app header with a functional user menu
**Depends on**: Phase 28 (data isolation must be enforced before admin UI exposes cross-user views)
**Requirements**: ADMIN-02, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. Admin user sees a toggle in the UI to switch between "My Projects" and "All Projects" views
  2. "All Projects" view shows project owner information alongside each project
  3. App header displays the authenticated user's name and email from Okta
  4. User menu includes a logout option that triggers the logout flow
**Plans**: TBD

Plans:
- [ ] 29-01: TBD
- [ ] 29-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 26 -> 27 -> 28 -> 29

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-9   | v1.0      | 17/17          | Complete | 2026-01-15 |
| 10-12 | v1.1      | 10/10          | Complete | 2026-01-20 |
| 13-17 | v1.2      | 8/8            | Complete | 2026-01-27 |
| 18-20 | v1.3      | 2/?            | Paused   | -          |
| 21-25 | v2.0      | 17/17          | Complete | 2026-03-09 |
| 26. Cognito Infrastructure | v3.0 | 0/? | Not started | - |
| 27. Auth Flow | v3.0 | 0/? | Not started | - |
| 28. Data Isolation | v3.0 | 0/? | Not started | - |
| 29. Admin UI and Polish | v3.0 | 0/? | Not started | - |
