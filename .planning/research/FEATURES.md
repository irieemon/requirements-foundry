# Feature Research: Project Sharing & Role-Based Collaboration

**Domain:** User-to-user project sharing with viewer/editor roles for an internal requirements management tool
**Researched:** 2026-03-23
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist when they hear "project sharing." Missing any of these = the feature feels broken or incomplete.

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|--------------------------|
| Share a project with a specific user by email | Core sharing primitive -- without this nothing else works | MEDIUM | New `ProjectShare` join table (projectId, userEmail/userId, role). Must validate target user exists in system (has logged in via Cognito at least once). Requires a local User table -- currently users only exist in Cognito, not in DB. |
| Viewer role (read-only access) | Standard minimum permission tier (Google Docs, Figma, Linear all have it) | LOW | Viewer can see all project data (uploads, cards, epics, stories, subtasks, MSS mappings, runs) but cannot trigger mutations. Must block: file uploads, AI generation runs, edits, deletions, JIRA exports. |
| Editor role (full mutating access) | Standard second permission tier | LOW | Editor can do everything the owner does day-to-day: upload files, trigger AI runs, edit/delete entities, export to JIRA. Cannot: delete the project, manage shares. |
| Owner retains exclusive control over project lifecycle | Users expect "my project, my rules" | LOW | Project deletion and share management restricted to `project.userId` (owner). Editors cannot escalate permissions or remove the owner. Straightforward authorization check. |
| "Shared with me" section on projects page | Users need to distinguish "my projects" from "projects others shared with me" | MEDIUM | Two sections on projects page: "My Projects" (`userId === currentUser`) and "Shared with Me" (`ProjectShare` rows where `userEmail === currentUser`). Same project card format in both sections. Shared cards must display the owner's name/email so users know whose project it is. |
| Share management UI (add/remove users, change roles) | Owner must control access after initial share -- add collaborators, revoke access, upgrade/downgrade roles | MEDIUM | Modal or drawer accessible from project page (owner only). Shows current shares with role dropdown (viewer/editor) and remove button. Uses the user picker component for adding new users. |
| User picker for sharing | Owner needs to find users to share with | MEDIUM | Autocomplete input searching local User table by email and display name. Limit to 7-9 suggestions (autocomplete UX best practice). Must prevent: sharing with yourself, duplicate shares. Should highlight matching text in results. Depends on User table being populated. |
| Authorization enforcement across ALL routes | Every server action touching project data must respect sharing -- not just the projects page | HIGH | This is the highest-effort table-stakes item. The existing `getAuthorizedProject()` function must be extended to check `ProjectShare` in addition to `project.userId` ownership. Must return the caller's effective role (owner/editor/viewer). Every write action must check role >= EDITOR. Covers ~15-20 server actions across: uploads, cards, epics, stories, subtasks, runs, MSS mappings, JIRA export. |
| Admin full-access override preserved | Existing admin behavior (v3.0) must not regress | LOW | Admin bypass in `getAuthorizedProject` already exists (`isAdmin(user.email)`). Just extend the access check to: owner OR admin OR has ProjectShare. Admin always gets full access regardless of share role. |

### Differentiators (Competitive Advantage)

