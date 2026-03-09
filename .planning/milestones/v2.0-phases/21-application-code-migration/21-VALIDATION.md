---
phase: 21
slug: application-code-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.16 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | CODE-01 | unit | `npx vitest run lib/storage/__tests__/s3-adapter.test.ts -x` | No -- Wave 0 | ⬜ pending |
| 21-01-02 | 01 | 1 | CODE-02 | unit | `npx vitest run lib/ai/__tests__/bedrock-provider.test.ts -x` | No -- Wave 0 | ⬜ pending |
| 21-01-03 | 01 | 1 | AI-03 | unit | `npx vitest run lib/ai/__tests__/mock-fallback.test.ts -x` | No -- Wave 0 | ⬜ pending |
| 21-01-04 | 01 | 1 | CODE-05 | unit | `npx vitest run server/actions/__tests__/direct-execution.test.ts -x` | No -- Wave 0 | ⬜ pending |
| 21-02-01 | 02 | 1 | CODE-04 | smoke | `docker build -t rf-test . && docker run --rm -p 3000:3000 -e MOCK_MODE=true rf-test` | Manual | ⬜ pending |
| 21-02-02 | 02 | 1 | CODE-06 | smoke | `curl -s http://localhost:3000/api/health` | Manual | ⬜ pending |
| 21-03-01 | 03 | 2 | CODE-03 | unit | `npx vitest run lib/__tests__/db.test.ts -x` | No -- Wave 0 | ⬜ pending |
| 21-03-02 | 03 | 2 | CODE-07 | lint | `grep -r "VERCEL_URL\|BATCH_STORY_SECRET\|VERCEL_AUTOMATION_BYPASS_SECRET" --include="*.ts" --include="*.tsx" lib/ app/ server/ components/` | Manual | ⬜ pending |
| 21-03-03 | 03 | 2 | CODE-08 | unit | `node -e "require('@aws-sdk/client-s3'); require('@anthropic-ai/bedrock-sdk')"` | Manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/storage/__tests__/s3-adapter.test.ts` — stubs for CODE-01 (mock S3Client)
- [ ] `lib/ai/__tests__/bedrock-provider.test.ts` — stubs for CODE-02 (mock AnthropicBedrock)
- [ ] `lib/ai/__tests__/mock-fallback.test.ts` — stubs for AI-03 (credential detection fallback)
- [ ] `server/actions/__tests__/direct-execution.test.ts` — stubs for CODE-05 (verify no HTTP triggers)
- [ ] Update `vitest.config.ts` coverage include to add `lib/storage/**`, `lib/ai/**`, `server/actions/**`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker build and start | CODE-04 | Requires Docker daemon | `docker build -t rf-test . && docker run --rm -p 3000:3000 -e MOCK_MODE=true rf-test` — verify app starts on port 3000 |
| Health check returns 200 | CODE-06 | Requires running container | `curl -s http://localhost:3000/api/health` — verify 200 response |
| No Vercel references remain | CODE-07 | Grep-based verification | `grep -r "VERCEL_URL\|BATCH_STORY_SECRET\|VERCEL_AUTOMATION_BYPASS_SECRET\|@vercel/blob\|@anthropic-ai/sdk" --include="*.ts" --include="*.tsx" lib/ app/ server/ components/` — must return empty |
| Correct package dependencies | CODE-08 | Package presence check | `node -e "require('@aws-sdk/client-s3'); require('@anthropic-ai/bedrock-sdk')"` — must not throw |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
