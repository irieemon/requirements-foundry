# Project Research Summary

**Project:** Requirements Foundry v4.0 — Project Sharing & Role-Based Permissions
**Domain:** Retrofitting multi-user collaboration onto a single-owner requirements management tool
**Researched:** 2026-03-23
**Confidence:** HIGH

## Executive Summary

Requirements Foundry v4.0 adds user-to-user project sharing with viewer and editor roles to a previously single-owner application. The research conclusion is unambiguous: this milestone is a schema extension and authorization refactor, not a technology addition. The existing stack (Prisma 7, Next.js 16, iron-session, Zod 4, Radix UI) provides every capability needed. A single new `ProjectShare` junction table, a modified `getAuthorizedProject()` function that returns an explicit role, and a new `User` table populated via login upsert are the entire data layer footprint. No new npm dependencies are required.

The recommended approach follows the existing app's centralized authorization pattern: all access control flows through `lib/auth/authorization.ts`, the `ProjectShare` table is indexed for efficient "shared with me" lookups, and permissions are resolved once per request and threaded through the component tree. The correct mental model is Linear's approach — authenticated SSO users only, explicit per-user sharing, no public links — which matches the corporate security constraints of this tool. Two roles (viewer, editor) plus the existing owner/admin hierarchy cover all realistic collaboration needs without the complexity of per-entity ACLs or a full RBAC library.

The dominant risk is not technical but implementation discipline: the existing codebase has authorization checks scattered across both the centralized module and inline in at least six API route handlers. If the inline checks are not updated alongside the centralized function, shared users will experience partial access (project pages load but run polling and upload endpoints return 404). The authorization consolidation must happen in Phase 1, before any sharing UI is built. A secondary risk is that the app currently has no `User` table — users exist only in Cognito — and the share user picker cannot function without a local queryable source. Adding the `User` model with an upsert on every login is the enabling prerequisite for the share management UI.

## Key Findings

### Recommended Stack

The stack requires no changes. All necessary capabilities exist in the current dependencies. The `ProjectShare` junction table uses Prisma 7's native enum fields (`ShareRole: VIEWER | EDITOR`), composite unique constraints (`@@unique([projectId, userEmail])`), and cascade deletes — all stable features since Prisma 4. Zod 4 validates share inputs. Radix UI Dialog and Select (already installed) provide the share management modal and role dropdown. The only new integration is Cognito's `ListUsers` API for user discovery if not using a local User table, which uses `@aws-sdk/client-cognito-identity-provider` already in the dependency tree.

**Core technologies:**
- **Prisma 7**: Schema migration for `ProjectShare` and `User` models, typed queries with relation includes — no new dependency, uses existing patterns
- **Next.js 16 Server Actions**: All share CRUD operations as server actions — consistent with existing mutation pattern throughout the app
- **iron-session 8**: Session provides `user.email` for authorization checks — unchanged, remains the identity pivot
- **Zod 4**: Input validation for share/unshare/role-change actions — same pattern as existing action validators
- **Radix UI Dialog + Select**: Share management modal and role dropdown — already installed, no new packages needed

**What NOT to add:** CASL/casbin (two roles on one resource type is massive overkill), a WebSocket layer (users collaborate asynchronously; AI generation is the bottleneck, not simultaneous editing), or email notifications via SES (out of scope; in-app discovery is sufficient for this use case).

### Expected Features

**Must have (table stakes — v4.0 launch):**
- User table (new Prisma model, upserted on every login from Cognito claims) — enables picker and owner name display
- ProjectShare table with migration — the data foundation for all sharing functionality
- Authorization layer refactor — `getAuthorizedProject()` returns `{ project, user, role: 'owner' | 'editor' | 'viewer' | 'admin' }` and ALL inline checks consolidated here
- Mutation guards across all 11 server action files — viewers blocked from all write operations with clear feedback
- Share management UI — modal accessible to project owner; lists current shares with role dropdown and remove action
- User picker autocomplete — searches local User table; 7-9 max suggestions; prevents self-share and duplicates
- "Shared with me" section on projects page — separate from "My Projects"; displays owner name and role badge
- Read-only visual indicators — disabled buttons with "View only" context for viewers; no confusing errors on click
- Runs page visibility for shared projects — shared users see runs for projects they have access to

