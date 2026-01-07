import Papa from "papaparse";
import { CardData } from "@/lib/types";

/**
 * Column mapping configuration for CSV parsing
 */
export interface CSVColumnMapping {
  title: string;
  problem?: string;
  targetUsers?: string;
  currentState?: string;
  desiredOutcomes?: string;
  constraints?: string;
  systems?: string;
  priority?: string;
  impact?: string;
}

/**
 * Auto-detect column mappings based on header names
 */
export function autoDetectColumns(headers: string[]): CSVColumnMapping | null {
  const mapping: Partial<CSVColumnMapping> = {};

  const patterns: Record<keyof CSVColumnMapping, RegExp[]> = {
    title: [/^title$/i, /^name$/i, /^use\s*case$/i, /^summary$/i, /^feature$/i],
    problem: [/^problem$/i, /^issue$/i, /^opportunity$/i, /^description$/i, /^detail/i],
    targetUsers: [/^user/i, /^stakeholder/i, /^audience/i, /^persona/i, /^who$/i],
    currentState: [/^current/i, /^as.is$/i, /^today$/i, /^baseline$/i],
    desiredOutcomes: [/^outcome/i, /^goal/i, /^objective/i, /^kpi/i, /^success/i, /^target$/i],
    constraints: [/^constraint/i, /^limitation/i, /^require/i, /^must$/i],
    systems: [/^system/i, /^integration/i, /^platform/i, /^tool/i, /^tech/i],
    priority: [/^priority/i, /^urgency/i, /^p[0-9]$/i, /^rank$/i],
    impact: [/^impact/i, /^value$/i, /^benefit$/i, /^roi$/i],
  };

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    for (const [field, fieldPatterns] of Object.entries(patterns)) {
      if (mapping[field as keyof CSVColumnMapping]) continue;
      for (const pattern of fieldPatterns) {
        if (pattern.test(normalized)) {
          mapping[field as keyof CSVColumnMapping] = header;
          break;
        }
      }
    }
  }

  // Must have at least a title column
  if (!mapping.title) {
    // Try to use first column as title
    if (headers.length > 0) {
      mapping.title = headers[0];
    } else {
      return null;
    }
  }

  return mapping as CSVColumnMapping;
}

/**
 * Parse CSV content into Card objects
 */
export function parseCSVToCards(
  csvContent: string,
  mapping?: CSVColumnMapping
): { cards: CardData[]; headers: string[]; autoMapping: CSVColumnMapping | null } {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    console.warn("CSV parsing warnings:", result.errors);
  }

  const headers = result.meta.fields || [];
  const autoMapping = mapping || autoDetectColumns(headers);

  if (!autoMapping) {
    return { cards: [], headers, autoMapping: null };
  }

  const cards: CardData[] = [];

  for (const row of result.data) {
    const title = row[autoMapping.title]?.trim();
    if (!title) continue;

    const card: CardData = { title };

    if (autoMapping.problem && row[autoMapping.problem]) {
      card.problem = row[autoMapping.problem].trim();
    }
    if (autoMapping.targetUsers && row[autoMapping.targetUsers]) {
      card.targetUsers = row[autoMapping.targetUsers].trim();
    }
    if (autoMapping.currentState && row[autoMapping.currentState]) {
      card.currentState = row[autoMapping.currentState].trim();
    }
    if (autoMapping.desiredOutcomes && row[autoMapping.desiredOutcomes]) {
      card.desiredOutcomes = row[autoMapping.desiredOutcomes].trim();
    }
    if (autoMapping.constraints && row[autoMapping.constraints]) {
      card.constraints = row[autoMapping.constraints].trim();
    }
    if (autoMapping.systems && row[autoMapping.systems]) {
      card.systems = row[autoMapping.systems].trim();
    }
    if (autoMapping.priority && row[autoMapping.priority]) {
      card.priority = row[autoMapping.priority].trim();
    }
    if (autoMapping.impact && row[autoMapping.impact]) {
      card.impact = row[autoMapping.impact].trim();
    }

    // Store raw row as JSON in rawText for reference
    card.rawText = JSON.stringify(row);

    cards.push(card);
  }

  return { cards, headers, autoMapping };
}

/**
 * Get available headers from CSV content
 */
export function getCSVHeaders(csvContent: string): string[] {
  const result = Papa.parse(csvContent, {
    header: true,
    preview: 1,
  });
  return result.meta.fields || [];
}
