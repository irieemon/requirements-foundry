import { CardData } from "@/lib/types";

/**
 * Parse raw text into Card objects using heuristics.
 * Handles:
 * - Markdown-style headings (# Title)
 * - Horizontal rules (---, ===) as separators
 * - Bullet points for structured content
 * - Key-value patterns (Problem:, Opportunity:, etc.)
 */
export function parseTextToCards(rawText: string): CardData[] {
  const cards: CardData[] = [];

  // First, try to split by clear separators
  const segments = splitIntoSegments(rawText);

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed || trimmed.length < 20) continue; // Skip too-short segments

    const card = extractCardFromSegment(trimmed);
    if (card.title) {
      cards.push(card);
    }
  }

  // If no cards extracted, treat entire text as one card
  if (cards.length === 0 && rawText.trim().length > 20) {
    cards.push({
      title: extractTitle(rawText) || "Untitled Use Case",
      rawText: rawText.trim(),
    });
  }

  return cards;
}

/**
 * Split text into segments using common separators
 */
function splitIntoSegments(text: string): string[] {
  // Common separators: ---, ===, blank lines with headers, numbered sections
  const separatorPatterns = [
    /\n-{3,}\n/g, // ---
    /\n={3,}\n/g, // ===
    /\n\*{3,}\n/g, // ***
    /\n(?=#{1,3}\s)/g, // Before markdown headers
    /\n(?=\d+\.\s+[A-Z])/g, // Before numbered sections like "1. Title"
  ];

  let segments = [text];

  for (const pattern of separatorPatterns) {
    const newSegments: string[] = [];
    for (const segment of segments) {
      const parts = segment.split(pattern);
      newSegments.push(...parts);
    }
    segments = newSegments;
  }

  return segments.filter((s) => s.trim().length > 0);
}

/**
 * Extract card data from a text segment
 */
function extractCardFromSegment(segment: string): CardData {
  const lines = segment.split("\n").map((l) => l.trim());
  const card: CardData = {
    title: "",
    rawText: segment,
  };

  // Extract title from first heading or first non-empty line
  card.title = extractTitle(segment);

  // Look for key-value patterns
  const keyValuePatterns: Record<string, keyof CardData> = {
    "problem|issue|challenge": "problem",
    "opportunity|benefit": "problem",
    "user|users|stakeholder|audience|persona": "targetUsers",
    "current|as-is|today": "currentState",
    "outcome|goal|objective|kpi|metric|success": "desiredOutcomes",
    "constraint|limitation|requirement|must": "constraints",
    "system|integration|platform|tool": "systems",
    "priority|urgency|importance": "priority",
    "impact|value|benefit|roi": "impact",
  };

  for (const [patternStr, field] of Object.entries(keyValuePatterns)) {
    const pattern = new RegExp(`(?:${patternStr})s?\\s*[:;-]\\s*(.+)`, "i");
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1]) {
        card[field] = match[1].trim();
        break;
      }
    }
  }

  // Also look for bullet points under known headers
  let currentHeader = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a header line
    const headerMatch = line.match(/^(?:#{1,3}\s*)?(.+?)[:]\s*$/);
    if (headerMatch) {
      currentHeader = headerMatch[1].toLowerCase();
      continue;
    }

    // If we have a header context and this is a bullet point
    if (currentHeader && line.match(/^[-*•]\s+/)) {
      const content = line.replace(/^[-*•]\s+/, "").trim();

      if (currentHeader.includes("user") || currentHeader.includes("stakeholder")) {
        card.targetUsers = appendValue(card.targetUsers, content);
      } else if (currentHeader.includes("outcome") || currentHeader.includes("goal")) {
        card.desiredOutcomes = appendValue(card.desiredOutcomes, content);
      } else if (currentHeader.includes("constraint") || currentHeader.includes("require")) {
        card.constraints = appendValue(card.constraints, content);
      } else if (currentHeader.includes("system") || currentHeader.includes("integration")) {
        card.systems = appendValue(card.systems, content);
      }
    }
  }

  return card;
}

/**
 * Extract the title from a text segment
 */
function extractTitle(text: string): string {
  const lines = text.split("\n").map((l) => l.trim());

  // Look for markdown heading
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
  }

  // Look for "Title:" pattern
  for (const line of lines) {
    const titleMatch = line.match(/^(?:title|name|use case)[:]\s*(.+)$/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
  }

  // Use first non-empty line that looks like a title (capitalized, not too long)
  for (const line of lines) {
    if (line && line.length > 3 && line.length < 100) {
      // Remove common prefixes
      const cleaned = line
        .replace(/^\d+\.\s*/, "") // "1. Title" -> "Title"
        .replace(/^[-*•]\s*/, "") // "- Title" -> "Title"
        .trim();
      if (cleaned && cleaned[0] === cleaned[0].toUpperCase()) {
        return cleaned;
      }
    }
  }

  // Fallback: first 50 chars of first line
  const firstLine = lines.find((l) => l.length > 0);
  return firstLine ? firstLine.slice(0, 50) + (firstLine.length > 50 ? "..." : "") : "Untitled";
}

/**
 * Append a value to an existing field (for collecting multiple items)
 */
function appendValue(existing: string | undefined, newValue: string): string {
  if (!existing) return newValue;
  return `${existing}; ${newValue}`;
}
