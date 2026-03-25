# Phase 32: Share Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 32-share-management
**Areas discussed:** Share dialog trigger & layout, User picker behavior, Role assignment & changes, Access control for share UI

---

## Share Dialog Trigger & Layout

### Q1: Where should the share button appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Project detail page header | Share button next to project name/actions at the top of the project page. Consistent with Google Docs pattern. | ✓ |
| Project card overflow menu | Share option in the … menu on each project card on the projects listing page. | |
| Both locations | Share available from both the project detail header and the project card menu. | |

**User's choice:** Project detail page header
**Notes:** None

### Q2: How should the share UI open?

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog | Modal dialog over current page. Matches existing create-project-dialog pattern. | ✓ |
| Sheet (side panel) | Slides in from the right. Better for ongoing management of a long collaborator list. | |
| Inline section | Collapsible section within the project settings/detail page. No overlay. | |

**User's choice:** Dialog
**Notes:** None

### Q3: Single or multi-user sharing per action?

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time | Add one user, pick their role, confirm. Simple and clear. Dialog stays open. | ✓ |
| Multi-user batch | Select multiple users, assign same role to batch, then confirm all at once. | |

**User's choice:** One at a time
**Notes:** None

---

## User Picker Behavior

### Q1: How should the user picker search work?

| Option | Description | Selected |
|--------|-------------|----------|
| Search-as-you-type with dropdown | Type in an input, matching users appear in a dropdown below. Uses the User table. | ✓ |
| Pre-loaded dropdown | All users loaded upfront in a select/dropdown. | |
| Type exact email | No autocomplete — user types the full email address. | |

**User's choice:** Search-as-you-type with dropdown
**Notes:** None

### Q2: What fields should the picker search against?

| Option | Description | Selected |
|--------|-------------|----------|
| Email and name | Match against both email and display name. | ✓ |
| Email only | Simpler query. | |
| Name only | More natural but can be ambiguous. | |

**User's choice:** Email and name
**Notes:** None

### Q3: What should each result row show?

| Option | Description | Selected |
|--------|-------------|----------|
| Name + email | Display name as primary, email as secondary. Falls back to email-only. | ✓ |
| Email only | Just the email address. | |
| Name + email + avatar initial | Adds a circle with first letter of name. | |

**User's choice:** Name + email
**Notes:** None

---

## Role Assignment & Changes

### Q1: What should the default role be when sharing?

| Option | Description | Selected |
|--------|-------------|----------|
| Viewer | Least-privilege default. | |
| Editor | Full access by default. Faster for collaborative teams. | ✓ |

**User's choice:** Editor
**Notes:** User chose editor over viewer (least-privilege) default — prioritizing collaboration speed.

### Q2: How should role changes work for existing shares?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline toggle in share list | Dropdown or toggle next to each shared user's name in the dialog. | ✓ |
| Edit button per user | Click edit on a user row, change role in a sub-form, save. | |

**User's choice:** Inline toggle in share list
**Notes:** None

### Q3: Should removing a user's access require confirmation?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, confirm dialog | Small confirmation prompt before removing access. | ✓ |
| No, instant remove | Click remove, it's gone. | |
| Instant with undo toast | Remove immediately but show a toast with 'Undo' button. | |

**User's choice:** Yes, confirm dialog
**Notes:** None

---

## Access Control for Share UI

### Q1: Who can access the share management controls?

| Option | Description | Selected |
|--------|-------------|----------|
| Owner and admin only | Only the project owner and admin can manage collaborators. | ✓ |
| Owner, admin, and editors | Editors can also share the project with others. | |

**User's choice:** Owner and admin only
**Notes:** None

### Q2: What should non-owners see instead of share controls?

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden share button | Share button simply doesn't render for non-owners. | ✓ |
| Disabled share button with tooltip | Visible but greyed out with explanation tooltip. | |
| Read-only share list | Non-owners can see who else has access but can't modify. | |

**User's choice:** Hidden share button
**Notes:** None

---

## Claude's Discretion

- Combobox component choice (shadcn/ui Command, cmdk, or custom)
- Debounce timing for search queries
- Server action vs API route for user search
- Whether owner appears in the collaborator list
- Toast messaging specifics
- Empty state design
- Whether to exclude already-shared users from search results

## Deferred Ideas

None — discussion stayed within phase scope.
