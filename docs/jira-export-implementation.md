# Jira Export Feature - Implementation Summary

## File Tree

```
requirements-foundry/
├── app/
│   └── projects/
│       └── [id]/
│           └── export/
│               └── page.tsx                    # Export wizard page route
├── components/
│   ├── export/
│   │   ├── export-stepper.tsx                  # 3-step wizard indicator
│   │   ├── export-wizard.tsx                   # Main wizard container
│   │   ├── format-config.tsx                   # Step 2: Format options
│   │   ├── scope-selector.tsx                  # Step 1: Scope selection
│   │   └── validate-download.tsx               # Step 3: Validation & download
│   └── ui/
│       └── radio-group.tsx                     # New shadcn component
├── lib/
│   └── export/
│       └── jira/
│           ├── __tests__/
│           │   ├── csv-generator.test.ts       # CSV escaping tests (42 tests)
│           │   └── normalizer.test.ts          # Hierarchy tests (27 tests)
│           ├── presets/
│           │   ├── cloud-company.ts            # Cloud company-managed preset
│           │   ├── cloud-team.ts               # Cloud team-managed preset
│           │   ├── index.ts                    # Preset registry
│           │   └── server-dc.ts                # Server/DC preset
│           ├── csv-generator.ts                # CSV generation with security
│           ├── description-templates.ts        # Markdown formatters
│           ├── extractor.ts                    # Database extraction
│           ├── index.ts                        # Public API
│           ├── instructions-generator.ts       # Import guide generator
│           ├── mapper.ts                       # Field mapping logic
│           ├── normalizer.ts                   # Hierarchy flattening
│           ├── types.ts                        # All TypeScript types
│           └── validator.ts                    # Preflight validation
├── server/
│   └── actions/
│       └── jira-export.ts                      # Server actions
└── vitest.config.ts                            # Test configuration
```

**Total Files Created: 21**

---

## Patch Script

Run these commands to apply the changes to a fresh clone:

```bash
#!/bin/bash
# Jira Export Feature - Patch Script

# 1. Install new dependencies
npm install jszip @radix-ui/react-radio-group
npm install -D vitest @vitest/coverage-v8

# 2. Verify all files exist
FILES=(
  "lib/export/jira/types.ts"
  "lib/export/jira/presets/cloud-company.ts"
  "lib/export/jira/presets/cloud-team.ts"
  "lib/export/jira/presets/server-dc.ts"
  "lib/export/jira/presets/index.ts"
  "lib/export/jira/description-templates.ts"
  "lib/export/jira/extractor.ts"
  "lib/export/jira/normalizer.ts"
  "lib/export/jira/mapper.ts"
  "lib/export/jira/csv-generator.ts"
  "lib/export/jira/validator.ts"
  "lib/export/jira/instructions-generator.ts"
  "lib/export/jira/index.ts"
  "server/actions/jira-export.ts"
  "components/ui/radio-group.tsx"
  "components/export/export-stepper.tsx"
  "components/export/scope-selector.tsx"
  "components/export/format-config.tsx"
  "components/export/validate-download.tsx"
  "components/export/export-wizard.tsx"
  "app/projects/[id]/export/page.tsx"
)

echo "Checking files..."
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ MISSING: $file"
  fi
done

# 3. Run tests
npm run test:run

# 4. Build to verify no TypeScript errors
npm run build

echo "Patch verification complete!"
```

---

## Smoke Test Checklist

### Prerequisites
- [ ] Dev server running (`npm run dev`)
- [ ] Database has at least one project with epics/stories
- [ ] Browser open to localhost:3000

### Navigation Tests
- [ ] **T1**: Navigate to `/projects/{id}` - export button visible in header
- [ ] **T2**: Click "Export to Jira" → redirects to `/projects/{id}/export`
- [ ] **T3**: Export page shows wizard with step indicator (Scope → Format → Validate & Download)
- [ ] **T4**: "Back to project" link works

