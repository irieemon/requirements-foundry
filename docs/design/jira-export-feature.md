# Jira Export Feature - Implementation Design Document

> **Status:** Implementation-Ready
> **Target:** `/sc:implement` ready with no guessing required
> **Generated:** Based on consolidated brainstorm from Product, Architect, Backend, Frontend, and QA agents

---

## 1. Route Structure

### New Route: `/projects/[id]/export`

```
app/
└── projects/
    └── [id]/
        └── export/
            └── page.tsx          # Server Component - data fetching
```

**Data Fetching Strategy:**
- Server Component fetches all required data upfront via `getExportData(projectId)`
- Pass data to client wizard component for interactivity
- No streaming needed (data is local SQLite, always fast)

---

## 2. Component Tree

```
app/projects/[id]/export/page.tsx (Server)
├── PageHeader (sticky, with back button)
└── ExportWizard (Client - "use client")
    ├── ExportStepper (visual step indicator)
    │   └── Steps: ["Scope", "Format", "Validate & Download"]
    │
    ├── Step 1: ScopeSelector
    │   ├── ScopeModeToggle (All Epics / Select Epics / By Run)
    │   ├── EpicCheckboxList (when "Select Epics")
    │   │   └── Checkbox per epic with story count
    │   ├── RunSelector (when "By Run")
    │   │   └── Select dropdown of completed GENERATE_EPICS runs
    │   └── ScopeSummary (count: X epics, Y stories, Z subtasks)
    │
    ├── Step 2: FormatConfig
    │   ├── JiraPresetSelect
    │   │   └── Radio: Cloud Company | Cloud Team | Server/DC
    │   ├── ContentLevelSelect
    │   │   └── Radio: Compact | Full (with preview toggle)
    │   ├── IncludeSubtasksToggle
    │   │   └── Switch + warning when subtasks > 0
    │   └── PreviewPanel (collapsible)
    │       └── Shows 1 epic + 1 story sample in chosen format
    │
    ├── Step 3: ValidateDownload
    │   ├── ValidationResults
    │   │   ├── ErrorList (blocks download)
    │   │   └── WarningList (allows download with caution)
    │   ├── ExportSummary
    │   │   └── Final counts + estimated row count
    │   └── DownloadBundle
    │       ├── PrimaryButton: "Download Export Bundle (.zip)"
    │       └── SecondaryLinks: "Download CSV only" | "Download Instructions"
    │
    └── WizardNavigation
        └── Back | Next/Download buttons
```

---

## 3. Export Engine Module Boundaries

```
lib/
└── export/
    └── jira/
        ├── index.ts                 # Public API exports
        ├── types.ts                 # All TypeScript types
        ├── extractor.ts             # DB → Normalized data
        ├── normalizer.ts            # Assign IDs, flatten hierarchy
        ├── mapper.ts                # Map to Jira field values
        ├── validator.ts             # Preflight validation rules
        ├── csv-generator.ts         # Generate CSV string
        ├── description-templates.ts # Markdown formatters
        ├── instructions-generator.ts# Generate import-instructions.md
        └── presets/
            ├── cloud-company.ts     # Column config for Company-managed
            ├── cloud-team.ts        # Column config for Team-managed
            └── server-dc.ts         # Column config for Server/DC
```

### Module Responsibilities

#### `types.ts`
```typescript
// ═══════════════════════════════════════════════════════════════
// JIRA EXPORT TYPES
// ═══════════════════════════════════════════════════════════════

export type JiraPreset = "cloud-company" | "cloud-team" | "server-dc";
export type ContentLevel = "compact" | "full";
export type ScopeMode = "all" | "selected" | "by-run";

export interface ExportScope {
  mode: ScopeMode;
  epicIds?: string[];      // When mode = "selected"
  runId?: string;          // When mode = "by-run"
}

export interface ExportConfig {
  scope: ExportScope;
  preset: JiraPreset;
  contentLevel: ContentLevel;
  includeSubtasks: boolean;
}

export interface NormalizedItem {
  tempId: string;          // TEMP-E-001, TEMP-S-001, TEMP-ST-001
  parentTempId: string | null;
  issueType: "Epic" | "Story" | "Sub-task";
  sourceId: string;        // Original DB id
  code: string;            // E1, S1, ST1
  title: string;
  // All source fields for mapping
  description?: string;
  businessValue?: string;
  userStory?: string;
  persona?: string;
  acceptanceCriteria?: string;
  technicalNotes?: string;
  priority?: string;
  effort?: string;
  impact?: string;
  theme?: string;
  dependencies?: string;
}

export interface JiraExportRow {
  "Issue ID": string;
  "Parent ID": string;
  "Issue Type": string;
  Summary: string;
  Description: string;
  Priority: string;
  Labels: string;
  "Story Points"?: string;       // Cloud only
  "Custom field (Story Points)"?: string; // Server/DC
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  itemId?: string;
  field?: string;
}

export interface ExportBundle {
  csv: string;
  instructions: string;
  rawJson?: string;
  stats: ExportStats;
}

export interface ExportStats {
  epicCount: number;
  storyCount: number;
  subtaskCount: number;
  totalRows: number;
  estimatedImportTime: string;
}
```

