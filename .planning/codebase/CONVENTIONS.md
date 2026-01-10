# Coding Conventions

**Analysis Date:** 2026-01-09

## Naming Patterns

**Files:**
- Components: kebab-case (`run-progress.tsx`, `status-pill.tsx`, `batch-story-config-dialog.tsx`)
- Utilities/services: kebab-case (`csv-parser.ts`, `document-analyzer.ts`, `batch-story-executor.ts`)
- Tests: `{name}.test.ts` in `__tests__/` subdirectory
- API routes: `route.ts` (Next.js App Router convention)

**Functions:**
- camelCase for all functions (`parseCSVToCards`, `normalizeForExport`, `generateJiraCSV`)
- No special prefix for async functions
- `handle*` for event handlers (`handleClick`, `handleSubmit`)
- `get*` for data fetching (`getRunProgress`, `getAIProvider`)
- `create*` for factories (`createRunLogger`, `createMockEpic`)

**Variables:**
- camelCase for variables (`epicCount`, `completedItems`, `inputConfig`)
- SCREAMING_SNAKE_CASE for constants (`PACING_CONFIG`, `STALE_THRESHOLD_MS`, `MAX_RECOVERY_AGE_MS`)
- No underscore prefix for private members

**Types:**
- PascalCase for interfaces, no I prefix (`CardData`, `ExtractedContent`, `ProcessingResult`)
- PascalCase for type aliases (`CSVColumnMapping`, `StorageMode`)
- Const objects with `as const` for enum-like values:
  ```typescript
  export const RunStatus = { QUEUED: "QUEUED", RUNNING: "RUNNING", ... } as const;
  ```
- Suffix patterns: `...Props`, `...Input`, `...Result`, `...Error`, `...Config`

## Code Style

**Formatting:**
- 2-space indentation (TypeScript standard)
- Double quotes for strings in most files
- Semicolons used consistently
- No Prettier config - ESLint handles formatting

**Linting:**
- ESLint 9 with flat config (`eslint.config.mjs`)
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Run: `npm run lint`

**TypeScript:**
- Strict mode enabled (`tsconfig.json`)
- Path alias `@/*` maps to project root
- Prefer `import type { X }` for type-only imports

## Import Organization

**Order:**
1. External packages (`next/`, `react`, `@anthropic-ai/sdk`)
2. Type imports (`import type { ... }`)
3. Internal modules (`@/lib/`, `@/components/`)
4. Relative imports (`./utils`, `../types`)

**Grouping:**
- Blank line between groups
- Alphabetical within groups (not strictly enforced)

**Path Aliases:**
- `@/` maps to project root (configured in `tsconfig.json`)
- Example: `import { cn } from "@/lib/utils"`

## Error Handling

**Patterns:**
- Try/catch at API route boundaries
- Structured error returns: `{ success: false, error: string }`
- Custom error class: `ExtractionError` in `lib/documents/extractors`
- Run failures stored in database with error field

**Error Types:**
- Throw on validation failures, missing dependencies
- Return error objects from Server Actions
- Use `instanceof` checks: `if (error instanceof ExtractionError)`

**Logging:**
- `lib/observability/logger.ts` for structured logging
- Console.log still present in many files (should use structured logger)

## Logging

**Framework:**
- Custom structured logger in `lib/observability/logger.ts`
- Levels: info, warn, error

**Patterns:**
- Structured logging with context: `logEvent({ event: "run.started", runId, ... })`
- Per-run correlation via runId
- Console.log for development debugging (should be removed for production)

## Comments

**When to Comment:**
- File headers with section separators: `// ════════════════════════════════════════════`
- Purpose statements at file/section top
- Complex business logic explanations
- Mapping explanations: `priority: epic.impact, // Map impact to priority`

**JSDoc/TSDoc:**
- Used for public APIs and exported functions
- `@param`, `@returns` tags for documentation
- Example from `lib/documents/processor.ts`:
  ```typescript
  /**
   * Process a single document
   * @param file - Buffer containing file data
   * @param filename - Original filename
   * @param mimeType - Optional MIME type
   */
  ```

**Section Separators:**
- Box-style headers for major sections:
  ```typescript
  // ════════════════════════════════════════════════════════════════
  // SECTION NAME
  // ════════════════════════════════════════════════════════════════
  ```
- Line separators for subsections:
  ```typescript
  // ─────────────────────────────────────────────────────────────────
  // Subsection Name
  // ─────────────────────────────────────────────────────────────────
  ```

**TODO Comments:**
- Format: `// TODO: description`
- No username tracking (use git blame)

## Function Design

**Size:**
- Keep functions focused, extract helpers for complex logic
- No strict line limit but prefer under 50 lines

**Parameters:**
- Max 3-4 parameters before using options object
- Destructure in parameter list: `function process({ file, filename }: ProcessParams)`
- Optional parameters with defaults

**Return Values:**
- Explicit return types on exported functions
- Structured returns for operations: `{ success: boolean, data?: T, error?: string }`
- Early returns for guard clauses

## Module Design

**Exports:**
- Named exports preferred
- Default exports only for React components in some files
- Barrel exports via `index.ts` for public APIs

**Barrel Files:**
- `index.ts` re-exports public API
- Example: `lib/export/jira/index.ts`, `lib/observability/index.ts`
- Keep internal helpers private

## React Patterns

**Components:**
- Functional components with arrow functions
- Props interfaces defined inline or separately
- Example:
  ```typescript
  function Card({ className, ...props }: React.ComponentProps<"div">) { ... }
  ```

**Hooks:**
- Custom hooks in `hooks/` directory
- Prefix with `use` (React convention)

**Server Components:**
- Default in Next.js App Router
- `"use client"` directive for client components
- `"use server"` directive for Server Actions

---

*Convention analysis: 2026-01-09*
*Update when patterns change*