**Should have (differentiators — v4.x after validation):**
- Transfer ownership — when an employee leaves; simple `project.userId` swap with confirmation dialog
- Bulk share — multi-select in user picker for team onboarding; batch insert in one transaction
- In-app share notification — "N new projects shared with you" indicator; no email/SES dependency
- Share count on owner project cards — "Shared with N people" badge; trivial count query

**Defer (v5+):**
- Email notifications via SES — significant scope: templates, preferences, bounce handling; in-app discovery suffices
- Okta group-based auto-sharing — requires group sync pipeline; removes explicit owner control
- Audit log for share changes — separate concern already in the deferred backlog; build sharing first, audit later
- Commenter role — only if a commenting feature is actually built; premature to add a role for a non-existent capability

### Architecture Approach

The integration architecture is additive: one new junction table, one new `User` model, and modifications to the existing authorization module and three pages. The entity chain ownership pattern (Project is the root; child tables carry no userId) is preserved and extended — the `ProjectShare` table is the sole addition at the project level, not scattered across child tables. All authorization resolves once in `getAuthorizedProject()`, which now returns an explicit role. The `canEdit()`, `canManageShares()`, and `canDelete()` helper functions derived from that role are the only permission logic downstream components need. User discovery uses the local `User` table (preferred: faster, no rate limits, FK-safe) over Cognito `ListUsers`.

**Major components:**
1. **`lib/auth/authorization.ts` (modified)** — sole authorization source of truth; resolves owner/admin/editor/viewer/none for every project access; exposes `canEdit()`, `canManageShares()`, `canDelete()` helpers; eliminates all inline checks in API route handlers
2. **`server/actions/sharing.ts` (new)** — share CRUD (`getProjectShares`, `shareProject`, `updateShareRole`, `removeShare`) and user search (`searchUsers`); all guarded by `canManageShares()` check
3. **`components/projects/share-dialog.tsx` + `share-user-picker.tsx` (new)** — owner-only UI for managing shares; autocomplete over User table; prevents self-share and duplicates
4. **`app/(authenticated)/projects/page.tsx` (modified)** — two-section layout ("My Projects" / "Shared with me") using updated `getAuthorizedProjects()` return shape
5. **`app/(authenticated)/runs/page.tsx` (modified)** — expand `where` clause to include shared projects alongside owned projects

### Critical Pitfalls

1. **Scattered inline ownership checks create authorization gaps** — The codebase has `project.userId !== user.email` checks in at least 6 API route handlers outside the centralized module. Updating the centralized function without updating inline checks means shared users get partial access (project page works; run polling and upload endpoints silently 404). Prevention: audit every `project.userId` reference before writing sharing logic; consolidate all checks into `authorization.ts` in Phase 1. Verify with: `grep -r "project.userId" app/ server/ lib/` returning matches ONLY in `lib/auth/authorization.ts`.

2. **Viewer role not enforced on mutating server actions** — The current auth model is binary (access/no-access). Developers add the share check to `getAuthorizedProject()`, declare the feature done, and ship a viewer who can trigger AI generation runs and delete cards. Prevention: `assertCanEdit(role)` helper called at the top of every write action; automated tests for each server action verifying viewers receive a permission error.

3. **No User table breaks the user picker and creates orphaned shares** — The app has no local `User` model; users exist only in Cognito. Without a User table, developers fall back to Cognito `ListUsers` (rate-limited at 5 req/sec, slow) or allow sharing with arbitrary emails that produce orphaned share records for users who never sign in. Prevention: add the `User` model in Phase 2 with an upsert on every auth callback login; `ProjectShare` references `User` via FK to prevent orphaned records.

4. **Runs page and API route handlers bypass `getAuthorizedProject()`** — The runs page queries runs with an inline `project: { userId: user.email }` filter. Run detail pages and upload API routes check ownership inline. These paths will silently deny shared users access. Prevention: design a `getAccessibleProjectIds(userEmail)` helper as part of the Phase 1 auth refactor; use it as the building block for all list queries on child entities.