#### `extractor.ts`
```typescript
// Extract data from DB based on scope
export async function extractExportData(
  projectId: string,
  scope: ExportScope
): Promise<ExtractedData>

interface ExtractedData {
  project: { id: string; name: string };
  epics: EpicWithRelations[];
}

type EpicWithRelations = Epic & {
  stories: (Story & { subtasks: Subtask[] })[];
};
```

#### `normalizer.ts`
```typescript
// Flatten hierarchy and assign temp IDs
export function normalizeForExport(
  data: ExtractedData,
  includeSubtasks: boolean
): NormalizedItem[]

// ID format: TEMP-{type}-{3-digit-index}
// Examples: TEMP-E-001, TEMP-S-001, TEMP-ST-001
```

#### `mapper.ts`
```typescript
// Map normalized items to Jira row format
export function mapToJiraRows(
  items: NormalizedItem[],
  config: { preset: JiraPreset; contentLevel: ContentLevel }
): JiraExportRow[]
```

#### `validator.ts`
```typescript
// Validate before export
export function validateExport(
  items: NormalizedItem[],
  config: ExportConfig
): ValidationResult

// Error codes (block export):
// E001: No items to export
// E002: Summary exceeds 255 characters
// E003: Invalid hierarchy (story without epic)

// Warning codes (allow export):
// W001: Description exceeds 32KB (will be truncated)
// W002: Special characters in labels
// W003: Subtasks exist but not included
// W004: Large export (>500 rows) may timeout in Jira
```

#### `csv-generator.ts`
```typescript
// Generate CSV from rows
export function generateJiraCSV(
  rows: JiraExportRow[],
  preset: JiraPreset
): string
```

---

## 4. CSV Column Definitions Per Preset

### 4.1 Cloud Company-Managed (Default)

| Column | Required | Epic | Story | Sub-task | Notes |
|--------|----------|------|-------|----------|-------|
| `Issue ID` | Yes | ✓ | ✓ | ✓ | Temp ID for hierarchy |
| `Parent ID` | Yes | (empty) | Epic's ID | Story's ID | Links hierarchy |
| `Issue Type` | Yes | "Epic" | "Story" | "Sub-task" | Exact casing |
| `Summary` | Yes | ✓ | ✓ | ✓ | Max 255 chars |
| `Description` | Yes | ✓ | ✓ | ✓ | Markdown supported |
| `Priority` | No | ✓ | ✓ | ✓ | Highest/High/Medium/Low/Lowest |
| `Labels` | No | theme | persona | (empty) | Hyphenated, no spaces |
| `Story Points` | No | ✓ | ✓ | (empty) | Numeric: 1,2,3,5,8,13 |

**Column Order (exact):**
```
Issue ID,Parent ID,Issue Type,Summary,Description,Priority,Labels,Story Points
```

### 4.2 Cloud Team-Managed

| Column | Required | Epic | Story | Sub-task | Notes |
|--------|----------|------|-------|----------|-------|
| `Issue ID` | Yes | ✓ | ✓ | ✓ | Temp ID |
| `Parent ID` | Yes | (empty) | ✓ | ✓ | Links hierarchy |
| `Issue Type` | Yes | "Epic" | "Story" | "Subtask" | Note: no hyphen |
| `Summary` | Yes | ✓ | ✓ | ✓ | Max 255 chars |
| `Description` | Yes | ✓ | ✓ | ✓ | Plain text only |
| `Priority` | No | ✓ | ✓ | ✓ | Same as company |

**Column Order:**
```
Issue ID,Parent ID,Issue Type,Summary,Description,Priority
```

