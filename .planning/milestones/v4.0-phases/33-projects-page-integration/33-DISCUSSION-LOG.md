# Phase 33: Projects Page Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 33-projects-page-integration
**Areas discussed:** Section layout, Role badge design, Owner display, Runs page inclusion
**Mode:** Auto (--auto flag, all gray areas selected, recommended defaults chosen)

---

## Section Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked sections with headers | "My Projects" grid above, "Shared with me" grid below | :white_check_mark: |
| Tabs (My Projects / Shared) | Tab navigation to switch between views | |
| Single list with role indicators | All projects mixed, role badges differentiate | |

**User's choice:** Stacked sections with headers (auto-selected: recommended default)
**Notes:** Matches requirements language ("Shared with me section"). Simplest approach with no navigation overhead. Admin view preserves existing merged list behavior.

---

## Role Badge Design

| Option | Description | Selected |
|--------|-------------|----------|
| Badge with variant differentiation | outline for Viewer, secondary for Editor | :white_check_mark: |
| Text label only | Plain "Viewer" / "Editor" text without badge styling | |
| Icon-based | Lock icon for viewer, pencil for editor | |

**User's choice:** Badge with variant differentiation (auto-selected: recommended default)
**Notes:** Reuses existing Badge component. Outline variant is visually lighter (read-only), secondary is more prominent (editor has more access).

---

## Owner Display

| Option | Description | Selected |
|--------|-------------|----------|
| Subtitle line under project name | "Shared by {name}" text | :white_check_mark: |
| Badge-style owner label | Owner name in a badge near role badge | |
| Footer text | Owner info at bottom of card | |

**User's choice:** Subtitle line under project name (auto-selected: recommended default)
**Notes:** Consistent with existing ownerLabel admin pattern. Falls back to email when no display name exists (Phase 30 D-04).

---

## Runs Page Inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Mixed into same chronological list | All runs together, project name column for context | :white_check_mark: |
| Separate "Shared project runs" section | Two tables on runs page | |
| Filter toggle (mine / shared / all) | User controls which runs to see | |

**User's choice:** Mixed into same list with project name column (auto-selected: recommended default)
**Notes:** Runs page already supports showProject column. Simpler UX — single chronological view. Per-run project name needed (currently single prop).

---

## Claude's Discretion

- Badge color/styling within variant system
- Icon next to "Shared by" text
- RunList refactor approach for per-run project names
- Section header count badge
- Loading skeleton layout
- Sort order within sections

## Deferred Ideas

- PAGE-04: In-app indicator for newly shared projects (v4.x)
- PAGE-05: Share count on owned project cards (v4.x)
- Shared project sorting by role or date shared