### Step 1: Scope Selection
- [ ] **T5**: Default "All Epics" radio selected
- [ ] **T6**: Summary shows correct epic/story/subtask counts
- [ ] **T7**: Select "Select Epics" → epic list appears with checkboxes
- [ ] **T8**: "Select all" / "Clear" buttons work
- [ ] **T9**: Selecting/deselecting epics updates summary counts
- [ ] **T10**: Next button disabled when "Select Epics" chosen but none selected
- [ ] **T11**: "By Generation Run" shows if runs exist (may be hidden if no runs)

### Step 2: Format Options
- [ ] **T12**: Three preset options visible: Cloud Company, Cloud Team, Server/DC
- [ ] **T13**: Cloud Company marked as "Recommended"
- [ ] **T14**: Content level toggle: Compact / Full
- [ ] **T15**: Include Subtasks switch toggles
- [ ] **T16**: Warning appears when subtasks disabled but exist
- [ ] **T17**: "Preview Sample Output" expands/collapses
- [ ] **T18**: Preview shows sample rows with Issue Type badges

### Step 3: Validate & Download
- [ ] **T19**: Loading spinner shows while validating
- [ ] **T20**: Success state (green) shows "Ready to Export"
- [ ] **T21**: Warning state (yellow) shows warnings but allows download
- [ ] **T22**: Error state (red) blocks download with clear error messages
- [ ] **T23**: Export summary shows Epics/Stories/Subtasks/Total Rows counts
- [ ] **T24**: Estimated import time displayed

### Download Tests
- [ ] **T25**: "Download Export Bundle (.zip)" downloads a .zip file
- [ ] **T26**: ZIP contains: `jira-import.csv`, `import-instructions.md`, `raw-data.json`
- [ ] **T27**: "CSV Only" downloads just the CSV file
- [ ] **T28**: "Instructions" downloads markdown guide
- [ ] **T29**: CSV opens in Excel without formula injection warnings
- [ ] **T30**: CSV has UTF-8 BOM (no garbled characters in Excel)

### CSV Content Validation
- [ ] **T31**: CSV header row: `Issue ID,Parent ID,Issue Type,Summary,Description,Priority,Labels,Story Points`
- [ ] **T32**: Epics have `TEMP-E-XXX` format IDs, empty Parent ID
- [ ] **T33**: Stories have `TEMP-S-XXX` IDs, Parent ID references Epic
- [ ] **T34**: Subtasks (if included) have `TEMP-ST-XXX` IDs, Parent ID references Story
- [ ] **T35**: Description field contains formatted markdown/wiki
- [ ] **T36**: Special characters (quotes, commas, newlines) properly escaped

### Error Handling
- [ ] **T37**: Navigate to `/projects/nonexistent/export` → 404 page
- [ ] **T38**: Project with no epics shows "No Epics to Export" message
- [ ] **T39**: Network error during download shows toast error

### Automated Tests
- [ ] **T40**: `npm run test:run` passes (69 tests)
- [ ] **T41**: `npm run build` succeeds with no TypeScript errors

---

## Key Implementation Details

### Hierarchy Preservation Strategy
- Uses `Issue ID` + `Parent ID` columns (modern Jira approach)
- NOT the deprecated `Epic Link` field
- Temporary IDs: `TEMP-E-001`, `TEMP-S-001`, `TEMP-ST-001`
- Depth-first ordering ensures parent rows appear before children

### CSV Security
- Double-quote escaping per RFC 4180
- Formula injection prevention (prefixes `=`, `+`, `-`, `@` with `'`)
- Null byte removal
- UTF-8 BOM for Excel compatibility
- CRLF line endings for maximum compatibility

### Preset Differences
| Feature | Cloud Company | Cloud Team | Server/DC |
|---------|--------------|------------|-----------|
| Markdown | ✓ | ✓ | Wiki markup |
| Labels | ✓ | ✓ | ✗ |
| Story Points | `Story Points` | `Story point estimate` | `Story Points` |
| Subtask Type | `Sub-task` | `Subtask` | `Sub-task` |

### Validation Rules
**Errors (block export):**
- E001: Empty title
- E002: Orphan children (no parent)
- E003: Invalid parent reference
- E004: Too many rows (>1000)

**Warnings (allow export):**
- W001: Missing description
- W002: Very long description (>32KB)
- W003: Missing priority
- W004: Missing story points
- W005: Special characters in title
- W006: Subtasks excluded