**Differences from Company-managed:**
- No `Labels` column (use Jira board filters instead)
- No `Story Points` column (not available in team-managed)
- `Subtask` without hyphen
- Plain text descriptions (no markdown rendering)

### 4.3 Server/Data Center

| Column | Required | Epic | Story | Sub-task | Notes |
|--------|----------|------|-------|----------|-------|
| `Issue ID` | Yes | ✓ | ✓ | ✓ | Temp ID |
| `Parent ID` | Yes | (empty) | ✓ | ✓ | Links hierarchy |
| `Issue Type` | Yes | "Epic" | "Story" | "Sub-task" | With hyphen |
| `Summary` | Yes | ✓ | ✓ | ✓ | Max 255 chars |
| `Description` | Yes | ✓ | ✓ | ✓ | Wiki markup |
| `Priority` | No | ✓ | ✓ | ✓ | Configurable |
| `Labels` | No | ✓ | ✓ | (empty) | Same as cloud |
| `Custom field (Story Points)` | No | ✓ | ✓ | (empty) | Custom field name |

**Column Order:**
```
Issue ID,Parent ID,Issue Type,Summary,Description,Priority,Labels,Custom field (Story Points)
```

**Differences:**
- `Custom field (Story Points)` instead of `Story Points`
- Wiki markup in descriptions (not markdown)
- May require field mapping during import

---

## 5. Description Templates

### 5.1 Compact Template

**Epic:**
```markdown
{description}

**Business Value:** {businessValue}
```

**Story:**
```markdown
{userStory}

**Acceptance Criteria:**
{acceptanceCriteria as numbered list}
```

**Sub-task:**
```markdown
{description}
```

### 5.2 Full Template

**Epic:**
```markdown
## Overview
{description}

## Business Value
{businessValue}

## Acceptance Criteria
{acceptanceCriteria as numbered list}

## Dependencies
{dependencies as bullet list}

---
*Generated by Requirements Foundry • {epicCode}*
```

**Story:**
```markdown
## User Story
{userStory}

## Persona
{persona}

## Acceptance Criteria
{acceptanceCriteria as numbered list}

## Technical Notes
{technicalNotes}

---
*Generated by Requirements Foundry • {epicCode}/{storyCode}*
```

**Sub-task:**
```markdown
{description}

## Effort Estimate
{effort}

---
*Generated by Requirements Foundry • {epicCode}/{storyCode}/{subtaskCode}*
```

### 5.3 Template Implementation

```typescript
// lib/export/jira/description-templates.ts

export function formatEpicDescription(
  epic: NormalizedItem,
  level: ContentLevel
): string {
  if (level === "compact") {
    return formatCompactEpic(epic);
  }
  return formatFullEpic(epic);
}

export function formatStoryDescription(
  story: NormalizedItem,
  level: ContentLevel
): string {
  if (level === "compact") {
    return formatCompactStory(story);
  }
  return formatFullStory(story);
}

export function formatSubtaskDescription(
  subtask: NormalizedItem,
  level: ContentLevel
): string {
  if (level === "compact") {
    return subtask.description || "";
  }
  return formatFullSubtask(subtask);
}

// For Server/DC: Convert markdown to wiki markup
export function markdownToWiki(md: string): string {
  return md
    .replace(/^## (.+)$/gm, "h2. $1")
    .replace(/^### (.+)$/gm, "h3. $1")
    .replace(/^\* (.+)$/gm, "* $1")
    .replace(/^\d+\. (.+)$/gm, "# $1")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/---/g, "----");
}
```

---

## 6. Prisma Assessment

### No Schema Changes Required

The current Prisma schema already contains all fields needed for export:

**Epic fields used:**
- `code`, `title`, `description`, `businessValue`
- `acceptanceCriteria`, `dependencies` (JSON strings)
- `effort`, `impact`, `priority`, `theme`

**Story fields used:**
- `code`, `title`, `userStory`, `persona`
- `acceptanceCriteria`, `technicalNotes` (JSON strings)
- `priority`, `effort`

**Subtask fields used:**
- `code`, `title`, `description`, `effort`

### Query Patterns

```typescript
// Single query with all relations
const data = await db.epic.findMany({
  where: getWhereClause(projectId, scope),
  orderBy: { priority: "asc" },
  include: {
    stories: {
      orderBy: { code: "asc" },
      include: {
        subtasks: {
          orderBy: { code: "asc" },
        },
      },
    },
  },
});
```

---

## 7. API Contracts

### Server Actions Location: `server/actions/jira-export.ts`