Features that add polish beyond bare-minimum sharing. Recommended for v4.0 where noted.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Role badge on shared project cards | Instantly communicates "what can I do here" without opening the project -- small "Viewer" or "Editor" chip | LOW | Trivial UI addition, high clarity. **Include in v4.0.** |
| Owner name/email on shared project cards | Know who shared it with you at a glance | LOW | Display `project.userId` (or resolved display name from User table) on cards in "Shared with me." **Include in v4.0.** |
| Read-only visual indicators for viewers | Viewers see disabled buttons, "Read only" banner, or grayed-out actions instead of confusing errors | LOW | Better UX than silently failing or showing error toasts on forbidden actions. **Include in v4.0.** |
| Share count on owner's project cards | "Shared with 3 people" gives owners visibility into their sharing | LOW | Simple count query from ProjectShare. Nice-to-have for v4.0. |
| In-app share notification indicator | "2 new projects shared with you" badge on projects page | MEDIUM | Requires tracking "last seen" timestamp vs ProjectShare.createdAt. No email/SES dependency. Consider for v4.0 if time permits. |
| Bulk share (multi-user at once) | Convenience when onboarding a team to a project | LOW | Multi-select in user picker, batch insert ProjectShare rows in one transaction. Defer to v4.x. |
| Transfer ownership | Owner leaves the team, project needs a new owner | LOW | Update `project.userId`. Simple DB operation but needs confirmation UX (irreversible). Defer to v4.x. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems in this context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Commenter role (view + comment) | Google Docs has three tiers | Requirements Foundry has no commenting system. Adding a role for a non-existent capability is meaningless. If commenting is added later, add the role then. | Two roles (viewer/editor) are sufficient. The domain is structured requirements generation, not document annotation. |
| Granular per-entity permissions (share only epics, not cards) | "I only want them to see the stories" | Massive complexity explosion. Every entity needs its own ACL check. The project is the natural sharing boundary -- all entities cascade from Project. Per-entity ACLs would touch every query in the system. | Share at project level only. The project IS the permission boundary. |
| Real-time collaborative editing | "Like Google Docs" | Requires WebSocket infrastructure (app uses polling), conflict resolution (OT/CRDT), and fundamental architecture changes. Overkill for requirements generation where AI is the bottleneck, not simultaneous human editing. | Share access, not cursors. Users work asynchronously. One triggers AI generation; others review results. |
| Public/anonymous share links | "Share with stakeholders who don't have SSO" | Breaks the corporate security model (Cognito SSO, Okta-only). Would require a separate auth path and link-based token scheme. | All users must authenticate via Okta SSO. Non-SSO stakeholders receive JIRA exports or screenshots instead. |
| Role inheritance from Okta groups | "Auto-share based on team membership" | Requires Okta group sync pipeline (currently hardcoded admin email), complex mapping logic ("marketing team gets viewer on all marketing projects"), and removes explicit owner control. | Explicit per-user sharing. The owner decides who gets access. Okta groups can be considered in a future milestone if demand emerges. |
| Audit log of share changes | "Track who shared what when" | Useful but separate concern already in the deferred backlog. Adds a new table, write overhead on every share mutation, and a new UI to browse logs. Not needed for sharing to function. | Defer to the "Audit log of user actions" item already in PROJECT.md deferred section. Build sharing first, audit later. |
| Email notifications on share | "Send an email when someone shares a project" | Requires SES integration, email template design, notification preferences, and bounce handling. Significant scope for a "nice to have." | Defer entirely. Users will see shared projects on their projects page. In-app indicator (differentiator above) covers discovery without email infra. |

## Feature Dependencies

```
[User table + login upsert]
    |
    +--required by--> [User picker autocomplete]
    |                     |
    |                     +--required by--> [Share management UI]
    |
    +--required by--> [Owner name display on shared cards]

[ProjectShare table + migration]
    |
    +--required by--> [Authorization layer updates]
    |                     |
    |                     +--enables--> [Viewer enforcement (block mutations)]
    |                     +--enables--> [Editor enforcement (allow mutations)]
    |                     +--enables--> [Read-only visual indicators]
    |
    +--required by--> ["Shared with me" section]
    |                     +--uses--> [Role badge on cards]
    |                     +--uses--> [Owner name on cards]
    |
    +--required by--> [Share management UI]
    |                     +--uses--> [User picker]
    |
    +--required by--> [Runs page: show runs for shared projects]

[Admin override] --unchanged--> [Already works; extend condition only]
```

### Dependency Notes

- **User table is the foundation.** The current schema has no `User` model -- users exist only in Cognito. The user picker ("search users to share with") requires a queryable local table. The simplest approach: create a `User` model populated via upsert on every login (email + display name from Cognito claims). This also enables displaying owner names on shared project cards and future-proofs for audit logs and activity tracking.
- **ProjectShare table is the second foundation.** Everything else (authorization, UI sections, share management) depends on this join table existing.
- **Authorization updates are the critical path and highest risk.** Every server action touching project data must be updated. This is not one feature -- it is a cross-cutting concern touching ~15-20 server actions. Must be done methodically to avoid regressions. Consider a centralized `getAuthorizedProject()` refactor that returns `{ project, user, role }` where role is `owner | editor | viewer | admin`.
- **"Shared with me" section is independent of share management UI.** Can be built as soon as the ProjectShare table exists and `getAuthorizedProjects()` is updated to include shared projects.
- **User picker depends on User table.** Sequential dependency -- User table must be populated before the picker can search it.

