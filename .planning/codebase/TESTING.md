# Testing Patterns

**Analysis Date:** 2026-01-09

## Test Framework

**Runner:**
- Vitest 4.0.16
- Config: `vitest.config.ts` in project root

**Assertion Library:**
- Vitest built-in expect
- Matchers: `toBe`, `toEqual`, `toContain`, `toThrow`, `toBeLessThan`, `toMatch`

**Run Commands:**
```bash
npm test                              # Run all tests (watch mode)
npm run test:run                      # Run all tests (single run)
npm run test:coverage                 # Coverage report
npm test -- path/to/file.test.ts     # Single file
```

## Test File Organization

**Location:**
- `__tests__/` subdirectory within feature modules
- Example: `lib/export/jira/__tests__/normalizer.test.ts`
- Example: `lib/batch-stories/__tests__/generate-all-stories.test.ts`

**Naming:**
- `{module-name}.test.ts` for test files
- No distinction between unit/integration in filename

**Structure:**
```
lib/
  export/
    jira/
      __tests__/
        normalizer.test.ts
        csv-generator.test.ts
      normalizer.ts
      csv-generator.ts
  batch-stories/
    __tests__/
      generate-all-stories.test.ts
    types.ts
    index.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ═══════════════════════════════════════════════════════════════
// TEST FILE HEADER
// Description of what's being tested
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// Test Data Factories
// ─────────────────────────────────────────────────────────────────

function createMockEpic(id: string, code: string) { ... }
function createMockStory(id: string, epicCode: string) { ... }

// ─────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────

describe("normalizeForExport", () => {
  describe("basic normalization", () => {
    it("should normalize epic with stories", () => {
      // arrange
      const input = createMockEpic("1", "EPIC-1");

      // act
      const result = normalizeForExport(input);

      // assert
      expect(result.items).toHaveLength(1);
    });
  });
});
```

**Patterns:**
- Use `beforeEach` for per-test setup
- Use `afterEach` for cleanup: `vi.clearAllMocks()`
- Arrange/Act/Assert pattern for test structure
- One assertion focus per test (multiple expects OK if testing one concept)

## Mocking

**Framework:**
- Vitest built-in mocking (`vi`)
- Module mocking via `vi.mock()` at top of test file

**Patterns:**
```typescript
import { vi } from "vitest";
import { externalFunction } from "./external";

// Mock module
vi.mock("./external", () => ({
  externalFunction: vi.fn(),
}));

describe("test suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mocks function", () => {
    const mockFn = vi.mocked(externalFunction);
    mockFn.mockReturnValue("mocked result");

    // test code

    expect(mockFn).toHaveBeenCalledWith("expected arg");
  });
});
```

**What to Mock:**
- External API calls (Anthropic, Vercel Blob)
- Database operations (Prisma client)
- File system operations
- Environment variables (`process.env`)

**What NOT to Mock:**
- Pure functions and utilities
- Internal business logic being tested
- Type definitions

## Fixtures and Factories

**Test Data:**
```typescript
// Factory functions in test file
function createMockEpic(id: string, code: string, storyCount = 0) {
  return {
    id,
    code,
    title: `Epic ${code}`,
    stories: Array.from({ length: storyCount }, (_, i) =>
      createMockStory(`story-${i}`, code)
    ),
  };
}

function createMockStory(id: string, epicCode: string) {
  return {
    id,
    code: `${epicCode}-S${id}`,
    title: `Story ${id}`,
    subtasks: [],
  };
}

// Usage
const epic = createMockEpic("1", "EPIC-1", 3);
```

**Location:**
- Factory functions defined at top of test file
- Complex shared fixtures could go in `__fixtures__/` (not currently used)

## Coverage

**Requirements:**
- No enforced coverage target
- Coverage tracked for awareness
- Focus on critical paths (export, normalization)

**Configuration:**
```typescript
// vitest.config.ts
coverage: {
  provider: "v8",
  reporter: ["text", "html"],
  include: ["lib/export/**/*.ts"],
}
```

**View Coverage:**
```bash
npm run test:coverage
open coverage/index.html
```

## Test Types

**Unit Tests:**
- Test single function in isolation
- Mock external dependencies
- Fast execution (<100ms per test)
- Examples: `csv-generator.test.ts` tests individual formatting functions

**Integration Tests:**
- Test multiple functions together
- Mock only external boundaries (APIs, database)
- Examples: `normalizer.test.ts` tests full normalization pipeline

**Security Tests:**
- Formula injection prevention in CSV
- Unicode handling
- Edge cases for malicious input
- Examples in `csv-generator.test.ts`:
  - `sanitizeForCSV()` tests
  - `preventFormulaInjection()` tests

**E2E Tests:**
- Not currently implemented
- Manual testing for full user flows

## Common Patterns

**Async Testing:**
```typescript
it("should handle async operation", async () => {
  const result = await asyncFunction();
  expect(result).toBe("expected");
});
```

**Error Testing:**
```typescript
it("should throw on invalid input", () => {
  expect(() => parse(null)).toThrow("Cannot parse null");
});

// Async error
it("should reject on failure", async () => {
  await expect(asyncCall()).rejects.toThrow("error message");
});
```

**Edge Case Testing:**
```typescript
describe("edge cases", () => {
  it("handles empty input", () => { ... });
  it("handles very long text (10000 chars)", () => { ... });
  it("handles unicode characters", () => { ... });
  it("handles multiple consecutive special characters", () => { ... });
});
```

**Parameterized Tests:**
```typescript
const testCases = [
  { input: "=SUM()", expected: "'=SUM()" },
  { input: "+1234", expected: "'+1234" },
  { input: "-1234", expected: "'-1234" },
];

testCases.forEach(({ input, expected }) => {
  it(`prevents formula injection for ${input}`, () => {
    expect(preventFormulaInjection(input)).toBe(expected);
  });
});
```

## Test Gaps

**Currently Untested:**
- `lib/batch-stories/__tests__/generate-all-stories.test.ts` has placeholder tests only (TODO implementations)
- Full batch story generation flow
- AI provider integration (relies on mock)
- Database operations in run engine

**High Priority to Add:**
- Batch story happy path and error scenarios
- Run engine continuation logic
- Document extraction error handling

---

*Testing analysis: 2026-01-09*
*Update when test patterns change*
