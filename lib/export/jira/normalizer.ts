// ═══════════════════════════════════════════════════════════════
// DATA NORMALIZER
// Flattens hierarchy and assigns temporary IDs for Jira import
// ═══════════════════════════════════════════════════════════════

import type { ExtractedData, NormalizedItem, EpicWithRelations, StoryWithSubtasks, MssServiceAreaWithLine } from "./types";
import type { Subtask } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────
// ID Generation
// ─────────────────────────────────────────────────────────────────

/**
 * Generates a temporary ID for Jira import.
 * Format: TEMP-{type}-{3-digit-index}
 * Examples: TEMP-E-001, TEMP-S-001, TEMP-ST-001
 */
function generateTempId(type: "E" | "S" | "ST", index: number): string {
  const paddedIndex = String(index).padStart(3, "0");
  return `TEMP-${type}-${paddedIndex}`;
}

// ─────────────────────────────────────────────────────────────────
// Item Normalizers
// ─────────────────────────────────────────────────────────────────

function normalizeEpic(epic: EpicWithRelations, index: number): NormalizedItem {
  return {
    tempId: generateTempId("E", index),
    parentTempId: null,
    issueType: "Epic",
    sourceId: epic.id,
    code: epic.code,
    title: epic.title,
    description: epic.description,
    businessValue: epic.businessValue,
    acceptanceCriteria: epic.acceptanceCriteria,
    dependencies: epic.dependencies,
    priority: epic.impact, // Map impact to priority for epics
    effort: epic.effort,
    impact: epic.impact,
    theme: epic.theme,
    // MSS fields
    mssServiceLineName: epic.mssServiceArea?.serviceLine?.name ?? null,
    mssServiceAreaName: epic.mssServiceArea?.name ?? null,
  };
}

function normalizeStory(
  story: StoryWithSubtasks,
  index: number,
  parentTempId: string,
  epicCode: string,
  epicMssServiceArea?: MssServiceAreaWithLine | null
): NormalizedItem {
  // Story inherits MSS from epic if not directly assigned
  const effectiveMss = story.mssServiceArea ?? epicMssServiceArea;
  return {
    tempId: generateTempId("S", index),
    parentTempId,
    issueType: "Story",
    sourceId: story.id,
    code: story.code,
    epicCode,
    title: story.title,
    userStory: story.userStory,
    persona: story.persona,
    acceptanceCriteria: story.acceptanceCriteria,
    technicalNotes: story.technicalNotes,
    priority: story.priority,
    effort: story.effort,
    // MSS fields (own or inherited from epic)
    mssServiceLineName: effectiveMss?.serviceLine?.name ?? null,
    mssServiceAreaName: effectiveMss?.name ?? null,
  };
}

function normalizeSubtask(
  subtask: Subtask,
  index: number,
  parentTempId: string,
  epicCode: string,
  storyCode: string
): NormalizedItem {
  return {
    tempId: generateTempId("ST", index),
    parentTempId,
    issueType: "Sub-task",
    sourceId: subtask.id,
    code: subtask.code,
    epicCode,
    storyCode,
    title: subtask.title,
    description: subtask.description,
    effort: subtask.effort,
  };
}

// ─────────────────────────────────────────────────────────────────
// Main Normalization Function
// ─────────────────────────────────────────────────────────────────

/**
 * Normalizes extracted data into a flat list of items for export.
 * Items are ordered: Epic → Stories → Subtasks (depth-first)
 * This ensures parent rows appear before children in CSV.
 */
export function normalizeForExport(
  data: ExtractedData,
  includeSubtasks: boolean
): NormalizedItem[] {
  const items: NormalizedItem[] = [];

  let epicIndex = 1;
  let storyIndex = 1;
  let subtaskIndex = 1;

  for (const epic of data.epics) {
    // Add epic
    const epicItem = normalizeEpic(epic, epicIndex++);
    items.push(epicItem);

    // Add stories
    for (const story of epic.stories) {
      const storyItem = normalizeStory(
        story,
        storyIndex++,
        epicItem.tempId,
        epic.code,
        epic.mssServiceArea // Pass epic's MSS for inheritance
      );
      items.push(storyItem);

      // Add subtasks if included
      if (includeSubtasks) {
        for (const subtask of story.subtasks) {
          const subtaskItem = normalizeSubtask(
            subtask,
            subtaskIndex++,
            storyItem.tempId,
            epic.code,
            story.code
          );
          items.push(subtaskItem);
        }
      }
    }
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────

/**
 * Counts subtasks in the data without including them in export.
 * Used for warning when subtasks exist but are excluded.
 */
export function countSubtasks(data: ExtractedData): number {
  let count = 0;
  for (const epic of data.epics) {
    for (const story of epic.stories) {
      count += story.subtasks.length;
    }
  }
  return count;
}

/**
 * Validates hierarchy integrity.
 * Returns true if all parent references are valid.
 */
export function validateHierarchy(items: NormalizedItem[]): boolean {
  const ids = new Set(items.map((item) => item.tempId));

  for (const item of items) {
    if (item.parentTempId && !ids.has(item.parentTempId)) {
      return false;
    }
  }

  return true;
}