## MVP Definition

### Launch With (v4.0)

Minimum viable sharing -- enough for real users to share and collaborate on projects.

- [ ] **User table** -- new Prisma model, populated via upsert on login from Cognito claims (email, displayName)
- [ ] **ProjectShare table** -- join table: projectId (FK), userId (FK to User), role enum (VIEWER/EDITOR), createdAt, unique constraint on [projectId, userId]
- [ ] **Authorization layer refactor** -- `getAuthorizedProject()` checks ownership OR ProjectShare OR admin; returns effective role
- [ ] **Mutation guards** -- all write server actions check `role >= EDITOR`; viewers get clear feedback (disabled UI + error if bypassed)
- [ ] **Share management UI** -- modal accessible to project owner; lists current shares with role dropdown and remove action
- [ ] **User picker** -- autocomplete over User table by email/name; 7-9 max suggestions; prevents self-share and duplicates
- [ ] **"Shared with me" section** -- separate section on projects page showing shared projects with owner name and role badge
- [ ] **Read-only indicators** -- viewers see disabled action buttons with "Read only" context; no confusing error-on-click
- [ ] **Runs visibility for shared projects** -- users with share access see project runs (viewers: read-only; editors: can trigger)

### Add After Validation (v4.x)

Features to add once core sharing is deployed and users provide feedback.

- [ ] **Transfer ownership** -- when an employee leaves; `project.userId` swap with confirmation dialog
- [ ] **Bulk share** -- multi-select in user picker for team onboarding scenarios
- [ ] **In-app share notification** -- "N new projects shared with you" indicator on projects page
- [ ] **Share count on owner cards** -- "Shared with N people" badge on own project cards

### Future Consideration (v5+)

Features to defer until sharing is proven and explicitly requested.

- [ ] **Email notifications** -- requires SES integration, templates, preferences
- [ ] **Okta group-based auto-sharing** -- auto-share based on team membership
- [ ] **Audit log for shares** -- track share/unshare/role-change events with timestamps
- [ ] **Commenter role** -- only if a commenting feature is built

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| User table (login-populated) | HIGH | LOW | P1 |
| ProjectShare table + migration | HIGH | LOW | P1 |
| Authorization layer refactor | HIGH | HIGH | P1 |
| Mutation guards (viewer vs editor) | HIGH | MEDIUM | P1 |
| Share management UI | HIGH | MEDIUM | P1 |
| User picker autocomplete | HIGH | MEDIUM | P1 |
| "Shared with me" section | HIGH | MEDIUM | P1 |
| Role badge on shared cards | MEDIUM | LOW | P1 |
| Owner name on shared cards | MEDIUM | LOW | P1 |
| Read-only visual indicators | MEDIUM | LOW | P1 |
| Runs visibility for shared projects | MEDIUM | LOW | P1 |
| Transfer ownership | MEDIUM | LOW | P2 |
| Bulk share | LOW | LOW | P2 |
| Share count on owner cards | LOW | LOW | P2 |
| In-app notification | LOW | MEDIUM | P3 |
| Email notifications | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v4.0 launch
- P2: Should have, add in v4.x when feedback warrants
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Google Docs | Figma | Notion | Linear | Our Approach (v4.0) |
|---------|-------------|-------|--------|--------|---------------------|
| Sharing granularity | Per-document | Per-file or per-project | Per-page or per-workspace | Per-team or per-project | **Per-project** -- natural boundary; all entities cascade from Project |
| Role tiers | Owner/Editor/Commenter/Viewer | Owner/Editor/Viewer | Full/Editor/Commenter/Viewer | Admin/Member/Guest | **Owner/Editor/Viewer** -- commenter deferred (no commenting system) |
| User discovery | Google contacts + email | Workspace members + email | Workspace members + email | Org members | **Local User table** -- SSO users who have logged in at least once |
| Link sharing | Yes (public/org/restricted) | Yes (anyone with link) | Yes (web publishing) | No (team-only) | **No** -- corporate SSO only; matches Linear's model |
| Bulk sharing | Yes | Yes | Yes (workspace invite) | Yes (team) | **Deferred** to v4.x |
| Transfer ownership | Yes | Yes | Yes | N/A (team-owned) | **Deferred** to v4.x |
| Share notifications | Email + in-app | Email + in-app | Email + in-app | In-app | **Deferred**; in-app indicator considered for v4.0 |
| Read-only indicators | Gray toolbar for viewers | "View only" banner | Lock icons | Role badges | **Disabled buttons + role badge** in v4.0 |

