# Smoke Test Plan - Vercel Deployment

Quick verification tests for Requirements Foundry after Vercel deployment.

## Pre-Deployment Checklist

- [ ] Vercel Postgres database created and linked
- [ ] Vercel Blob storage created and linked
- [ ] Environment variables set:
  - [ ] `ANTHROPIC_API_KEY` (or test in Mock Mode)
  - [ ] `UPLOAD_STORAGE=blob`
  - [ ] Database env vars auto-configured by Vercel

## Post-Deployment Smoke Tests

### 1. Health Check
- **URL**: `https://<your-app>.vercel.app/api/health`
- **Expected**: `{"status":"ok","aiEnabled":true}` (or `false` if no API key)
- **Verify**: Response returns 200 OK

### 2. Homepage Load
- **URL**: `https://<your-app>.vercel.app`
- **Expected**: Homepage loads with project list (may be empty)
- **Verify**: No console errors, styles load correctly

### 3. Create Project
- **Steps**:
  1. Click "New Project"
  2. Enter project name: "Smoke Test Project"
  3. Click Create
- **Expected**: Project created, redirects to project page
- **Verify**: Project appears in project list

### 4. File Upload (Blob Storage)
- **Steps**:
  1. Open the smoke test project
  2. Upload a small text file (< 1MB)
  3. Wait for extraction to complete
- **Expected**:
  - Upload shows "Extracted" status
  - Word count displayed
- **Verify**: No errors in Vercel function logs

### 5. AI Analysis (if API key configured)
- **Steps**:
  1. Click "Analyze Documents"
  2. Wait for analysis to complete
- **Expected**:
  - Progress indicator shows phases
  - Cards extracted and displayed
- **Verify**: Cards have reasonable content

### 6. Mock Mode (if no API key)
- **Steps**:
  1. Create project and upload file
  2. Run analysis
- **Expected**:
  - Mock cards generated (deterministic)
  - UI functions normally

### 7. PDF Upload (Node.js Runtime)
- **Steps**:
  1. Upload a small PDF file (< 5MB)
  2. Wait for extraction
- **Expected**:
  - PDF text extracted
  - Page count shown
- **Verify**: No Edge runtime errors

## Local Development Tests

### 1. SQLite Mode
```bash
# Set up local env
DATABASE_URL="file:./dev.db"
UPLOAD_STORAGE="local"

# Push schema and seed
npm run db:push
npm run db:seed

# Start dev server
npm run dev
```
- **Verify**: App starts, projects load from seed data

### 2. Upload in Local Mode
- Upload file with `UPLOAD_STORAGE=local`
- **Verify**: File processes from buffer (no Blob storage used)

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 500 on upload | Edge runtime | Ensure `runtime = "nodejs"` |
| Empty database | No migrations | Run `prisma migrate deploy` |
| Blob upload fails | Missing token | Check `BLOB_READ_WRITE_TOKEN` |
| Prisma errors | Schema mismatch | Re-run `prisma generate` |

## Performance Benchmarks

| Operation | Expected Time |
|-----------|---------------|
| Page load | < 2s |
| Text upload (100KB) | < 3s |
| PDF extraction (1MB) | < 10s |
| AI analysis (per doc) | 5-15s |

## Sign-Off

- [ ] All smoke tests pass
- [ ] No critical console errors
- [ ] Database persists across page reloads
- [ ] Uploaded files persist (in Blob mode)
