---
status: partial
phase: 33-projects-page-integration
source: [33-VERIFICATION.md]
started: 2026-03-25T14:50:00Z
updated: 2026-03-25T14:50:00Z
---

## Current Test

[awaiting human testing on deployed AWS environment]

## Tests

### 1. Two-section layout visible
expected: Navigate to /projects with shared projects in DB; confirm "My Projects" and "Shared with me" sections render as separate headed sections, with "Shared with me" absent when no shares exist.
result: [pending]

### 2. Role badge rendering
expected: Confirm "Editor" badge shows with secondary (filled) style and "Viewer" with outline style on shared cards; no badge on owned cards.
result: [pending]

### 3. Owner name attribution
expected: Confirm "Shared by {name}" subtitle appears on shared cards, falling back to email when User.name is null.
result: [pending]

### 4. Delete dropdown absent on shared cards
expected: Three-dot menu absent on editor/viewer cards, present on owned cards.
result: [pending]

### 5. Runs page includes shared project runs
expected: At /runs, shared project runs appear chronologically mixed with owned runs, each showing its correct project name.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
