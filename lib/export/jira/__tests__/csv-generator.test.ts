// ═══════════════════════════════════════════════════════════════
// CSV GENERATOR TESTS
// Tests for CSV escaping, formula injection prevention, and output
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  sanitizeForCSV,
  preventFormulaInjection,
  formatCSVCell,
  generateJiraCSV,
} from "../csv-generator";
import type { JiraExportRow } from "../types";

// ─────────────────────────────────────────────────────────────────
// sanitizeForCSV Tests
// ─────────────────────────────────────────────────────────────────

describe("sanitizeForCSV", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeForCSV("")).toBe("");
  });

  it("returns empty string for null/undefined input", () => {
    expect(sanitizeForCSV(null as unknown as string)).toBe("");
    expect(sanitizeForCSV(undefined as unknown as string)).toBe("");
  });

  it("passes through simple text unchanged", () => {
    expect(sanitizeForCSV("Hello world")).toBe("Hello world");
  });

  it("escapes double quotes by doubling them", () => {
    expect(sanitizeForCSV('Say "Hello"')).toBe('Say ""Hello""');
    expect(sanitizeForCSV('"Quoted"')).toBe('""Quoted""');
    expect(sanitizeForCSV('A "B" C "D" E')).toBe('A ""B"" C ""D"" E');
  });

  it("handles multiple consecutive quotes", () => {
    expect(sanitizeForCSV('""test""')).toBe('""""test""""');
  });

  it("removes null bytes", () => {
    expect(sanitizeForCSV("Hello\0World")).toBe("HelloWorld");
    expect(sanitizeForCSV("\0\0test\0")).toBe("test");
  });

  it("normalizes CRLF to LF", () => {
    expect(sanitizeForCSV("Line1\r\nLine2")).toBe("Line1\nLine2");
  });

  it("normalizes CR to LF", () => {
    expect(sanitizeForCSV("Line1\rLine2")).toBe("Line1\nLine2");
  });

  it("handles mixed line endings", () => {
    expect(sanitizeForCSV("A\r\nB\rC\nD")).toBe("A\nB\nC\nD");
  });

  it("handles complex text with multiple escaping needs", () => {
    const input = 'Say "Hi"\r\nNew\0Line';
    const expected = 'Say ""Hi""\nNewLine';
    expect(sanitizeForCSV(input)).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────
// preventFormulaInjection Tests
// ─────────────────────────────────────────────────────────────────

describe("preventFormulaInjection", () => {
  it("returns empty string for empty input", () => {
    expect(preventFormulaInjection("")).toBe("");
  });

  it("returns empty string for null/undefined", () => {
    expect(preventFormulaInjection(null as unknown as string)).toBe("");
    expect(preventFormulaInjection(undefined as unknown as string)).toBe("");
  });

  it("passes through safe text unchanged", () => {
    expect(preventFormulaInjection("Hello world")).toBe("Hello world");
    expect(preventFormulaInjection("Normal text")).toBe("Normal text");
  });

  it("trims whitespace from input", () => {
    expect(preventFormulaInjection("  Hello  ")).toBe("Hello");
  });

  it("prefixes formula with equals sign", () => {
    expect(preventFormulaInjection("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(preventFormulaInjection("=1+1")).toBe("'=1+1");
  });

  it("prefixes formula with plus sign", () => {
    expect(preventFormulaInjection("+1")).toBe("'+1");
    expect(preventFormulaInjection("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
  });

  it("prefixes formula with minus sign", () => {
    expect(preventFormulaInjection("-1")).toBe("'-1");
    expect(preventFormulaInjection("-@")).toBe("'-@");
  });

  it("prefixes formula with at sign", () => {
    expect(preventFormulaInjection("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("handles tab character at start (trimmed away)", () => {
    // Tab at start gets trimmed, so "data" doesn't start with dangerous char
    expect(preventFormulaInjection("\tdata")).toBe("data");
  });

  it("handles carriage return at start (trimmed away)", () => {
    // CR at start gets trimmed, so "data" doesn't start with dangerous char
    expect(preventFormulaInjection("\rdata")).toBe("data");
  });

  it("prefixes tab not at start if text starts with dangerous char", () => {
    // Tab in middle is preserved, but =\t... would trigger the prefix
    expect(preventFormulaInjection("=\tdata")).toBe("'=\tdata");
  });

  it("handles leading whitespace before dangerous character", () => {
    // The trim happens first, then the check
    expect(preventFormulaInjection("  =formula")).toBe("'=formula");
  });

  it("does not prefix if dangerous character is not at start", () => {
    expect(preventFormulaInjection("a=b")).toBe("a=b");
    expect(preventFormulaInjection("Price: -$5")).toBe("Price: -$5");
    expect(preventFormulaInjection("Email: @user")).toBe("Email: @user");
  });

  // Real-world attack vectors
  describe("known attack vectors", () => {
    it("blocks DDE attack", () => {
      expect(preventFormulaInjection("=DDE(\"cmd\";\"calc.exe\")")).toBe(
        "'=DDE(\"cmd\";\"calc.exe\")"
      );
    });

    it("blocks HYPERLINK attack", () => {
      expect(preventFormulaInjection("=HYPERLINK(\"http://evil.com\")")).toBe(
        "'=HYPERLINK(\"http://evil.com\")"
      );
    });

    it("blocks command execution attempt", () => {
      expect(preventFormulaInjection("+cmd|' /C calc'!A0")).toBe(
        "'+cmd|' /C calc'!A0"
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// formatCSVCell Tests
// ─────────────────────────────────────────────────────────────────

describe("formatCSVCell", () => {
  it("returns empty quoted string for undefined", () => {
    expect(formatCSVCell(undefined)).toBe('""');
  });

  it("returns empty quoted string for empty string", () => {
    expect(formatCSVCell("")).toBe('""');
  });

  it("wraps simple text in quotes", () => {
    expect(formatCSVCell("Hello")).toBe('"Hello"');
  });

  it("applies full escaping pipeline", () => {
    // Input with quotes, null bytes, formula prefix
    expect(formatCSVCell('="test"')).toBe("\"'=\"\"test\"\"\"");
  });

  it("handles text with commas", () => {
    expect(formatCSVCell("A, B, C")).toBe('"A, B, C"');
  });

  it("handles text with newlines", () => {
    expect(formatCSVCell("Line1\nLine2")).toBe('"Line1\nLine2"');
  });
});

// ─────────────────────────────────────────────────────────────────
// generateJiraCSV Tests
// ─────────────────────────────────────────────────────────────────

describe("generateJiraCSV", () => {
  const sampleRows: JiraExportRow[] = [
    {
      "Issue ID": "TEMP-E-001",
      "Parent ID": "",
      "Issue Type": "Epic",
      Summary: "Test Epic",
      Description: "Epic description",
      Priority: "High",
      Labels: "feature",
      "Story Points": "",
    },
    {
      "Issue ID": "TEMP-S-001",
      "Parent ID": "TEMP-E-001",
      "Issue Type": "Story",
      Summary: "Test Story",
      Description: "Story description",
      Priority: "Medium",
      Labels: "",
      "Story Points": "5",
    },
  ];

  it("generates valid CSV with BOM", () => {
    const csv = generateJiraCSV(sampleRows, "cloud-company");
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });

  it("includes header row", () => {
    const csv = generateJiraCSV(sampleRows, "cloud-company");
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toBe(
      "Issue ID,Parent ID,Issue Type,Summary,Description,Priority,Labels,Story Points"
    );
  });

  it("includes data rows", () => {
    const csv = generateJiraCSV(sampleRows, "cloud-company");
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines.length).toBe(3); // header + 2 data rows
  });

  it("properly escapes special characters in data", () => {
    const rowsWithSpecialChars: JiraExportRow[] = [
      {
        "Issue ID": "TEMP-E-001",
        "Parent ID": "",
        "Issue Type": "Epic",
        Summary: 'Test "Epic" with quotes',
        Description: "Line1\nLine2",
        Priority: "High",
        Labels: "a,b,c",
        "Story Points": "",
      },
    ];

    const csv = generateJiraCSV(rowsWithSpecialChars, "cloud-company");
    // Should contain escaped quotes
    expect(csv).toContain('""Epic""');
    // Should preserve newlines in quoted field
    expect(csv).toContain("Line1\nLine2");
  });

  it("uses CRLF line endings", () => {
    const csv = generateJiraCSV(sampleRows, "cloud-company");
    const content = csv.replace("\uFEFF", "");
    expect(content).toContain("\r\n");
  });

  it("handles empty rows array", () => {
    const csv = generateJiraCSV([], "cloud-company");
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines.length).toBe(1); // Just header
  });
});

// ─────────────────────────────────────────────────────────────────
// Edge Cases and Integration
// ─────────────────────────────────────────────────────────────────

describe("CSV Generator Edge Cases", () => {
  it("handles very long text", () => {
    const longText = "A".repeat(10000);
    const result = formatCSVCell(longText);
    expect(result).toBe(`"${longText}"`);
  });

  it("handles unicode characters", () => {
    const unicode = "日本語 🎉 émoji";
    const result = formatCSVCell(unicode);
    expect(result).toBe(`"${unicode}"`);
  });

  it("handles all escape scenarios in one string", () => {
    const complex = '=Formula\0with\r\n"quotes"\rand\nnewlines';
    const result = sanitizeForCSV(complex);
    // No nulls, normalized line endings, escaped quotes
    expect(result).not.toContain("\0");
    expect(result).not.toContain("\r\n");
    expect(result).not.toContain("\r");
    expect(result).toContain('""');
  });

  it("prevents formula injection after sanitization", () => {
    // This tests the full pipeline: sanitize then prevent injection
    const input = "=SUM(A1)\0";
    const sanitized = sanitizeForCSV(input);
    const safe = preventFormulaInjection(sanitized);
    expect(safe).toBe("'=SUM(A1)");
  });
});