5. **N+1 queries on the "Shared with me" projects page** — Naively fetching shared projects as "get share IDs, then fetch each project individually" produces one query per shared project. Prevention: include `_count` in the `ProjectShare.findMany` query with a nested project include; return a unified `ProjectWithAccess` type from `getAuthorizedProjects()` so the component receives a single list to group, not two sequential round trips.

## Implications for Roadmap

Based on research, the dependency chain is clear and suggests a four-phase structure. The architecture research provides an explicit build order; the pitfalls research confirms the sequencing is mandatory, not advisory.

### Phase 1: Authorization Foundation

**Rationale:** Every other phase depends on this. The authorization module must return an explicit role before any UI or server action can enforce permissions correctly. Pitfalls 1, 2, and 4 (scattered checks, viewer enforcement, entity chain gaps) are all caused by doing this phase wrong or out of order. This is the highest-risk phase and must be completed before Phase 2.
**Delivers:** Consolidated authorization module with no inline checks remaining; `getAuthorizedProject()` returning `{ project, user, role }`; `canEdit()` / `canManageShares()` / `canDelete()` helpers; `getAccessibleProjectIds()` for child entity queries; admin permission hierarchy clearly defined as admin > owner > editor > viewer.
**Addresses:** Authorization enforcement across all routes (highest-effort table-stakes feature from FEATURES.md); admin full-access override preservation.
**Avoids:** P1 (scattered checks), P2 (viewer enforcement gaps), P4 (entity chain breaks), P6 (admin/sharing ambiguity).
**Research flag:** No additional research needed — codebase is fully analyzed, pattern is well-established.

### Phase 2: Data Layer (Schema + User Table)

**Rationale:** The `User` table and `ProjectShare` table are the data foundations for all sharing UI. The User table must be populated before the picker can function. The `ProjectShare` table must exist before the authorization checks added in Phase 1 can query it. This phase also includes the login upsert so the User table self-populates going forward.
**Delivers:** `User` Prisma model + migration with upsert in auth callback; `ProjectShare` model + migration with `ShareRole` enum, composite unique, and cascade delete; updated `getAuthorizedProjects()` returning `{ ownedProjects, sharedProjects }` with unified `ProjectWithAccess` type including counts.
**Uses:** Prisma 7 enum fields, composite unique constraints, relation includes; existing iron-session callback for login upsert trigger.
**Avoids:** P5 (no User table / orphaned shares), P4 (N+1 query — design unified query shape here).
**Research flag:** No additional research needed — schema design is fully specified in STACK.md and ARCHITECTURE.md.

### Phase 3: Share Management + Projects Page UI

