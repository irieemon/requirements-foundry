# Phase 36: Admin Bug Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 36-admin-bug-dashboard
**Areas discussed:** Report list layout, Status workflow UX

---

## Report List Layout

### Q1: How should bug reports be displayed?

| Option | Description | Selected |
|--------|-------------|----------|
| Data table (Recommended) | Rows with sortable columns reusing existing table.tsx | ✓ |
| Card grid | Individual cards per report, more visual but less scannable | |

**User's choice:** Data table
**Notes:** Consistent with existing app patterns

### Q2: What happens when admin clicks a row?

| Option | Description | Selected |
|--------|-------------|----------|
| Expand inline (Recommended) | Row expands below to show full details and admin controls | ✓ |
| Detail modal | Opens a Dialog with full report details | |
| Separate detail page | Navigate to /bug-reports/[id] | |

**User's choice:** Expand inline
**Notes:** Fast triage workflow without page navigation

### Q3: Description column preview length?

| Option | Description | Selected |
|--------|-------------|----------|
| Truncated (80 chars) | First ~80 characters with ellipsis | ✓ |
| First line only | Up to first newline | |
| You decide | Claude picks best approach | |

**User's choice:** Truncated (80 chars)

---

## Status Workflow UX

### Q1: How should admin change status?

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown in expanded row (Recommended) | Select component in inline expanded row | ✓ |
| Click status badge to cycle | Clicking badge cycles to next status | |
| Button group per status | Explicit buttons for each valid next status | |

**User's choice:** Dropdown in expanded row

### Q2: Save pattern for status and notes?

| Option | Description | Selected |
|--------|-------------|----------|
| Single save button (Recommended) | One Save button persists both together | ✓ |
| Auto-save on change | Status auto-saves, notes save separately | |
| You decide | Claude picks best pattern | |

**User's choice:** Single save button

### Q3: Status transition rules?

| Option | Description | Selected |
|--------|-------------|----------|
| Any status (Recommended) | Admin can pick any status freely | ✓ |
| Forward only with reopen | Sequential progression plus reopen option | |

**User's choice:** Any status (free transitions)

### Q4: Confirmation before status change?

| Option | Description | Selected |
|--------|-------------|----------|
| No confirmation (Recommended) | Save applies immediately with toast | ✓ |
| Confirm on close only | Ask confirmation only when closing a report | |

**User's choice:** No confirmation

---

## Claude's Discretion

- Filtering & sorting implementation details (status filter, date sort)
- Sidebar badge style and open count source
- Status badge colors/icons
- Expanded row layout details
- Empty state design
- Pagination approach
- Loading skeleton

## Deferred Ideas

None — discussion stayed within phase scope.