### 7.1 `getExportStats`

**Purpose:** Get counts for scope display without full data fetch

```typescript
"use server";

export async function getExportStats(
  projectId: string,
  scope?: ExportScope
): Promise<ExportStats>

// Response
interface ExportStats {
  epicCount: number;
  storyCount: number;
  subtaskCount: number;
  totalRows: number;
  estimatedImportTime: string; // "~2 minutes"
}

// Error Codes
// ESTATUS001: Project not found
// ESTATUS002: Invalid scope configuration
```

### 7.2 `previewExport`

**Purpose:** Generate preview with 1 epic sample for format selection

```typescript
"use server";

export async function previewExport(
  projectId: string,
  config: ExportConfig
): Promise<ExportPreview>

interface ExportPreview {
  sampleRows: JiraExportRow[]; // First epic + first story + first subtask
  validation: ValidationResult;
  stats: ExportStats;
}

// Error Codes
// EPREV001: No data to preview
// EPREV002: Invalid configuration
```

### 7.3 `generateExport`

**Purpose:** Generate full export bundle

```typescript
"use server";

export async function generateExport(
  projectId: string,
  config: ExportConfig
): Promise<ExportBundle>

interface ExportBundle {
  csv: string;           // UTF-8 CSV content
  instructions: string;  // Markdown instructions
  rawJson?: string;      // Optional JSON export
  stats: ExportStats;
  generatedAt: string;   // ISO timestamp
}

// Error Codes
// EGEN001: Validation failed (errors present)
// EGEN002: No items in scope
// EGEN003: Export generation failed
```

### 7.4 `getAvailableRuns`

**Purpose:** Get runs for "By Run" scope selector

```typescript
"use server";

export async function getAvailableRuns(
  projectId: string
): Promise<RunOption[]>

interface RunOption {
  id: string;
  type: string;
  createdAt: Date;
  epicCount: number;
  storyCount: number;
}
```

---

## 8. Error Codes Reference

| Code | Type | Message | Resolution |
|------|------|---------|------------|
| `E001` | Error | No items to export | Select at least one epic |
| `E002` | Error | Summary exceeds 255 characters | Item will be truncated |
| `E003` | Error | Invalid hierarchy detected | Contact support |
| `W001` | Warning | Description exceeds 32KB | Will be truncated on import |
| `W002` | Warning | Special characters in labels | May need manual cleanup |
| `W003` | Warning | Subtasks exist but excluded | Enable subtasks to include |
| `W004` | Warning | Large export (>500 rows) | May timeout during Jira import |
| `W005` | Warning | Missing priority values | Will default to Medium |
| `W006` | Warning | Missing effort estimates | Story points will be empty |

---

## 9. Performance Notes

### Chunking Strategy

```typescript
// For large exports, process in chunks
const CHUNK_SIZE = 100;

async function processInChunks<T, R>(
  items: T[],
  processor: (chunk: T[]) => Promise<R[]>,
  chunkSize = CHUNK_SIZE
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await processor(chunk);
    results.push(...chunkResults);
  }
  return results;
}
```

### Size Limits

| Metric | Soft Limit | Hard Limit | Action |
|--------|------------|------------|--------|
| Total rows | 500 | 2,000 | Warning at soft, error at hard |
| CSV file size | 5 MB | 10 MB | Warning at soft, error at hard |
| Description length | 32 KB | 64 KB | Truncate at soft, error at hard |
| Summary length | 200 chars | 255 chars | Truncate at hard |

### Memory Optimization

```typescript
// Stream CSV generation for large exports
export function* generateCSVRows(
  items: NormalizedItem[],
  config: ExportConfig
): Generator<string> {
  // Yield header row first
  yield getHeaderRow(config.preset);

  // Yield data rows one at a time
  for (const item of items) {
    yield formatRow(mapToJiraRow(item, config));
  }
}
```

### Estimated Timing

| Operation | Items | Expected Time |
|-----------|-------|---------------|
| Extract | 100 epics | <100ms (SQLite local) |
| Normalize | 500 stories | <50ms |
| Validate | 1000 items | <200ms |
| Generate CSV | 1000 rows | <100ms |
| **Total** | 1000 items | **<500ms** |

---

## 10. Security Notes

### Local-First Architecture

- **No external API calls:** All processing happens locally
- **No data transmission:** Export bundle stays on user's machine
- **No authentication required:** Single-user local app

### Raw Content Handling