**Rationale:** Server actions and UI for creating and managing shares, plus the "Shared with me" section, can be built together once the data layer is in place. These are the user-visible deliverables of the milestone.
**Delivers:** `server/actions/sharing.ts` (getProjectShares, shareProject, updateShareRole, removeShare, searchUsers); share dialog + user picker components; "Shared with me" section on projects page with role badges and owner names; share button on project cards/headers; owner-only access guards on share management UI.
**Implements:** Share creation flow and shared project access flow from ARCHITECTURE.md; user picker with 7-9 suggestion limit and debounced search.
**Avoids:** P5 (picking users who don't exist — User table FK prevents this); UX pitfalls (no visual distinction between owned and shared projects, share management buried, exact-match-only picker).
**Research flag:** No additional research needed — component boundaries and data flows are fully specified in ARCHITECTURE.md.

### Phase 4: Viewer Enforcement + Read-Only UI

**Rationale:** Viewer role enforcement is separated from share creation because it requires touching all 11 server action files and every mutation-bearing UI component. Treating it as a dedicated phase ensures it receives complete attention rather than being bolted on at the end of Phase 3.
**Delivers:** `assertCanEdit()` calls in all write server actions; disabled/hidden mutation controls for viewers in project detail page; role-conditional UI in upload panel, run trigger, epic/story/subtask generation, JIRA export, and delete; "View only" indicators with tooltip context; runs page `where` clause expansion for shared project visibility; run detail page sharing-aware authorization check.
**Avoids:** P2 (viewer enforcement), P3 (runs page entity chain gap), UX pitfall of viewers seeing all UI controls but receiving confusing errors on click.
**Research flag:** No additional research needed — the 11 server action files are identified; the pattern is straightforward.

### Phase Ordering Rationale

- Phases 1 and 2 are strictly prerequisite: you cannot safely add the ProjectShare table without the authorization module ready to query it, and you cannot build share UI without the data to back it
- Phase 3 depends on both the authorization module (to check `canManageShares()`) and the User table (for the picker)
- Phase 4 is intentionally last so that viewer enforcement is validated end-to-end against real share records and real UI
- The ARCHITECTURE.md build order (Schema -> Auth -> Server Actions -> UI -> Page -> Detail -> Runs) is resequenced slightly here: authorization refactor precedes schema creation because the refactor defines the interface the schema will serve

### Research Flags

Phases with standard patterns (skip research-phase):
- **Phase 1:** Authorization consolidation is a mechanical refactor of a well-understood pattern; the codebase has been fully analyzed and inline check locations are known
- **Phase 2:** Schema design is fully specified; Prisma junction table with enum is standard and version-compatible
- **Phase 3:** Component boundaries and server action signatures are fully specified in ARCHITECTURE.md
- **Phase 4:** Viewer enforcement pattern is clear; the 11 server action files are identified

No phase requires a `/gsd:research-phase` call. All necessary detail is in the four research files.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase analysis of package.json and schema; all technologies verified as having the required capabilities in their current installed versions; no new dependencies needed |
| Features | HIGH | MVP feature set derived from codebase constraints (no User table, no commenting system) and direct comparison with industry patterns; Linear's model confirmed as the correct archetype for a corporate SSO tool |
| Architecture | HIGH | Based on direct analysis of authorization.ts, all server action files, and prisma/schema.prisma; component boundaries and data flows fully specified with code samples |
| Pitfalls | HIGH | Based on direct codebase analysis of 6 API route handlers with inline ownership checks and 11 server action files; pitfalls are identified from actual code, not inference |

**Overall confidence:** HIGH

### Gaps to Address

- **IAM permission for Cognito ListUsers:** If the Cognito ListUsers approach is chosen for user discovery instead of the local User table, the ECS task role needs `cognito-idp:ListUsers` scoped to the User Pool ARN. This is a CDK infra change. Recommendation: use the User table approach (no IAM change, no rate limits, FK integrity enforced). Confirm before Phase 2 schema work begins.
- **Cognito vs. User table for user discovery:** STACK.md recommends the User table; ARCHITECTURE.md describes both approaches. Decide explicitly before Phase 2. Recommendation is the User table.
- **Backfilling the User table:** On first deploy, the User table will be empty. Existing users will not appear in the picker until they log in again. Options: (a) accept the cold-start gap, (b) backfill from `SELECT DISTINCT userId FROM Project` at migration time, (c) backfill from Cognito ListUsers at migration time. Option (b) is simplest and sufficient — plan this as part of the Phase 2 migration script.
- **Concurrent run conflicts (P7):** Multiple editors on the same project can trigger AI generation simultaneously, potentially producing duplicate runs. Acceptable to defer a robust locking solution to a v4.x patch. A transaction-based run creation guard with a "run already in progress" response is sufficient for v4.0 and should be addressed in Phase 4.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `lib/auth/authorization.ts`, `prisma/schema.prisma`, `package.json`, `server/actions/*.ts` — direct analysis, all findings verified against actual code
- `.planning/PROJECT.md` — v4.0 milestone requirements, established architectural decisions (entity chain ownership, 404-not-403, app-level filtering, no middleware auth)
- Prisma 7 documentation — enum support, composite unique constraints, relation queries, cascade deletes — all verified as stable features since Prisma 4

### Secondary (MEDIUM confidence)
- [Google Drive Roles and Permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles) — role hierarchy reference for table stakes determination
- [Baymard: Autocomplete Design Best Practices](https://baymard.com/blog/autocomplete-design) — 7-9 suggestion limit, match highlighting recommendation
- [Permify: Modeling Google Docs Access Management](https://permify.co/post/modeling-google-docs-access-management-using-permify/) — ReBAC pattern reference

### Tertiary (supporting context)
- Competitor analysis (Google Docs, Figma, Notion, Linear) — used to confirm Linear's model (authenticated users only, no public links) is the correct archetype for a corporate SSO tool; public sharing features of Google Docs and Figma are explicitly out of scope

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
