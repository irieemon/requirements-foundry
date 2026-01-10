# Technology Stack

**Analysis Date:** 2026-01-09

## Languages

**Primary:**
- TypeScript 5.x - All application code (`tsconfig.json`, `package.json`)

**Secondary:**
- JavaScript - Config files (`postcss.config.mjs`, `eslint.config.mjs`)

## Runtime

**Environment:**
- Node.js 18+ (ES2017 target) - `tsconfig.json`
- React 19.2.3 - `package.json`

**Package Manager:**
- npm (implied by `package-lock.json`)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.1.1 - Full-stack web framework with App Router - `package.json`, `next.config.ts`
- React 19.2.3 - UI framework - `package.json`

**Testing:**
- Vitest 4.0.16 - Unit testing - `package.json`, `vitest.config.ts`

**Build/Dev:**
- TypeScript 5.x - Compilation - `tsconfig.json`
- Tailwind CSS 4 - Styling with PostCSS plugin - `package.json`, `postcss.config.mjs`
- ESLint 9 - Linting with flat config - `eslint.config.mjs`

## Key Dependencies

**Critical:**
- `@anthropic-ai/sdk` (^0.71.2) - Claude AI for document analysis and story generation - `lib/ai/provider.ts`
- `@prisma/client` (^7.2.0) - Database ORM - `lib/db.ts`, `prisma/schema.prisma`
- `@prisma/adapter-pg` (^7.2.0) - PostgreSQL adapter - `lib/db.ts`
- `zod` (^4.3.5) - Runtime type validation - `lib/types.ts`

**UI:**
- `@radix-ui/*` - Multiple headless UI components (dialog, dropdown, tabs, etc.) - `package.json`
- `react-hook-form` (^7.70.0) - Form management - `package.json`
- `lucide-react` (^0.562.0) - Icons - `package.json`
- `sonner` (^2.0.7) - Toast notifications - `package.json`
- `next-themes` (^0.4.6) - Theme management - `package.json`

**Document Processing:**
- `unpdf` (^1.4.0) - PDF extraction - `lib/documents/extractors/pdf-extractor.ts`
- `mammoth` (^1.11.0) - DOCX extraction - `lib/documents/extractors/docx-extractor.ts`
- `xlsx` (^0.18.5) - Excel parsing - `lib/documents/extractors/xlsx-extractor.ts`
- `jszip` (^3.10.1) + `fast-xml-parser` (^5.3.3) - PPTX extraction - `lib/documents/extractors/pptx-extractor.ts`
- `papaparse` (^5.5.3) - CSV parsing - `lib/parsers/csv-parser.ts`

**Infrastructure:**
- `pg` (^8.16.0) - PostgreSQL driver - `package.json`
- `@vercel/blob` (^0.27.1) - File storage - `lib/storage/index.ts`
- `csv-stringify` (^6.6.0) - JIRA CSV export - `lib/export/jira-csv.ts`

## Configuration

**Environment:**
- `.env` files with documented `.env.example`
- Key env vars: `DATABASE_URL` or `POSTGRES_URL`, `ANTHROPIC_API_KEY`, `UPLOAD_STORAGE`, `BLOB_READ_WRITE_TOKEN`, `BATCH_STORY_SECRET`

**Build:**
- `tsconfig.json` - TypeScript strict mode, React 19 JSX
- `next.config.ts` - Server actions 4MB body limit, Prisma external package
- `prisma.config.ts` - PostgreSQL datasource config
- `vitest.config.ts` - Node environment, v8 coverage

## Platform Requirements

**Development:**
- Any platform with Node.js 18+
- PostgreSQL database (local or Vercel Postgres)
- No external dependencies required for local dev

**Production:**
- Vercel deployment target
- Vercel Postgres (auto-configured via `POSTGRES_URL`)
- Vercel Blob storage (optional, via `BLOB_READ_WRITE_TOKEN`)
- 300s max function duration (serverless limits)

---

*Stack analysis: 2026-01-09*
*Update after major dependency changes*
