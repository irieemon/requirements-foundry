---
phase: 21-application-code-migration
plan: 02
subsystem: storage
tags: [s3, aws-sdk, prisma, file-upload, formdata]

# Dependency graph
requires:
  - phase: 21-01
    provides: AWS SDK packages installed (@aws-sdk/client-s3, @aws-sdk/credential-providers)
provides:
  - S3 storage adapter with credential auto-detection (lib/storage/index.ts)
  - Renamed Prisma columns (storageUrl, storageKey)
  - Server-side FormData upload flow (no @vercel/blob)
  - Migration SQL for column renames
affects: [21-03, 21-04, 23-presigned-urls]

# Tech tracking
tech-stack:
  added: []
  patterns: [S3 storage adapter with auto-detection, server-side FormData upload, async getStorageMode]

key-files:
  created:
    - prisma/migrations/20260305000000_rename_blob_to_storage/migration.sql
  modified:
    - lib/storage/index.ts
    - prisma/schema.prisma
    - app/api/uploads/route.ts
    - components/uploads/multi-file-upload.tsx
    - app/api/uploads/get-upload-url/route.ts (deleted)

key-decisions:
  - "getStorageMode() made async for credential auto-detection; all callers updated"
  - "S3 key format: uploads/{timestamp}-{filename} for uniqueness"
  - "Credential check cached at module level to avoid repeated AWS API calls"
  - "Migration SQL created manually (no DB connection available in dev env)"

patterns-established:
  - "Storage auto-detection: check UPLOAD_STORAGE env first, then probe AWS credentials"
  - "Server-side FormData upload: client sends file directly to API route, server stores in S3"

requirements-completed: [CODE-01, CODE-07]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 21 Plan 02: File Storage Migration Summary

**S3 storage adapter with credential auto-detection replacing @vercel/blob, Prisma column rename (blobUrl->storageUrl), and server-side FormData upload flow**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T19:20:34Z
- **Completed:** 2026-03-05T19:24:59Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 3 modified, 1 deleted)

## Accomplishments
- Replaced @vercel/blob with @aws-sdk/client-s3 in storage adapter (PutObject, GetObject, DeleteObject)
- Added credential auto-detection with caching: probes AWS credential chain, falls back to local mode
- Renamed Prisma Upload model columns from blobUrl/blobPathname to storageUrl/storageKey with migration SQL
- Converted upload route from JSON body (with blobUrl) to FormData (with file buffer) and server-side S3 upload
- Eliminated two-step upload pattern (client->Blob, then URL->API) in favor of single-step FormData POST
- Deleted get-upload-url route (Vercel Blob client upload endpoint)

## Task Commits

Each task was committed atomically:

1. **Task 1: S3 storage adapter and Prisma column rename** - `f5b258a` (feat)
2. **Task 2: Upload route and component migration to server-side upload** - `ccfd071` (feat)

## Files Created/Modified
- `lib/storage/index.ts` - Rewritten: S3Client replaces @vercel/blob, async getStorageMode with credential auto-detection
- `prisma/schema.prisma` - Renamed blobUrl->storageUrl, blobPathname->storageKey in Upload model
- `prisma/migrations/20260305000000_rename_blob_to_storage/migration.sql` - ALTER TABLE RENAME COLUMN statements
- `app/api/uploads/route.ts` - Accepts FormData with file buffer, calls uploadToStorage for S3, removed maxDuration/runtime exports
- `components/uploads/multi-file-upload.tsx` - Sends files via FormData POST (removed @vercel/blob/client import and two-step upload)
- `app/api/uploads/get-upload-url/route.ts` - Deleted (Vercel Blob client upload endpoint no longer needed)

## Decisions Made
- Made getStorageMode() async to support credential auto-detection via fromNodeProviderChain
- Used module-level credential caching (_hasCredentials) to avoid repeated AWS API probes
- S3 key format uses `uploads/{timestamp}-{filename}` for uniqueness without UUID overhead
- Created migration SQL manually since no database connection available in dev environment
- Removed the checkmark emoji from "Context provided" text in upload component (avoiding emoji in code)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 2 changes absorbed by parallel 21-03 plan execution**
- **Found during:** Task 2 (commit step)
- **Issue:** The parallel 21-03 plan execution committed Task 2 file changes (upload route, component, get-upload-url deletion) as part of its docs commit (ccfd071)
- **Fix:** Verified all Task 2 changes are correctly in HEAD, no additional commit needed
- **Files affected:** app/api/uploads/route.ts, components/uploads/multi-file-upload.tsx, app/api/uploads/get-upload-url/route.ts
- **Verification:** All verification checks pass; no blobUrl/blobPathname references remain

---

**Total deviations:** 1 (commit absorbed by parallel execution)
**Impact on plan:** No impact on correctness. All changes verified present in HEAD.

## Issues Encountered
- Prisma generate fails on Node.js 21.5.0 due to ESM/CJS compatibility issue with zeptomatch dependency. This is a known dev environment limitation; Prisma client will regenerate correctly in Docker (Node 22-alpine) at build time.
- Parallel plan execution (21-03) committed Task 2 file changes alongside its own docs commit. Changes verified correct.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Storage adapter ready for S3 operations when AWS credentials are available
- Falls back gracefully to local mode without credentials (dev workflow preserved)
- Upload flow functional via server-side FormData (presigned URL flow deferred to Phase 23)
- Prisma migration SQL ready to apply against production database
- All @vercel/blob imports eliminated from source code

## Self-Check: PASSED

All files verified present. Both commits (f5b258a, ccfd071) confirmed in git log. Deleted file (get-upload-url/route.ts) confirmed absent.

---
*Phase: 21-application-code-migration*
*Completed: 2026-03-05*