```typescript
// Sanitize all text content before CSV generation
export function sanitizeForCSV(text: string): string {
  return text
    // Escape double quotes (CSV standard)
    .replace(/"/g, '""')
    // Remove null bytes
    .replace(/\0/g, "")
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

// Prevent formula injection in CSV
export function preventFormulaInjection(text: string): string {
  const dangerousChars = ["=", "+", "-", "@", "\t", "\r"];
  if (dangerousChars.some((char) => text.startsWith(char))) {
    return `'${text}`; // Prefix with single quote
  }
  return text;
}
```

### Input Validation

```typescript
// Validate all IDs before database queries
export function validateId(id: string): boolean {
  // CUID format validation
  return /^c[a-z0-9]{24}$/.test(id);
}

// Validate scope before processing
export function validateScope(scope: ExportScope): void {
  if (scope.mode === "selected" && (!scope.epicIds || scope.epicIds.length === 0)) {
    throw new Error("ESCOPE001: Selected mode requires epicIds");
  }
  if (scope.mode === "by-run" && !scope.runId) {
    throw new Error("ESCOPE002: By-run mode requires runId");
  }
}
```

### File Download Security

```typescript
// Generate safe filename
export function getSafeFilename(projectName: string): string {
  const safe = projectName
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${safe}-jira-export-${timestamp}`;
}
```

---

## 11. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `lib/export/jira/` directory structure
- [ ] Implement `types.ts` with all interfaces
- [ ] Implement `extractor.ts` with DB queries
- [ ] Implement `normalizer.ts` with ID assignment
- [ ] Implement `mapper.ts` with field mapping
- [ ] Implement `csv-generator.ts`

### Phase 2: Presets & Templates
- [ ] Create preset configs in `presets/` directory
- [ ] Implement `description-templates.ts`
- [ ] Implement `instructions-generator.ts`
- [ ] Add wiki markup converter for Server/DC

### Phase 3: Validation
- [ ] Implement `validator.ts` with all rules
- [ ] Add error/warning code constants
- [ ] Add size limit checks

### Phase 4: Server Actions
- [ ] Create `server/actions/jira-export.ts`
- [ ] Implement `getExportStats`
- [ ] Implement `previewExport`
- [ ] Implement `generateExport`
- [ ] Implement `getAvailableRuns`

### Phase 5: UI Components
- [ ] Create `app/projects/[id]/export/page.tsx`
- [ ] Create `components/export/export-wizard.tsx`
- [ ] Create `components/export/scope-selector.tsx`
- [ ] Create `components/export/format-config.tsx`
- [ ] Create `components/export/validate-download.tsx`
- [ ] Create `components/export/export-stepper.tsx`

### Phase 6: Polish
- [ ] Add loading states and skeletons
- [ ] Add error handling and toasts
- [ ] Add keyboard navigation
- [ ] Test with large datasets
- [ ] Update project detail page with export link

---

## 12. File Creation Order

For `/sc:implement`, create files in this order:

1. `lib/export/jira/types.ts`
2. `lib/export/jira/presets/cloud-company.ts`
3. `lib/export/jira/presets/cloud-team.ts`
4. `lib/export/jira/presets/server-dc.ts`
5. `lib/export/jira/description-templates.ts`
6. `lib/export/jira/extractor.ts`
7. `lib/export/jira/normalizer.ts`
8. `lib/export/jira/mapper.ts`
9. `lib/export/jira/validator.ts`
10. `lib/export/jira/csv-generator.ts`
11. `lib/export/jira/instructions-generator.ts`
12. `lib/export/jira/index.ts`
13. `server/actions/jira-export.ts`
14. `components/export/export-stepper.tsx`
15. `components/export/scope-selector.tsx`
16. `components/export/format-config.tsx`
17. `components/export/validate-download.tsx`
18. `components/export/export-wizard.tsx`
19. `app/projects/[id]/export/page.tsx`

---

## 13. Testing Matrix

| Scenario | Expected Outcome |
|----------|------------------|
| Export all epics (0 stories) | Warning W003, allows download |
| Export with 500+ items | Warning W004, allows download |
| Export with >255 char summary | Auto-truncate, warning shown |
| Export with subtasks disabled | Subtasks excluded, warning if any exist |
| Export Server/DC preset | Wiki markup in descriptions |
| Export empty project | Error E001, download blocked |
| By-run scope with deleted run | Error, graceful message |

---

*Document generated for Requirements Foundry Jira Export feature*
*Ready for `/sc:implement` execution*
