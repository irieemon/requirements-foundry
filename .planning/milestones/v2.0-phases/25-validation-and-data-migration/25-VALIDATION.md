---
phase: 25
slug: validation-and-data-migration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-09
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit), Manual checklist (e2e) |
| **Config file** | vitest.config.* (project root) |
| **Quick run command** | `npm run test:run` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke test checklist all-pass
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | DB-04 | unit-regression | `npm run test:run` | ✅ | ⬜ pending |
| 25-01-02 | 01 | 1 | DB-04 | unit-regression | `npm run test:run` | ✅ | ⬜ pending |
| 25-01-03 | 01 | 1 | DB-04 | manual-only | N/A -- CDK deploy | N/A | ⬜ pending |
| 25-02-01 | 02 | 2 | DB-03 | manual-only | N/A -- pg_dump/pg_restore | N/A | ⬜ pending |
| 25-02-02 | 02 | 2 | DB-03, VAL-03 | manual-only | N/A -- SQL verification | N/A | ⬜ pending |
| 25-02-03 | 02 | 2 | DB-04 | manual-only | N/A -- container restart | N/A | ⬜ pending |
| 25-03-01 | 03 | 3 | VAL-04 | manual-only | `curl -s -o /dev/null -w "%{http_code}" http://<alb-url>/api/health` | N/A | ⬜ pending |
| 25-03-02 | 03 | 3 | VAL-01 | manual-only | N/A -- browser walkthrough | N/A | ⬜ pending |
| 25-03-03 | 03 | 3 | VAL-02 | manual-only | N/A -- browser walkthrough | N/A | ⬜ pending |
| 25-03-04 | 03 | 3 | VAL-03 | manual-only | N/A -- browser data check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 25 is operational — cleanup edits should pass existing unit tests. No new test files needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Data migrated from Neon to RDS | DB-03 | One-time operational task, pg_dump/pg_restore | Run pg_dump from Neon, pg_restore to RDS, verify row counts |
| Prisma migrations apply on RDS | DB-04 | Verified by container startup logs | Check ECS container logs for successful migrate deploy |
| E2E smoke test (upload through export) | VAL-01 | Manual browser walkthrough per user decision | Upload doc → analyze cards → generate epics → stories → subtasks → JIRA export |
| MSS taxonomy import and mapping | VAL-02 | Manual browser walkthrough per user decision | Import MSS CSV → verify service lines → map to epics/stories → check dashboard |
| Existing data accessible after migration | VAL-03 | Manual verification of migrated data | Navigate to existing projects, verify cards/epics/stories/subtasks visible |
| App accessible via ALB | VAL-04 | Network connectivity check | curl ALB URL, verify 200 response, load in browser |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
