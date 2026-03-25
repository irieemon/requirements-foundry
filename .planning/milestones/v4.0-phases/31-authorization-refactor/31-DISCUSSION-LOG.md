# Phase 31: Authorization Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 31-authorization-refactor
**Areas discussed:** Role resolution, Viewer enforcement, Inline check cleanup, Auth return shape

---

## Role Resolution

### Q1: Role priority when user has multiple relationships

| Option | Description | Selected |
|--------|-------------|----------|
| Highest-wins | admin > owner > editor > viewer. Simple, predictable. | ✓ |
| Explicit role only | Admin is separate flag. Role is strictly owner or share role. No merging. | |
| You decide | Claude picks simplest approach. | |

**User's choice:** Highest-wins
**Notes:** None

### Q2: Where should ProjectShare lookup happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Inside getAuthorizedProject | Extend existing function. Single query point, all callers benefit. | ✓ |
| Separate resolveRole function | New function called by getAuthorizedProject. More testable unit. | |
| You decide | Claude picks cleanest integration. | |

**User's choice:** Inside getAuthorizedProject
**Notes:** None

### Q3: Query strategy for ProjectShare lookup

| Option | Description | Selected |
|--------|-------------|----------|
| Join in project query | Include ProjectShare in findUnique. One round-trip. | ✓ |
| Separate query if needed | Only query ProjectShare when user isn't owner/admin. Two round-trips in share case. | |
| You decide | Claude picks balance of performance and clarity. | |

**User's choice:** Join in project query
**Notes:** None

---

## Viewer Enforcement

### Q4: Server-side enforcement approach

| Option | Description | Selected |
|--------|-------------|----------|
| Role check in each mutation | Each server action checks role, returns error if viewer. ~15-20 functions. | ✓ |
| Wrapper/decorator pattern | requireEditor() wrapper reduces boilerplate. | |
| You decide | Claude picks most maintainable approach. | |

**User's choice:** Role check in each mutation
**Notes:** None

### Q5: Error behavior for blocked viewer mutations

| Option | Description | Selected |
|--------|-------------|----------|
| Return error object | { success: false, error: "Read-only access" }. Matches existing pattern. | ✓ |
| Throw/notFound | Call notFound() like unauthorized access. Consistent but harsh. | |
| Silent no-op | Return success without action. Simplest but confusing. | |

**User's choice:** Return error object
**Notes:** None

### Q6: UI scope in Phase 31

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side only | Phase 31 = auth logic. UI disabling deferred to Phase 33. | ✓ |
| Both server and UI | Also disable buttons for viewers. Blurs phase boundary. | |
| You decide | Claude decides based on phase boundary. | |

**User's choice:** Server-side only
**Notes:** None

---

## Inline Check Cleanup

### Q7: Consolidation strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Route-specific auth helpers | Add getAuthorizedRun, getAuthorizedUpload etc. to authorization module. | ✓ |
| Refactor routes to call getAuthorizedProject | Routes resolve parent projectId first, then call existing function. Extra query. | |
| You decide | Claude picks minimal duplication approach. | |

**User's choice:** Route-specific auth helpers
**Notes:** None

---

## Auth Return Shape

### Q8: Authorization return type

| Option | Description | Selected |
|--------|-------------|----------|
| Role string + convenience flags | { project, user, role, canEdit, isAdmin }. Role is truth; canEdit is convenience. | ✓ |
| Role string only | { project, user, role }. Callers derive permissions. Minimal surface. | |
| Permission object | { project, user, permissions: { canEdit, canDelete, ... } }. Most explicit. | |
| You decide | Claude picks most practical shape. | |

**User's choice:** Role string + convenience flags
**Notes:** None

### Q9: Per-project roles in list view

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include role per project | Each project in array includes resolved role. Phase 33 needs it for badges. | ✓ |
| No, roles only on single project | List stays simple. Role resolution on navigation only. | |
| You decide | Claude decides based on downstream needs. | |

**User's choice:** Yes, include role per project
**Notes:** None

---

## Claude's Discretion

- Prisma include/select shape for joined ProjectShare query
- Whether to create shared AuthResult TypeScript type
- User.id lookup efficiency strategy
- getAuthorizedProjects query strategy (single join vs two queries merged)
- Test strategy for role resolution and API route migration

## Deferred Ideas

None — discussion stayed within phase scope.