**Takeaway:** Our approach most closely mirrors Linear -- team-scoped, authenticated users only, no public links. This is the correct model for an internal corporate tool. Google Docs/Figma/Notion public sharing features are irrelevant for this use case.

## Implementation Notes

### Critical: User Table Decision

The existing system stores user identity as `Project.userId` (a plain email string). There is no `User` model in Prisma. For sharing to work, we need:

1. **A `User` table** -- stores email (unique), displayName, first/last login timestamps
2. **Login upsert** -- on every Cognito callback, upsert the user record from token claims
3. **ProjectShare references User** -- FK relationship enables cascading and data integrity
4. **Migrate Project.userId** -- optionally FK to User.id (or keep as email string for backward compatibility; either works, but FK is cleaner)

The User table also enables: owner name display on shared cards, user picker search, and future features (audit logs, activity metrics).

### Critical: Authorization Refactor Scope

The current `getAuthorizedProject()` in `lib/auth/authorization.ts` checks:
- `project.userId !== user.email` -> notFound()
- `isAdmin(user.email)` -> bypass

For v4.0, this must become:
- Is the user the owner? -> role = OWNER
- Is the user an admin? -> role = ADMIN (full access)
- Does a ProjectShare row exist for this user + project? -> role = share.role
- None of the above? -> notFound()

Every server action that calls `getAuthorizedProject()` (or should) needs to check the returned role before allowing mutations. Viewers attempting writes should receive a clear 403-style error (or the UI should prevent the action entirely via disabled controls).

### Existing Schema Compatibility

The schema is well-prepared for this extension:
- `Project.userId` already exists with an index -- no breaking changes needed
- All data chains through Project (Project -> Upload -> Card, Project -> Epic -> Story -> Subtask) -- sharing at Project level automatically shares all child entities
- MSS taxonomy tables are global (not per-project) -- no sharing implications
- `Run` links to Project -- run access follows project access automatically
- Cascade deletes on all child relations mean removing a share just removes access, not data

## Sources

- [Google Drive Roles and Permissions](https://developers.google.com/workspace/drive/api/guides/ref-roles) -- role hierarchy reference (HIGH confidence)
- [Modeling Google Docs Access Management Using Permify](https://permify.co/post/modeling-google-docs-access-management-using-permify/) -- ReBAC pattern for document sharing (MEDIUM confidence)
- [Baymard: Autocomplete Design Best Practices](https://baymard.com/blog/autocomplete-design) -- 7-9 suggestion limit, highlighting matches (HIGH confidence)
- [Fresh Consulting: Autocomplete UX Best Practices](https://www.freshconsulting.com/insights/blog/autocomplete-benefits-ux-best-practices/) -- <200ms response time, minimal steps (MEDIUM confidence)
- Existing codebase: `lib/auth/authorization.ts` -- current ownership check pattern (HIGH confidence)
- Existing codebase: `prisma/schema.prisma` -- current data model, no User table, Project.userId is string email (HIGH confidence)
- Existing codebase: `.planning/PROJECT.md` -- v4.0 milestone requirements and deferred items (HIGH confidence)

---
*Feature research for: Project Sharing & Role-Based Collaboration (v4.0 milestone)*
*Researched: 2026-03-23*
